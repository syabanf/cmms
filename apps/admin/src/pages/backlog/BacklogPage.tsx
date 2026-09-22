import { backlogRows, backlogSummary, fmtAgo, fmtNumber, plural, toMs, urgency, weeklyCapacity } from '@cmms/fixtures'
import type { Priority, WaitingReason } from '@cmms/types'
import { PRIORITIES, PRIORITY_LABEL, WAITING_REASON_LABEL } from '@cmms/types'
import { Button, Card, CardDescription, CardHeader, CardTitle, Chip, EmptyState, PageHeader, PillTabs, StatCard } from '@cmms/ui'
import { CalendarDays, CalendarPlus, CalendarX, CirclePause, Clock, Hourglass } from 'lucide-react'
import { useMemo, useRef } from 'react'
import { Link } from 'react-router'
import { TeamPicker } from '../../components/pickers'
import { useHistoryState } from '../../lib/history-state'
import { useNow, useScoped } from '../../state/scoped'
import { AgeCard, WaitingCard } from './BacklogCharts'
import { BacklogTable } from './BacklogTable'
import { BACKLOG_VIEWS, type BacklogView, VIEW_TEST, asView, isReady, sumHours } from './lib'
import { WorkloadCard } from './WorkloadCard'

const VIEW_LABEL: Record<BacklogView, string> = {
  all: 'All',
  ready: 'Ready to schedule',
  blocked: 'Blocked',
  overdue: 'Overdue',
}

const EMPTY: Record<BacklogView, { title: string; description: string }> = {
  all: { title: 'No open work', description: 'Work from triaged requests and PM schedules shows up here until it is done.' },
  ready: { title: 'Everything open has a date', description: 'Open or assigned work without a scheduled start shows up here.' },
  blocked: { title: 'Nothing is waiting', description: 'Work on hold for parts, vendors or a production window shows up here.' },
  overdue: { title: 'Nothing is overdue', description: 'Open work past its due date shows up here first.' },
}

export function BacklogPage() {
  const s = useScoped()
  const now = useNow()
  const [view, setView] = useHistoryState<BacklogView>('view', 'all')
  const [teamId, setTeamId] = useHistoryState<string | null>('teamId', null)
  const [priorities, setPriorities] = useHistoryState<Priority[]>('priorities', [])
  const tableRef = useRef<HTMLElement>(null)

  const all = useMemo(() => backlogRows(s.workOrders, now).sort((a, b) => urgency(a.wo, now) - urgency(b.wo, now)), [s.workOrders, now])
  const capacity = weeklyCapacity(s.technicians, s.settings)
  const summary = useMemo(() => backlogSummary(all, capacity), [all, capacity])
  const onDuty = s.technicians.filter((p) => p.technician?.availability !== 'leave').length

  const overdue = all.filter((r) => r.overdue)
  const oldestDue = Math.min(...overdue.map((r) => toMs(r.wo.dueAt)))
  const ready = all.filter(isReady)
  const topReason = (Object.entries(summary.byReason) as [WaitingReason, number][]).sort((a, b) => b[1] - a[1])[0]
  const averageAge = all.length ? all.reduce((sum, r) => sum + r.ageDays, 0) / all.length : 0
  const oldestAge = Math.max(0, ...all.map((r) => r.ageDays))

  const filtered = useMemo(
    () => all.filter((r) => (!teamId || r.wo.teamId === teamId) && (!priorities.length || priorities.includes(r.wo.priority))),
    [all, teamId, priorities],
  )
  const rows = filtered.filter(VIEW_TEST[view])
  const narrowed = !!teamId || priorities.length > 0

  const show = (next: BacklogView) => {
    setView(next)
    tableRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
  const togglePriority = (p: Priority) => setPriorities((list) => (list.includes(p) ? list.filter((x) => x !== p) : [...list, p]))

  const emptyAction = () => {
    if (narrowed) {
      return (
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setTeamId(null)
            setPriorities([])
          }}
        >
          Clear filters
        </Button>
      )
    }
    if (view === 'all') {
      return (
        <Button asChild variant="outline" size="sm">
          <Link to="/work/requests">Review new requests</Link>
        </Button>
      )
    }
    return (
      <Button variant="outline" size="sm" onClick={() => setView('all')}>
        Show all open work
      </Button>
    )
  }

  return (
    <>
      <PageHeader
        title="Backlog"
        description="Open work measured in man-hours against the hands-on time your technicians have each week."
        actions={
          <Button asChild variant="outline">
            <Link to="/work/calendar">
              <CalendarDays />
              Plan in calendar
            </Link>
          </Button>
        }
      />

      <div className="mb-4 grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <WorkloadCard count={summary.count} manHours={summary.manHours} capacity={capacity} onDuty={onDuty} onLeave={s.technicians.length - onDuty} />
        <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4 xl:grid-cols-2">
          <StatCard
            label="Overdue"
            value={fmtNumber(summary.overdue)}
            hint={overdue.length ? `Oldest due ${fmtAgo(oldestDue, now)}` : 'Nothing past due'}
            icon={<CalendarX />}
            tone="danger"
            onClick={() => show('overdue')}
          />
          <StatCard
            label="Waiting"
            value={fmtNumber(summary.waiting)}
            hint={topReason ? `Top reason: ${WAITING_REASON_LABEL[topReason[0]].toLowerCase()} (${topReason[1]})` : 'Nothing on hold'}
            icon={<CirclePause />}
            tone="warning"
            onClick={() => show('blocked')}
          />
          <StatCard
            label="Ready to schedule"
            value={fmtNumber(ready.length)}
            hint={ready.length ? `${fmtNumber(sumHours(ready), 1)} man-hours without a date` : 'Everything has a date'}
            icon={<CalendarPlus />}
            tone="info"
            onClick={() => show('ready')}
          />
          <StatCard
            label="Average age"
            value={fmtNumber(averageAge, 1)}
            unit="days"
            hint={`Oldest ${plural(Math.floor(oldestAge), 'day')}`}
            icon={<Clock />}
          />
        </div>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <AgeCard buckets={summary.ageBuckets} total={summary.count} />
        <WaitingCard rows={all} byReason={summary.byReason} />
      </div>

      <section ref={tableRef} aria-label="Open work" className="scroll-mt-4">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <PillTabs
            value={view}
            onValueChange={(v) => setView(asView(v))}
            items={BACKLOG_VIEWS.map((v) => ({ value: v, label: VIEW_LABEL[v], count: filtered.filter(VIEW_TEST[v]).length }))}
          />
          <div className="flex flex-wrap items-center gap-2">
            <TeamPicker variant="inline" clearable placeholder="All teams" value={teamId} onChange={setTeamId} className="h-10 bg-card px-4 shadow-card" />
            {PRIORITIES.map((p) => (
              <Chip key={p} variant="filter" active={priorities.includes(p)} title={PRIORITY_LABEL[p]} onClick={() => togglePriority(p)}>
                {p}
              </Chip>
            ))}
          </div>
        </div>
        <Card>
          <CardHeader action={<span className="text-sm tabular-nums text-muted">{`${plural(rows.length, 'work order')} · ${fmtNumber(sumHours(rows), 1)} man-hours`}</span>}>
            <CardTitle>{view === 'all' ? 'Open work' : VIEW_LABEL[view]}</CardTitle>
            <CardDescription>Sorted by urgency: overdue first, then priority and due date. Click a column to sort.</CardDescription>
          </CardHeader>
          <BacklogTable
            rows={rows}
            now={now}
            resetKey={`${view}|${teamId}|${priorities.join()}`}
            empty={
              <EmptyState
                icon={<Hourglass />}
                title={narrowed ? 'No work matches these filters' : EMPTY[view].title}
                description={narrowed ? 'Clear the team or priority filter to see more.' : EMPTY[view].description}
                action={emptyAction()}
              />
            }
          />
        </Card>
      </section>
    </>
  )
}
