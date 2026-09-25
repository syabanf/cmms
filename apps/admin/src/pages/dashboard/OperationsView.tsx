import {
  DAY,
  backlogRows,
  backlogSummary,
  costBetween,
  fmtAgo,
  fmtDuration,
  fmtIdrShort,
  fmtNumber,
  fmtPercent,
  isActive,
  pmCompliance,
  plannedAt,
  startOfDay,
  startOfMonth,
  statusCounts,
  toMs,
  typeMix,
  urgency,
  weeklyCapacity,
  workShares,
} from '@cmms/fixtures'
import {
  BarStrip,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CountBadge,
  Donut,
  EmptyState,
  IconTile,
  NativeSelect,
  SegmentBar,
  Sparkline,
  StatCard,
  cn,
} from '@cmms/ui'
import {
  ArrowUpRight,
  CalendarCheck,
  CalendarClock,
  ClipboardList,
  Coins,
  PartyPopper,
  Siren,
  Wrench,
} from 'lucide-react'
import { PLANNED_WO_TYPES } from '@cmms/types'
import { type ReactNode, useMemo, useState } from 'react'
import { Link } from 'react-router'
import { CriticalityBadge, PriorityBadge } from '../../components/badges'
import { AssetIcon } from '../../components/icons'
import { paths } from '../../components/links'
import { type Scoped, useScoped } from '../../state/scoped'
import {
  type Featured,
  featuredAsset,
  recentFailureCount,
  weeklyBacklogHours,
  weeklyPmCompliance,
} from './lib'
import { WorkRow } from './WorkRow'

const MIX_PERIODS = [
  { value: 'month', label: 'This month' },
  { value: '30', label: 'Last 30 days' },
  { value: '90', label: 'Last 90 days' },
]

export function OperationsView({ now }: { now: number }) {
  const s = useScoped()
  const [team, setTeam] = useState('all')
  const [mixPeriod, setMixPeriod] = useState('month')

  const d = useMemo(() => {
    const monthStart = startOfMonth(now)
    const active = s.workOrders.filter(isActive)
    const capacity = weeklyCapacity(s.technicians, s.settings)
    const endOfTomorrow = startOfDay(now) + 2 * DAY
    return {
      counts: statusCounts(s.workOrders, now),
      active,
      month: typeMix(s.workOrders, monthStart, now + 1),
      shares: workShares(s.workOrders, now - 30 * DAY, now),
      pm90: pmCompliance(s.workOrders, now - 90 * DAY, now, now),
      pmTrend: weeklyPmCompliance(s.workOrders, 12, now),
      capacity,
      backlog: backlogSummary(backlogRows(s.workOrders, now), capacity),
      backlogTrend: weeklyBacklogHours(s.workOrders, 8, now),
      cost: costBetween(s.workOrders, s.maps.person, monthStart, now + 1, now),
      priority: active
        .filter((w) => w.priority === 'P1' || w.priority === 'P2')
        .sort((a, b) => urgency(a, now) - urgency(b, now)),
      // Routine work starting in the next two days, plus planned work that already slipped.
      dueSoon: active
        .filter((w) => {
          const at = toMs(plannedAt(w))
          const upcoming =
            at >= startOfDay(now) && at < endOfTomorrow && w.priority !== 'P1' && w.priority !== 'P2'
          return upcoming || (PLANNED_WO_TYPES.includes(w.type) && at < startOfDay(now))
        })
        .sort((a, b) => toMs(plannedAt(a)) - toMs(plannedAt(b))),
      featured: featuredAsset(s, now),
    }
  }, [s, now])

  const mix = useMemo(() => {
    const from = mixPeriod === 'month' ? startOfMonth(now) : now - Number(mixPeriod) * DAY
    return workShares(s.workOrders, from, now + 1)
  }, [s.workOrders, mixPeriod, now])

  const priority = team === 'all' ? d.priority : d.priority.filter((w) => w.teamId === team)
  const segments = [
    { key: 'progress', value: d.counts.inProgress, className: 'bg-info', label: 'In progress' },
    {
      key: 'ready',
      value: d.counts.assigned + d.counts.open,
      className: 'bg-ink',
      label: 'Open or assigned',
    },
    { key: 'waiting', value: d.counts.waiting, className: 'bg-warning', label: 'Waiting' },
    { key: 'draft', value: d.counts.draft, className: 'bg-silver', label: 'Draft' },
  ]

  return (
    <div className="space-y-4">
      <div className="gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] grid grid-cols-1">
        <HeroCard featured={d.featured} now={now} s={s} />

        <div className="gap-3 sm:gap-4 grid grid-cols-2">
          <Card className="p-5 flex flex-col">
            <p className="font-semibold text-[13px] text-body/80">PM compliance</p>
            <p className="mt-1.5 font-extrabold text-[28px] leading-[1.15] tracking-[-0.5px]">
              {fmtPercent(d.pm90.ratio)}
            </p>
            <p className="mt-1 text-xs text-muted">
              {d.pm90.onTime} of {d.pm90.due} on time · 90 days
            </p>
            <Sparkline
              className="pt-3 mt-auto"
              data={d.pmTrend.map((p) => p.value)}
              labels={d.pmTrend.map((p) => `Week of ${p.label}`)}
              format={(v) => `${v}%`}
              highlightLast
              height={36}
              ariaLabel="Weekly PM compliance, last 12 weeks"
            />
          </Card>
          <Card className="p-5 flex flex-col">
            <p className="font-semibold text-[13px] text-body/80">Backlog</p>
            <p className="mt-1.5 gap-1 font-extrabold flex items-start text-[28px] leading-[1.15] tracking-[-0.5px]">
              {d.backlog.weeks.toFixed(1)}
              <span className="pt-1 text-sm font-semibold text-muted">weeks</span>
            </p>
            <p className="mt-1 text-xs text-muted">
              {fmtNumber(d.backlog.manHours)} man-hours · {fmtNumber(d.capacity)} h/week
            </p>
            <BarStrip
              className="pt-3 mt-auto"
              data={d.backlogTrend.map((b) => ({ label: `Week of ${b.label}`, value: b.value }))}
              format={(v) => `${v} man-hours`}
              height={36}
              ariaLabel="Open man-hours at the end of each week"
            />
          </Card>
        </div>
      </div>

      <Card className="gap-5 p-5 sm:grid-cols-2 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)_auto] grid grid-cols-1 items-center">
        <div className="min-w-0 sm:col-span-2 xl:col-span-1">
          <p className="text-sm font-semibold">
            Active work <span className="font-normal text-muted">· {d.counts.active} orders</span>
          </p>
          <SegmentBar className="mt-3" segments={segments} />
          <div className="mt-2.5 gap-x-4 gap-y-1 text-xs flex flex-wrap text-muted">
            {segments.map((seg) => (
              <span key={seg.key} className="gap-1.5 inline-flex items-center">
                <span className={cn('size-2 rounded-full', seg.className)} />
                {seg.label} <span className="font-semibold text-foreground tabular-nums">{seg.value}</span>
              </span>
            ))}
          </div>
        </div>
        <Metric
          icon={<CalendarCheck />}
          tone="info"
          label="Planned work"
          value={fmtPercent(d.shares.plannedShare)}
          hint="Last 30 days"
        />
        <Metric
          icon={<Siren />}
          tone="danger"
          label="Emergency work"
          value={fmtPercent(d.shares.emergencyShare)}
          hint="Last 30 days"
        />
        <Button asChild variant="outline" className="sm:justify-self-start xl:justify-self-end">
          <Link to="/work/backlog">View backlog</Link>
        </Button>
      </Card>

      <div className="gap-3 sm:grid sm:grid-cols-3 sm:gap-4 sm:overflow-visible sm:[&>*]:min-w-0 no-scrollbar flex snap-x snap-mandatory overflow-x-auto [&>*]:min-w-[72%] [&>*]:snap-start">
        <StatCard
          label="Corrective this month"
          value={d.month.corrective}
          hint="Repairs from requests and findings"
          icon={<Wrench />}
        />
        <StatCard
          label="Breakdowns this month"
          value={d.month.emergency}
          hint="Emergency work with production stopped"
          icon={<Siren />}
          tone={d.month.emergency ? 'danger' : 'default'}
        />
        <StatCard
          label="Maintenance cost, month to date"
          value={fmtIdrShort(d.cost.total)}
          hint={`Labor ${fmtIdrShort(d.cost.labor)} · parts ${fmtIdrShort(d.cost.parts)}`}
          icon={<Coins />}
          tone="ink"
        />
      </div>

      <div className="gap-4 md:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_20rem] grid grid-cols-1">
        <Card className="flex flex-col">
          <CardHeader
            action={
              <NativeSelect
                variant="inline"
                aria-label="Team"
                value={team}
                onChange={(e) => setTeam(e.target.value)}
                options={[
                  { value: 'all', label: 'All teams' },
                  ...s.teams.map((t) => ({ value: t.id, label: t.name })),
                ]}
              />
            }
          >
            <CardTitle className="gap-2 flex items-center">
              Priority work <CountBadge count={priority.length} />
            </CardTitle>
            <p className="text-sm text-muted">P1 and P2, most urgent first</p>
          </CardHeader>
          <CardContent className="gap-2 flex flex-1 flex-col">
            {priority.length ? (
              priority.slice(0, 5).map((wo) => <WorkRow key={wo.id} wo={wo} now={now} />)
            ) : (
              <EmptyState
                compact
                icon={<PartyPopper />}
                title="No urgent work"
                description="Nothing at P1 or P2 for this team."
              />
            )}
            <Button asChild variant="outline" size="sm" className="mt-2 self-start">
              <Link to="/work/orders">View all work orders</Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="flex flex-col">
          <CardHeader>
            <CardTitle className="gap-2 flex items-center">
              Due today and tomorrow <CountBadge count={d.dueSoon.length} />
            </CardTitle>
            <p className="text-sm text-muted">Planned and routine work by start time</p>
          </CardHeader>
          <CardContent className="gap-2 flex flex-1 flex-col">
            {d.dueSoon.length ? (
              d.dueSoon.slice(0, 5).map((wo) => <WorkRow key={wo.id} wo={wo} now={now} dateMode="planned" />)
            ) : (
              <EmptyState
                compact
                icon={<CalendarClock />}
                title="Nothing planned"
                description="Generate work from the PM schedules to fill the next two days."
              />
            )}
            <Button asChild variant="outline" size="sm" className="mt-2 self-start">
              <Link to="/work/calendar">Open calendar</Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="md:col-span-2 xl:col-span-1">
          <CardHeader
            action={
              <NativeSelect
                variant="inline"
                aria-label="Period"
                value={mixPeriod}
                onChange={(e) => setMixPeriod(e.target.value)}
                options={MIX_PERIODS}
              />
            }
          >
            <CardTitle>Work mix</CardTitle>
            <p className="text-sm text-muted">Planned against reactive work</p>
          </CardHeader>
          <CardContent>
            <div className="gap-5 md:flex-nowrap xl:flex-wrap flex flex-wrap items-center">
              <Donut
                className="mx-auto"
                segments={[
                  { key: 'planned', label: 'Planned', value: mix.planned, color: 'var(--color-ink)' },
                  {
                    key: 'corrective',
                    label: 'Corrective',
                    value: mix.corrective,
                    color: 'var(--color-chart-muted)',
                  },
                  {
                    key: 'emergency',
                    label: 'Emergency',
                    value: mix.emergency,
                    color: 'var(--color-accent)',
                  },
                ]}
                centerValue={mix.total}
                centerLabel="work orders"
                ariaLabel="Work mix by type"
              />
              <dl className="space-y-2.5 text-sm min-w-[10rem] flex-1">
                <MixRow color="bg-ink" label="Planned" value={mix.planned} share={mix.plannedShare} />
                <MixRow
                  color="bg-chart-muted"
                  label="Corrective"
                  value={mix.corrective}
                  share={mix.correctiveShare}
                />
                <MixRow
                  color="bg-accent"
                  label="Emergency"
                  value={mix.emergency}
                  share={mix.emergencyShare}
                />
              </dl>
            </div>
            <p className="mt-4 text-xs md:block hidden text-muted">
              Planned covers preventive, inspection, calibration and improvement work.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function HeroCard({ featured, now, s }: { featured: Featured | null; now: number; s: Scoped }) {
  if (!featured) {
    return (
      <Card variant="ink" className="min-h-72 p-6 flex items-center justify-center">
        <EmptyState
          icon={<ClipboardList />}
          title="All assets running"
          description="No asset is down and no bad actor stands out this quarter."
        />
      </Card>
    )
  }
  const { asset } = featured
  const type = s.maps.assetType.get(asset.typeId)
  const repeats = recentFailureCount(s, asset.id, now)
  const wo = featured.kind === 'down' ? featured.wo : undefined
  const lastEvent = wo?.events[wo.events.length - 1]
  const downMinutes = featured.kind === 'down' ? (now - featured.downSince) / 60_000 : 0

  return (
    <Card variant="ink" className="gap-6 p-6 flex flex-col">
      <div className="gap-3 flex flex-wrap items-start justify-between">
        <div className="min-w-0 gap-3 flex items-center">
          <span className="size-12 rounded-2xl bg-white/10 [&_svg]:size-6 flex shrink-0 items-center justify-center">
            <AssetIcon icon={type?.icon} />
          </span>
          <div className="min-w-0">
            <p className="gap-2 font-semibold tracking-wider flex items-center text-[11px] text-on-ink-muted uppercase">
              {featured.kind === 'down' ? (
                <>
                  <span className="size-2 animate-pulse rounded-full bg-accent" /> Asset down
                </>
              ) : (
                'Bad actor · last 90 days'
              )}
            </p>
            <h2 className="text-2xl font-bold tracking-tight truncate">{asset.name}</h2>
            <p className="text-sm truncate text-on-ink-muted">
              <span className="text-xs font-mono">{asset.code}</span> · {s.locationPath(asset.locationId)}
            </p>
          </div>
        </div>
        <CriticalityBadge criticality={asset.criticality} long />
      </div>

      <div className="gap-4 flex flex-wrap items-end justify-between">
        {featured.kind === 'down' ? (
          <div>
            <p className="text-xs font-medium text-on-ink-muted">Production stopped for</p>
            <p className="mt-1 gap-1.5 flex items-start leading-none">
              <span className="text-6xl font-bold tracking-tight">
                {downMinutes < 60 ? Math.round(downMinutes) : (downMinutes / 60).toFixed(1)}
              </span>
              <span className="pt-1.5 text-sm font-semibold text-on-ink-muted">
                {downMinutes < 60 ? 'min' : 'h'}
              </span>
            </p>
          </div>
        ) : (
          <div>
            <p className="text-xs font-medium text-on-ink-muted">Failures in 90 days</p>
            <p className="mt-1 gap-1.5 flex items-start leading-none">
              <span className="text-6xl font-bold tracking-tight">{featured.failures}</span>
              <span className="pt-1.5 text-sm font-semibold text-on-ink-muted">
                {fmtNumber(featured.downtimeHours, 1)} h down · {fmtIdrShort(featured.cost)}
              </span>
            </p>
          </div>
        )}
        <div className="gap-2 flex flex-wrap">
          {wo && (
            <span className="h-8 gap-2 px-3 text-xs font-semibold text-white inline-flex items-center rounded-full bg-accent">
              {wo.code} <PriorityBadge priority={wo.priority} />
            </span>
          )}
          {repeats >= 2 && (
            <span className="h-8 border-white/10 bg-white/10 px-3 text-xs font-semibold inline-flex items-center rounded-full border">
              {repeats} failures in {s.settings.repeatWindowDays * 2} days
            </span>
          )}
          {wo && (
            <span className="h-8 border-white/10 bg-white/10 px-3 text-xs font-semibold inline-flex items-center rounded-full border">
              {wo.assigneeIds.length
                ? wo.assigneeIds.map((id) => s.personName(id).split(' ')[0]).join(', ')
                : 'Unassigned'}
            </span>
          )}
        </div>
      </div>

      {wo && lastEvent && (
        <Link
          to={paths.workOrder(wo.id)}
          className="gap-3 rounded-2xl bg-white/5 p-3 hover:bg-white/10 flex items-center transition-colors"
        >
          <span className="min-w-0 flex-1">
            <span className="text-sm font-semibold block truncate">{wo.title}</span>
            <span className="text-xs block truncate text-on-ink-muted">
              Latest: {lastEvent.text} · {s.personName(lastEvent.by)} · {fmtAgo(lastEvent.at, now)}
            </span>
          </span>
          <ArrowUpRight className="size-4 shrink-0 text-on-ink-muted" />
        </Link>
      )}

      <div className="gap-3 mt-auto flex flex-wrap items-center justify-between">
        <div className="gap-2 text-xs flex flex-wrap">
          <span className="bg-white/10 px-3 py-1.5 font-medium rounded-full">{type?.name}</span>
          {featured.kind === 'down' && wo && (
            <span className="bg-white/10 px-3 py-1.5 font-medium rounded-full">
              SLA {fmtDuration((toMs(wo.dueAt) - now) / 60_000)} left
            </span>
          )}
          {featured.kind === 'bad_actor' && featured.mtbfHours !== null && (
            <span className="bg-white/10 px-3 py-1.5 font-medium rounded-full">
              MTBF {fmtNumber(featured.mtbfHours)} h
            </span>
          )}
        </div>
        <div className="gap-2 flex flex-wrap">
          <Button asChild variant="onInk" size="sm">
            <Link to={paths.asset(asset.id)}>Asset passport</Link>
          </Button>
          {wo && (
            <Button asChild size="sm">
              <Link to={paths.workOrder(wo.id)}>Open work order</Link>
            </Button>
          )}
        </div>
      </div>
    </Card>
  )
}

function Metric({
  icon,
  tone,
  label,
  value,
  hint,
}: {
  icon: ReactNode
  tone: 'info' | 'danger'
  label: string
  value: string
  hint: string
}) {
  return (
    <div className="gap-3 flex items-center">
      <IconTile tone={tone} size="md">
        {icon}
      </IconTile>
      <div>
        <p className="text-xs font-medium text-muted">{label}</p>
        <p className="text-xl font-bold leading-tight">{value}</p>
        <p className="text-[11px] text-muted">{hint}</p>
      </div>
    </div>
  )
}

function MixRow({
  color,
  label,
  value,
  share,
}: {
  color: string
  label: string
  value: number
  share: number
}) {
  return (
    <div className="gap-2 flex items-center">
      <dt className="flex flex-1 items-center gap-2 text-muted">
        <span className={cn('size-2.5 rounded-sm', color)} />
        {label}
      </dt>
      <dd className="font-semibold tabular-nums">{value}</dd>
      <dd className="w-11 text-xs text-right text-muted tabular-nums">{fmtPercent(share)}</dd>
    </div>
  )
}
