import { fmtNumber, isDone, toMs } from '@cmms/fixtures'
import type { ChecklistItem, CheckOutcome, IsoDate, JobPlan, WoTask, WorkOrder } from '@cmms/types'
import type { LineChartProps } from '@cmms/ui'

export type DoneInspection = WorkOrder & { completedAt: IsoDate }

/** Completed inspection work orders, newest first. */
export function completedInspections(workOrders: readonly WorkOrder[]): DoneInspection[] {
  return workOrders
    .filter((w): w is DoneInspection => w.type === 'inspection' && isDone(w) && w.completedAt !== null)
    .sort((a, b) => toMs(b.completedAt) - toMs(a.completedAt))
}

export const isFlag = (outcome: CheckOutcome | null) => outcome === 'warning' || outcome === 'fail'

/** The job plan an inspection follows names its route; ad-hoc inspections fall back to `fallback`. */
export const routeName = (jobPlans: ReadonlyMap<string, JobPlan>, jobPlanId: string | null, fallback: string) =>
  (jobPlanId && jobPlans.get(jobPlanId)?.name) || fallback

/** The person who recorded the readings, else the first assignee. */
export const inspectorOf = (wo: WorkOrder) => wo.tasks.find((t) => t.result)?.result?.by ?? wo.assigneeIds[0] ?? null

const decimals = (value: number) => Math.min(2, (String(value).split('.')[1] ?? '').length)

/** A reading with the precision it was recorded in: 5.4 stays 5.4, 70 stays 70. */
export const fmtReading = (value: number) => fmtNumber(value, decimals(value))

/** "Down 3.1 from 14 Sep" style change against the previous reading. */
export function readingChange(current: number, previous: number): { direction: 'up' | 'down' | 'same'; amount: string } {
  const digits = Math.max(decimals(current), decimals(previous))
  const diff = Number((current - previous).toFixed(digits))
  return { direction: diff > 0 ? 'up' : diff < 0 ? 'down' : 'same', amount: fmtNumber(Math.abs(diff), digits) }
}

// ─── Flagged readings on one inspection ─────────────────────────

/** A passing measurement that sits exactly on its warning limit. */
const onWarnLimit = (t: WoTask) => {
  const value = t.result?.value
  return typeof value === 'number' && t.result?.outcome === 'pass' && (value === t.warnMax || value === t.warnMin)
}

const severity = (t: WoTask) => (t.result?.outcome === 'fail' ? 0 : t.result?.outcome === 'warning' ? 1 : 2)

/** "Vibration velocity at drive end" becomes "Vibration velocity" so table cells stay short. */
const shortLabel = (label: string) => label.replace(/\s+(at|on|of|for|in)\s.*$/i, '')

const lowerFirst = (text: string) => (/^[A-Z][a-z]/.test(text) ? text.charAt(0).toLowerCase() + text.slice(1) : text)

function phrase(t: WoTask): string {
  const label = shortLabel(t.label)
  const value = t.result?.value
  if (typeof value === 'number') return `${label} ${fmtReading(value)}${t.unit ? ` ${t.unit}` : ''}`
  if (t.type === 'passfail') return `${label} failed`
  if (t.type === 'check') return `${label} not done`
  return `${label} ${String(value).toLowerCase()}`
}

/** Warning and fail readings, worst first, plus measurements that sit on a warning limit. */
export function flaggedSummary(wo: WorkOrder): string {
  return wo.tasks
    .filter((t) => isFlag(t.result?.outcome ?? null) || onWarnLimit(t))
    .sort((a, b) => severity(a) - severity(b))
    .map((t, i) => (i === 0 ? phrase(t) : lowerFirst(phrase(t))))
    .join(', ')
}

// ─── Measurement trends ─────────────────────────────────────────

export type Limits = Pick<ChecklistItem, 'min' | 'max' | 'warnMin' | 'warnMax'>

export interface Reading {
  woId: string
  at: number
  value: number
  outcome: CheckOutcome | null
  by: string
}

/** One numeric checklist line on one asset, across every inspection that recorded it. */
export interface MeasurementPoint {
  key: string
  assetId: string
  label: string
  unit: string
  /** From the latest inspection, so a revised job plan shows its current limits. */
  limits: Limits
  /** Oldest first. */
  readings: Reading[]
  latest: Reading
}

export function measurementPoints(done: readonly DoneInspection[]): MeasurementPoint[] {
  const points = new Map<string, MeasurementPoint>()
  const oldestFirst = [...done].sort((a, b) => toMs(a.completedAt) - toMs(b.completedAt))
  for (const wo of oldestFirst) {
    for (const t of wo.tasks) {
      const result = t.result
      if ((t.type !== 'measurement' && t.type !== 'number') || !result || typeof result.value !== 'number') continue
      const reading: Reading = { woId: wo.id, at: toMs(result.at), value: result.value, outcome: result.outcome, by: result.by }
      const key = `${wo.assetId}|${t.label}`
      points.set(key, {
        key,
        assetId: wo.assetId,
        label: t.label,
        unit: t.unit ?? '',
        limits: { min: t.min, max: t.max, warnMin: t.warnMin, warnMax: t.warnMax },
        readings: [...(points.get(key)?.readings ?? []), reading],
        latest: reading,
      })
    }
  }
  return [...points.values()]
}

/** Points whose latest reading is a warning or a fail, fails first, then newest. */
export function pointsAtRisk(points: readonly MeasurementPoint[]): MeasurementPoint[] {
  return points
    .filter((p) => isFlag(p.latest.outcome))
    .sort((a, b) => Number(b.latest.outcome === 'fail') - Number(a.latest.outcome === 'fail') || b.latest.at - a.latest.at)
}

/** Points that read inside their limits now but were flagged since `since`, with that flag. Newest flag first. */
export function recentlyFlagged(points: readonly MeasurementPoint[], since: number) {
  return points
    .flatMap((point) => {
      if (isFlag(point.latest.outcome)) return []
      const flag = point.readings.findLast((r) => isFlag(r.outcome) && r.at >= since)
      return flag ? [{ point, flag }] : []
    })
    .sort((a, b) => b.flag.at - a.flag.at)
}

type Zone = NonNullable<LineChartProps['zones']>[number]
type ReferenceLine = NonNullable<LineChartProps['referenceLines']>[number]

/** Green inside the warning limits, amber between warning and fail, red past the fail limit. */
export function limitZones(l: Limits): Zone[] {
  const zones: Zone[] = []
  if (l.max != null) zones.push({ from: l.max, to: Infinity, tone: 'danger' })
  if (l.warnMax != null) zones.push({ from: l.warnMax, to: l.max ?? Infinity, tone: 'warning' })
  if (l.min != null) zones.push({ from: -Infinity, to: l.min, tone: 'danger' })
  if (l.warnMin != null) zones.push({ from: l.min ?? -Infinity, to: l.warnMin, tone: 'warning' })
  if (zones.length) zones.push({ from: l.warnMin ?? l.min ?? -Infinity, to: l.warnMax ?? l.max ?? Infinity, tone: 'success' })
  return zones
}

export function limitLines(l: Limits): ReferenceLine[] {
  const lines: ReferenceLine[] = []
  for (const value of [l.warnMax, l.warnMin]) if (value != null) lines.push({ value, label: `Warning ${fmtReading(value)}`, tone: 'warning' })
  for (const value of [l.max, l.min]) if (value != null) lines.push({ value, label: `Fail ${fmtReading(value)}`, tone: 'danger' })
  return lines
}

/** "Warning above 4.5 mm/s, fail above 7.1 mm/s" */
export function limitSummary(l: Limits, unit: string): string | null {
  const u = unit ? ` ${unit}` : ''
  const parts = [
    l.warnMax != null && `warning above ${fmtReading(l.warnMax)}${u}`,
    l.max != null && `fail above ${fmtReading(l.max)}${u}`,
    l.warnMin != null && `warning below ${fmtReading(l.warnMin)}${u}`,
    l.min != null && `fail below ${fmtReading(l.min)}${u}`,
  ].filter((part): part is string => !!part)
  const text = parts.join(', ')
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : null
}
