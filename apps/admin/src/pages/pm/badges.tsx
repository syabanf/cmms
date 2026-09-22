import type { PmState } from '@cmms/fixtures'
import { Badge, type BadgeProps } from '@cmms/ui'
import { PM_RESULT_LABEL, PM_STATE_LABEL, type PmResult } from './lib'

type Variant = NonNullable<BadgeProps['variant']>

const STATE_VARIANT: Record<PmState, Variant> = { overdue: 'danger', due: 'warning', due_soon: 'info', scheduled: 'default' }
const RESULT_VARIANT: Record<PmResult, Variant> = { on_time: 'success', late: 'warning', overdue: 'danger', open: 'default', cancelled: 'muted' }

/** Due state of a schedule. A paused schedule reads as paused whatever its dates say. */
export function PmStateBadge({ state }: { state: PmState | 'paused' }) {
  if (state === 'paused') return <Badge variant="outline">Paused</Badge>
  return (
    <Badge variant={STATE_VARIANT[state]} dot={state === 'overdue'}>
      {PM_STATE_LABEL[state]}
    </Badge>
  )
}

/** How a generated work order went against its due date. */
export function PmResultBadge({ result }: { result: PmResult }) {
  return <Badge variant={RESULT_VARIANT[result]}>{PM_RESULT_LABEL[result]}</Badge>
}
