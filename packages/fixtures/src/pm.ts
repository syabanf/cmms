import type { Meter, PmSchedule, WorkOrder } from '@cmms/types'
import { INTERVAL_UNIT_LABEL } from '@cmms/types'
import { nowMs } from './clock'
import { DAY, addInterval, intervalDays, startOfDay, toMs } from './dates'
import { fmtNumber } from './format'
import { isActive } from './wo'

export type PmState = 'scheduled' | 'due_soon' | 'due' | 'overdue'

export interface PmDue {
  dueAt: number
  dueBy: 'calendar' | 'meter'
  calendarDueAt: number | null
  meterDueAt: number | null
  meterDueValue: number | null
  meterRemaining: number | null
  daysLeft: number
  state: PmState
}

export function pmDue(pm: PmSchedule, meters: ReadonlyMap<string, Meter>, now = nowMs()): PmDue {
  const t = pm.trigger
  const last = toMs(pm.lastDoneAt)
  let calendarDueAt: number | null = null
  let meterDueAt: number | null = null
  let meterDueValue: number | null = null
  let meterRemaining: number | null = null

  if (t.kind === 'calendar' || t.kind === 'combined') calendarDueAt = addInterval(last, t.every, t.unit)
  if (t.kind === 'meter' || t.kind === 'combined') {
    const meter = meters.get(t.meterId)
    const every = t.kind === 'meter' ? t.every : t.meterEvery
    if (meter) {
      meterDueValue = (pm.lastDoneMeter ?? meter.value) + every
      meterRemaining = meterDueValue - meter.value
      meterDueAt = now + (meterRemaining / Math.max(meter.dailyRate, 0.01)) * DAY
    }
  }
  const candidates = [calendarDueAt, meterDueAt].filter((v): v is number => v !== null)
  const dueAt = candidates.length ? Math.min(...candidates) : now
  const dueBy = meterDueAt !== null && dueAt === meterDueAt ? 'meter' : 'calendar'
  const daysLeft = (startOfDay(dueAt) - startOfDay(now)) / DAY
  const state: PmState =
    daysLeft < 0 ? 'overdue' : daysLeft === 0 ? 'due' : daysLeft <= Math.max(pm.leadDays, 3) ? 'due_soon' : 'scheduled'
  return { dueAt, dueBy, calendarDueAt, meterDueAt, meterDueValue, meterRemaining, daysLeft, state }
}

export const openPmWorkOrder = (pm: PmSchedule, workOrders: readonly WorkOrder[]) =>
  workOrders.find((w) => w.pmScheduleId === pm.id && isActive(w))

/** "Every 1 month", "Every 500 h", "Every 30 days or 500 h, whichever first" */
export function triggerText(pm: PmSchedule, meters: ReadonlyMap<string, Meter>): string {
  const t = pm.trigger
  const unitLabel = (every: number, unit: keyof typeof INTERVAL_UNIT_LABEL) =>
    `${every} ${every === 1 ? INTERVAL_UNIT_LABEL[unit].replace(/s$/, '') : INTERVAL_UNIT_LABEL[unit]}`
  if (t.kind === 'calendar') return `Every ${unitLabel(t.every, t.unit)}`
  const meter = meters.get(t.meterId)
  const unit = meter?.unit ?? ''
  if (t.kind === 'meter') return `Every ${fmtNumber(t.every)} ${unit}`
  return `Every ${unitLabel(t.every, t.unit)} or ${fmtNumber(t.meterEvery)} ${unit}, whichever first`
}

/** Days between occurrences, used to project future due dates on the calendar. */
export function pmIntervalDays(pm: PmSchedule, meters: ReadonlyMap<string, Meter>): number {
  const t = pm.trigger
  if (t.kind === 'calendar') return intervalDays(t.every, t.unit)
  const meter = meters.get(t.meterId)
  const rate = Math.max(meter?.dailyRate ?? 1, 0.01)
  if (t.kind === 'meter') return t.every / rate
  return Math.min(intervalDays(t.every, t.unit), t.meterEvery / rate)
}

/** Projected due dates between from and to, starting at the next due date. */
export function projectPm(pm: PmSchedule, meters: ReadonlyMap<string, Meter>, from: number, to: number, now = nowMs()): number[] {
  const out: number[] = []
  const first = pmDue(pm, meters, now).dueAt
  const step = pmIntervalDays(pm, meters) * DAY
  for (let at = first; at < to && out.length < 60; at += step) if (at >= from) out.push(at)
  return out
}

export interface PmCompliance {
  due: number
  onTime: number
  late: number
  missed: number
  ratio: number
}

/** PM work orders due in [from, to): done by the end of their due day counts as on time. */
export function pmCompliance(workOrders: readonly WorkOrder[], from: number, to: number, now = nowMs()): PmCompliance {
  let due = 0
  let onTime = 0
  let late = 0
  let missed = 0
  for (const wo of workOrders) {
    if (!wo.pmScheduleId || wo.status === 'cancelled') continue
    const dueAt = toMs(wo.dueAt)
    if (dueAt < from || dueAt >= to || dueAt > now) continue
    due++
    const deadline = startOfDay(dueAt) + DAY
    if (wo.completedAt && toMs(wo.completedAt) <= deadline) onTime++
    else if (wo.completedAt) late++
    else missed++
  }
  return { due, onTime, late, missed, ratio: due ? onTime / due : 1 }
}
