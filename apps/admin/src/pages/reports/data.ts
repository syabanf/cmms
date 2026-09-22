import {
  type Period,
  type WoCost,
  addMonths,
  areaOf,
  assetReliability,
  backlogRows,
  backlogSummary,
  badActors,
  completionRate,
  costBetween,
  costBy,
  failureEvents,
  fleetReliability,
  fmtMonth,
  inRange,
  isDone,
  lastMonths,
  pareto,
  pmCompliance,
  repeatFailures,
  scheduleCompliance,
  startOfMonth,
  statusCounts,
  technicianLoad,
  weeklyCapacity,
  workShares,
} from '@cmms/fixtures'
import type { WorkOrder } from '@cmms/types'
import type { Scoped } from '../../state/scoped'

export type ReportPeriod = 'month' | 'quarter' | 'year'

export const REPORT_PERIODS: { value: ReportPeriod; label: string; months: number }[] = [
  { value: 'month', label: 'This month', months: 1 },
  { value: 'quarter', label: 'Last 3 months', months: 3 },
  { value: 'year', label: 'Last 12 months', months: 12 },
]

export const isReportPeriod = (value: unknown): value is ReportPeriod => REPORT_PERIODS.some((p) => p.value === value)

/** Utilization above this share of paid hours counts as overloaded. */
export const OVERLOAD = 0.9

export interface Range {
  from: number
  to: number
  /** "Sep 2026" or "Jul 2026 to Sep 2026" */
  label: string
}

/** Whole calendar months up to today, the current month included. */
export function periodRange(period: ReportPeriod, now: number): Range {
  const months = REPORT_PERIODS.find((p) => p.value === period)?.months ?? 3
  const from = addMonths(startOfMonth(now), 1 - months)
  return { from, to: now, label: months === 1 ? fmtMonth(now) : `${fmtMonth(from)} to ${fmtMonth(now)}` }
}

export interface MonthRow {
  period: Period
  current: boolean
  created: number
  planned: number
  corrective: number
  emergency: number
  plannedShare: number
  cost: WoCost
  failures: number
  mtbfHours: number | null
  mttrHours: number | null
  downtimeHours: number
}

/** The last 12 calendar months for the trend charts, whatever period the page shows. */
export function monthlyReport(s: Scoped, now: number): MonthRow[] {
  const months = lastMonths(12, now)
  return months.map((period, i) => {
    const to = Math.min(period.to, now)
    const shares = workShares(s.workOrders, period.from, to)
    const rows = assetReliability(s.assets, s.workOrders, s.meters, s.maps.person, period.from, to, s.settings.repeatWindowDays, now)
    const fleet = fleetReliability(rows, s.meters, period.from, to)
    return {
      period,
      current: i === months.length - 1,
      created: shares.total,
      planned: shares.planned,
      corrective: shares.corrective,
      emergency: shares.emergency,
      plannedShare: shares.plannedShare,
      cost: costBetween(s.workOrders, s.maps.person, period.from, to, now),
      failures: fleet.failures,
      mtbfHours: fleet.mtbfHours,
      mttrHours: fleet.mttrHours,
      downtimeHours: fleet.downtimeHours,
    }
  })
}

export function operationalReport(s: Scoped, range: Range, now: number) {
  const capacity = weeklyCapacity(s.technicians, s.settings)
  return {
    pm: pmCompliance(s.workOrders, range.from, range.to, now),
    schedule: scheduleCompliance(s.workOrders, range.from, range.to, now),
    completion: completionRate(s.workOrders, range.from, range.to),
    overdue: statusCounts(s.workOrders, now).overdue,
    capacity,
    backlog: backlogSummary(backlogRows(s.workOrders, now), capacity),
    shares: workShares(s.workOrders, range.from, range.to),
  }
}
export type OperationalReport = ReturnType<typeof operationalReport>

export function reliabilityReport(s: Scoped, range: Range, now: number) {
  const windowDays = s.settings.repeatWindowDays
  const rows = assetReliability(s.assets, s.workOrders, s.meters, s.maps.person, range.from, range.to, windowDays, now)
  const all = failureEvents(s.workOrders)
  const events = all.filter((e) => e.at >= range.from && e.at < range.to)
  const chains = repeatFailures(all, windowDays).filter((g) => g.lastAt >= range.from)
  const actions = s.rcas.flatMap((r) => r.actions)
  return {
    fleet: fleetReliability(rows, s.meters, range.from, range.to),
    repeats: rows.reduce((sum, r) => sum + r.repeats, 0),
    chains: chains.length,
    /** Repeat chains that have an RCA on the same asset and failure mode. */
    covered: chains.filter((g) => s.rcas.some((r) => r.assetId === g.assetId && r.modeId === g.modeId)).length,
    bad: badActors(rows, 5),
    modes: pareto(events.map((e) => e.modeId)),
    causes: pareto(events.map((e) => e.causeId)),
    openRcas: s.rcas.filter((r) => r.status !== 'closed').length,
    actionsDone: actions.filter((a) => a.status === 'done').length,
    actionsTotal: actions.length,
  }
}
export type ReliabilityReport = ReturnType<typeof reliabilityReport>

interface PartUse {
  partId: string
  qty: number
  cost: number
}

/** Parts issued or used on the given work orders, costliest first. */
function partsUsed(workOrders: readonly WorkOrder[]): PartUse[] {
  const byPart = new Map<string, PartUse>()
  for (const wo of workOrders) {
    for (const line of wo.parts) {
      if (line.status !== 'issued' && line.status !== 'consumed') continue
      const prev = byPart.get(line.partId) ?? { partId: line.partId, qty: 0, cost: 0 }
      byPart.set(line.partId, { partId: line.partId, qty: prev.qty + line.qty, cost: prev.cost + line.qty * line.unitCost })
    }
  }
  return [...byPart.values()].sort((a, b) => b.cost - a.cost)
}

export function costReport(s: Scoped, range: Range, now: number) {
  const { from, to } = range
  const people = s.maps.person
  // Same rule as the cost KPIs: cost is booked when the work is completed.
  const booked = s.workOrders.filter((w) => isDone(w) && inRange(w.completedAt, from, to))
  const byAsset = costBy(s.workOrders, people, from, to, (w) => w.assetId, now)
  const areaId = (w: WorkOrder) => {
    const asset = s.maps.asset.get(w.assetId)
    return asset ? (areaOf(s.locations, asset.locationId)?.id ?? null) : null
  }
  const total = costBetween(s.workOrders, people, from, to, now)
  return {
    total,
    workOrders: booked.length,
    assets: byAsset.length,
    perWorkOrder: booked.length ? total.total / booked.length : 0,
    perAsset: byAsset.length ? total.total / byAsset.length : 0,
    byAsset: byAsset.slice(0, 10),
    byArea: costBy(s.workOrders, people, from, to, areaId, now),
    byType: costBy(s.workOrders, people, from, to, (w) => w.type, now),
    parts: partsUsed(booked).slice(0, 8),
  }
}
export type CostReport = ReturnType<typeof costReport>

/** Logged hours, finished jobs and open load per technician, busiest first. */
export const technicianRows = (s: Scoped, range: Range, now: number) =>
  technicianLoad(s.technicians, s.workOrders, s.settings, range.from, range.to, now).sort((a, b) => b.utilization - a.utilization)
