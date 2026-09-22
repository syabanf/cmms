import {
  fmtDate,
  fmtIdrShort,
  fmtWhen,
  isActive,
  isDone,
  isOverdue,
  subtreeIds,
  toMs,
  urgency,
  woCost,
} from '@cmms/fixtures'
import type { Asset, WorkOrder } from '@cmms/types'
import { Button, EmptyState, IconTile, cn } from '@cmms/ui'
import { ClipboardCheck, Plus } from 'lucide-react'
import { useMemo } from 'react'
import { useAuth } from '../../auth/auth'
import { PriorityBadge, WoStatusBadge } from '../../components/badges'
import { useCreate } from '../../components/create'
import { WoTypeIcon } from '../../components/icons'
import { WoLink } from '../../components/links'
import { useScoped } from '../../state/scoped'
import { SectionTitle } from './ui'

const RECENT = 10

/** Open and recently closed work on the asset and its components. */
export function WorkTab({
  asset,
  now,
  onShowHistory,
}: {
  asset: Asset
  now: number
  onShowHistory: () => void
}) {
  const { assets, workOrders } = useScoped()
  const { can } = useAuth()
  const create = useCreate()

  const { open, closed, closedTotal } = useMemo(() => {
    const ids = subtreeIds(assets, asset.id)
    const mine = workOrders.filter((w) => ids.has(w.assetId))
    const done = mine
      .flatMap((wo) => (isDone(wo) && wo.completedAt ? [{ wo, at: toMs(wo.completedAt) }] : []))
      .sort((a, b) => b.at - a.at)
    return {
      open: mine.filter(isActive).sort((a, b) => urgency(a, now) - urgency(b, now)),
      closed: done.slice(0, RECENT).map((d) => d.wo),
      closedTotal: done.length,
    }
  }, [assets, workOrders, asset.id, now])

  return (
    <div className="space-y-8">
      <section>
        <SectionTitle
          count={open.length}
          action={
            can('wo.create') && (
              <Button variant="outline" size="sm" onClick={() => create.workOrder({ assetId: asset.id })}>
                <Plus />
                New work order
              </Button>
            )
          }
        >
          Open work
        </SectionTitle>
        {open.length ? (
          <ul className="space-y-2">
            {open.map((wo) => (
              <WoRow key={wo.id} wo={wo} assetId={asset.id} now={now} />
            ))}
          </ul>
        ) : (
          <EmptyState
            compact
            icon={<ClipboardCheck />}
            title="No open work on this asset"
            description="When something sounds or runs wrong, report it so a supervisor can plan the repair."
            action={
              can('request.create') && (
                <Button variant="outline" onClick={() => create.request(asset.id)}>
                  Report a problem
                </Button>
              )
            }
          />
        )}
      </section>

      <section>
        <SectionTitle
          action={
            closedTotal > RECENT && (
              <Button variant="ghost" size="sm" onClick={onShowHistory}>
                Full history
              </Button>
            )
          }
        >
          Recently closed
        </SectionTitle>
        {closed.length ? (
          <>
            <ul className="space-y-2">
              {closed.map((wo) => (
                <WoRow key={wo.id} wo={wo} assetId={asset.id} now={now} />
              ))}
            </ul>
            {closedTotal > RECENT && (
              <p className="mt-3 text-xs text-muted">
                Showing the last {RECENT} of {closedTotal} closed work orders.
              </p>
            )}
          </>
        ) : (
          <p className="text-sm text-muted">Nothing closed yet. Completed work lands here with its cost.</p>
        )}
      </section>
    </div>
  )
}

function WoRow({ wo, assetId, now }: { wo: WorkOrder; assetId: string; now: number }) {
  const { maps, personName } = useScoped()
  const component = wo.assetId !== assetId ? maps.asset.get(wo.assetId) : undefined
  const done = isDone(wo)
  const overdue = isOverdue(wo, now)
  const urgent = !done && wo.priority === 'P1'

  return (
    <li className="flex flex-wrap items-center gap-3 rounded-2xl bg-surface-2 p-3">
      <IconTile size="sm" tone={urgent ? 'danger' : 'default'} className={cn(!urgent && 'bg-card')}>
        <WoTypeIcon type={wo.type} />
      </IconTile>
      <div className="min-w-0 flex-1 basis-48">
        <p className="truncate text-sm font-semibold">{wo.title}</p>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted">
          <WoLink woId={wo.id} />
          {component && <span className="font-mono">{component.code}</span>}
          {done && wo.completedAt ? (
            <>
              <span>Completed {fmtDate(wo.completedAt)}</span>
              <span className="tabular-nums">{fmtIdrShort(woCost(wo, maps.person, now).total)}</span>
            </>
          ) : (
            <>
              <span className={cn(overdue && 'font-semibold text-accent')}>
                {overdue ? 'Overdue since' : 'Due'} {fmtWhen(wo.dueAt, now)}
              </span>
              <span>
                {wo.assigneeIds.length ? wo.assigneeIds.map((id) => personName(id)).join(', ') : 'Unassigned'}
              </span>
            </>
          )}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        {!done && <PriorityBadge priority={wo.priority} />}
        <WoStatusBadge status={wo.status} waitingReason={wo.waitingReason} />
      </div>
    </li>
  )
}
