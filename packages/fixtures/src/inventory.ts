import type { CalibrationPlan, CalibrationState, Part, StockItem, Tool } from '@cmms/types'
import { nowMs } from './clock'
import { DAY, toMs } from './dates'

export interface StockLevel {
  onHand: number
  reserved: number
  available: number
  items: StockItem[]
}

/** Stock of one part summed across the given warehouses (all when omitted). */
export function stockLevel(partId: string, stock: readonly StockItem[], warehouseIds?: readonly string[]): StockLevel {
  const items = stock.filter((s) => s.partId === partId && (!warehouseIds || warehouseIds.includes(s.warehouseId)))
  const onHand = items.reduce((sum, s) => sum + s.onHand, 0)
  const reserved = items.reduce((sum, s) => sum + s.reserved, 0)
  return { onHand, reserved, available: onHand - reserved, items }
}

export type StockState = 'ok' | 'reorder' | 'shortage' | 'overstock'

export function stockState(part: Part, level: StockLevel): StockState {
  if (level.reserved > level.onHand) return 'shortage'
  if (level.available <= part.min) return 'reorder'
  if (level.onHand > part.max) return 'overstock'
  return 'ok'
}

export const STOCK_STATE_LABEL: Record<StockState, string> = {
  ok: 'In stock',
  reorder: 'Reorder',
  shortage: 'Shortage',
  overstock: 'Overstock',
}

/** Suggested order quantity to get back to max. */
export const reorderSuggestion = (part: Part, level: StockLevel) =>
  Math.max(part.reorderQty, part.max - level.available)

export const stockValue = (level: StockLevel, part: Part) => level.onHand * part.unitCost

// ─── Calibration ────────────────────────────────────────────────

export const CALIBRATION_WARNING_DAYS = 30

export function calibrationState(plan: CalibrationPlan | null, now = nowMs()): CalibrationState | null {
  if (!plan) return null
  const due = toMs(plan.due)
  if (due < now) return 'expired'
  if (due - now <= CALIBRATION_WARNING_DAYS * DAY) return 'expiring'
  return 'valid'
}

export const calibrationDaysLeft = (plan: CalibrationPlan, now = nowMs()) => Math.ceil((toMs(plan.due) - now) / DAY)

/** A tool can go on a work order when it is not lost or in repair and its calibration is current. */
export function toolBlockReason(tool: Tool, now = nowMs()): string | null {
  if (tool.status === 'lost') return 'Missing'
  if (tool.status === 'maintenance') return 'In repair'
  if (calibrationState(tool.calibration, now) === 'expired') return 'Calibration expired'
  return null
}
