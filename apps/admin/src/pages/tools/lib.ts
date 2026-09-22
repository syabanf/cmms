import { toMs } from '@cmms/fixtures'
import type { Tool, ToolCondition, WorkOrder } from '@cmms/types'
import { TOOL_CONDITION_LABEL } from '@cmms/types'

const CONDITIONS: ToolCondition[] = ['good', 'fair', 'poor']
const CONDITION_TONE = { good: 'success', fair: 'warning', poor: 'danger' } as const

/** SegmentedControl options for a tool's condition, toned by how usable it is. */
export const CONDITION_OPTIONS = CONDITIONS.map((c) => ({ value: c, label: TOOL_CONDITION_LABEL[c], tone: CONDITION_TONE[c] }))
export const asCondition = (value: string): ToolCondition => CONDITIONS.find((c) => c === value) ?? 'good'

/** Sorted distinct non-empty values, for category and location suggestions. */
export const distinct = (values: readonly string[]) =>
  [...new Set(values.map((v) => v.trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b))

export interface ToolUse {
  wo: WorkOrder
  /** Checkout time. Checkouts made before the log fall back to the work order start. */
  from: number | null
  /** Return time. Null while the tool is out, or when a cancelled work order released it. */
  to: number | null
  current: boolean
}

/**
 * Work orders that used the tool, current first, then newest. Built from the check-out and
 * return events on each work order plus the tool's current checkout. Completing a work order
 * releases its tools without an event, so its completion time closes the use.
 */
export function toolUses(tool: Tool, workOrders: readonly WorkOrder[]): ToolUse[] {
  const out = `Checked out ${tool.code} `
  const back = `Returned ${tool.code}`
  const uses: ToolUse[] = []
  for (const wo of workOrders) {
    const current = tool.status === 'in_use' && tool.woId === wo.id
    const started = wo.startedAt ? toMs(wo.startedAt) : null
    let open: number | null = null
    for (const e of wo.events) {
      if (e.kind !== 'tool') continue
      if (e.text.startsWith(out)) open = toMs(e.at)
      else if (e.text === back) {
        uses.push({ wo, from: open ?? started, to: toMs(e.at), current: false })
        open = null
      }
    }
    if (open !== null) uses.push({ wo, from: open, to: current ? null : wo.completedAt ? toMs(wo.completedAt) : null, current })
    else if (current) uses.push({ wo, from: started, to: null, current: true })
  }
  return uses.sort((a, b) => Number(b.current) - Number(a.current) || (b.from ?? 0) - (a.from ?? 0))
}
