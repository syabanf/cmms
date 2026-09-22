import {
  type Period,
  type StockLevel,
  type StockState,
  fmtIdr,
  fmtNumber,
  reorderSuggestion,
  stockLevel,
  stockState,
  stockValue,
  toMs,
} from '@cmms/fixtures'
import type { Part, PartCategory, StockItem, StockTxn } from '@cmms/types'
import { PART_CATEGORY_LABEL } from '@cmms/types'

export const PART_CATEGORIES = Object.keys(PART_CATEGORY_LABEL) as PartCategory[]

export interface PartRow {
  part: Part
  level: StockLevel
  /** Null when none of the site's warehouses holds a stock record for the part. */
  state: StockState | null
  value: number
}

export function partRow(part: Part, stock: readonly StockItem[], warehouseIds: readonly string[]): PartRow {
  const level = stockLevel(part.id, stock, warehouseIds)
  return { part, level, state: level.items.length ? stockState(part, level) : null, value: stockValue(level, part) }
}

/** At or below minimum, or more reserved than on hand. Same rule as the navigation badge. */
export const needsReorder = (state: StockState | null) => state === 'reorder' || state === 'shortage'

/** Sort key that puts the most urgent stock state first. */
export const STATE_RANK: Record<StockState, number> = { shortage: 0, reorder: 1, overstock: 2, ok: 3 }

interface PurchaseLine {
  part: Part
  /** Available stock today, the reason the part is on the list. */
  available: number
  qty: number
  value: number
}

interface PurchaseGroup {
  vendorId: string | null
  lines: PurchaseLine[]
  total: number
}

/** Suggested orders for every part that needs reordering, grouped by vendor, largest spend first. */
export function purchaseList(rows: readonly PartRow[]): PurchaseGroup[] {
  const groups = new Map<string | null, PurchaseGroup>()
  for (const { part, level, state } of rows) {
    if (!needsReorder(state)) continue
    const qty = reorderSuggestion(part, level)
    const group = groups.get(part.vendorId) ?? { vendorId: part.vendorId, lines: [], total: 0 }
    group.lines.push({ part, available: level.available, qty, value: qty * part.unitCost })
    group.total += qty * part.unitCost
    groups.set(part.vendorId, group)
  }
  return [...groups.values()].sort((a, b) => b.total - a.total)
}

/** Plain text for pasting into an email or a purchase request. */
export function purchaseListText(groups: readonly PurchaseGroup[], heading: string, vendorName: (id: string | null) => string): string {
  const out = [heading, '']
  for (const group of groups) {
    out.push(vendorName(group.vendorId))
    for (const { part, qty, value } of group.lines) {
      out.push(`- ${part.code} ${part.name}: ${fmtNumber(qty)} ${part.unit} x ${fmtIdr(part.unitCost)} = ${fmtIdr(value)}, lead time ${part.leadTimeDays} days`)
    }
    out.push(`Subtotal ${fmtIdr(group.total)}`, '')
  }
  out.push(`Total ${fmtIdr(groups.reduce((sum, g) => sum + g.total, 0))}`)
  return out.join('\n')
}

/** Units issued per period, returns deducted. `txns` should already be limited to one part. */
export function consumptionByPeriod(txns: readonly StockTxn[], periods: readonly Period[]): number[] {
  return periods.map((period) => {
    let used = 0
    for (const t of txns) {
      if (t.kind !== 'issue' && t.kind !== 'return') continue
      const at = toMs(t.at)
      if (at >= period.from && at < period.to) used -= t.qty
    }
    return Math.max(0, used)
  })
}
