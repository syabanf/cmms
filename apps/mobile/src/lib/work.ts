import { DAY, isActive, plannedAt, startOfDay, toMs, urgency } from '@cmms/fixtures'
import type { WorkOrder } from '@cmms/types'

export type WorkTab = 'todo' | 'doing' | 'done'

export const WORK_TABS: { value: WorkTab; label: string }[] = [
  { value: 'todo', label: 'To do' },
  { value: 'doing', label: 'Doing' },
  { value: 'done', label: 'Done' },
]

/** Finished work stays on the phone this long after completion. */
const DONE_WINDOW_DAYS = 14

/** The list tab a work order sits in; null for drafts, cancelled work and older completions. */
export function workTab(wo: WorkOrder, now: number): WorkTab | null {
  switch (wo.status) {
    case 'open':
    case 'assigned':
      return 'todo'
    case 'in_progress':
    case 'waiting':
      return 'doing'
    case 'completed':
    case 'verified':
    case 'closed':
      return wo.completedAt && now - toMs(wo.completedAt) <= DONE_WINDOW_DAYS * DAY ? 'done' : null
    default:
      return null
  }
}

export type TypeFilter = 'all' | 'corrective' | 'preventive' | 'inspection' | 'calibration'

export const TYPE_FILTERS: { value: TypeFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'corrective', label: 'Corrective' },
  { value: 'preventive', label: 'PM' },
  { value: 'inspection', label: 'Inspection' },
  { value: 'calibration', label: 'Calibration' },
]

export const isTypeFilter = (value: string | null): value is TypeFilter => TYPE_FILTERS.some((f) => f.value === value)

/** Corrective covers breakdown work of any urgency, emergencies included. */
export function matchesType(wo: WorkOrder, filter: TypeFilter): boolean {
  if (filter === 'all') return true
  if (filter === 'corrective') return wo.type === 'corrective' || wo.type === 'emergency'
  return wo.type === filter
}

/** Any lock-out, PPE or hazard on the job makes safety a gate before the work starts. */
export const needsSafety = (wo: WorkOrder) => wo.safety.loto || wo.safety.ppeIds.length > 0 || wo.safety.hazardIds.length > 0

/** The job has a safety gate that nobody has confirmed yet. */
export const safetyPending = (wo: WorkOrder) => needsSafety(wo) && !wo.safety.confirmedBy

export const byUrgency = (now: number) => (a: WorkOrder, b: WorkOrder) => urgency(a, now) - urgency(b, now)

export const byPlannedTime = (a: WorkOrder, b: WorkOrder) => toMs(plannedAt(a)) - toMs(plannedAt(b))

/** Today's jobs: active work planned for today or already late, plus work finished today. */
export function todaysWork(workOrders: readonly WorkOrder[], now: number): WorkOrder[] {
  const start = startOfDay(now)
  const end = start + DAY
  return workOrders.filter((wo) =>
    isActive(wo) ? wo.status !== 'draft' && toMs(plannedAt(wo)) < end : !!wo.completedAt && toMs(wo.completedAt) >= start,
  )
}
