import { STOCK_STATE_LABEL, type StockState } from '@cmms/fixtures'
import type {
  ApprovalStatus,
  AssetStatus,
  CalibrationState as CalState,
  CheckOutcome,
  Criticality,
  Priority,
  RcaStatus,
  RequestStatus,
  Severity,
  ToolStatus,
  WaitingReason,
  WoStatus,
  WoType,
} from '@cmms/types'
import {
  APPROVAL_STATUS_LABEL,
  ASSET_STATUS_LABEL,
  CALIBRATION_STATE_LABEL,
  CHECK_OUTCOME_LABEL,
  CRITICALITY_LABEL,
  PRIORITY_LABEL,
  RCA_STATUS_LABEL,
  REQUEST_STATUS_LABEL,
  SEVERITY_LABEL,
  TOOL_STATUS_LABEL,
  WAITING_REASON_LABEL,
  WO_STATUS_LABEL,
  WO_TYPE_LABEL,
} from '@cmms/types'
import { Badge, type BadgeProps } from '@cmms/ui'

type Variant = NonNullable<BadgeProps['variant']>

const WO_STATUS_VARIANT: Record<WoStatus, Variant> = {
  draft: 'outline',
  open: 'default',
  assigned: 'default',
  in_progress: 'info',
  waiting: 'warning',
  completed: 'success',
  verified: 'success',
  closed: 'muted',
  cancelled: 'muted',
}

export function WoStatusBadge({ status, waitingReason }: { status: WoStatus; waitingReason?: WaitingReason | null }) {
  const label = status === 'waiting' && waitingReason ? `Waiting · ${WAITING_REASON_LABEL[waitingReason]}` : WO_STATUS_LABEL[status]
  return (
    <Badge variant={WO_STATUS_VARIANT[status]} dot={status === 'in_progress' || status === 'waiting'}>
      {label}
    </Badge>
  )
}

/** Status for table cells: the waiting reason drops to a second line so the column stays narrow. */
export function WoStatusCell({ status, waitingReason }: { status: WoStatus; waitingReason?: WaitingReason | null }) {
  return (
    <div>
      <WoStatusBadge status={status} />
      {status === 'waiting' && waitingReason && <p className="mt-1 whitespace-nowrap text-[11px] text-muted">{WAITING_REASON_LABEL[waitingReason]}</p>}
    </div>
  )
}

const PRIORITY_VARIANT: Record<Priority, Variant> = { P1: 'accent', P2: 'danger', P3: 'default', P4: 'muted' }

export function PriorityBadge({ priority, long = false }: { priority: Priority; long?: boolean }) {
  return (
    <Badge variant={PRIORITY_VARIANT[priority]} title={PRIORITY_LABEL[priority]}>
      {long ? `${priority} ${PRIORITY_LABEL[priority]}` : priority}
    </Badge>
  )
}

const CRITICALITY_VARIANT: Record<Criticality, Variant> = { A: 'danger', B: 'warning', C: 'default', D: 'muted' }

export function CriticalityBadge({ criticality, long = false }: { criticality: Criticality; long?: boolean }) {
  return (
    <Badge variant={CRITICALITY_VARIANT[criticality]} title={`Criticality ${criticality}: ${CRITICALITY_LABEL[criticality]}`}>
      {long ? `${criticality} · ${CRITICALITY_LABEL[criticality]}` : criticality}
    </Badge>
  )
}

export function WoTypeBadge({ type }: { type: WoType }) {
  return <Badge variant={type === 'emergency' ? 'danger' : 'outline'}>{WO_TYPE_LABEL[type]}</Badge>
}

const ASSET_STATUS_VARIANT: Record<AssetStatus, Variant> = {
  operational: 'success',
  down: 'accent',
  standby: 'muted',
  retired: 'muted',
}

export function AssetStatusBadge({ status }: { status: AssetStatus }) {
  return (
    <Badge variant={ASSET_STATUS_VARIANT[status]} dot>
      {ASSET_STATUS_LABEL[status]}
    </Badge>
  )
}

const REQUEST_VARIANT: Record<RequestStatus, Variant> = {
  new: 'accent',
  monitor: 'warning',
  converted: 'success',
  rejected: 'muted',
  duplicate: 'muted',
}

export function RequestStatusBadge({ status }: { status: RequestStatus }) {
  return <Badge variant={REQUEST_VARIANT[status]}>{REQUEST_STATUS_LABEL[status]}</Badge>
}

const SEVERITY_VARIANT: Record<Severity, Variant> = { critical: 'accent', high: 'danger', medium: 'warning', low: 'muted' }

export function SeverityBadge({ severity }: { severity: Severity }) {
  return (
    <Badge variant={SEVERITY_VARIANT[severity]} dot>
      {SEVERITY_LABEL[severity]}
    </Badge>
  )
}

const CAL_VARIANT: Record<CalState, Variant> = { valid: 'success', expiring: 'warning', expired: 'danger' }

export function CalibrationBadge({ state }: { state: CalState | null }) {
  if (!state) return <Badge variant="muted">Not required</Badge>
  return (
    <Badge variant={CAL_VARIANT[state]} dot>
      {CALIBRATION_STATE_LABEL[state]}
    </Badge>
  )
}

const STOCK_VARIANT: Record<StockState, Variant> = { ok: 'success', reorder: 'warning', shortage: 'danger', overstock: 'info' }

export function StockBadge({ state }: { state: StockState }) {
  return (
    <Badge variant={STOCK_VARIANT[state]} dot>
      {STOCK_STATE_LABEL[state]}
    </Badge>
  )
}

const OUTCOME_VARIANT: Record<CheckOutcome, Variant> = { pass: 'success', warning: 'warning', fail: 'danger' }

export function OutcomeBadge({ outcome }: { outcome: CheckOutcome | null }) {
  if (!outcome) return null
  return <Badge variant={OUTCOME_VARIANT[outcome]}>{CHECK_OUTCOME_LABEL[outcome]}</Badge>
}

const TOOL_VARIANT: Record<ToolStatus, Variant> = { available: 'success', in_use: 'info', calibration: 'info', maintenance: 'warning', lost: 'danger' }

export function ToolStatusBadge({ status }: { status: ToolStatus }) {
  return (
    <Badge variant={TOOL_VARIANT[status]} dot>
      {TOOL_STATUS_LABEL[status]}
    </Badge>
  )
}

const RCA_VARIANT: Record<RcaStatus, Variant> = { open: 'accent', analysis: 'warning', actions: 'info', closed: 'muted' }

export function RcaStatusBadge({ status }: { status: RcaStatus }) {
  return <Badge variant={RCA_VARIANT[status]}>{RCA_STATUS_LABEL[status]}</Badge>
}

const APPROVAL_VARIANT: Record<ApprovalStatus, Variant> = { pending: 'warning', approved: 'success', rejected: 'danger' }

export function ApprovalBadge({ status }: { status: ApprovalStatus }) {
  return <Badge variant={APPROVAL_VARIANT[status]}>{APPROVAL_STATUS_LABEL[status]}</Badge>
}
