import { fmtNumber, plural, toMs, wib } from '@cmms/fixtures'
import type { RcaStatus } from '@cmms/types'
import { RCA_STATUS_FLOW, RCA_STATUS_LABEL } from '@cmms/types'
import { Button, Card, EmptyState, PageHeader, PillTabs, StatCard, toast } from '@cmms/ui'
import { CalendarX, CircleCheck, Hourglass, Microscope, Plus } from 'lucide-react'
import { useMemo } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { useAuth } from '../../auth/auth'
import { paths } from '../../components/links'
import { useHistoryState } from '../../lib/history-state'
import { useNow, useScoped } from '../../state/scoped'
import { RcaCard } from './RcaCard'
import { RcaDialog } from './RcaDialog'
import { daysToClose, overdueActions } from './lib'

type Tab = 'all' | RcaStatus
const TABS: Tab[] = ['all', ...RCA_STATUS_FLOW]
const isTab = (value: unknown): value is Tab => TABS.some((t) => t === value)

export function RcaListPage() {
  const s = useScoped()
  const now = useNow(60_000)
  const navigate = useNavigate()
  const { can } = useAuth()
  const canManage = can('rca.manage')
  const [params, setParams] = useSearchParams()
  const [tab, setTab] = useHistoryState<Tab>('tab', 'all')
  const creating = canManage && params.get('new') === '1'

  const setCreating = (open: boolean) => {
    const next = new URLSearchParams(params)
    if (open) next.set('new', '1')
    else next.delete('new')
    setParams(next, { replace: true })
  }

  const sorted = useMemo(() => {
    const active = s.rcas.filter((r) => r.status !== 'closed').sort((a, b) => toMs(a.dueAt) - toMs(b.dueAt))
    const closed = s.rcas.filter((r) => r.status === 'closed').sort((a, b) => (b.closedAt ?? '').localeCompare(a.closedAt ?? ''))
    return [...active, ...closed]
  }, [s.rcas])

  const stats = useMemo(() => {
    const year = wib(now).year
    const count = (status: RcaStatus) => s.rcas.filter((r) => r.status === status).length
    const durations = s.rcas.map(daysToClose).filter((d): d is number => d !== null)
    return {
      year,
      byStatus: { open: count('open'), analysis: count('analysis'), actions: count('actions'), closed: count('closed') },
      overdue: s.rcas.flatMap((r) => overdueActions(r.actions, now)).length,
      closedThisYear: s.rcas.filter((r) => r.closedAt !== null && wib(toMs(r.closedAt)).year === year).length,
      avgDays: durations.length ? durations.reduce((sum, d) => sum + d, 0) / durations.length : null,
      closedCount: durations.length,
    }
  }, [s.rcas, now])

  const visible = tab === 'all' ? sorted : sorted.filter((r) => r.status === tab)
  const openCount = s.rcas.length - stats.byStatus.closed

  return (
    <>
      <PageHeader
        title="Root cause analysis"
        description="Find why a failure happens, then track the actions that stop it for good."
        actions={
          canManage ? (
            <Button onClick={() => setCreating(true)}>
              <Plus />
              New RCA
            </Button>
          ) : undefined
        }
      />

      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
          <StatCard
            label="Open RCAs"
            value={openCount}
            hint={`${stats.byStatus.analysis} in analysis, ${stats.byStatus.actions} running actions`}
            icon={<Microscope />}
            tone="ink"
          />
          <StatCard
            label="Overdue actions"
            value={stats.overdue}
            hint="Open actions past their due date"
            icon={<CalendarX />}
            tone={stats.overdue ? 'danger' : 'default'}
          />
          <StatCard label="Closed this year" value={stats.closedThisYear} hint={`In ${stats.year}`} icon={<CircleCheck />} tone="success" />
          <StatCard
            label="Average time to close"
            value={stats.avgDays === null ? 'None' : fmtNumber(stats.avgDays)}
            unit={stats.avgDays === null ? undefined : 'days'}
            hint={stats.closedCount ? `Across ${plural(stats.closedCount, 'closed RCA')}` : 'Nothing closed yet'}
            icon={<Hourglass />}
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <PillTabs
            value={tab}
            onValueChange={(value) => {
              if (isTab(value)) setTab(value)
            }}
            items={TABS.map((t) => ({
              value: t,
              label: t === 'all' ? 'All' : RCA_STATUS_LABEL[t],
              count: t === 'all' ? s.rcas.length : stats.byStatus[t],
            }))}
          />
          <p className="hidden text-xs text-muted md:block">Open work first, soonest due on top</p>
        </div>

        {visible.length ? (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {visible.map((rca) => (
              <RcaCard key={rca.id} rca={rca} now={now} />
            ))}
          </div>
        ) : (
          <Card>
            <EmptyState
              icon={<Microscope />}
              title={tab === 'all' ? 'No RCAs yet' : `No RCAs with status ${RCA_STATUS_LABEL[tab].toLowerCase()}`}
              description={
                tab === 'all'
                  ? 'Start one from a repeat failure on the Failures page, or open one here for a critical, costly or unsafe failure.'
                  : 'Pick another status, or open a new RCA.'
              }
              action={
                <div className="flex flex-wrap justify-center gap-2">
                  {canManage && (
                    <Button onClick={() => setCreating(true)}>
                      <Plus />
                      New RCA
                    </Button>
                  )}
                  <Button asChild variant="outline">
                    <Link to="/reliability/failures">See repeat failures</Link>
                  </Button>
                </div>
              }
            />
          </Card>
        )}
      </div>

      <RcaDialog
        open={creating}
        onOpenChange={setCreating}
        onSaved={(rca) => {
          toast(`${rca.code} created`, {
            tone: 'success',
            description: rca.woIds.length ? `${plural(rca.woIds.length, 'failure')} linked.` : 'Link the failures it explains next.',
          })
          navigate(paths.rca(rca.id))
        }}
      />
    </>
  )
}
