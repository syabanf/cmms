import type { ChecklistItem, CheckOutcome, TaskResult, WoTask } from '@cmms/types'

/** Outcome of one checklist value. Measurements outside min/max fail, outside warn limits warn. */
export function evaluateItem(item: ChecklistItem, value: TaskResult['value']): CheckOutcome | null {
  if (value === null || value === '') return null
  switch (item.type) {
    case 'passfail':
      return value === 'pass' ? 'pass' : value === 'fail' ? 'fail' : null
    case 'check':
      return value === true ? 'pass' : value === false ? (item.required ? 'fail' : null) : null
    case 'measurement':
    case 'number': {
      if (typeof value !== 'number' || Number.isNaN(value)) return null
      if (item.min != null && value < item.min) return 'fail'
      if (item.max != null && value > item.max) return 'fail'
      if (item.warnMin != null && value < item.warnMin) return 'warning'
      if (item.warnMax != null && value > item.warnMax) return 'warning'
      return item.type === 'measurement' ? 'pass' : null
    }
    case 'choice': {
      // Convention: the first option is the healthy one, the last the worst.
      const options = item.options ?? []
      const idx = options.indexOf(String(value))
      if (idx < 0 || options.length < 2) return null
      if (idx === 0) return 'pass'
      return idx === options.length - 1 ? 'fail' : 'warning'
    }
    default:
      return null
  }
}

const RANK: Record<CheckOutcome, number> = { pass: 0, warning: 1, fail: 2 }

export function worstOutcome(tasks: readonly WoTask[]): CheckOutcome | null {
  let worst: CheckOutcome | null = null
  for (const t of tasks) {
    const o = t.result?.outcome
    if (o && (worst === null || RANK[o] > RANK[worst])) worst = o
  }
  return worst
}

export function isTaskDone(task: WoTask): boolean {
  const v = task.result?.value
  if (v === undefined || v === null || v === '') return false
  if (task.type === 'check') return v === true
  return true
}

export function taskProgress(tasks: readonly WoTask[]) {
  const done = tasks.filter(isTaskDone).length
  const required = tasks.filter((t) => t.required)
  const requiredDone = required.filter(isTaskDone).length
  return {
    done,
    total: tasks.length,
    ratio: tasks.length ? done / tasks.length : 0,
    missingRequired: required.length - requiredDone,
  }
}

/** Human text for a measurement range, e.g. "< 75 °C" or "190 to 210 bar". */
export function limitText(item: ChecklistItem): string | null {
  const unit = item.unit ? ` ${item.unit}` : ''
  if (item.min != null && item.max != null) return `${item.min} to ${item.max}${unit}`
  if (item.max != null) return `< ${item.max}${unit}`
  if (item.min != null) return `> ${item.min}${unit}`
  return null
}
