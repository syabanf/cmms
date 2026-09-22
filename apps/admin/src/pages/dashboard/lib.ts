import {
  DAY,
  assetReliability,
  backlogHoursAt,
  badActors,
  failureEvents,
  isActive,
  lastWeeks,
  pmCompliance,
  recentFailures,
  toMs,
  urgency,
} from '@cmms/fixtures'
import type { Asset, WorkOrder } from '@cmms/types'
import type { Scoped } from '../../state/scoped'

export type Featured =
  | { kind: 'down'; asset: Asset; wo: WorkOrder | undefined; downSince: number }
  | { kind: 'bad_actor'; asset: Asset; failures: number; downtimeHours: number; cost: number; mtbfHours: number | null }

/** The one thing the hero card talks about: an asset that is down, else the worst bad actor. */
export function featuredAsset(s: Scoped, now: number): Featured | null {
  const down = s.assets.filter((a) => a.status === 'down')
  for (const asset of down) {
    const wo = s.workOrders.filter((w) => w.assetId === asset.id && w.downtime && isActive(w)).sort((a, b) => urgency(a, now) - urgency(b, now))[0]
    return { kind: 'down', asset, wo, downSince: wo ? toMs(wo.requestedAt) : now }
  }
  const rows = assetReliability(s.assets, s.workOrders, s.meters, s.maps.person, now - 90 * DAY, now, s.settings.repeatWindowDays, now)
  const worst = badActors(rows, 1)[0]
  const asset = worst ? s.maps.asset.get(worst.assetId) : undefined
  if (!worst || !asset) return null
  return { kind: 'bad_actor', asset, failures: worst.failures, downtimeHours: worst.downtimeHours, cost: worst.cost, mtbfHours: worst.mtbfHours }
}

/** Weekly PM compliance for the last `count` weeks (weeks with nothing due count as full). */
export function weeklyPmCompliance(workOrders: readonly WorkOrder[], count: number, now: number) {
  return lastWeeks(count, now).map((w) => ({ label: w.label, value: Math.round(pmCompliance(workOrders, w.from, w.to, now).ratio * 100) }))
}

/** Open man-hours at the end of each of the last `count` weeks (today for the current one). */
export function weeklyBacklogHours(workOrders: readonly WorkOrder[], count: number, now: number) {
  return lastWeeks(count, now).map((w) => ({ label: w.label, value: Math.round(backlogHoursAt(workOrders, Math.min(w.to, now))) }))
}

/** Failures on an asset in the last 60 days, for the repeat-failure chip. */
export const recentFailureCount = (s: Scoped, assetId: string, now: number) =>
  recentFailures(assetId, failureEvents(s.workOrders), s.settings.repeatWindowDays * 2, now).length
