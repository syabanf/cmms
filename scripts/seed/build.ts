// Builders that turn compact specs into full work orders and requests.
import type {
  ApprovalLevel,
  Attachment,
  ChecklistItem,
  ExecutionType,
  MaintenanceRequest,
  OperationalImpact,
  PartLineStatus,
  Priority,
  RequestSource,
  RequestStatus,
  SafetyRequirement,
  Severity,
  TaskResult,
  WaitingReason,
  WoEvent,
  WoEventKind,
  WoStatus,
  WoTask,
  WoType,
  WorkOrder,
} from '../../packages/types/src/index.ts'
import { APPROVAL_LEVEL_LABEL, WAITING_REASON_LABEL } from '../../packages/types/src/index.ts'
import { evaluateItem } from '../../packages/fixtures/src/checklist.ts'
import { HOUR, MINUTE, toIso, wib } from '../../packages/fixtures/src/dates.ts'
import { A } from './assets.ts'
import { failureCodes, fcId, partId, parts, people, safetyDetail, sf } from './master.ts'
import { JP, pmId } from './plans.ts'
import { rng } from './rng.ts'
import { toolId } from './tools.ts'

export const NOW = Date.parse('2026-09-22T09:41:00+07:00')

export type Task = Omit<ChecklistItem, 'id'>

export interface LaborSpec {
  person: string
  start: number
  end: number | null
}

export interface PartSpec {
  code: string
  qty: number
  status: PartLineStatus
  wh?: string
}

export interface WoSpec {
  key: string
  asset: string
  title: string
  description?: string
  type: WoType
  priority: Priority
  status: WoStatus
  waitingReason?: WaitingReason
  waitingSince?: number
  waitingNote?: string
  request?: string
  pm?: string
  plan?: string
  team: string
  assignees: string[]
  requestedBy: string
  requestedAt: number
  assignedAt?: number
  assignedBy?: string
  scheduledAt?: number
  dueAt?: number
  startedAt?: number
  completedAt?: number
  verified?: { by: string; at: number; note?: string }
  closed?: { by: string; at: number }
  cancelled?: { by: string; at: number; note: string }
  estimatedMin: number
  execution?: ExecutionType
  vendor?: string
  vendorCost?: number
  miscCost?: number
  downtime?: boolean
  labor?: LaborSpec[]
  parts?: PartSpec[]
  toolCodes?: string[]
  requiredTools?: string[]
  failure?: { problem?: string; mode?: string; cause?: string; remedy?: string; note?: string }
  tasks?: Task[]
  /** How many checklist lines carry a result. Defaults to all once the work is completed. */
  done?: number
  values?: Record<number, TaskResult['value']>
  approval?: { level: ApprovalLevel; status: 'pending' | 'approved' | 'rejected'; reason: string; by?: string; at?: number; note?: string }
  safety?: SafetyRequirement
  safetyConfirmed?: { by: string; at: number } | false
  completionNote?: string
  photos?: number
  extraEvents?: { at: number; by: string | null; kind: WoEventKind; text: string }[]
}

export const SLA_HOURS: Record<Priority, number> = { P1: 4, P2: 24, P3: 72, P4: 168 }
const DONE: WoStatus[] = ['completed', 'verified', 'closed']

const personById = new Map(people.map((p) => [p.id, p]))
const nameOf = (id: string) => personById.get(id)?.name ?? id
const partByCode = new Map(parts.map((p) => [p.code, p]))
const codeName = new Map(failureCodes.map((f) => [f.code, f.name]))

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
function fmt(ms: number): string {
  const d = wib(ms)
  return `${String(d.day).padStart(2, '0')} ${MONTHS[d.month]} ${String(d.hours).padStart(2, '0')}:${String(d.minutes).padStart(2, '0')}`
}

function decimals(span: number): number {
  if (span < 0.05) return 3
  if (span < 1) return 2
  if (span < 30) return 1
  return 0
}

/** A plausible healthy reading for a checklist line. */
function normalValue(t: Task): TaskResult['value'] {
  switch (t.type) {
    case 'check':
      return true
    case 'passfail':
      return 'pass'
    case 'choice':
      return t.options?.[0] ?? null
    case 'measurement': {
      const upper = t.warnMax ?? t.max ?? null
      const lower = t.warnMin ?? t.min ?? null
      let lo: number
      let hi: number
      if (upper != null && lower != null) {
        lo = lower
        hi = upper
      } else if (upper != null) {
        lo = upper * 0.45
        hi = upper * 0.9
      } else if (lower != null) {
        lo = lower * 1.1
        hi = lower * 1.6
      } else {
        lo = 1
        hi = 10
      }
      const inner = lo + (hi - lo) * rng.float(0.2, 0.8)
      return rng.round(inner, decimals(hi - lo))
    }
    case 'number':
      return t.unit === '%' ? rng.int(55, 95) : rng.int(100, 900)
    case 'text':
      return `KN-26-${rng.int(10000, 99999)}`
    case 'photo':
      return 1
    case 'signature':
      return null
  }
}

function defaultSafety(team: string): SafetyRequirement {
  const build = (loto: boolean, hazards: string[], ppe: string[]): SafetyRequirement => ({
    loto,
    ...safetyDetail(loto, hazards.map(sf)),
    hazardIds: hazards.map(sf),
    ppeIds: ppe.map(sf),
    notes: '',
  })
  if (team.includes('elec')) return build(true, ['electrical'], ['egloves', 'glasses', 'shoes'])
  if (team.includes('utl')) return build(true, ['pressure', 'hot'], ['gloves', 'glasses', 'ear'])
  if (team.includes('inst')) return build(false, [], ['glasses'])
  return build(true, ['rotating'], ['glasses', 'gloves', 'shoes'])
}

const GENERIC_TASKS: Task[] = [
  { label: 'Isolate and make the machine safe', type: 'check', required: true },
  { label: 'Find and fix the cause of the failure', type: 'check', required: true },
  { label: 'Test run after repair', type: 'passfail', required: true },
]

/** Drop null and undefined fields so optional checklist limits stay out of the JSON. */
function withoutNulls<T extends object>(o: T): T {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== null && v !== undefined)) as T
}

let attachmentSeq = 0
function photoAttachments(count: number, at: number, by: string): Attachment[] {
  return Array.from({ length: count }, () => ({
    id: `att-${String(++attachmentSeq).padStart(4, '0')}`,
    kind: 'photo' as const,
    stage: null,
    name: `IMG_${2000 + ((attachmentSeq * 37) % 7000)}.jpg`,
    url: null,
    at: toIso(at),
    by,
  }))
}

export function buildWo(s: WoSpec): WorkOrder {
  const asset = A(s.asset)
  const plan = s.plan ? JP(s.plan) : null
  const taskDefs: Task[] = s.tasks ?? plan?.tasks.map(({ id: _id, ...t }) => t) ?? (s.type === 'corrective' || s.type === 'emergency' ? GENERIC_TASKS : [])
  const lead = s.assignees[0] ?? null
  const workEnd = s.completedAt ?? s.waitingSince ?? (s.status === 'in_progress' ? NOW : undefined)
  const doneCount = s.done ?? (DONE.includes(s.status) ? taskDefs.length : 0)

  const tasks: WoTask[] = taskDefs.map((def, i) => {
    const t = withoutNulls(def)
    const id = `t${i + 1}`
    if (i >= doneCount || !lead || s.startedAt === undefined || workEnd === undefined) return { ...t, id, result: null }
    let value = s.values?.[i] !== undefined ? s.values[i]! : normalValue(t)
    if (t.type === 'signature') value = nameOf(lead)
    const at = s.startedAt + ((workEnd - s.startedAt) * (i + 1)) / (taskDefs.length + 1)
    return {
      ...t,
      id,
      result: {
        value,
        outcome: evaluateItem({ ...t, id }, value),
        at: toIso(at),
        by: lead,
        note: '',
        photos: t.type === 'photo' ? [''] : [],
      },
    }
  })

  const laborSpecs: LaborSpec[] =
    s.labor ??
    (s.startedAt !== undefined
      ? s.assignees.map((p, i) => ({
          person: p,
          start: s.startedAt! + i * rng.int(2, 12) * MINUTE,
          end: s.completedAt ?? s.waitingSince ?? null,
        }))
      : [])

  const events: WoEvent[] = []
  const push = (at: number, by: string | null, kind: WoEventKind, text: string) =>
    events.push({ id: '', at: toIso(at), by, kind, text })

  push(
    s.requestedAt,
    s.requestedBy,
    'created',
    s.pm ? `Generated from ${s.pm} ${plan ? `(${plan.code})` : ''}`.trim() : s.request ? `Created from {mr:${s.request}}` : 'Work order created',
  )
  if (s.approval) {
    push(s.requestedAt + MINUTE, null, 'approval', `${APPROVAL_LEVEL_LABEL[s.approval.level]} requested. ${s.approval.reason}`)
    if (s.approval.status !== 'pending' && s.approval.by && s.approval.at) {
      push(
        s.approval.at,
        s.approval.by,
        'approval',
        s.approval.status === 'approved' ? `Approved${s.approval.note ? `: ${s.approval.note}` : ''}` : `Rejected: ${s.approval.note ?? ''}`,
      )
    }
  }
  const assignedAt = s.assignedAt ?? (s.assignees.length ? s.requestedAt + 20 * MINUTE : undefined)
  if (assignedAt !== undefined && s.assignees.length) {
    push(assignedAt, s.assignedBy ?? null, 'assigned', `Assigned to ${s.assignees.map(nameOf).join(', ')}`)
  }
  if (s.scheduledAt !== undefined) push((assignedAt ?? s.requestedAt) + MINUTE, s.assignedBy ?? null, 'scheduled', `Scheduled for ${fmt(s.scheduledAt)}`)

  for (const p of s.parts ?? []) {
    const part = partByCode.get(p.code)!
    const qtyText = `${p.qty} ${part.unit} ${part.code}`
    if (p.status === 'reserved') {
      push(s.requestedAt + 10 * MINUTE, s.assignedBy ?? null, 'part', `Reserved ${qtyText}`)
    } else {
      const issuedAt = (s.startedAt ?? s.requestedAt) + 5 * MINUTE
      push(issuedAt, 'per-sari', 'part', `Issued ${qtyText}`)
      if (p.status === 'consumed' && s.completedAt) push(s.completedAt - 10 * MINUTE, lead, 'part', `Used ${qtyText}`)
      if (p.status === 'returned' && s.completedAt) push(s.completedAt, lead, 'part', `Returned ${qtyText}`)
    }
  }

  const safety = s.safety ?? plan?.safety ?? defaultSafety(s.team)
  const needsConfirm = safety.loto || safety.ppeIds.length > 0
  const confirmed =
    s.safetyConfirmed === false || s.startedAt === undefined || !needsConfirm || !lead
      ? null
      : (s.safetyConfirmed ?? { by: lead, at: s.startedAt - 3 * MINUTE })
  if (confirmed) push(confirmed.at, confirmed.by, 'safety', safety.loto ? 'Safety confirmed: LOTO applied, PPE checked' : 'Safety confirmed: PPE checked')
  if (s.startedAt !== undefined) push(s.startedAt, lead, 'status', 'Work started')
  for (const l of laborSpecs) {
    if (s.labor && l.start !== s.startedAt) push(l.start, l.person, 'labor', `${nameOf(l.person)} clocked in`)
  }
  if (s.waitingSince !== undefined && s.waitingReason) {
    push(s.waitingSince, lead, 'status', `Waiting: ${WAITING_REASON_LABEL[s.waitingReason]}${s.waitingNote ? `. ${s.waitingNote}` : ''}`)
  }
  if (s.failure?.mode) {
    const at = (s.completedAt ?? s.waitingSince ?? NOW) - 4 * MINUTE
    push(at, lead, 'failure', `Failure coded: ${codeName.get(s.failure.mode)}${s.failure.cause ? ` / ${codeName.get(s.failure.cause)}` : ''}`)
  }
  if (s.completedAt !== undefined) push(s.completedAt, lead, 'status', 'Marked complete')
  if (s.verified) push(s.verified.at, s.verified.by, 'status', `Verified${s.verified.note ? `: ${s.verified.note}` : ''}`)
  if (s.closed) push(s.closed.at, s.closed.by, 'status', 'Closed')
  if (s.cancelled) push(s.cancelled.at, s.cancelled.by, 'status', `Cancelled: ${s.cancelled.note}`)
  for (const e of s.extraEvents ?? []) push(e.at, e.by, e.kind, e.text)
  events.sort((a, b) => a.at.localeCompare(b.at))
  events.forEach((e, i) => (e.id = `e${i + 1}`))

  const dueAt = s.dueAt ?? s.requestedAt + SLA_HOURS[s.priority] * HOUR

  return {
    id: s.key,
    code: '',
    siteId: asset.siteId,
    assetId: asset.id,
    title: s.title,
    description: s.description ?? '',
    type: s.type,
    priority: s.priority,
    status: s.status,
    waitingReason: s.status === 'waiting' ? (s.waitingReason ?? null) : null,
    requestId: s.request ?? null,
    pmScheduleId: s.pm ? pmId(s.pm) : null,
    jobPlanId: plan?.id ?? null,
    teamId: s.team,
    assigneeIds: s.assignees,
    requestedBy: s.requestedBy,
    requestedAt: toIso(s.requestedAt),
    scheduledAt: s.scheduledAt !== undefined ? toIso(s.scheduledAt) : null,
    dueAt: toIso(dueAt),
    startedAt: s.startedAt !== undefined ? toIso(s.startedAt) : null,
    completedAt: s.completedAt !== undefined ? toIso(s.completedAt) : null,
    closedAt: s.closed ? toIso(s.closed.at) : null,
    estimatedMin: s.estimatedMin,
    execution: s.execution ?? (s.vendor ? 'vendor' : 'internal'),
    vendorId: s.vendor ?? null,
    downtime: s.downtime ?? false,
    safety: { ...safety, confirmedBy: confirmed?.by ?? null, confirmedAt: confirmed ? toIso(confirmed.at) : null },
    tasks,
    labor: laborSpecs.map((l, i) => ({
      id: `l${i + 1}`,
      personId: l.person,
      start: toIso(l.start),
      end: l.end === null ? null : toIso(l.end),
    })),
    parts: (s.parts ?? []).map((p, i) => ({
      id: `p${i + 1}`,
      partId: partId(p.code),
      warehouseId: p.wh ?? (asset.siteId === 'site-ckr' ? 'wh-ckr-c1' : 'wh-bdg-a'),
      qty: p.qty,
      status: p.status,
      unitCost: partByCode.get(p.code)!.unitCost,
    })),
    requiredTools: s.requiredTools ?? plan?.toolCategories ?? [],
    toolIds: (s.toolCodes ?? []).map(toolId),
    failure: s.failure
      ? {
          problemId: s.failure.problem ? fcId(s.failure.problem) : null,
          modeId: s.failure.mode ? fcId(s.failure.mode) : null,
          causeId: s.failure.cause ? fcId(s.failure.cause) : null,
          remedyId: s.failure.remedy ? fcId(s.failure.remedy) : null,
          note: s.failure.note ?? '',
        }
      : null,
    vendorCost: s.vendorCost ?? 0,
    miscCost: s.miscCost ?? 0,
    approval: s.approval
      ? {
          level: s.approval.level,
          status: s.approval.status,
          reason: s.approval.reason,
          decidedBy: s.approval.by ?? null,
          decidedAt: s.approval.at !== undefined ? toIso(s.approval.at) : null,
          note: s.approval.note ?? '',
        }
      : null,
    verification: s.verified ? { by: s.verified.by, at: toIso(s.verified.at), note: s.verified.note ?? '' } : null,
    attachments: s.photos && lead ? photoAttachments(s.photos, s.completedAt ?? s.startedAt ?? s.requestedAt, lead) : [],
    events,
    signature: null,
    completionNote: s.completionNote ?? '',
  }
}

export interface MrSpec {
  key: string
  asset: string
  title: string
  description?: string
  severity: Severity
  impact?: OperationalImpact
  status: RequestStatus
  source?: RequestSource
  reportedBy: string
  reportedAt: number
  wo?: string
  duplicateOf?: string
  inspectionWo?: string
  triageNote?: string
  triagedBy?: string
  triagedAt?: number
  photos?: number
}

export function buildMr(s: MrSpec): MaintenanceRequest {
  const asset = A(s.asset)
  return {
    id: s.key,
    code: '',
    siteId: asset.siteId,
    assetId: asset.id,
    title: s.title,
    description: s.description ?? '',
    severity: s.severity,
    impact: s.impact ?? (s.severity === 'critical' ? 'stopped' : s.severity === 'high' ? 'reduced' : 'none'),
    status: s.status,
    source: s.source ?? 'operator',
    reportedBy: s.reportedBy,
    reportedAt: toIso(s.reportedAt),
    attachments: s.photos ? photoAttachments(s.photos, s.reportedAt, s.reportedBy) : [],
    woId: s.wo ?? null,
    duplicateOfId: s.duplicateOf ?? null,
    inspectionWoId: s.inspectionWo ?? null,
    triageNote: s.triageNote ?? '',
    triagedBy: s.triagedBy ?? null,
    triagedAt: s.triagedAt !== undefined ? toIso(s.triagedAt) : null,
    events:
      s.triagedBy && s.triagedAt !== undefined ? [{ id: 'r1', at: toIso(s.triagedAt), by: s.triagedBy, status: s.status, note: s.triageNote ?? '' }] : [],
  }
}

export const severityFor = (p: Priority): Severity =>
  p === 'P1' ? 'critical' : p === 'P2' ? 'high' : p === 'P3' ? 'medium' : 'low'
