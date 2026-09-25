import { fmtTime, isActive, isOverdue } from '@cmms/fixtures'
import { Banner, Button, Card, PillTabs } from '@cmms/ui'
import { BadgeCheck, CirclePause, ClipboardCheck, Siren, TriangleAlert } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { useAuth } from '../../auth/auth'
import { usePersistentState } from '../../lib/storage'
import { useNow, useScoped } from '../../state/scoped'
import { OperationsView } from './OperationsView'
import { ReliabilityView } from './ReliabilityView'

export function DashboardPage() {
  const now = useNow(60_000)
  const { site, workOrders, user } = useScoped()
  const { can } = useAuth()
  const [view, setView] = usePersistentState('cmms.admin.dashboard.view', 'operations')
  const pending = workOrders.filter(
    (w) =>
      w.approval?.status === 'pending' &&
      (w.approval.level === 'supervisor' || user.role === 'manager' || user.role === 'admin'),
  ).length
  const active = workOrders.filter(isActive)
  const attention = {
    critical: active.filter((w) => w.priority === 'P1').length,
    overdue: active.filter((w) => isOverdue(w, now)).length,
    waiting: active.filter((w) => w.status === 'waiting').length,
  }

  return (
    <div className="space-y-4">
      <h1 className="sr-only">Dashboard</h1>
      {can('wo.approve') && pending > 0 && (
        <Banner
          tone="info"
          icon={<BadgeCheck />}
          title={`${pending} work ${pending === 1 ? 'order waits' : 'orders wait'} for your approval.`}
          action={
            <Button asChild size="sm">
              <Link to="/work/approvals">Review</Link>
            </Button>
          }
        >
          Drafts stay blocked until someone signs them off.
        </Banner>
      )}
      <div className="gap-2 flex flex-wrap items-center justify-between">
        <PillTabs
          value={view}
          onValueChange={setView}
          items={[
            { value: 'operations', label: 'Operations' },
            { value: 'reliability', label: 'Reliability' },
          ]}
        />
        <p className="text-xs md:block hidden text-muted">
          {site.name} · updated {fmtTime(now)} WIB
        </p>
      </div>
      <Card className="p-4" aria-labelledby="attention-title">
        <div className="gap-3 flex flex-wrap items-center justify-between">
          <div>
            <h2 id="attention-title" className="font-semibold">
              Needs attention
            </h2>
            <p className="text-xs text-muted">Open the queue that needs action first.</p>
          </div>
          <div className="gap-2 sm:w-auto sm:grid-cols-4 grid w-full grid-cols-2">
            <AttentionLink
              to="/work/orders"
              icon={<Siren />}
              label="P1 work"
              count={attention.critical}
              urgent
            />
            <AttentionLink
              to="/work/orders?view=overdue"
              icon={<TriangleAlert />}
              label="Overdue"
              count={attention.overdue}
              urgent
            />
            <AttentionLink
              to="/work/orders"
              icon={<CirclePause />}
              label="Waiting"
              count={attention.waiting}
            />
            <AttentionLink to="/work/approvals" icon={<ClipboardCheck />} label="Approvals" count={pending} />
          </div>
        </div>
      </Card>
      {view === 'reliability' ? <ReliabilityView now={now} /> : <OperationsView now={now} />}
    </div>
  )
}

function AttentionLink({
  to,
  icon,
  label,
  count,
  urgent = false,
}: {
  to: string
  icon: ReactNode
  label: string
  count: number
  urgent?: boolean
}) {
  return (
    <Link
      to={to}
      className={`min-w-32 gap-3 rounded-2xl px-3 py-2.5 flex items-center transition-colors focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:outline-none ${
        urgent && count > 0
          ? 'bg-accent-soft text-accent-strong hover:bg-accent-soft/70'
          : 'bg-surface text-foreground hover:bg-surface-2'
      }`}
    >
      <span aria-hidden="true" className="[&_svg]:size-4">
        {icon}
      </span>
      <span className="min-w-0">
        <span className="text-lg font-bold block leading-none tabular-nums">{count}</span>
        <span className="font-semibold block truncate text-[11px]">{label}</span>
      </span>
    </Link>
  )
}
