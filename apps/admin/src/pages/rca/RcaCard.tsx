import { fmtDate, plural } from '@cmms/fixtures'
import type { Rca } from '@cmms/types'
import { RCA_TRIGGER_LABEL } from '@cmms/types'
import { Badge, Card, ProgressBar, cn } from '@cmms/ui'
import { Link } from 'react-router'
import { RcaStatusBadge } from '../../components/badges'
import { PersonChip, paths } from '../../components/links'
import { useScoped } from '../../state/scoped'
import { doneCount, isPastDue, overdueActions } from './lib'

/** Gallery card for one RCA. The title link stretches over the whole card. */
export function RcaCard({ rca, now }: { rca: Rca; now: number }) {
  const { maps } = useScoped()
  const asset = maps.asset.get(rca.assetId)
  const mode = rca.modeId ? maps.failureCode.get(rca.modeId)?.name : undefined
  const done = doneCount(rca.actions)
  const total = rca.actions.length
  const closed = rca.status === 'closed'
  const late = !closed && isPastDue(rca.dueAt, now)
  const overdue = overdueActions(rca.actions, now).length

  return (
    <Card className={cn('relative flex flex-col p-5 transition-colors hover:bg-surface-2', closed && 'bg-card/70')}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-mono text-xs text-muted">{rca.code}</p>
          <h3 className="mt-1 text-base font-semibold leading-snug">
            <Link
              to={paths.rca(rca.id)}
              className="after:absolute after:inset-0 after:rounded-card focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-accent/40"
            >
              {rca.title}
            </Link>
          </h3>
          <p className="mt-1 truncate text-sm text-muted">
            {asset ? `${asset.name} · ${asset.code}` : 'Removed asset'}
            {mode && ` · ${mode}`}
          </p>
        </div>
        <RcaStatusBadge status={rca.status} />
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        <Badge variant="outline">{RCA_TRIGGER_LABEL[rca.trigger]}</Badge>
        <Badge variant="muted">{plural(rca.woIds.length, 'linked failure')}</Badge>
        {overdue > 0 && (
          <Badge variant="danger" dot>
            {plural(overdue, 'overdue action')}
          </Badge>
        )}
      </div>

      <div className="mt-4">
        <div className="flex items-center justify-between gap-2 text-xs">
          <span className="font-medium text-body">Corrective and preventive actions</span>
          <span className="tabular-nums text-muted">{total ? `${done} of ${total} done` : 'None yet'}</span>
        </div>
        <ProgressBar value={total ? done / total : 0} tone={total > 0 && done === total ? 'success' : 'ink'} className="mt-1.5" aria-label="Actions done" />
      </div>

      <div className="mt-auto pt-4">
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3 text-sm">
          <PersonChip personId={rca.ownerId} hint="owner" />
          <span className={cn('tabular-nums', late ? 'font-semibold text-accent' : 'text-muted')}>
            {closed && rca.closedAt ? `Closed ${fmtDate(rca.closedAt)}` : `Due ${fmtDate(rca.dueAt)}${late ? ' · late' : ''}`}
          </span>
        </div>
      </div>
    </Card>
  )
}
