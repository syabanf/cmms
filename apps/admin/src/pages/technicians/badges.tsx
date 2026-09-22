import { AVAILABILITY_LABEL } from '@cmms/types'
import { Badge, type BadgeProps, cn } from '@cmms/ui'
import { CERT_WARNING_DAYS, type Presence } from './lib'

type Variant = NonNullable<BadgeProps['variant']>

const PRESENCE: Record<Presence, { label: string; variant: Variant }> = {
  clocked_in: { label: 'Clocked in', variant: 'info' },
  on_shift: { label: AVAILABILITY_LABEL.on_shift, variant: 'success' },
  off_shift: { label: AVAILABILITY_LABEL.off_shift, variant: 'muted' },
  leave: { label: AVAILABILITY_LABEL.leave, variant: 'warning' },
}

export function PresenceBadge({ presence }: { presence: Presence }) {
  const { label, variant } = PRESENCE[presence]
  return (
    <Badge variant={variant}>
      <span
        aria-hidden="true"
        className={cn(
          'size-1.5 shrink-0 rounded-full bg-current',
          presence === 'clocked_in' && 'animate-pulse',
        )}
      />
      {label}
    </Badge>
  )
}

export function CertExpiryBadge({ daysLeft }: { daysLeft: number | null }) {
  if (daysLeft === null) return <Badge variant="muted">No expiry</Badge>
  if (daysLeft < 0) return <Badge variant="danger">Expired</Badge>
  if (daysLeft <= CERT_WARNING_DAYS)
    return <Badge variant="warning">{daysLeft === 0 ? 'Expires today' : `${daysLeft} days left`}</Badge>
  return <Badge variant="success">Valid</Badge>
}
