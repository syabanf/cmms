import { DAY, emptyRca, nextRcaCode, nowIso, startOfDay, toMs } from '@cmms/fixtures'
import type { CapaAction, Meter, PmSchedule, Rca } from '@cmms/types'

/** Applies a change to the latest saved RCA and stores the result. */
export type RcaUpdate = (change: (rca: Rca) => Rca) => void

/**
 * A new RCA with the next free code. Codes run across sites: pass the RCAs of every site, since
 * this site's alone can hand out a code another site holds and overwrite that record.
 */
export function createRca(allRcas: readonly Rca[], siteId: string, by: string, fields: Partial<Omit<Rca, 'id' | 'code' | 'siteId'>>): Rca {
  const at = nowIso()
  const code = nextRcaCode(allRcas, at)
  // Seeded ids are the lowercase code: RCA-2026-004 is rca-2026-004.
  return { ...emptyRca(siteId, by, at), ...fields, id: code.toLowerCase(), code }
}

/** Due dates count by day: something due today is late from tomorrow. */
export const isPastDue = (dueAt: string, now: number) => startOfDay(toMs(dueAt)) < startOfDay(now)

export const doneCount = (actions: readonly CapaAction[]) => actions.filter((a) => a.status === 'done').length

export const overdueActions = (actions: readonly CapaAction[], now: number) =>
  actions.filter((a) => a.status === 'open' && isPastDue(a.dueAt, now))

export const daysToClose = (rca: Rca) => (rca.closedAt ? (toMs(rca.closedAt) - toMs(rca.createdAt)) / DAY : null)

export function moveItem<T>(list: readonly T[], from: number, to: number): T[] {
  const next = [...list]
  if (to < 0 || to >= next.length) return next
  const [item] = next.splice(from, 1)
  if (item !== undefined) next.splice(to, 0, item)
  return next
}

export const insertAt = <T>(list: readonly T[], index: number, item: T): T[] => [...list.slice(0, index), item, ...list.slice(index)]

export interface PmChange {
  code: string
  hours: number
}

/** Reads "Change PM-0003 ... to every 400 runtime hours" as a PM code and a runtime interval. */
export function pmChangeIn(text: string): PmChange | null {
  const code = /\bPM-\d{3,}\b/i.exec(text)?.[0]
  const hours = /(\d[\d.,]*)\s*(?:runtime\s+)?(?:hours?|hrs?|h)\b/i.exec(text)?.[1]
  if (!code || !hours) return null
  const value = Number(hours.replace(/[.,](?=\d{3}(?:\D|$))/g, ''))
  return value > 0 ? { code: code.toUpperCase(), hours: value } : null
}

export const runsOnMeter = (pm: PmSchedule, meterId: string, hours: number) =>
  pm.trigger.kind === 'combined' && pm.trigger.meterId === meterId && pm.trigger.meterEvery === hours

/**
 * The PM on a runtime trigger, whichever comes first with its calendar interval (30 days when it
 * had none). A schedule that never tracked this meter gets its reading at the last PM estimated.
 */
export function withRuntimeTrigger(pm: PmSchedule, meter: Meter, hours: number, now: number): PmSchedule {
  const t = pm.trigger
  const calendar = t.kind === 'meter' ? { every: 30, unit: 'day' as const } : { every: t.every, unit: t.unit }
  const tracked = t.kind !== 'calendar' && t.meterId === meter.id && pm.lastDoneMeter !== null
  const estimate = Math.max(0, Math.round(meter.value - (meter.dailyRate * (now - toMs(pm.lastDoneAt))) / DAY))
  return {
    ...pm,
    trigger: { kind: 'combined', ...calendar, meterId: meter.id, meterEvery: hours },
    lastDoneMeter: tracked ? pm.lastDoneMeter : estimate,
  }
}
