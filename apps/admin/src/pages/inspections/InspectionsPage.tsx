import { DAY, fmtDateShort, fmtPercent, isActive, plural, startOfDay, toMs, worstOutcome } from '@cmms/fixtures'
import { Button, PageHeader, StatCard, UnderlineTabs } from '@cmms/ui'
import { CalendarClock, CircleCheck, ClipboardCheck, ClipboardPlus, OctagonX, TriangleAlert } from 'lucide-react'
import { useMemo } from 'react'
import { useSearchParams } from 'react-router'
import { useAuth } from '../../auth/auth'
import { useCreate } from '../../components/create'
import { useNow, useScoped } from '../../state/scoped'
import { completedInspections } from './lib'
import { ResultsTab } from './ResultsTab'
import { TrendsTab } from './TrendsTab'
import { UpcomingTab } from './UpcomingTab'

const TABS = ['results', 'upcoming', 'trends'] as const
type Tab = (typeof TABS)[number]
const asTab = (value: string | null): Tab => TABS.find((t) => t === value) ?? 'results'

const WINDOW_DAYS = 30

export function InspectionsPage() {
  const { workOrders, maps } = useScoped()
  const { can } = useAuth()
  const create = useCreate()
  const now = useNow(60_000)
  const [params, setParams] = useSearchParams()
  const tab = asTab(params.get('tab'))

  const done = useMemo(() => completedInspections(workOrders), [workOrders])
  const stats = useMemo(() => {
    const since = now - WINDOW_DAYS * DAY
    const recent = done.filter((w) => toMs(w.completedAt) >= since).map((wo) => ({ wo, outcome: worstOutcome(wo.tasks) }))
    const warnings = recent.filter((r) => r.outcome === 'warning')
    const fails = recent.filter((r) => r.outcome === 'fail').length
    const today = startOfDay(now)
    const open = workOrders.filter((w) => w.type === 'inspection' && isActive(w))
    return {
      recent: recent.length,
      passed: recent.length - warnings.length - fails,
      warnings: warnings.length,
      latestWarning: warnings[0]?.wo,
      fails,
      lastFail: done.find((w) => worstOutcome(w.tasks) === 'fail'),
      open: open.length,
      dueToday: open.filter((w) => toMs(w.dueAt) >= today && toMs(w.dueAt) < today + DAY).length,
      lateFromBefore: open.filter((w) => toMs(w.dueAt) < today).length,
    }
  }, [done, workOrders, now])

  const setTab = (next: string) =>
    setParams(
      (p) => {
        if (next === 'results') p.delete('tab')
        else p.set('tab', next)
        return p
      },
      { replace: true },
    )
  const showUpcoming = () => setTab('upcoming')
  const assetCode = (assetId: string) => maps.asset.get(assetId)?.code ?? 'a removed asset'

  return (
    <>
      <PageHeader
        title="Inspections"
        description="Technicians observe, measure and evaluate on each route. A warning or a fail raises a maintenance request."
        actions={
          can('wo.create') ? (
            <Button onClick={() => create.workOrder({ type: 'inspection' })}>
              <ClipboardPlus />
              New inspection
            </Button>
          ) : undefined
        }
      />

      <div className="no-scrollbar mb-4 flex snap-x snap-mandatory gap-3 overflow-x-auto pb-1 [&>*]:min-w-[72%] [&>*]:snap-start sm:grid sm:grid-cols-2 sm:gap-4 sm:overflow-visible sm:pb-0 sm:[&>*]:min-w-0 lg:grid-cols-3 xl:grid-cols-5">
        <StatCard label="Inspections done" value={stats.recent} hint={`Last ${WINDOW_DAYS} days`} icon={<ClipboardCheck />} tone="ink" />
        <StatCard
          label="Pass rate"
          value={stats.recent ? fmtPercent(stats.passed / stats.recent) : 'None'}
          hint={stats.recent ? `${stats.passed} of ${stats.recent} without findings` : 'No inspection in the window'}
          icon={<CircleCheck />}
          tone="success"
        />
        <StatCard
          label="Warnings"
          value={stats.warnings}
          hint={stats.latestWarning ? `Latest ${fmtDateShort(stats.latestWarning.completedAt)} on ${assetCode(stats.latestWarning.assetId)}` : `Last ${WINDOW_DAYS} days`}
          icon={<TriangleAlert />}
          tone="warning"
        />
        <StatCard
          label="Fails"
          value={stats.fails}
          hint={
            stats.fails
              ? 'Each one raised a request'
              : stats.lastFail
                ? `Last one ${fmtDateShort(stats.lastFail.completedAt)} on ${assetCode(stats.lastFail.assetId)}`
                : 'None recorded'
          }
          icon={<OctagonX />}
          tone={stats.fails ? 'danger' : 'default'}
        />
        <StatCard
          label="Due today"
          value={stats.dueToday}
          hint={stats.lateFromBefore ? `${stats.lateFromBefore} overdue from earlier days` : plural(stats.open, 'open inspection')}
          icon={<CalendarClock />}
          tone={stats.lateFromBefore ? 'danger' : 'default'}
          onClick={showUpcoming}
        />
      </div>

      <UnderlineTabs
        className="mb-4"
        value={tab}
        onValueChange={setTab}
        items={[
          { value: 'results', label: 'Results', count: done.length },
          { value: 'upcoming', label: 'Upcoming', count: stats.open },
          { value: 'trends', label: 'Trends' },
        ]}
      />

      {tab === 'results' && <ResultsTab done={done} onShowUpcoming={showUpcoming} />}
      {tab === 'upcoming' && <UpcomingTab now={now} />}
      {tab === 'trends' && <TrendsTab done={done} now={now} onShowUpcoming={showUpcoming} />}
    </>
  )
}
