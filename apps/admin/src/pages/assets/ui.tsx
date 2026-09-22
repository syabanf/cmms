import type { PmState } from '@cmms/fixtures'
import { Badge, type BadgeProps, Card } from '@cmms/ui'
import type { ReactNode } from 'react'
import { PM_STATE_LABEL, WARRANTY_STATE_LABEL, type WarrantyState } from './lib'

type Variant = NonNullable<BadgeProps['variant']>

/** Inspector card for the passport's right column: small-caps title, optional action. */
export function SideCard({
  title,
  action,
  children,
}: {
  title: string
  action?: ReactNode
  children: ReactNode
}) {
  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-2 px-5 pt-5 pb-3">
        <h2 className="text-[13px] font-bold tracking-[0.4px] text-body uppercase">{title}</h2>
        {action}
      </div>
      <div className="px-5 pb-5">{children}</div>
    </Card>
  )
}

/** Heading for a block inside a tab panel. */
export function SectionTitle({
  children,
  count,
  action,
}: {
  children: ReactNode
  count?: number
  action?: ReactNode
}) {
  return (
    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
      <h3 className="flex items-center gap-2 text-sm font-semibold">
        {children}
        {count !== undefined && (
          <span className="rounded-full bg-surface px-1.5 py-px text-[11px] font-bold text-body tabular-nums">
            {count}
          </span>
        )}
      </h3>
      {action}
    </div>
  )
}

const PM_VARIANT: Record<PmState, Variant> = {
  scheduled: 'muted',
  due_soon: 'warning',
  due: 'warning',
  overdue: 'danger',
}

export function PmStateBadge({ state, active }: { state: PmState; active: boolean }) {
  if (!active) return <Badge variant="muted">Paused</Badge>
  return <Badge variant={PM_VARIANT[state]}>{PM_STATE_LABEL[state]}</Badge>
}

const WARRANTY_VARIANT: Record<WarrantyState, Variant> = {
  active: 'success',
  expiring: 'warning',
  expired: 'muted',
}

export function WarrantyBadge({ state }: { state: WarrantyState }) {
  return (
    <Badge variant={WARRANTY_VARIANT[state]} dot>
      {WARRANTY_STATE_LABEL[state]}
    </Badge>
  )
}
