import { fmtNumber, isActive, urgency } from '@cmms/fixtures'
import type { Part, StockItem, WoPartLine, WorkOrder } from '@cmms/types'

/** A non-negative quantity typed into a field; null while the field is empty or invalid. */
export function parseQuantity(value: string | undefined): number | null {
  if (value === undefined || value.trim() === '') return null
  const n = Number(value)
  return Number.isFinite(n) && n >= 0 ? n : null
}

const stockKey = (partId: string, warehouseId: string) => `${partId}|${warehouseId}`

/** Why the warehouse cannot hand out a reserved line yet, or null when it can. */
export function issueBlock(wo: WorkOrder, line: WoPartLine, onHand: number): string | null {
  if (wo.approval?.status === 'pending') return 'Waiting for approval'
  if (onHand < line.qty) return onHand > 0 ? `Only ${fmtNumber(onHand)} on hand` : 'None on hand'
  return null
}

export interface PickLine {
  line: WoPartLine
  part: Part | undefined
  stock: StockItem | undefined
  /** On hand minus every reservation: what stays free once all reserved lines are issued. Negative means short. */
  free: number
}

export interface PickGroup {
  wo: WorkOrder
  lines: PickLine[]
}

/** Reserved lines on active work orders, grouped by work order, most urgent first. */
export function pickList(workOrders: readonly WorkOrder[], stock: readonly StockItem[], parts: ReadonlyMap<string, Part>, now: number): PickGroup[] {
  const byKey = new Map(stock.map((s) => [stockKey(s.partId, s.warehouseId), s]))
  return workOrders
    .filter(isActive)
    .map((wo) => ({
      wo,
      lines: wo.parts
        .filter((line) => line.status === 'reserved')
        .map((line) => {
          const item = byKey.get(stockKey(line.partId, line.warehouseId))
          return { line, part: parts.get(line.partId), stock: item, free: item ? item.onHand - item.reserved : -line.qty }
        }),
    }))
    .filter((group) => group.lines.length > 0)
    .sort((a, b) => urgency(a.wo, now) - urgency(b.wo, now))
}

/** Lines of one work order the shelf can cover, counting earlier lines of the same batch against the stock. */
export function issuableLines({ wo, lines }: PickGroup): PickLine[] {
  const left = new Map<string, number>()
  return lines.filter(({ line, stock }) => {
    const key = stockKey(line.partId, line.warehouseId)
    const onHand = left.get(key) ?? stock?.onHand ?? 0
    if (issueBlock(wo, line, onHand)) return false
    left.set(key, onHand - line.qty)
    return true
  })
}
