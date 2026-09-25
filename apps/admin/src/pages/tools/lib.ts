import { toMs } from '@cmms/fixtures'
import type { Tool, ToolCondition, ToolMovement } from '@cmms/types'
import { TOOL_CONDITION_LABEL } from '@cmms/types'
import { toast } from '@cmms/ui'
import type { Scoped } from '../../state/scoped'

const CONDITIONS: ToolCondition[] = ['good', 'fair', 'poor']
const CONDITION_TONE = { good: 'success', fair: 'warning', poor: 'danger' } as const

/** SegmentedControl options for a tool's condition, toned by how usable it is. */
export const CONDITION_OPTIONS = CONDITIONS.map((c) => ({ value: c, label: TOOL_CONDITION_LABEL[c], tone: CONDITION_TONE[c] }))
export const asCondition = (value: string): ToolCondition => CONDITIONS.find((c) => c === value) ?? 'good'

/** Sorted distinct non-empty values, for category and location suggestions. */
export const distinct = (values: readonly string[]) =>
  [...new Set(values.map((v) => v.trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b))

/** One check-out of a tool and, once logged, its return. */
export interface ToolUse {
  /** Id of the check-out movement. */
  id: string
  holderId: string | null
  /** Null for general use without a work order. */
  woId: string | null
  from: number
  /** Null while the tool is out, or when the next check-out came before any return. */
  to: number | null
  /** Condition noted on return. Null while out, or when a work order released the tool. */
  condition: ToolCondition | null
  note: string
  /** The open check-out of a tool that is out right now. */
  current: boolean
}

/**
 * The tool's movement log paired into uses, newest first. Each check-out opens a use; a return
 * closes the open check-out for its work order (the same person can hold a tool for two jobs at
 * once), or the latest one when it names none. A second check-out for a work order that already
 * holds the tool replaces the open one instead of starting a second use.
 */
export function toolUses(tool: Tool, movements: readonly ToolMovement[]): ToolUse[] {
  // Entries logged at the same time keep their log order.
  const own = movements.filter((m) => m.toolId === tool.id).sort((a, b) => toMs(a.at) - toMs(b.at))
  const use = (out: ToolMovement, back: ToolMovement | null): ToolUse => ({
    id: out.id,
    holderId: out.holderId,
    woId: out.woId,
    from: toMs(out.at),
    to: back ? toMs(back.at) : null,
    condition: back?.condition ?? null,
    note: back?.note ?? '',
    current: false,
  })
  const uses: ToolUse[] = []
  const open: ToolMovement[] = []
  for (const m of own) {
    let i = open.length - 1
    while (i >= 0 && open[i]?.woId !== m.woId) i--
    if (m.kind === 'checkout') {
      if (i === -1) open.push(m)
      else open[i] = m
      continue
    }
    const [out] = open.splice(i === -1 ? open.length - 1 : i, 1)
    if (out) uses.push(use(out, m))
  }
  for (const out of open) uses.push({ ...use(out, null), current: tool.status === 'in_use' })
  return uses.sort((a, b) => b.from - a.from)
}

/** Sends a tool out for calibration. Recording the calibration brings it back. */
export function sendForCalibration(dispatch: Scoped['dispatch'], tool: Pick<Tool, 'id' | 'code'>) {
  dispatch({ type: 'tools/setStatus', id: tool.id, status: 'calibration' })
  toast(`${tool.code} sent for calibration`, { tone: 'success', description: 'Record the calibration when it comes back.' })
}
