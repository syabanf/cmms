import type { ApprovalLevel, Asset, Person, Settings, WoStatus, WorkOrder } from '@cmms/types'
import { ACTIVE_WO_STATUSES, DONE_WO_STATUSES, FAILURE_WO_TYPES, PRIORITY_LABEL } from '@cmms/types'
import { nowMs } from './clock'
import { DAY, HOUR, MINUTE, toMs } from './dates'
import { fmtIdrShort } from './format'

export const DEFAULT_HOURLY_COST = 70_000

export const isActive = (wo: WorkOrder) => ACTIVE_WO_STATUSES.includes(wo.status)
export const isDone = (wo: WorkOrder) => DONE_WO_STATUSES.includes(wo.status)
export const isFailureWork = (wo: WorkOrder) => FAILURE_WO_TYPES.includes(wo.type)

export function isOverdue(wo: WorkOrder, now = nowMs()): boolean {
  return isActive(wo) && toMs(wo.dueAt) < now
}

/** Minutes between due and now; negative while there is time left. */
export const minutesPastDue = (wo: WorkOrder, now = nowMs()) => (now - toMs(wo.dueAt)) / MINUTE

export const ageDays = (wo: WorkOrder, now = nowMs()) => (now - toMs(wo.requestedAt)) / DAY

export type SlaState = 'on_track' | 'due_soon' | 'overdue' | 'met' | 'missed'

export function slaState(wo: WorkOrder, now = nowMs()): SlaState {
  const due = toMs(wo.dueAt)
  if (wo.completedAt) return toMs(wo.completedAt) <= due ? 'met' : 'missed'
  if (wo.status === 'cancelled') return 'met'
  if (now > due) return 'overdue'
  const window = due - toMs(wo.requestedAt)
  return due - now < Math.max(2 * HOUR, window * 0.25) ? 'due_soon' : 'on_track'
}

export function laborEntryMinutes(entry: { start: string; end: string | null }, now = nowMs()): number {
  return Math.max(0, ((entry.end ? toMs(entry.end) : now) - toMs(entry.start)) / MINUTE)
}

export function laborMinutes(wo: WorkOrder, now = nowMs()): number {
  return wo.labor.reduce((sum, e) => sum + laborEntryMinutes(e, now), 0)
}

export const runningLabor = (wo: WorkOrder) => wo.labor.filter((e) => e.end === null)
export const isClockedIn = (wo: WorkOrder, personId: string) => wo.labor.some((e) => e.personId === personId && e.end === null)

const hourlyCost = (personId: string, people: ReadonlyMap<string, Person>) =>
  people.get(personId)?.technician?.hourlyCost ?? DEFAULT_HOURLY_COST

export interface WoCost {
  labor: number
  parts: number
  vendor: number
  misc: number
  total: number
}

export function woCost(wo: WorkOrder, people: ReadonlyMap<string, Person>, now = nowMs()): WoCost {
  const labor = wo.labor.reduce((sum, e) => sum + (laborEntryMinutes(e, now) / 60) * hourlyCost(e.personId, people), 0)
  const parts = wo.parts
    .filter((l) => l.status === 'issued' || l.status === 'consumed')
    .reduce((sum, l) => sum + l.qty * l.unitCost, 0)
  const vendor = wo.vendorCost
  const misc = wo.miscCost
  return { labor, parts, vendor, misc, total: labor + parts + vendor + misc }
}

/** Cost used by the approval rule: planned parts plus vendor and other costs. */
export function estimatedCost(wo: WorkOrder): number {
  const parts = wo.parts.filter((l) => l.status !== 'returned').reduce((sum, l) => sum + l.qty * l.unitCost, 0)
  return parts + wo.vendorCost + wo.miscCost
}

export function approvalFor(wo: WorkOrder, settings: Settings): { level: ApprovalLevel; reason: string } | null {
  const estimate = estimatedCost(wo)
  if (estimate > settings.managerApprovalAbove) {
    return {
      level: 'manager',
      reason: `Estimated cost ${fmtIdrShort(estimate)} is above ${fmtIdrShort(settings.managerApprovalAbove)}.`,
    }
  }
  const rule = settings.approvalByPriority[wo.priority]
  if (rule === 'auto') return null
  return { level: rule, reason: `${wo.priority} ${PRIORITY_LABEL[wo.priority]} work orders need ${rule} approval.` }
}

export const needsVerification = (asset: Asset | undefined, settings: Settings) =>
  !!asset && settings.verifyCriticalities.includes(asset.criticality)

/** Hands-on repair time in hours for MTTR: the union of labor intervals, so waiting gaps drop out. */
export function repairHours(wo: WorkOrder): number | null {
  if (!wo.startedAt || !wo.completedAt) return null
  const spans = wo.labor
    .filter((e) => e.end !== null)
    .map((e) => [toMs(e.start), toMs(e.end!)] as const)
    .sort((a, b) => a[0] - b[0])
  if (!spans.length) return (toMs(wo.completedAt) - toMs(wo.startedAt)) / HOUR
  let covered = 0
  let [start, end] = spans[0]!
  for (const [s, e] of spans.slice(1)) {
    if (s <= end) end = Math.max(end, e)
    else {
      covered += end - start
      start = s
      end = e
    }
  }
  return (covered + end - start) / HOUR
}

/** Hours the asset was down: from the report until the work was completed. */
export function downtimeHours(wo: WorkOrder, now = nowMs()): number {
  if (!wo.downtime) return 0
  const end = wo.completedAt ? toMs(wo.completedAt) : now
  return Math.max(0, (end - toMs(wo.requestedAt)) / HOUR)
}

/** The date a work order sits on in lists and the calendar. */
export const plannedAt = (wo: WorkOrder) => wo.scheduledAt ?? wo.dueAt

export type WoTransition = 'approve' | 'reject' | 'assign' | 'start' | 'wait' | 'resume' | 'complete' | 'verify' | 'close' | 'reopen' | 'cancel'

/** Status moves that make sense from the current status. Permissions are checked by the caller. */
export function transitionsFor(wo: WorkOrder, verificationNeeded: boolean): WoTransition[] {
  const map: Record<WoStatus, WoTransition[]> = {
    draft: wo.approval?.status === 'pending' ? ['approve', 'reject', 'cancel'] : ['cancel'],
    open: ['assign', 'start', 'cancel'],
    assigned: ['start', 'assign', 'cancel'],
    in_progress: ['complete', 'wait', 'assign', 'cancel'],
    waiting: ['resume', 'assign', 'cancel'],
    completed: verificationNeeded ? ['verify', 'reopen'] : ['close', 'reopen'],
    verified: ['close', 'reopen'],
    closed: [],
    cancelled: [],
  }
  return map[wo.status]
}

/** Sort key: overdue and urgent first, then by due date. */
export function urgency(wo: WorkOrder, now = nowMs()): number {
  const priorityWeight = { P1: 0, P2: 1, P3: 2, P4: 3 }[wo.priority]
  const overdue = isOverdue(wo, now) ? 0 : 1
  return overdue * 1e13 + priorityWeight * 1e12 + toMs(wo.dueAt)
}
