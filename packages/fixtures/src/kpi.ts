import type { Person, Settings, WaitingReason, WoType, WorkOrder } from '@cmms/types'
import { PLANNED_WO_TYPES, WO_TYPES } from '@cmms/types'
import { nowMs } from './clock'
import { DAY, addMonths, monthKey, startOfDay, startOfMonth, startOfWeek, toMs, wib } from './dates'
import { fmtMonthShort } from './format'
import { type WoCost, ageDays, isActive, isDone, isOverdue, laborMinutes, woCost } from './wo'

export interface StatusCounts {
  draft: number
  open: number
  assigned: number
  inProgress: number
  waiting: number
  review: number
  overdue: number
  active: number
  pendingApproval: number
}

export function statusCounts(workOrders: readonly WorkOrder[], now = nowMs()): StatusCounts {
  const c: StatusCounts = { draft: 0, open: 0, assigned: 0, inProgress: 0, waiting: 0, review: 0, overdue: 0, active: 0, pendingApproval: 0 }
  for (const w of workOrders) {
    if (w.status === 'draft') c.draft++
    if (w.status === 'open') c.open++
    if (w.status === 'assigned') c.assigned++
    if (w.status === 'in_progress') c.inProgress++
    if (w.status === 'waiting') c.waiting++
    if (w.status === 'completed' || w.status === 'verified') c.review++
    if (isActive(w)) c.active++
    if (isOverdue(w, now)) c.overdue++
    if (w.approval?.status === 'pending') c.pendingApproval++
  }
  return c
}

export interface Period {
  key: string
  label: string
  from: number
  to: number
}

/** The last `count` calendar months, oldest first, the current month included. */
export function lastMonths(count: number, now = nowMs()): Period[] {
  const current = startOfMonth(now)
  return Array.from({ length: count }, (_, i) => {
    const from = addMonths(current, i - count + 1)
    return { key: monthKey(from), label: fmtMonthShort(from), from, to: addMonths(from, 1) }
  })
}

/** The last `count` ISO weeks, oldest first, the current week included. */
export function lastWeeks(count: number, now = nowMs()): Period[] {
  const current = startOfWeek(now)
  return Array.from({ length: count }, (_, i) => {
    const from = current - (count - 1 - i) * 7 * DAY
    const d = wib(from)
    return { key: `w${from}`, label: `${d.day}/${d.month + 1}`, from, to: from + 7 * DAY }
  })
}

export const inRange = (iso: string | null, from: number, to: number) => !!iso && toMs(iso) >= from && toMs(iso) < to

/** Work created in the window, by type. Cancelled work is left out. */
export function typeMix(workOrders: readonly WorkOrder[], from: number, to: number): Record<WoType, number> {
  const mix = Object.fromEntries(WO_TYPES.map((t) => [t, 0])) as Record<WoType, number>
  for (const w of workOrders) if (w.status !== 'cancelled' && inRange(w.requestedAt, from, to)) mix[w.type]++
  return mix
}

export function workShares(workOrders: readonly WorkOrder[], from: number, to: number) {
  const mix = typeMix(workOrders, from, to)
  const total = Object.values(mix).reduce((s, n) => s + n, 0)
  const planned = PLANNED_WO_TYPES.reduce((s, t) => s + mix[t], 0)
  return {
    total,
    planned,
    corrective: mix.corrective,
    emergency: mix.emergency,
    plannedShare: total ? planned / total : 0,
    correctiveShare: total ? mix.corrective / total : 0,
    emergencyShare: total ? mix.emergency / total : 0,
  }
}

const zeroCost = (): WoCost => ({ labor: 0, parts: 0, vendor: 0, misc: 0, total: 0 })
const addCost = (a: WoCost, b: WoCost): WoCost => ({
  labor: a.labor + b.labor,
  parts: a.parts + b.parts,
  vendor: a.vendor + b.vendor,
  misc: a.misc + b.misc,
  total: a.total + b.total,
})

/** Cost is booked when the work is completed; open work only carries estimates. */
const booked = (w: WorkOrder, from: number, to: number) => isDone(w) && inRange(w.completedAt, from, to)

export function costBetween(workOrders: readonly WorkOrder[], people: ReadonlyMap<string, Person>, from: number, to: number, now = nowMs()): WoCost {
  return workOrders.filter((w) => booked(w, from, to)).reduce((acc, w) => addCost(acc, woCost(w, people, now)), zeroCost())
}

export function costByPeriod(workOrders: readonly WorkOrder[], people: ReadonlyMap<string, Person>, periods: readonly Period[], now = nowMs()) {
  return periods.map((p) => ({ ...p, cost: costBetween(workOrders, people, p.from, p.to, now) }))
}

/** Total cost per group key (asset, area, type...) in the window, highest first. */
export function costBy(
  workOrders: readonly WorkOrder[],
  people: ReadonlyMap<string, Person>,
  from: number,
  to: number,
  keyOf: (w: WorkOrder) => string | null,
  now = nowMs(),
): { key: string; cost: number; count: number }[] {
  const acc = new Map<string, { cost: number; count: number }>()
  for (const w of workOrders) {
    if (!booked(w, from, to)) continue
    const k = keyOf(w)
    if (!k) continue
    const prev = acc.get(k) ?? { cost: 0, count: 0 }
    acc.set(k, { cost: prev.cost + woCost(w, people, now).total, count: prev.count + 1 })
  }
  return [...acc.entries()].map(([key, v]) => ({ key, ...v })).sort((a, b) => b.cost - a.cost)
}

/** Completed within the window divided by created within the window. */
export function completionRate(workOrders: readonly WorkOrder[], from: number, to: number) {
  const created = workOrders.filter((w) => w.status !== 'cancelled' && inRange(w.requestedAt, from, to)).length
  const completed = workOrders.filter((w) => inRange(w.completedAt, from, to)).length
  return { created, completed, ratio: created ? completed / created : 0 }
}

/** Scheduled work finished on its scheduled day. */
export function scheduleCompliance(workOrders: readonly WorkOrder[], from: number, to: number, now = nowMs()) {
  let scheduled = 0
  let kept = 0
  for (const w of workOrders) {
    if (!w.scheduledAt || w.status === 'cancelled' || !inRange(w.scheduledAt, from, Math.min(to, now))) continue
    scheduled++
    if (w.completedAt && toMs(w.completedAt) < startOfDay(toMs(w.scheduledAt)) + DAY) kept++
  }
  return { scheduled, kept, ratio: scheduled ? kept / scheduled : 1 }
}

// ─── Backlog & capacity ─────────────────────────────────────────

export interface BacklogRow {
  wo: WorkOrder
  ageDays: number
  manHours: number
  overdue: boolean
}

/** Remaining man-hours: the estimate minus logged time, never below a fifth of the estimate. */
export function remainingManHours(wo: WorkOrder, now = nowMs()): number {
  const crew = Math.max(1, wo.assigneeIds.length)
  const loggedPerHead = laborMinutes(wo, now) / crew
  return (Math.max(wo.estimatedMin - loggedPerHead, wo.estimatedMin * 0.2) * crew) / 60
}

/** Estimated man-hours that were still open at instant t, for backlog trends. */
export function backlogHoursAt(workOrders: readonly WorkOrder[], t: number): number {
  let hours = 0
  for (const w of workOrders) {
    if (w.status === 'cancelled' || toMs(w.requestedAt) > t) continue
    if (w.completedAt && toMs(w.completedAt) <= t) continue
    hours += (w.estimatedMin * Math.max(1, w.assigneeIds.length)) / 60
  }
  return hours
}

export function backlogRows(workOrders: readonly WorkOrder[], now = nowMs()): BacklogRow[] {
  return workOrders
    .filter(isActive)
    .map((wo) => ({ wo, ageDays: ageDays(wo, now), manHours: remainingManHours(wo, now), overdue: isOverdue(wo, now) }))
}

/** Hands-on hours per week the team can give to the backlog. */
export function weeklyCapacity(technicians: readonly Person[], settings: Settings): number {
  return technicians
    .filter((p) => p.technician && p.technician.availability !== 'leave')
    .reduce((s) => s + settings.weeklyHours * settings.wrenchTime, 0)
}

export function backlogSummary(rows: readonly BacklogRow[], capacityHours: number) {
  const manHours = rows.reduce((s, r) => s + r.manHours, 0)
  const byReason = {} as Partial<Record<WaitingReason, number>>
  for (const r of rows) if (r.wo.status === 'waiting' && r.wo.waitingReason) byReason[r.wo.waitingReason] = (byReason[r.wo.waitingReason] ?? 0) + 1
  return {
    count: rows.length,
    manHours,
    weeks: capacityHours ? manHours / capacityHours : 0,
    overdue: rows.filter((r) => r.overdue).length,
    waiting: rows.filter((r) => r.wo.status === 'waiting').length,
    byReason,
    ageBuckets: [
      { label: 'Under 3 days', count: rows.filter((r) => r.ageDays < 3).length },
      { label: '3 to 7 days', count: rows.filter((r) => r.ageDays >= 3 && r.ageDays < 7).length },
      { label: '1 to 3 weeks', count: rows.filter((r) => r.ageDays >= 7 && r.ageDays < 21).length },
      { label: 'Over 3 weeks', count: rows.filter((r) => r.ageDays >= 21).length },
    ],
  }
}

export interface TechnicianLoad {
  person: Person
  loggedMinutes: number
  jobsDone: number
  openJobs: number
  openManHours: number
  utilization: number
  clockedIn: boolean
}

/** Logged time, finished jobs and open load per technician in the window. */
export function technicianLoad(
  technicians: readonly Person[],
  workOrders: readonly WorkOrder[],
  settings: Settings,
  from: number,
  to: number,
  now = nowMs(),
): TechnicianLoad[] {
  const weeks = Math.max((Math.min(to, now) - from) / (7 * DAY), 1 / 7)
  return technicians.map((person) => {
    let loggedMinutes = 0
    let jobsDone = 0
    let openJobs = 0
    let openManHours = 0
    let clockedIn = false
    for (const w of workOrders) {
      for (const e of w.labor) {
        if (e.personId !== person.id) continue
        const start = Math.max(toMs(e.start), from)
        const end = Math.min(e.end ? toMs(e.end) : now, to)
        if (end > start) loggedMinutes += (end - start) / 60_000
        if (e.end === null) clockedIn = true
      }
      if (!w.assigneeIds.includes(person.id)) continue
      if (isDone(w) && inRange(w.completedAt, from, to)) jobsDone++
      if (isActive(w)) {
        openJobs++
        openManHours += remainingManHours(w, now) / Math.max(1, w.assigneeIds.length)
      }
    }
    return {
      person,
      loggedMinutes,
      jobsDone,
      openJobs,
      openManHours,
      utilization: loggedMinutes / 60 / (settings.weeklyHours * weeks),
      clockedIn,
    }
  })
}

