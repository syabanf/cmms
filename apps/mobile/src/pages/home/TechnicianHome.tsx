import {
  type CalendarItem,
  DAY,
  calendarItems,
  fmtDateShort,
  fmtDuration,
  fmtTime,
  fmtWeekday,
  isActive,
  isOverdue,
  isSameDay,
  laborEntryMinutes,
  plannedAt,
  startOfDay,
  toMs,
  wib,
} from '@cmms/fixtures'
import type { LaborEntry, WorkOrder } from '@cmms/types'
import { Button, Card, EmptyState, Kicker, LazySentinel, cn, toast, useLazyList } from '@cmms/ui'
import { ArrowRight, CalendarClock, ChevronRight, CircleCheck, Clock, ScanLine, Square } from 'lucide-react'
import { useMemo } from 'react'
import { Link, useNavigate } from 'react-router'
import { PriorityBadge, StatusText, WO_STATUS_TONE, woStatusLabel } from '../../components/badges'
import { WoTypeIcon } from '../../components/icons'
import { RunningTimer } from '../../components/RunningTimer'
import { Section } from '../../components/Section'
import { woTileClass } from '../../components/WoCard'
import { ScreenHeader } from '../../layouts/ScreenHeader'
import { paths } from '../../lib/paths'
import { dueText, greeting } from '../../lib/time'
import { byPlannedTime, byUrgency, safetyPending, todaysWork } from '../../lib/work'
import { useMobileScope, useNow } from '../../state/scope'

const UPCOMING_DAYS = 30

export function TechnicianHome() {
  const { user, myWork, workOrders, myPmSchedules, maps } = useMobileScope()
  const now = useNow()

  const active = useMemo(() => myWork.filter((w) => isActive(w) && w.status !== 'draft').sort(byUrgency(now)), [myWork, now])
  const today = useMemo(() => todaysWork(myWork, now).sort(byPlannedTime), [myWork, now])

  // Clocked in anywhere on the site, not only on assigned work.
  const running = useMemo(() => {
    for (const wo of workOrders) {
      const entry = wo.labor.find((e) => e.personId === user.id && e.end === null)
      if (entry) return { wo, entry }
    }
    return null
  }, [workOrders, user.id])

  const upcoming = useMemo(() => {
    const tomorrow = startOfDay(now) + DAY
    return calendarItems(
      {
        workOrders: active,
        pmSchedules: myPmSchedules,
        meters: maps.meter,
        assets: [],
        tools: [],
        jobPlanDuration: (id) => maps.jobPlan.get(id)?.durationMin ?? 60,
        pmTitle: (pm) => pm.name,
      },
      tomorrow,
      tomorrow + UPCOMING_DAYS * DAY,
      now,
    )
  }, [active, myPmSchedules, maps, now])

  // Work parked for a part or a vendor only leads when nothing else is waiting for hands.
  const hero = active.find((w) => w.status !== 'waiting') ?? active[0]
  const critical = active.filter((w) => w.priority === 'P1').length
  const countOf = (type: WorkOrder['type']) => today.filter((w) => w.type === type).length

  return (
    <div className="space-y-6">
      <ScreenHeader greeting={greeting(user.name, now)} title="Your shift today" />

      {hero ? <HeroCard wo={hero} critical={critical} now={now} /> : <AllClearCard />}

      <Section title="Today">
        <div className="grid grid-cols-3 gap-3">
          <StatTile to={paths.work()} value={today.length} label="Work orders" className="bg-ink text-on-ink" />
          <StatTile to={paths.work('preventive')} value={countOf('preventive')} label="PM" className="bg-accent text-white shadow-glow" />
          <StatTile to={paths.work('inspection')} value={countOf('inspection')} label="Inspections" className="bg-card" />
        </div>
      </Section>

      {running && <ClockCard wo={running.wo} entry={running.entry} />}

      <Section
        title="Today's jobs"
        count={today.length}
        action={
          <Link to={paths.work()} className="flex h-11 items-center px-1 text-sm font-semibold text-accent">
            All work
          </Link>
        }
      >
        {today.length ? (
          <div className="no-scrollbar -mx-5 flex snap-x snap-mandatory scroll-px-5 gap-3 overflow-x-auto px-5 pb-1">
            {today.map((wo) => (
              <JobRailCard key={wo.id} wo={wo} now={now} />
            ))}
          </div>
        ) : (
          <Card>
            <EmptyState
              compact
              icon={<CircleCheck />}
              title="Nothing planned for today"
              description="Scan a machine to see its history or report something you noticed."
              action={
                <Button asChild variant="outline" className="h-11">
                  <Link to={paths.scan}>
                    <ScanLine />
                    Scan an asset
                  </Link>
                </Button>
              }
            />
          </Card>
        )}
      </Section>

      <UpcomingSection items={upcoming} />
    </div>
  )
}

function HeroCard({ wo, critical, now }: { wo: WorkOrder; critical: number; now: number }) {
  const { maps } = useMobileScope()
  const navigate = useNavigate()
  const asset = maps.asset.get(wo.assetId)
  const notStarted = wo.status === 'open' || wo.status === 'assigned'
  const cta = wo.status === 'in_progress' ? 'Continue work' : wo.status === 'waiting' ? 'Open work order' : 'Start work'
  // Starting goes through the safety gate, so a job with one opens right on it.
  const target = paths.workOrder(wo.id, notStarted && safetyPending(wo) ? 'safety' : undefined)
  return (
    <Card variant="ink" className="p-6">
      <div className="flex items-start justify-between gap-3">
        <Kicker className="text-on-ink-muted">{wo.priority === 'P1' ? `${critical} critical work` : 'Next up'}</Kicker>
        <PriorityBadge priority={wo.priority} />
      </div>
      <p className="mt-4 truncate text-sm text-on-ink-muted">
        {asset?.name ?? 'Removed asset'} · <span className="font-mono">{asset?.code}</span>
      </p>
      <h2 className="mt-1 text-2xl font-bold leading-tight tracking-tight">{wo.title}</h2>
      <p className={cn('mt-3 flex items-center gap-2 text-sm font-semibold', isOverdue(wo, now) ? 'text-accent' : 'text-white')}>
        <Clock aria-hidden="true" className="size-4" />
        {dueText(wo.dueAt, now)}
      </p>
      <Button size="lg" className="mt-6 w-full" onClick={() => navigate(target)}>
        {cta}
        <ArrowRight />
      </Button>
    </Card>
  )
}

function AllClearCard() {
  return (
    <Card variant="ink" className="p-6">
      <Kicker className="text-on-ink-muted">Your queue</Kicker>
      <h2 className="mt-2 text-2xl font-bold leading-tight tracking-tight">No open work assigned</h2>
      <p className="mt-1 text-sm text-on-ink-muted">New jobs from your supervisor land here. Meanwhile, scan a machine to check its history.</p>
      <Button asChild variant="onInk" size="lg" className="mt-6 w-full">
        <Link to={paths.scan}>
          <ScanLine />
          Scan an asset
        </Link>
      </Button>
    </Card>
  )
}

function StatTile({ to, value, label, className }: { to: string; value: number; label: string; className: string }) {
  return (
    <Link
      to={to}
      className={cn(
        'rounded-[24px] px-4 py-5 shadow-card transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 active:scale-[0.98]',
        className,
      )}
    >
      <span className="block text-[32px] font-bold leading-none tabular-nums">{value}</span>
      <span className="mt-2 block text-xs font-medium leading-tight">{label}</span>
    </Link>
  )
}

function ClockCard({ wo, entry }: { wo: WorkOrder; entry: LaborEntry }) {
  const { user, maps, dispatch } = useMobileScope()
  const asset = maps.asset.get(wo.assetId)
  const stop = () => {
    dispatch({ type: 'workOrders/clock', id: wo.id, personId: user.id, running: false })
    toast('Clocked out', { tone: 'success', description: `${fmtDuration(laborEntryMinutes(entry))} logged on ${wo.code}` })
  }
  return (
    <section aria-label="Running clock" className="rounded-[24px] bg-info-soft p-5">
      <div className="flex items-center gap-2">
        <span aria-hidden="true" className="size-2 animate-pulse rounded-full bg-info" />
        <Kicker className="text-info">Clock running</Kicker>
      </div>
      <RunningTimer since={entry.start} className="mt-2 block text-[32px] font-bold leading-none tracking-tight" />
      <p className="mt-3 truncate text-sm font-semibold">{wo.title}</p>
      <p className="truncate text-xs text-muted">
        <span className="font-mono">{wo.code}</span> · {asset?.name ?? 'Removed asset'}
      </p>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <Button variant="card" className="h-11" onClick={stop}>
          <Square />
          Stop
        </Button>
        <Button asChild variant="secondary" className="h-11">
          <Link to={paths.workOrder(wo.id)}>
            Open
            <ArrowRight />
          </Link>
        </Button>
      </div>
    </section>
  )
}

function JobRailCard({ wo, now }: { wo: WorkOrder; now: number }) {
  const { maps } = useMobileScope()
  const asset = maps.asset.get(wo.assetId)
  const at = toMs(plannedAt(wo))
  return (
    <Link
      to={paths.workOrder(wo.id)}
      className={cn(
        'flex w-44 shrink-0 snap-start flex-col rounded-[24px] p-4 shadow-card transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 active:scale-[0.98]',
        isActive(wo) ? 'bg-card' : 'bg-card/70',
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className={cn('flex size-10 items-center justify-center rounded-full [&_svg]:size-[18px]', woTileClass(wo))}>
          <WoTypeIcon type={wo.type} />
        </span>
        <span className={cn('text-sm font-bold tabular-nums', isOverdue(wo, now) && 'text-accent')}>
          {isSameDay(at, now) ? fmtTime(at) : fmtDateShort(at)}
        </span>
      </div>
      <p className="mt-3 truncate font-mono text-[11px] text-muted">{asset?.code}</p>
      <p className="mt-0.5 line-clamp-2 text-sm font-semibold leading-snug">{wo.title}</p>
      <StatusText className="mt-auto pt-3" tone={WO_STATUS_TONE[wo.status]} label={woStatusLabel(wo.status, wo.waitingReason)} />
    </Link>
  )
}

function UpcomingSection({ items }: { items: CalendarItem[] }) {
  const lazy = useLazyList(items)
  return (
    <Section title="Upcoming" count={items.length}>
      {items.length ? (
        <div className="space-y-2">
          {lazy.visible.map((item) => (
            <UpcomingRow key={item.id} item={item} />
          ))}
          <LazySentinel remaining={lazy.remaining} onLoad={lazy.loadMore} sentinelRef={lazy.sentinelRef} />
        </div>
      ) : (
        <Card>
          <EmptyState
            compact
            icon={<CalendarClock />}
            title="Nothing planned after today"
            description="PM and inspections assigned to you appear here once the planner schedules them."
            action={
              <Button asChild variant="outline" className="h-11">
                <Link to={paths.work()}>Open my work</Link>
              </Button>
            }
          />
        </Card>
      )}
    </Section>
  )
}

function UpcomingRow({ item }: { item: CalendarItem }) {
  const { maps } = useMobileScope()
  const asset = maps.asset.get(item.assetId)
  const wo = item.woId ? maps.workOrder.get(item.woId) : undefined
  const to = wo ? paths.workOrder(wo.id) : asset ? paths.asset(asset.code) : paths.work()
  return (
    <Link
      to={to}
      className="flex items-center gap-3 rounded-[20px] bg-card p-3 shadow-card transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 active:scale-[0.98]"
    >
      <span className="flex size-12 shrink-0 flex-col items-center justify-center rounded-2xl bg-surface leading-none">
        <span className="text-[10px] font-semibold uppercase text-muted">{fmtWeekday(item.at)}</span>
        <span className="mt-1 text-base font-bold tabular-nums">{wib(item.at).day}</span>
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold">{item.title}</span>
        <span className="block truncate text-xs text-muted">
          {asset?.name ?? 'Removed asset'} · {wo ? `${wo.code} · ${fmtTime(item.at)}` : 'Planned PM'}
        </span>
      </span>
      <ChevronRight aria-hidden="true" className="size-4 shrink-0 text-muted" />
    </Link>
  )
}
