import { fmtWhen, isActive, isOverdue } from '@cmms/fixtures'
import type { WorkOrder } from '@cmms/types'
import { PLANNED_WO_TYPES, PRIORITY_LABEL } from '@cmms/types'
import { cn } from '@cmms/ui'
import { Link } from 'react-router'
import { paths } from '../lib/paths'
import { useMobileScope } from '../state/scope'
import { StatusText, WO_STATUS_TONE, woStatusLabel } from './badges'
import { WoTypeIcon } from './icons'

/** Leading tile: the P1 job in accent, planned work in info, finished work greyed out. */
export function woTileClass(wo: WorkOrder) {
  if (!isActive(wo)) return 'bg-surface text-muted'
  if (wo.priority === 'P1') return 'bg-accent text-white'
  if (PLANNED_WO_TYPES.includes(wo.type)) return 'bg-info-soft text-info'
  return 'bg-surface text-body'
}

/** The time that matters for a card: completion, the missed due time, the planned start, or the due time. */
function woWhen(wo: WorkOrder, now: number) {
  if (!isActive(wo) && wo.completedAt) return { label: 'Completed', at: fmtWhen(wo.completedAt, now) }
  if (wo.scheduledAt && !isOverdue(wo, now)) return { label: 'Planned', at: fmtWhen(wo.scheduledAt, now) }
  return { label: 'Due', at: fmtWhen(wo.dueAt, now) }
}

export function WoCard({ wo, now }: { wo: WorkOrder; now: number }) {
  const { maps } = useMobileScope()
  const asset = maps.asset.get(wo.assetId)
  const active = isActive(wo)
  const when = woWhen(wo, now)
  return (
    <Link
      to={paths.workOrder(wo.id)}
      className={cn(
        'block rounded-[24px] p-4 shadow-card transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 active:scale-[0.98]',
        active ? 'bg-card' : 'bg-card/70',
      )}
    >
      <div className="flex items-center gap-3">
        <span className={cn('flex size-12 shrink-0 items-center justify-center rounded-full [&_svg]:size-5', woTileClass(wo))}>
          <WoTypeIcon type={wo.type} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <span className="truncate font-mono text-[13px] font-semibold">{wo.code}</span>
            <StatusText tone={WO_STATUS_TONE[wo.status]} label={woStatusLabel(wo.status, wo.waitingReason)} />
          </div>
          <p className="mt-0.5 truncate text-[13px] text-muted">{asset ? `${asset.name} · ${asset.code}` : 'Removed asset'}</p>
        </div>
      </div>
      <p className={cn('mt-3 text-[15px] font-semibold leading-snug', !active && 'text-body')}>{wo.title}</p>
      <div className="mt-2.5 flex items-center justify-between gap-2">
        <span className="min-w-0 truncate text-sm tabular-nums">
          <span className="text-muted">{when.label} </span>
          <span className="font-bold">{when.at}</span>
        </span>
        {isOverdue(wo, now) ? (
          <span className="flex shrink-0 items-center gap-1.5 text-[11px] font-semibold text-accent">
            <span className="size-2 rounded-full bg-accent" />
            Overdue
          </span>
        ) : (
          <span className="shrink-0 text-[11px] font-semibold text-muted">{`${wo.priority} ${PRIORITY_LABEL[wo.priority]}`}</span>
        )}
      </div>
    </Link>
  )
}
