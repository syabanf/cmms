import { fmtWhen, isOverdue, needsVerification } from '@cmms/fixtures'
import type { WorkOrder } from '@cmms/types'
import { Card, EmptyState, IconTile, Steps, cn } from '@cmms/ui'
import { ChevronRight, ClipboardCheck, ClipboardList } from 'lucide-react'
import { Link } from 'react-router'
import { PriorityBadge } from '../../components/badges'
import { WoTypeIcon } from '../../components/icons'
import { PeopleStack, paths } from '../../components/links'
import { woSteps } from '../../lib/wo-steps'
import { useScoped } from '../../state/scoped'
import { type MachineInfo, lateBy } from './lib'

/** Where one work order stands: its lifecycle pills and a row that opens it. */
export function TrackingCard({
  wo,
  machine,
  now,
  className,
}: {
  wo: WorkOrder | undefined
  machine: MachineInfo | undefined
  now: number
  className?: string
}) {
  const { maps, settings } = useScoped()
  const late = wo && isOverdue(wo, now)

  return (
    <Card className={cn('p-4', className)}>
      <div className="gap-2 flex flex-wrap items-center justify-between">
        <h2 className="gap-2 text-base font-semibold flex items-center">
          <IconTile size="sm" tone="info">
            <ClipboardList />
          </IconTile>
          Work order tracking
        </h2>
        <span className="min-w-0 text-xs truncate text-muted">
          {machine ? `${machine.asset.code} · ${machine.asset.name}` : 'Most urgent at this site'}
        </span>
      </div>
      {wo ? (
        <>
          <div className="mt-3 rounded-2xl px-2 pt-2 bg-surface">
            <Steps steps={woSteps(wo, needsVerification(maps.asset.get(wo.assetId), settings))} />
          </div>
          <Link
            to={paths.workOrder(wo.id)}
            className="mt-3 gap-3 rounded-2xl p-3 flex items-center bg-surface-2 transition-colors hover:bg-surface focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:outline-none"
          >
            <span className="size-10 rounded-xl flex shrink-0 items-center justify-center bg-card text-body shadow-card [&_svg]:size-[18px]">
              <WoTypeIcon type={wo.type} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="text-sm font-semibold block truncate">{wo.title}</span>
              <span className="text-xs block truncate text-muted">
                <span className="font-mono">{wo.code}</span> ·{' '}
                {late ? (
                  <span className="font-semibold text-accent">{lateBy(wo.dueAt, now)}</span>
                ) : (
                  `Due ${fmtWhen(wo.dueAt, now)}`
                )}
              </span>
            </span>
            <PriorityBadge priority={wo.priority} />
            <span className="sm:block hidden">
              <PeopleStack personIds={wo.assigneeIds} size="xs" />
            </span>
            <ChevronRight aria-hidden="true" className="size-4 shrink-0 text-muted" />
          </Link>
        </>
      ) : (
        <EmptyState
          compact
          icon={<ClipboardCheck />}
          title={machine ? `No open work on ${machine.asset.code}` : 'No open work at this site'}
          description="New work orders from requests and PM schedules show their progress here."
        />
      )}
    </Card>
  )
}
