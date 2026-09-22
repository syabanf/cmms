import { fmtWhen, isActive, isOverdue } from '@cmms/fixtures'
import type { WorkOrder } from '@cmms/types'
import { WO_TYPE_LABEL } from '@cmms/types'
import { Badge, Card, cn } from '@cmms/ui'
import { Clock } from 'lucide-react'
import { PriorityBadge, WoStatusBadge } from '../../components/badges'
import { WoTypeIcon } from '../../components/icons'
import { dueText } from '../../lib/time'
import { useMobileScope } from '../../state/scope'

const onInkBadge = 'bg-white/10 text-white'

export function WoHero({ wo, now }: { wo: WorkOrder; now: number }) {
  const { maps } = useMobileScope()
  const asset = maps.asset.get(wo.assetId)
  const when = isActive(wo)
    ? `${dueText(wo.dueAt, now)} · ${fmtWhen(wo.dueAt, now)}`
    : wo.completedAt
      ? `Completed ${fmtWhen(wo.completedAt, now)}`
      : 'Cancelled'

  return (
    <Card variant="ink" className="p-6">
      <div className="flex items-start justify-between gap-3">
        <span className="flex size-12 items-center justify-center rounded-2xl bg-white/10 [&_svg]:size-5">
          <WoTypeIcon type={wo.type} />
        </span>
        <WoStatusBadge status={wo.status} waitingReason={wo.waitingReason} />
      </div>
      <p className="mt-5 truncate text-sm text-on-ink-muted">
        {asset?.name ?? 'Removed asset'} · <span className="font-mono">{asset?.code}</span>
      </p>
      <h2 className="mt-1 text-xl font-bold leading-snug">{wo.title}</h2>
      <div className="mt-3 flex flex-wrap gap-2">
        <PriorityBadge priority={wo.priority} />
        <Badge className={onInkBadge}>{WO_TYPE_LABEL[wo.type]}</Badge>
        {wo.downtime && isActive(wo) && <Badge className={onInkBadge}>Production stopped</Badge>}
      </div>
      <p className={cn('mt-5 flex items-center gap-2 text-sm font-semibold tabular-nums', isOverdue(wo, now) ? 'text-accent' : 'text-white')}>
        <Clock aria-hidden="true" className="size-4 shrink-0" />
        {when}
      </p>
    </Card>
  )
}
