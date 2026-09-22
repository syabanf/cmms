import { newId } from '@cmms/fixtures'
import type { ChecklistItem, CheckOutcome, FieldType, JobPlan, JobPlanPart } from '@cmms/types'

/** "JP-POL-001" → "POL" */
const planGroup = (code: string) => code.split('-')[1] ?? ''

/** Letters and digits only, upper case, at most four. */
export const normalizeGroup = (value: string) => value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4)

interface PlanGroup {
  group: string
  names: string[]
}

/** Code groups in use, each with the plan names filed under it. */
export function planGroups(plans: readonly JobPlan[]): PlanGroup[] {
  const groups = new Map<string, string[]>()
  for (const plan of plans) {
    const group = planGroup(plan.code)
    if (group) groups.set(group, [...(groups.get(group) ?? []), plan.name])
  }
  return [...groups].map(([group, names]) => ({ group, names })).sort((a, b) => a.group.localeCompare(b.group))
}

/** The group of an existing plan for the same asset type, so a new plan lands beside its siblings. */
export function suggestGroup(assetTypeIds: readonly string[], plans: readonly JobPlan[]): string | null {
  const sibling = plans.find((p) => p.assetTypeIds.some((id) => assetTypeIds.includes(id)))
  return sibling ? planGroup(sibling.code) || null : null
}

export const FIELD_TYPE_HINT: Record<FieldType, string> = {
  check: 'Tick when done',
  number: 'A count or reading',
  text: 'A short written answer',
  passfail: 'Pass or fail',
  choice: 'One option from a list',
  measurement: 'A reading checked against limits',
  photo: 'One or more photos',
  signature: 'Sign-off on the device',
}

export const DEFAULT_OPTIONS = ['Good', 'Worn', 'Damaged']

export function emptyTask(type: FieldType): ChecklistItem {
  const item: ChecklistItem = { id: newId('task'), label: '', type, required: type !== 'photo' }
  if (type === 'choice') item.options = [...DEFAULT_OPTIONS]
  return item
}

/** How evaluateItem reads a choice: the first option passes, the last fails, the rest warn. */
export function optionOutcome(index: number, count: number): CheckOutcome | null {
  if (count < 2) return null
  if (index === 0) return 'pass'
  return index === count - 1 ? 'fail' : 'warning'
}

/** "Warning above 70 °C", "Warning outside 5 to 8 bar" */
export function warnText(item: ChecklistItem): string | null {
  const unit = item.unit?.trim() ? ` ${item.unit.trim()}` : ''
  const { warnMin, warnMax } = item
  if (warnMin != null && warnMax != null) return `Warning outside ${warnMin} to ${warnMax}${unit}`
  if (warnMax != null) return `Warning above ${warnMax}${unit}`
  if (warnMin != null) return `Warning below ${warnMin}${unit}`
  return null
}

function limitError({ min, max, warnMin, warnMax }: ChecklistItem): string | null {
  if (min != null && max != null && min > max) return 'The fail-below limit sits above the fail-above limit.'
  if (warnMin != null && warnMax != null && warnMin > warnMax) return 'The warn-below limit sits above the warn-above limit.'
  if (warnMin != null && min != null && warnMin < min) return 'Warn below must sit inside the fail limits.'
  if (warnMax != null && max != null && warnMax > max) return 'Warn above must sit inside the fail limits.'
  return null
}

function taskError(item: ChecklistItem): string | null {
  if (!item.label.trim()) return 'Write what the technician checks.'
  if (item.type === 'measurement' && !item.unit?.trim()) return 'Add a unit, such as °C or mm/s.'
  if (item.type === 'measurement' || item.type === 'number') return limitError(item)
  if (item.type === 'choice') {
    const options = (item.options ?? []).map((o) => o.trim())
    if (options.length < 2) return 'Give at least two options.'
    if (options.some((o) => !o)) return 'Fill in or remove the empty option.'
    if (new Set(options.map((o) => o.toLowerCase())).size !== options.length) return 'Each option must be different.'
  }
  return null
}

export type PlanField = 'name' | 'group' | 'durationMin' | 'personnel' | 'skill' | 'tasks' | 'parts'

export interface PlanErrors {
  fields: Partial<Record<PlanField, string>>
  /** Task id → message */
  tasks: Record<string, string>
}

/** `group` is checked only for new plans; saved plans keep their code. */
export function validatePlan(plan: JobPlan, group: string | null): PlanErrors {
  const fields: Partial<Record<PlanField, string>> = {}
  if (!plan.name.trim()) fields.name = 'Give the plan a name.'
  if (group !== null && !/^[A-Z0-9]{2,4}$/.test(group)) fields.group = 'Pick or type a group of 2 to 4 letters, such as POL.'
  if (!(plan.durationMin >= 5)) fields.durationMin = 'Enter at least 5 minutes.'
  if (!(plan.personnel >= 1)) fields.personnel = 'At least 1 person.'
  if (!plan.skillId) fields.skill = 'Choose the skill the job needs.'
  if (!plan.tasks.length) fields.tasks = 'Add at least one checklist line.'
  if (plan.parts.some((p) => p.partId && !(p.qty > 0))) fields.parts = 'Each part needs a quantity above 0.'
  const tasks: Record<string, string> = {}
  for (const item of plan.tasks) {
    const message = taskError(item)
    if (message) tasks[item.id] = message
  }
  return { fields, tasks }
}

export const hasErrors = (e: PlanErrors) => Object.keys(e.fields).length > 0 || Object.keys(e.tasks).length > 0

/** The message to lead with when a save is refused. */
export function firstError(errors: PlanErrors, tasks: readonly ChecklistItem[]): string | undefined {
  const field = Object.values(errors.fields)[0]
  if (field) return field
  const task = tasks.find((t) => errors.tasks[t.id])
  return task ? `Line ${tasks.indexOf(task) + 1}: ${errors.tasks[task.id]}` : undefined
}

/** Keeps only the fields a line's type uses, trimmed, in a fixed key order. */
function normalizeTask(item: ChecklistItem): ChecklistItem {
  const out: ChecklistItem = { id: item.id, label: item.label.trim(), type: item.type, required: item.required }
  if (item.type === 'measurement' || item.type === 'number') {
    const unit = item.unit?.trim()
    if (unit) out.unit = unit
    for (const key of ['min', 'max', 'warnMin', 'warnMax'] as const) {
      const value = item[key]
      if (value != null) out[key] = value
    }
  }
  if (item.type === 'choice') out.options = (item.options ?? []).map((o) => o.trim()).filter(Boolean)
  const help = item.help?.trim()
  if (help) out.help = help
  return out
}

/** Drops rows without a part and adds up repeated parts. */
function mergeParts(parts: readonly JobPlanPart[]): JobPlanPart[] {
  const merged = new Map<string, number>()
  for (const { partId, qty } of parts) if (partId) merged.set(partId, (merged.get(partId) ?? 0) + qty)
  return [...merged].map(([partId, qty]) => ({ partId, qty }))
}

export function normalizePlan(plan: JobPlan): JobPlan {
  return {
    ...plan,
    name: plan.name.trim(),
    description: plan.description.trim(),
    acceptance: plan.acceptance.trim(),
    sop: plan.sop.trim(),
    parts: mergeParts(plan.parts),
    safety: { ...plan.safety, notes: plan.safety.notes.trim() },
    tasks: plan.tasks.map(normalizeTask),
  }
}

const content = (plan: JobPlan) => {
  const p = normalizePlan(plan)
  return JSON.stringify([
    p.name,
    p.description,
    p.woType,
    p.assetTypeIds,
    p.durationMin,
    p.skillId,
    p.skillLevel,
    p.personnel,
    p.toolCategories,
    p.parts,
    p.safety.loto,
    p.safety.hazardIds,
    p.safety.ppeIds,
    p.safety.notes,
    p.tasks,
    p.acceptance,
    p.sop,
    p.active,
  ])
}

/** Same editable content; revision and timestamps don't count. */
export const samePlan = (a: JobPlan, b: JobPlan) => content(a) === content(b)

/** "PM-0001, PM-0002 and PM-0003" */
export function listText(items: readonly string[]): string {
  if (items.length < 2) return items.join('')
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`
}
