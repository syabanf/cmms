import type { Asset, Meter, Person, WorkOrder } from '@cmms/types'
import { nowMs } from './clock'
import { DAY, toMs } from './dates'
import { downtimeHours, isDone, isFailureWork, repairHours, woCost } from './wo'

export interface FailureEvent {
  wo: WorkOrder
  at: number
  assetId: string
  modeId: string | null
  causeId: string | null
  problemId: string | null
}

/** Completed corrective and emergency work, oldest first. */
export function failureEvents(workOrders: readonly WorkOrder[]): FailureEvent[] {
  return workOrders
    .filter((w) => isFailureWork(w) && isDone(w))
    .map((w) => ({
      wo: w,
      at: toMs(w.requestedAt),
      assetId: w.assetId,
      modeId: w.failure?.modeId ?? null,
      causeId: w.failure?.causeId ?? null,
      problemId: w.failure?.problemId ?? null,
    }))
    .sort((a, b) => a.at - b.at)
}

export interface RepeatGroup {
  key: string
  assetId: string
  modeId: string
  events: FailureEvent[]
  firstAt: number
  lastAt: number
}

/** Chains of failures on the same asset with the same failure mode, each within the window of the previous one. */
export function repeatFailures(events: readonly FailureEvent[], windowDays: number): RepeatGroup[] {
  const byKey = new Map<string, FailureEvent[]>()
  for (const e of events) {
    if (!e.modeId) continue
    const k = `${e.assetId}|${e.modeId}`
    byKey.set(k, [...(byKey.get(k) ?? []), e])
  }
  const groups: RepeatGroup[] = []
  const window = windowDays * DAY
  for (const [k, list] of byKey) {
    let chain: FailureEvent[] = [list[0]!]
    const flush = () => {
      if (chain.length >= 2) {
        groups.push({
          key: `${k}|${chain[0]!.wo.id}`,
          assetId: chain[0]!.assetId,
          modeId: chain[0]!.modeId!,
          events: chain,
          firstAt: chain[0]!.at,
          lastAt: chain[chain.length - 1]!.at,
        })
      }
    }
    for (let i = 1; i < list.length; i++) {
      if (list[i]!.at - list[i - 1]!.at <= window) chain.push(list[i]!)
      else {
        flush()
        chain = [list[i]!]
      }
    }
    flush()
  }
  return groups.sort((a, b) => b.lastAt - a.lastAt)
}

/** True when an earlier failure on the same asset and mode happened within the window. */
export function isRepeatFailure(wo: WorkOrder, events: readonly FailureEvent[], windowDays: number): boolean {
  const modeId = wo.failure?.modeId
  if (!modeId) return false
  const at = toMs(wo.requestedAt)
  return events.some((e) => e.wo.id !== wo.id && e.assetId === wo.assetId && e.modeId === modeId && e.at < at && at - e.at <= windowDays * DAY)
}

/** Failures on an asset in the last `days`, newest first. */
export function recentFailures(assetId: string, events: readonly FailureEvent[], days: number, now = nowMs()): FailureEvent[] {
  return events.filter((e) => e.assetId === assetId && now - e.at <= days * DAY).sort((a, b) => b.at - a.at)
}

/** Operating hours in a window: runtime meter rate when the asset has one, two shifts per day otherwise. */
export function operatingHours(assetId: string, meters: readonly Meter[], from: number, to: number): number {
  const runtime = meters.find((m) => m.assetId === assetId && m.kind === 'runtime')
  const perDay = runtime ? Math.min(runtime.dailyRate, 24) : 16
  return Math.max(0, (to - from) / DAY) * perDay
}

export interface AssetReliability {
  assetId: string
  failures: number
  repeats: number
  mtbfHours: number | null
  mttrHours: number | null
  downtimeHours: number
  cost: number
  workOrders: number
}

export function assetReliability(
  assets: readonly Asset[],
  workOrders: readonly WorkOrder[],
  meters: readonly Meter[],
  people: ReadonlyMap<string, Person>,
  from: number,
  to: number,
  windowDays: number,
  now = nowMs(),
): AssetReliability[] {
  const events = failureEvents(workOrders)
  const repeatIds = new Set(repeatFailures(events, windowDays).flatMap((g) => g.events.slice(1).map((e) => e.wo.id)))
  return assets.map((asset) => {
    const failures = events.filter((e) => e.assetId === asset.id && e.at >= from && e.at < to)
    const repairs = failures.map((e) => repairHours(e.wo)).filter((h): h is number => h !== null)
    const inRange = workOrders.filter((w) => w.assetId === asset.id && w.completedAt && toMs(w.completedAt) >= from && toMs(w.completedAt) < to)
    return {
      assetId: asset.id,
      failures: failures.length,
      repeats: failures.filter((e) => repeatIds.has(e.wo.id)).length,
      mtbfHours: failures.length ? operatingHours(asset.id, meters, from, Math.min(to, now)) / failures.length : null,
      mttrHours: repairs.length ? repairs.reduce((s, h) => s + h, 0) / repairs.length : null,
      downtimeHours: failures.reduce((s, e) => s + downtimeHours(e.wo, now), 0),
      cost: inRange.reduce((s, w) => s + woCost(w, people, now).total, 0),
      workOrders: inRange.length,
    }
  })
}

/** Plant-level MTBF and MTTR across the given assets. */
export function fleetReliability(rows: readonly AssetReliability[], meters: readonly Meter[], from: number, to: number) {
  const failures = rows.reduce((s, r) => s + r.failures, 0)
  const operating = rows.reduce((s, r) => s + operatingHours(r.assetId, meters, from, to), 0)
  const withMttr = rows.filter((r) => r.mttrHours !== null)
  const repairTotal = withMttr.reduce((s, r) => s + r.mttrHours! * r.failures, 0)
  const repairCount = withMttr.reduce((s, r) => s + r.failures, 0)
  return {
    failures,
    mtbfHours: failures ? operating / failures : null,
    mttrHours: repairCount ? repairTotal / repairCount : null,
    downtimeHours: rows.reduce((s, r) => s + r.downtimeHours, 0),
  }
}

/** Bad actors rank by failures, then downtime, then cost. */
export function badActors(rows: readonly AssetReliability[], count = 5): AssetReliability[] {
  return [...rows]
    .filter((r) => r.failures > 0)
    .sort((a, b) => b.failures - a.failures || b.downtimeHours - a.downtimeHours || b.cost - a.cost)
    .slice(0, count)
}

export interface ParetoRow {
  key: string
  count: number
  share: number
  cumulative: number
}

export function pareto(keys: readonly (string | null)[]): ParetoRow[] {
  const counts = new Map<string, number>()
  for (const k of keys) if (k) counts.set(k, (counts.get(k) ?? 0) + 1)
  const total = [...counts.values()].reduce((s, c) => s + c, 0)
  let running = 0
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([key, count]) => {
      running += count
      return { key, count, share: total ? count / total : 0, cumulative: total ? running / total : 0 }
    })
}
