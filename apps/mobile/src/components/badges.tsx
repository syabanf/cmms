import type {
  AssetStatus,
  CheckOutcome,
  Criticality,
  PartLineStatus,
  Priority,
  RequestStatus,
  Severity,
  WaitingReason,
  WoStatus,
} from '@cmms/types'
import {
  ASSET_STATUS_LABEL,
  CHECK_OUTCOME_LABEL,
  CRITICALITY_LABEL,
  PART_LINE_STATUS_LABEL,
  PRIORITY_LABEL,
  REQUEST_STATUS_LABEL,
  SEVERITY_LABEL,
  WAITING_REASON_LABEL,
  WO_STATUS_LABEL,
} from '@cmms/types'
import { Badge, type BadgeProps, StatusDot, type Tone, cn } from '@cmms/ui'

type Variant = NonNullable<BadgeProps['variant']>

export function woStatusLabel(status: WoStatus, waitingReason: WaitingReason | null) {
  return status === 'waiting' && waitingReason ? `Waiting · ${WAITING_REASON_LABEL[waitingReason]}` : WO_STATUS_LABEL[status]
}

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

export const WO_STATUS_TONE: Record<WoStatus, Tone> = {
  draft: 'default',
  open: 'default',
  assigned: 'ink',
  in_progress: 'info',
  waiting: 'warning',
  completed: 'success',
  verified: 'success',
  closed: 'default',
  cancelled: 'default',
}

export function WoStatusBadge({ status, waitingReason }: { status: WoStatus; waitingReason: WaitingReason | null }) {
  return (
    <Badge variant={WO_STATUS_VARIANT[status]} dot={status === 'in_progress' || status === 'waiting'}>
      {woStatusLabel(status, waitingReason)}
    </Badge>
  )
}

const PRIORITY_VARIANT: Record<Priority, Variant> = { P1: 'accent', P2: 'danger', P3: 'default', P4: 'muted' }

export function PriorityBadge({ priority }: { priority: Priority }) {
  return <Badge variant={PRIORITY_VARIANT[priority]}>{`${priority} ${PRIORITY_LABEL[priority]}`}</Badge>
}

const CRITICALITY_VARIANT: Record<Criticality, Variant> = { A: 'danger', B: 'warning', C: 'default', D: 'muted' }

export function CriticalityBadge({ criticality }: { criticality: Criticality }) {
  return <Badge variant={CRITICALITY_VARIANT[criticality]}>{`Class ${criticality} · ${CRITICALITY_LABEL[criticality]}`}</Badge>
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

export const REQUEST_STATUS_TONE: Record<RequestStatus, Tone> = {
  new: 'accent',
  monitor: 'warning',
  converted: 'success',
  rejected: 'default',
  duplicate: 'default',
}

export function RequestStatusBadge({ status }: { status: RequestStatus }) {
  return <Badge variant={REQUEST_VARIANT[status]}>{REQUEST_STATUS_LABEL[status]}</Badge>
}

export const SEVERITY_TONE: Record<Severity, Tone> = { critical: 'accent', high: 'warning', medium: 'info', low: 'default' }

const SEVERITY_VARIANT: Record<Severity, Variant> = { critical: 'accent', high: 'warning', medium: 'info', low: 'muted' }

export function SeverityBadge({ severity }: { severity: Severity }) {
  return (
    <Badge variant={SEVERITY_VARIANT[severity]} dot>
      {`${SEVERITY_LABEL[severity]} severity`}
    </Badge>
  )
}

const OUTCOME_VARIANT: Record<CheckOutcome, Variant> = { pass: 'success', warning: 'warning', fail: 'danger' }

export function OutcomeBadge({ outcome }: { outcome: CheckOutcome | null }) {
  if (!outcome) return null
  return <Badge variant={OUTCOME_VARIANT[outcome]}>{CHECK_OUTCOME_LABEL[outcome]}</Badge>
}

const PART_VARIANT: Record<PartLineStatus, Variant> = {
  reserved: 'info',
  issued: 'warning',
  consumed: 'success',
  returned: 'muted',
}

export function PartStatusBadge({ status }: { status: PartLineStatus }) {
  return <Badge variant={PART_VARIANT[status]}>{PART_LINE_STATUS_LABEL[status]}</Badge>
}

/** Status text with a dot, for the title row of mobile cards. */
export function StatusText({ tone, label, className }: { tone: Tone; label: string; className?: string }) {
  return (
    <span className={cn('flex shrink-0 items-center gap-1.5 text-[11px] font-semibold text-body', className)}>
      <StatusDot tone={tone} className="size-1.5" />
      {label}
    </span>
  )
}
