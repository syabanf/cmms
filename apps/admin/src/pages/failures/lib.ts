import { DAY, type FailureEvent, type ParetoRow, type RepeatGroup, downtimeHours, fmtDateShort, fmtNumber } from '@cmms/fixtures'

export const FAILURE_PERIODS = [30, 90, 180, 365] as const
export type FailurePeriod = (typeof FAILURE_PERIODS)[number]
export const isFailurePeriod = (value: unknown): value is FailurePeriod => FAILURE_PERIODS.some((p) => p === value)

export type ParetoBy = 'mode' | 'cause' | 'problem' | 'asset'

export const PARETO_BY: { value: ParetoBy; label: string; plural: string }[] = [
  { value: 'mode', label: 'Mode', plural: 'failure modes' },
  { value: 'cause', label: 'Cause', plural: 'causes' },
  { value: 'problem', label: 'Problem', plural: 'problems' },
  { value: 'asset', label: 'Asset', plural: 'assets' },
]

export const paretoKey: Record<ParetoBy, (e: FailureEvent) => string | null> = {
  mode: (e) => e.modeId,
  cause: (e) => e.causeId,
  problem: (e) => e.problemId,
  asset: (e) => e.assetId,
}

/** How many of the top rows it takes to reach 80% of the failures: the vital few. */
export function vitalFew(rows: readonly ParetoRow[]): number {
  const index = rows.findIndex((r) => r.cumulative >= 0.8 - 1e-9)
  return index === -1 ? rows.length : index + 1
}

export const spanDays = (group: RepeatGroup) => Math.max(1, Math.round((group.lastAt - group.firstAt) / DAY))

export const groupDowntime = (group: RepeatGroup, now: number) => group.events.reduce((sum, e) => sum + downtimeHours(e.wo, now), 0)

/** Problem statement for an RCA started from a repeat failure chain. */
export function repeatProblem(group: RepeatGroup, assetName: string, modeName: string, now: number): string {
  const dates = group.events.map((e) => fmtDateShort(e.at)).join(', ')
  const down = groupDowntime(group, now)
  const stopped = down > 0 ? ` Production stopped for ${fmtNumber(down, 1)} h in total.` : ''
  return `${modeName} on ${assetName} came back ${group.events.length} times in ${spanDays(group)} days (${dates}).${stopped}`
}
