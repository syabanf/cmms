import type {
  Asset,
  CapaAction,
  Criticality,
  IsoDate,
  JobPlan,
  Location,
  MaintenanceRequest,
  OperationalImpact,
  Part,
  Person,
  PmSchedule,
  Priority,
  Rca,
  Role,
  Settings,
  Severity,
  Tool,
  Vendor,
  WoTask,
  WorkOrder,
} from '@cmms/types'
import { HOUR, addDays, startOfDay, toIso, toMs } from './dates'
import { newId, nextCode, nextYearCode } from './ids'

// ─── Codes ──────────────────────────────────────────────────────

export const nextWoCode = (workOrders: readonly WorkOrder[], at: IsoDate) =>
  nextYearCode(workOrders.map((w) => w.code), 'WO', Number(at.slice(0, 4)), 6)
export const nextMrCode = (requests: readonly MaintenanceRequest[]) =>
  nextCode(requests.map((r) => r.code), 'MR-', 6)
export const nextRcaCode = (rcas: readonly Rca[], at: IsoDate) => nextCode(rcas.map((r) => r.code), `RCA-${at.slice(0, 4)}-`, 3)
export const nextPmCode = (pms: readonly PmSchedule[]) => nextCode(pms.map((p) => p.code), 'PM-', 4)
export const nextJobPlanCode = (plans: readonly JobPlan[], group: string) =>
  nextCode(plans.map((p) => p.code), `JP-${group}-`, 3)

// ─── Priority ───────────────────────────────────────────────────

const SEVERITY_SCORE: Record<Severity, number> = { low: 1, medium: 2, high: 3, critical: 4 }
const CRITICALITY_SCORE: Record<Criticality, number> = { A: 4, B: 3, C: 2, D: 1 }
const IMPACT_SCORE: Record<OperationalImpact, number> = { none: 0, reduced: 1, stopped: 3 }

/** Priority from asset criticality + issue severity + operational impact. */
export function suggestPriority(severity: Severity, criticality: Criticality, impact: OperationalImpact): Priority {
  const score = SEVERITY_SCORE[severity] + CRITICALITY_SCORE[criticality] + IMPACT_SCORE[impact]
  if (score >= 9 || (impact === 'stopped' && criticality === 'A')) return 'P1'
  if (score >= 7) return 'P2'
  if (score >= 4) return 'P3'
  return 'P4'
}

export const dueFromSla = (requestedAt: IsoDate, priority: Priority, settings: Settings): IsoDate =>
  toIso(toMs(requestedAt) + settings.slaHours[priority] * HOUR)

// ─── Work orders ────────────────────────────────────────────────

export function emptyWorkOrder(siteId: string, by: string, at: IsoDate, settings: Settings): WorkOrder {
  return {
    id: newId('wo'),
    code: '',
    siteId,
    assetId: '',
    title: '',
    description: '',
    type: 'corrective',
    priority: 'P3',
    status: 'open',
    waitingReason: null,
    requestId: null,
    pmScheduleId: null,
    jobPlanId: null,
    teamId: '',
    assigneeIds: [],
    requestedBy: by,
    requestedAt: at,
    scheduledAt: null,
    dueAt: dueFromSla(at, 'P3', settings),
    startedAt: null,
    completedAt: null,
    closedAt: null,
    estimatedMin: 60,
    execution: 'internal',
    vendorId: null,
    downtime: false,
    safety: { loto: false, ppeIds: [], hazardIds: [], notes: '', confirmedBy: null, confirmedAt: null },
    tasks: [],
    labor: [],
    parts: [],
    requiredTools: [],
    toolIds: [],
    failure: null,
    vendorCost: 0,
    miscCost: 0,
    approval: null,
    verification: null,
    attachments: [],
    events: [],
    signature: null,
    completionNote: '',
  }
}

/** Copy a job plan's checklist, parts, tools, safety and estimate onto a work order. */
export function applyJobPlan(wo: WorkOrder, plan: JobPlan, parts: ReadonlyMap<string, Part>, warehouseId: string): WorkOrder {
  const tasks: WoTask[] = plan.tasks.map((t, i) => ({ ...t, id: `t${i + 1}`, result: null }))
  return {
    ...wo,
    jobPlanId: plan.id,
    type: plan.woType,
    title: wo.title || plan.name,
    estimatedMin: plan.durationMin,
    requiredTools: [...plan.toolCategories],
    safety: { ...plan.safety, ppeIds: [...plan.safety.ppeIds], hazardIds: [...plan.safety.hazardIds], confirmedBy: null, confirmedAt: null },
    tasks,
    parts: plan.parts.map((p, i) => ({
      id: `p${i + 1}`,
      partId: p.partId,
      warehouseId,
      qty: p.qty,
      status: 'reserved',
      unitCost: parts.get(p.partId)?.unitCost ?? 0,
    })),
  }
}

export function workOrderFromRequest(
  request: MaintenanceRequest,
  asset: Asset,
  settings: Settings,
  by: string,
  at: IsoDate,
): WorkOrder {
  const priority = suggestPriority(request.severity, asset.criticality, request.impact)
  const emergency = priority === 'P1' && request.impact === 'stopped'
  return {
    ...emptyWorkOrder(asset.siteId, by, at, settings),
    assetId: asset.id,
    title: request.title,
    description: request.description,
    type: emergency ? 'emergency' : 'corrective',
    priority,
    requestId: request.id,
    teamId: asset.teamId,
    dueAt: dueFromSla(at, priority, settings),
    downtime: request.impact === 'stopped',
    estimatedMin: 120,
  }
}

export function workOrderFromPm(
  pm: PmSchedule,
  plan: JobPlan,
  asset: Asset,
  parts: ReadonlyMap<string, Part>,
  warehouseId: string,
  dueAt: number,
  settings: Settings,
  by: string,
  at: IsoDate,
): WorkOrder {
  const base: WorkOrder = {
    ...emptyWorkOrder(asset.siteId, by, at, settings),
    assetId: asset.id,
    title: plan.name,
    priority: 'P3',
    pmScheduleId: pm.id,
    teamId: pm.teamId,
    assigneeIds: pm.assigneeId ? [pm.assigneeId] : [],
    dueAt: toIso(Math.max(startOfDay(dueAt), startOfDay(toMs(at))) + 17 * HOUR),
    scheduledAt: toIso(Math.max(startOfDay(dueAt), startOfDay(toMs(at))) + 8 * HOUR),
  }
  return applyJobPlan(base, plan, parts, warehouseId)
}

// ─── Requests ───────────────────────────────────────────────────

export function emptyRequest(siteId: string, by: string, at: IsoDate): MaintenanceRequest {
  return {
    id: newId('mr'),
    code: '',
    siteId,
    assetId: '',
    title: '',
    description: '',
    severity: 'medium',
    impact: 'none',
    status: 'new',
    source: 'operator',
    reportedBy: by,
    reportedAt: at,
    attachments: [],
    woId: null,
    duplicateOfId: null,
    inspectionWoId: null,
    triageNote: '',
    triagedBy: null,
    triagedAt: null,
  }
}

// ─── Master data ────────────────────────────────────────────────

export function emptyAsset(siteId: string, at: IsoDate): Asset {
  return {
    id: '',
    code: '',
    name: '',
    siteId,
    locationId: '',
    parentId: null,
    typeId: '',
    manufacturer: '',
    model: '',
    serialNumber: '',
    installedAt: at,
    criticality: 'C',
    scores: { production: 3, safety: 2, quality: 2, replacementCost: 2, redundancy: 3 },
    costCenterId: '',
    teamId: '',
    status: 'operational',
    warranty: null,
    calibration: null,
    specs: [],
    notes: '',
  }
}

export const criticalityTotal = (s: Asset['scores']) => s.production + s.safety + s.quality + s.replacementCost + s.redundancy

/** Class from the five scores: 18+ A, 14+ B, 10+ C, else D (brainstorm section 6). */
export function criticalityFromScores(s: Asset['scores']): Criticality {
  const total = criticalityTotal(s)
  if (total >= 18) return 'A'
  if (total >= 14) return 'B'
  if (total >= 10) return 'C'
  return 'D'
}

export function emptyJobPlan(at: IsoDate): JobPlan {
  return {
    id: '',
    code: '',
    name: '',
    description: '',
    woType: 'preventive',
    assetTypeIds: [],
    durationMin: 60,
    skillId: 'skl-mech',
    skillLevel: 2,
    personnel: 1,
    toolCategories: [],
    parts: [],
    safety: { loto: false, ppeIds: [], hazardIds: [], notes: '' },
    tasks: [],
    acceptance: '',
    sop: '',
    revision: 1,
    updatedAt: at,
    active: true,
  }
}

export function emptyPm(siteId: string, at: IsoDate): PmSchedule {
  return {
    id: '',
    code: '',
    name: '',
    siteId,
    assetId: '',
    jobPlanId: '',
    trigger: { kind: 'calendar', every: 1, unit: 'month' },
    lastDoneAt: at,
    lastDoneMeter: null,
    leadDays: 3,
    teamId: '',
    assigneeId: null,
    active: true,
  }
}

export function emptyPart(): Part {
  return {
    id: '',
    code: '',
    name: '',
    category: 'mechanical',
    unit: 'pcs',
    unitCost: 0,
    min: 1,
    max: 4,
    reorderQty: 2,
    leadTimeDays: 7,
    vendorId: null,
    manufacturer: '',
    spec: '',
    critical: false,
  }
}

export function emptyTool(siteId: string): Tool {
  return {
    id: '',
    code: '',
    name: '',
    category: '',
    siteId,
    location: '',
    serialNumber: '',
    status: 'available',
    condition: 'good',
    calibration: null,
    holderId: null,
    woId: null,
  }
}

export function emptyVendor(at: IsoDate): Vendor {
  return {
    id: '',
    name: '',
    serviceTypes: [],
    pic: '',
    phone: '',
    email: '',
    contractNo: '',
    contractStart: at,
    contractEnd: toIso(addDays(toMs(at), 365)),
    slaHours: 24,
    hourlyRate: 0,
    rating: 4,
  }
}

export function emptyPerson(siteId: string, role: Role = 'technician', teamId = ''): Person {
  return {
    id: '',
    name: '',
    title: '',
    role,
    email: '',
    phone: '',
    color: '#475569',
    siteIds: [siteId],
    technician:
      role === 'technician'
        ? { teamId, shift: 'A', hourlyCost: 70_000, skills: {}, certifications: [], authorizations: [], availability: 'on_shift' }
        : null,
  }
}

export function emptyLocation(siteId: string, parentId: string | null): Location {
  return { id: '', siteId, parentId, kind: parentId ? 'area' : 'plant', code: '', name: '' }
}

export function emptyRca(siteId: string, by: string, at: IsoDate): Rca {
  return {
    id: '',
    code: '',
    siteId,
    title: '',
    assetId: '',
    modeId: null,
    trigger: 'repeat',
    status: 'open',
    ownerId: by,
    createdAt: at,
    dueAt: toIso(addDays(toMs(at), 21)),
    closedAt: null,
    woIds: [],
    problem: '',
    whys: [],
    rootCause: '',
    fishbone: { man: [], machine: [], method: [], material: [], measurement: [], environment: [] },
    actions: [],
  }
}

export function emptyCapa(ownerId: string, at: IsoDate): CapaAction {
  return { id: newId('capa'), kind: 'preventive', text: '', ownerId, dueAt: toIso(addDays(toMs(at), 14)), status: 'open', doneAt: null }
}
