import { fmtWhen } from '@cmms/fixtures'
import type { WoStatus, WorkOrder } from '@cmms/types'
import { WO_STATUS_LABEL } from '@cmms/types'
import type { StepState, StepsProps } from '@cmms/ui'

/** The lifecycle pills for a work order. Waiting and verified appear only when the order passes through them. */
export function woSteps(wo: WorkOrder, verificationNeeded: boolean): StepsProps['steps'] {
  const flow: WoStatus[] = [
    'draft',
    'open',
    'assigned',
    'in_progress',
    ...(wo.status === 'waiting' ? (['waiting'] as const) : []),
    'completed',
    ...(verificationNeeded || wo.status === 'verified' ? (['verified'] as const) : []),
    'closed',
  ]
  const current = wo.status === 'cancelled' ? -1 : flow.indexOf(wo.status)
  const hint: Partial<Record<WoStatus, string | null>> = {
    in_progress: wo.startedAt && fmtWhen(wo.startedAt),
    completed: wo.completedAt && fmtWhen(wo.completedAt),
    verified: wo.verification && fmtWhen(wo.verification.at),
    closed: wo.closedAt && fmtWhen(wo.closedAt),
  }
  return flow.map((status, i) => {
    const state: StepState =
      current < 0 ? 'skipped' : i < current ? 'done' : i === current ? 'current' : 'upcoming'
    return {
      key: status,
      label: WO_STATUS_LABEL[status],
      state,
      hint: state !== 'upcoming' ? (hint[status] ?? undefined) : undefined,
    }
  })
}
