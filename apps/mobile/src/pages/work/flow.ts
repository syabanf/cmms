import { isFailureWork, taskProgress } from '@cmms/fixtures'
import type { FailureCodeKind, FailureReport, WorkOrder } from '@cmms/types'
import { DONE_WO_STATUSES, FAILURE_CODE_KINDS } from '@cmms/types'
import { needsSafety, safetyPending } from '../../lib/work'

export type StepId = 'job' | 'safety' | 'checklist' | 'parts' | 'findings' | 'finish'

export const STEPS: { id: StepId; label: string; title: string }[] = [
  { id: 'job', label: 'Job', title: 'The job' },
  { id: 'safety', label: 'Safety', title: 'Safety check' },
  { id: 'checklist', label: 'Checklist', title: 'Checklist' },
  { id: 'parts', label: 'Parts', title: 'Parts and tools' },
  { id: 'findings', label: 'Findings', title: 'Findings' },
  { id: 'finish', label: 'Finish', title: 'Finish' },
]

export const isStepId = (value: string | null): value is StepId => STEPS.some((s) => s.id === value)

export interface StepNav {
  back: (() => void) | null
  /** Null while the next step is still locked. */
  next: (() => void) | null
  go: (step: StepId) => void
}

export interface StepAccess {
  /** A technician on the work order; everyone else gets the read-only view. */
  assigned: boolean
  /** Assigned, and the order is open for changes (not a draft, not finished). */
  editable: boolean
  /** Assigned and in progress: readings and the clock need hands on the job. */
  working: boolean
}

export interface StepProps {
  wo: WorkOrder
  nav: StepNav
  access: StepAccess
}

export const FAILURE_FIELD: Record<FailureCodeKind, Exclude<keyof FailureReport, 'note'>> = {
  problem: 'problemId',
  mode: 'modeId',
  cause: 'causeId',
  remedy: 'remedyId',
}

const isFinished = (wo: WorkOrder) => DONE_WO_STATUSES.includes(wo.status)

/** Hands are on the job: started, paused, or already done. */
export const hasBegun = (wo: WorkOrder) =>
  wo.startedAt !== null || wo.status === 'in_progress' || wo.status === 'waiting' || isFinished(wo)

/** Reserved or issued lines still waiting for a used-or-returned decision. */
export const pendingParts = (wo: WorkOrder) => wo.parts.filter((l) => l.status === 'reserved' || l.status === 'issued')

/** Breakdown work must be fully coded; planned work may skip failure coding. */
export const missingFailureCodes = (wo: WorkOrder): FailureCodeKind[] =>
  isFailureWork(wo) ? FAILURE_CODE_KINDS.filter((kind) => !wo.failure?.[FAILURE_FIELD[kind]]) : []

export interface StepStatus {
  /** Earlier steps are done, so this one may open. */
  reachable: boolean
  done: boolean
  /** The job needs no safety step. */
  skipped: boolean
}

/** Where each step stands. Everything derives from the work order, so a refresh lands in the same place. */
export function flowStatus(wo: WorkOrder): Record<StepId, StepStatus> {
  const finished = isFinished(wo)
  const begun = hasBegun(wo)
  const safetyNeeded = needsSafety(wo)
  const safetyOk = !safetyNeeded || !!wo.safety.confirmedBy || finished
  const checklistOpen = begun && safetyOk
  const checklistDone = checklistOpen && (finished || taskProgress(wo.tasks).missingRequired === 0)
  const partsDone = checklistDone && (finished || pendingParts(wo).length === 0)
  const findingsDone = partsDone && (finished || missingFailureCodes(wo).length === 0)
  return {
    job: { reachable: true, done: begun, skipped: false },
    safety: { reachable: safetyNeeded, done: safetyNeeded && safetyOk, skipped: !safetyNeeded },
    checklist: { reachable: checklistOpen, done: checklistDone, skipped: false },
    parts: { reachable: checklistDone, done: partsDone, skipped: false },
    findings: { reachable: partsDone, done: findingsDone, skipped: false },
    finish: { reachable: findingsDone, done: finished, skipped: false },
  }
}

/** The step to open when the link names none. */
export function autoStep(wo: WorkOrder): StepId {
  if (isFinished(wo)) return 'finish'
  if (wo.status !== 'in_progress') return 'job'
  if (safetyPending(wo)) return 'safety'
  if (taskProgress(wo.tasks).missingRequired > 0) return 'checklist'
  return 'parts'
}

/** The neighbouring step in the given direction, passing over a skipped safety step. */
export function stepBeside(step: StepId, direction: 1 | -1, status: Record<StepId, StepStatus>): StepId | null {
  let index = STEPS.findIndex((s) => s.id === step) + direction
  while (index >= 0 && index < STEPS.length) {
    const candidate = STEPS[index]!.id
    if (!status[candidate].skipped) return candidate
    index += direction
  }
  return null
}

/** "Sprocket teeth condition, Run test and 2 more" */
export function listNames(names: string[], shown = 2): string {
  const head = names.slice(0, shown).join(', ')
  return names.length > shown ? `${head} and ${names.length - shown} more` : head
}
