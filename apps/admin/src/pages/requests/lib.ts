import { DAY, MINUTE, startOfMonth, suggestPriority, toMs } from '@cmms/fixtures'
import type { Criticality, MaintenanceRequest, Priority, RequestSource, RequestStatus, Severity, WoType } from '@cmms/types'

export type RequestView = 'new' | 'monitor' | 'converted' | 'closed' | 'all'

const VIEW_STATUSES: Record<RequestView, RequestStatus[] | null> = {
  new: ['new'],
  monitor: ['monitor'],
  converted: ['converted'],
  closed: ['rejected', 'duplicate'],
  all: null,
}

export const REQUEST_VIEWS = Object.keys(VIEW_STATUSES) as RequestView[]

/** Parses a tab value or URL param; the triage queue is the default. */
export const asView = (value: string | null): RequestView => REQUEST_VIEWS.find((v) => v === value) ?? 'new'

export const inView = (r: MaintenanceRequest, view: RequestView) => VIEW_STATUSES[view]?.includes(r.status) ?? true

/** The work order a conversion starts from: priority from severity, asset criticality and impact. */
export function conversionFor(r: MaintenanceRequest, criticality: Criticality): { priority: Priority; downtime: boolean; type: WoType } {
  const priority = suggestPriority(r.severity, criticality, r.impact)
  const downtime = r.impact === 'stopped'
  return { priority, downtime, type: downtime && priority === 'P1' ? 'emergency' : 'corrective' }
}

export const REQUEST_SOURCES: RequestSource[] = ['operator', 'inspection', 'technician']

export interface RequestFilters {
  severities: Severity[]
  sources: RequestSource[]
  assetId: string | null
}

export const NO_FILTERS: RequestFilters = { severities: [], sources: [], assetId: null }

export const filterCount = (f: RequestFilters) => f.severities.length + f.sources.length + (f.assetId ? 1 : 0)

export const toggle = <T,>(list: T[], value: T) => (list.includes(value) ? list.filter((x) => x !== value) : [...list, value])

export const newestFirst = (a: MaintenanceRequest, b: MaintenanceRequest) => toMs(b.reportedAt) - toMs(a.reportedAt)

/** Minutes from the report to the first triage decision; null while the request still waits for one. */
export function triageMinutes(r: MaintenanceRequest): number | null {
  const first = r.events[0]
  return first ? (toMs(first.at) - toMs(r.reportedAt)) / MINUTE : null
}

function median(values: number[]): number | null {
  if (!values.length) return null
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

export const TRIAGE_WINDOW_DAYS = 30

export function requestStats(requests: readonly MaintenanceRequest[], now: number) {
  const queue = requests.filter((r) => r.status === 'new').sort(newestFirst)
  const monthStart = startOfMonth(now)
  const decidedThisMonth = requests.filter((r) => r.status !== 'new' && r.triagedAt && toMs(r.triagedAt) >= monthStart)
  const triageTimes = requests
    .filter((r) => r.triagedAt && now - toMs(r.triagedAt) <= TRIAGE_WINDOW_DAYS * DAY)
    .map(triageMinutes)
    .filter((m) => m !== null)
  return {
    waiting: queue.length,
    oldestWaiting: queue.at(-1),
    monitoring: requests.filter((r) => r.status === 'monitor').length,
    convertedThisMonth: decidedThisMonth.filter((r) => r.status === 'converted').length,
    decidedThisMonth: decidedThisMonth.length,
    medianTriageMin: median(triageTimes),
    triageSamples: triageTimes.length,
  }
}
