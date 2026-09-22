import { HISTORY_KINDS, type HistoryItem, type HistoryKind, dayKey } from '@cmms/fixtures'
import type { Tone } from '@cmms/ui'
import type { LucideIcon } from 'lucide-react'
import { ClipboardCheck, FileText, Gauge, Package, Ruler, TriangleAlert, Wallet, Wrench } from 'lucide-react'

export const HISTORY_PERIODS = [30, 90, 365] as const
export type HistoryPeriod = (typeof HISTORY_PERIODS)[number]
export const isHistoryPeriod = (value: unknown): value is HistoryPeriod => HISTORY_PERIODS.some((p) => p === value)

/** Items shown before the "Show more" button, and added by each press. */
export const PAGE_SIZE = 40

export const KIND_STYLE: Record<HistoryKind, { icon: LucideIcon; tone: Tone }> = {
  work_order: { icon: Wrench, tone: 'default' },
  failure: { icon: TriangleAlert, tone: 'danger' },
  part: { icon: Package, tone: 'info' },
  measurement: { icon: Gauge, tone: 'default' },
  cost: { icon: Wallet, tone: 'warning' },
  document: { icon: FileText, tone: 'default' },
  inspection: { icon: ClipboardCheck, tone: 'success' },
  calibration: { icon: Ruler, tone: 'info' },
}

export interface DayGroup {
  key: string
  at: number
  items: HistoryItem[]
}

/** Runs of items on the same plant day. The items arrive newest first. */
export function groupByDay(items: readonly HistoryItem[]): DayGroup[] {
  const groups: DayGroup[] = []
  for (const item of items) {
    const key = dayKey(item.at)
    const last = groups.at(-1)
    if (last?.key === key) last.items.push(item)
    else groups.push({ key, at: item.at, items: [item] })
  }
  return groups
}

export function countByKind(items: readonly HistoryItem[]): Record<HistoryKind, number> {
  const counts = Object.fromEntries(HISTORY_KINDS.map((kind) => [kind, 0])) as Record<HistoryKind, number>
  for (const item of items) counts[item.kind]++
  return counts
}
