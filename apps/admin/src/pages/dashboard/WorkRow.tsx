import { fmtAgo, fmtWhen, isOverdue, plannedAt } from '@cmms/fixtures'
import type { WorkOrder } from '@cmms/types'
import { cn } from '@cmms/ui'
import { Link } from 'react-router'
import { PriorityBadge, WoStatusBadge } from '../../components/badges'
import { WoTypeIcon } from '../../components/icons'
import { paths } from '../../components/links'
import { useScoped } from '../../state/scoped'

/** Compact work order row for dashboard lists. */
export function WorkRow({ wo, now, dateMode = 'due' }: { wo: WorkOrder; now: number; dateMode?: 'due' | 'planned' }) {
  const { maps } = useScoped()
  const asset = maps.asset.get(wo.assetId)
  const overdue = isOverdue(wo, now)
  const when = dateMode === 'planned' ? plannedAt(wo) : wo.dueAt
  return (
    <Link to={paths.workOrder(wo.id)} className="flex items-start gap-3 rounded-2xl bg-surface-2 p-3 transition-colors hover:bg-card hover:shadow-card">
      <span
        className={cn(
          'flex size-10 shrink-0 items-center justify-center rounded-xl [&_svg]:size-[18px]',
          wo.priority === 'P1' ? 'bg-accent text-white' : wo.priority === 'P2' ? 'bg-accent-soft text-accent' : 'bg-card text-body',
        )}
      >
        <WoTypeIcon type={wo.type} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline justify-between gap-3">
          <span className="truncate text-sm font-semibold">{wo.title}</span>
          <span className={cn('shrink-0 text-xs tabular-nums', overdue ? 'font-semibold text-accent' : 'text-muted')}>
            {overdue ? `${fmtAgo(wo.dueAt, now).replace(' ago', '')} late` : fmtWhen(when, now)}
          </span>
        </span>
        <span className="block truncate text-xs text-muted">
          <span className="font-mono">{wo.code}</span> · {asset?.name ?? 'Unknown asset'}
        </span>
        <span className="mt-1.5 flex flex-wrap items-center gap-1.5">
          <PriorityBadge priority={wo.priority} />
          <WoStatusBadge status={wo.status} waitingReason={wo.waitingReason} />
        </span>
      </span>
    </Link>
  )
}
