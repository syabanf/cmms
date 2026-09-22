import {
  type AssetReliability,
  DAY,
  type FailureEvent,
  assetReliability,
  badActors,
  failureEvents,
  fleetReliability,
  fmtDate,
  fmtIdrShort,
  fmtNumber,
  isRepeatFailure,
  plural,
  repeatFailures,
} from '@cmms/fixtures'
import {
  Badge,
  Button,
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
  type Column,
  DataTable,
  EmptyState,
  PageHeader,
  PillTabs,
  StatCard,
} from '@cmms/ui'
import { Activity, Clock, Factory, Repeat, Timer, TriangleAlert, X } from 'lucide-react'
import { useMemo } from 'react'
import { useNavigate } from 'react-router'
import { AssetLink, WoLink, paths } from '../../components/links'
import { useHistoryState, useTableHistory } from '../../lib/history-state'
import { usePersistentState } from '../../lib/storage'
import { useNow, useScoped } from '../../state/scoped'
import { FailureChain } from './FailureChain'
import { ParetoCard } from './ParetoCard'
import { RepeatFailuresCard } from './RepeatFailuresCard'
import { FAILURE_PERIODS, type FailurePeriod, type ParetoBy, isFailurePeriod, paretoKey } from './lib'

interface FailureRecord {
  event: FailureEvent
  repeat: boolean
}

const noValue = <span className="text-muted">-</span>

export function FailuresPage() {
  const s = useScoped()
  const now = useNow(60_000)
  const navigate = useNavigate()
  const [storedPeriod, setPeriod] = usePersistentState<FailurePeriod>('cmms.admin.failures.period', 90)
  const period = isFailurePeriod(storedPeriod) ? storedPeriod : 90
  const [by, setBy] = useHistoryState<ParetoBy>('by', 'mode')
  const [focus, setFocus] = useHistoryState<string | null>('focus', null)
  const badTable = useTableHistory('bad')
  const recordsTable = useTableHistory('records')
  const windowDays = s.settings.repeatWindowDays

  const data = useMemo(() => {
    const from = now - period * DAY
    const all = failureEvents(s.workOrders)
    const rows = assetReliability(s.assets, s.workOrders, s.meters, s.maps.person, from, now, windowDays, now)
    return {
      all,
      events: all.filter((e) => e.at >= from),
      previous: all.filter((e) => e.at >= from - period * DAY && e.at < from).length,
      fleet: fleetReliability(rows, s.meters, from, now),
      repeats: rows.reduce((sum, r) => sum + r.repeats, 0),
      bad: badActors(rows, 10),
      groups: repeatFailures(all, windowDays).filter((g) => g.lastAt >= from),
    }
  }, [s.workOrders, s.assets, s.meters, s.maps.person, period, windowDays, now])

  const records = useMemo<FailureRecord[]>(() => {
    const keyOf = paretoKey[by]
    return data.events
      .filter((e) => focus === null || keyOf(e) === focus)
      .map((event) => ({ event, repeat: isRepeatFailure(event.wo, data.all, windowDays) }))
      .reverse()
  }, [data, by, focus, windowDays])

  const codeName = (id: string | null) => (id ? (s.maps.failureCode.get(id)?.name ?? 'Unknown code') : 'Not coded')
  const nameOf = (key: string) => (by === 'asset' ? (s.maps.asset.get(key)?.name ?? 'Removed asset') : codeName(key))

  const changePeriod = (value: string) => {
    const next = Number(value)
    if (!isFailurePeriod(next)) return
    setPeriod(next)
    setFocus(null)
  }

  const badColumns: Column<AssetReliability>[] = [
    {
      id: 'asset',
      header: 'Asset',
      cell: (r) => (
        <div className="min-w-0">
          <AssetLink assetId={r.assetId} showIcon />
          <div className="mt-1.5 flex flex-wrap gap-1.5 text-[11px] text-muted sm:hidden">
            <span>{r.failures} failures</span>
            {r.repeats > 0 && <span className="font-semibold text-accent">{r.repeats} repeat</span>}
            <span>{fmtIdrShort(r.cost)}</span>
          </div>
        </div>
      ),
      sortValue: (r) => s.maps.asset.get(r.assetId)?.code ?? '',
    },
    { id: 'failures', header: 'Failures', align: 'right', cell: (r) => <span className="font-semibold tabular-nums">{r.failures}</span>, sortValue: (r) => r.failures, hideBelow: 'sm' },
    {
      id: 'repeats',
      header: 'Repeats',
      align: 'right',
      cell: (r) => (r.repeats ? <Badge variant="danger">{r.repeats}</Badge> : <span className="tabular-nums text-muted">0</span>),
      sortValue: (r) => r.repeats,
      hideBelow: 'sm',
    },
    {
      id: 'mtbf',
      header: 'MTBF',
      align: 'right',
      cell: (r) => (r.mtbfHours === null ? noValue : <span className="whitespace-nowrap tabular-nums">{fmtNumber(r.mtbfHours)} h</span>),
      sortValue: (r) => r.mtbfHours,
      hideBelow: 'md',
    },
    {
      id: 'mttr',
      header: 'MTTR',
      align: 'right',
      cell: (r) => (r.mttrHours === null ? noValue : <span className="whitespace-nowrap tabular-nums">{fmtNumber(r.mttrHours, 1)} h</span>),
      sortValue: (r) => r.mttrHours,
      hideBelow: 'lg',
    },
    {
      id: 'downtime',
      header: 'Downtime',
      align: 'right',
      cell: (r) => <span className="whitespace-nowrap tabular-nums">{fmtNumber(r.downtimeHours, 1)} h</span>,
      sortValue: (r) => r.downtimeHours,
      hideBelow: 'lg',
    },
    { id: 'cost', header: 'Cost', align: 'right', cell: (r) => <span className="whitespace-nowrap tabular-nums">{fmtIdrShort(r.cost)}</span>, sortValue: (r) => r.cost, hideBelow: 'sm' },
  ]

  const recordColumns: Column<FailureRecord>[] = [
    {
      id: 'date',
      header: 'Date',
      cell: ({ event, repeat }) => (
        <div className="min-w-0">
          <p className="whitespace-nowrap font-medium tabular-nums">{fmtDate(event.at)}</p>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5 sm:hidden">
            <WoLink woId={event.wo.id} />
            <span className="text-xs font-semibold">{codeName(event.modeId)}</span>
            <span className="font-mono text-[11px] text-muted">{s.maps.asset.get(event.assetId)?.code}</span>
            {repeat && <Badge variant="danger">Repeat</Badge>}
          </div>
        </div>
      ),
      sortValue: ({ event }) => event.at,
    },
    { id: 'wo', header: 'Work order', cell: ({ event }) => <WoLink woId={event.wo.id} />, sortValue: ({ event }) => event.wo.code, hideBelow: 'sm' },
    { id: 'asset', header: 'Asset', cell: ({ event }) => <AssetLink assetId={event.assetId} />, sortValue: ({ event }) => s.maps.asset.get(event.assetId)?.code ?? '', hideBelow: 'lg' },
    { id: 'failure', header: 'Failure', cell: ({ event }) => <FailureChain failure={event.wo.failure} />, hideBelow: 'sm' },
    {
      id: 'note',
      header: 'Note',
      cell: ({ event }) => (event.wo.failure?.note ? <p className="line-clamp-2 max-w-[16rem] text-xs text-muted">{event.wo.failure.note}</p> : noValue),
      hideBelow: 'xl',
    },
    {
      id: 'repeat',
      header: 'Repeat',
      cell: ({ repeat }) => (repeat ? <Badge variant="danger">Repeat</Badge> : null),
      sortValue: ({ repeat }) => Number(repeat),
      hideBelow: 'sm',
    },
  ]

  const { fleet } = data

  return (
    <>
      <PageHeader
        title="Failures"
        description="What breaks most, and what keeps coming back."
        actions={
          <PillTabs value={String(period)} onValueChange={changePeriod} items={FAILURE_PERIODS.map((days) => ({ value: String(days), label: `${days} days` }))} />
        }
      />

      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-5">
          <StatCard
            label="Failures"
            value={fmtNumber(fleet.failures)}
            hint={`${data.previous} in the ${period} days before`}
            icon={<TriangleAlert />}
            tone="ink"
          />
          <StatCard
            label="MTBF"
            value={fleet.mtbfHours === null ? 'None' : fmtNumber(fleet.mtbfHours)}
            unit="h"
            hint="Operating hours per failure"
            icon={<Activity />}
          />
          <StatCard
            label="MTTR"
            value={fleet.mttrHours === null ? 'None' : fmtNumber(fleet.mttrHours, 1)}
            unit="h"
            hint="Hands-on repair time per failure"
            icon={<Timer />}
          />
          <StatCard
            label="Downtime"
            value={fmtNumber(fleet.downtimeHours, 1)}
            unit="h"
            hint="Production stopped by failures"
            icon={<Clock />}
            tone={fleet.downtimeHours > 0 ? 'warning' : 'default'}
          />
          <StatCard
            label="Repeat failures"
            value={data.repeats}
            hint={`Same asset and mode within ${windowDays} days`}
            icon={<Repeat />}
            tone={data.repeats > 0 ? 'danger' : 'default'}
            className="col-span-2 md:col-span-1"
          />
        </div>

        <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-2">
          <RepeatFailuresCard groups={data.groups} windowDays={windowDays} periodDays={period} now={now} />
          <ParetoCard
            events={data.events}
            periodDays={period}
            by={by}
            onByChange={(next) => {
              setBy(next)
              setFocus(null)
            }}
            focus={focus}
            onFocusChange={setFocus}
            nameOf={nameOf}
          />
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Bad actors</CardTitle>
            <CardDescription>Assets ranked by failures in the last {period} days, then downtime, then cost.</CardDescription>
          </CardHeader>
          <DataTable
            columns={badColumns}
            rows={data.bad}
            {...badTable}
            getRowKey={(r) => r.assetId}
            onRowClick={(r) => navigate(paths.asset(r.assetId))}
            pageSize={0}
            empty={
              <EmptyState
                compact
                icon={<Factory />}
                title={`No failures in the last ${period} days`}
                description="Completed corrective and emergency work lands here. Pick a longer period to compare assets."
              />
            }
          />
        </Card>

        <Card>
          <CardHeader
            action={
              focus !== null ? (
                <Button variant="soft" size="sm" aria-label={`Show all failures, not only ${nameOf(focus)}`} onClick={() => setFocus(null)}>
                  {nameOf(focus)}
                  <X />
                </Button>
              ) : undefined
            }
          >
            <CardTitle>Failure records</CardTitle>
            <CardDescription>
              {plural(records.length, 'failure')} in the last {period} days, newest first. Each reads problem → failure mode → cause → remedy.
            </CardDescription>
          </CardHeader>
          <DataTable
            columns={recordColumns}
            rows={records}
            {...recordsTable}
            getRowKey={(r) => r.event.wo.id}
            onRowClick={(r) => navigate(paths.workOrder(r.event.wo.id))}
            pageSize={10}
            resetPageKey={`${period}|${by}|${focus}`}
            empty={
              <EmptyState
                compact
                icon={<TriangleAlert />}
                title={focus !== null ? `No ${nameOf(focus)} failures in this period` : `No failures in the last ${period} days`}
                description={focus !== null ? 'Clear the filter to see every failure.' : 'Pick a longer period to see older failures.'}
                action={
                  focus !== null ? (
                    <Button variant="outline" size="sm" onClick={() => setFocus(null)}>
                      Clear filter
                    </Button>
                  ) : undefined
                }
              />
            }
          />
        </Card>
      </div>
    </>
  )
}
