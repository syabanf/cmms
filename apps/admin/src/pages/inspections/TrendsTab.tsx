import { DAY, fmtDateShort, fmtDateTime } from '@cmms/fixtures'
import type { Asset } from '@cmms/types'
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Combobox,
  type Column,
  DataTable,
  EmptyState,
  FormField,
  Kicker,
  LineChart,
  SegmentedControl,
  cn,
} from '@cmms/ui'
import { ChartSpline, CircleCheck, Table2 } from 'lucide-react'
import { useCallback, useMemo } from 'react'
import { OutcomeBadge } from '../../components/badges'
import { PersonChip, WoLink } from '../../components/links'
import { AssetPicker } from '../../components/pickers'
import { useHistoryState, useTableHistory } from '../../lib/history-state'
import { useScoped } from '../../state/scoped'
import {
  type DoneInspection,
  type MeasurementPoint,
  type Reading,
  fmtReading,
  isFlag,
  limitLines,
  limitSummary,
  limitZones,
  measurementPoints,
  pointsAtRisk,
  readingChange,
  recentlyFlagged,
} from './lib'

const RECENT_DAYS = 30

export function TrendsTab({ done, now, onShowUpcoming }: { done: DoneInspection[]; now: number; onShowUpcoming: () => void }) {
  const { maps } = useScoped()
  const [pickedKey, setPickedKey] = useHistoryState<string | null>('trends.point', null)
  const [view, setView] = useHistoryState<'chart' | 'table'>('trends.view', 'chart')

  const points = useMemo(() => measurementPoints(done), [done])
  const atRisk = useMemo(() => pointsAtRisk(points), [points])
  const recovered = useMemo(() => recentlyFlagged(points, now - RECENT_DAYS * DAY), [points, now])
  const assetIds = useMemo(() => new Set(points.map((p) => p.assetId)), [points])
  const withReadings = useCallback((a: Asset) => assetIds.has(a.id), [assetIds])

  // Until the user picks, show the point that most needs a look.
  const point = points.find((p) => p.key === pickedKey) ?? atRisk[0] ?? recovered[0]?.point ?? points[0]

  if (!point) {
    return (
      <Card>
        <EmptyState
          icon={<ChartSpline />}
          title="No readings yet"
          description="Measurements show here once a technician completes an inspection with numeric checks."
          action={
            <Button variant="outline" size="sm" onClick={onShowUpcoming}>
              See upcoming routes
            </Button>
          }
        />
      </Card>
    )
  }

  const asset = maps.asset.get(point.assetId)
  const assetPoints = points.filter((p) => p.assetId === point.assetId)
  const limits = limitSummary(point.limits, point.unit)

  const pickAsset = (assetId: string | null) => {
    const candidates = points.filter((p) => p.assetId === assetId)
    const best = candidates.find((p) => isFlag(p.latest.outcome)) ?? candidates.find((p) => recovered.some((r) => r.point === p)) ?? candidates[0]
    if (best) setPickedKey(best.key)
  }

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
      <Card className="min-w-0">
        <CardHeader
          action={
            <SegmentedControl
              size="sm"
              aria-label="View"
              value={view}
              onChange={(v) => setView(v === 'table' ? 'table' : 'chart')}
              options={[
                { value: 'chart', label: 'Chart', icon: <ChartSpline /> },
                { value: 'table', label: 'Table', icon: <Table2 /> },
              ]}
            />
          }
        >
          <CardTitle>{point.label}</CardTitle>
          <CardDescription>
            {asset ? `${asset.code} · ${asset.name}` : 'Removed asset'}
            {limits ? `. ${limits}.` : '.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <FormField label="Asset">
              <AssetPicker value={point.assetId} onChange={pickAsset} filter={withReadings} variant="soft" />
            </FormField>
            <FormField label="Measurement point">
              <Combobox
                variant="soft"
                items={assetPoints}
                value={point.key}
                onChange={(key) => key && setPickedKey(key)}
                getKey={(p) => p.key}
                getLabel={(p) => p.label}
                getDescription={(p) => [p.unit, `${p.readings.length} readings`].filter(Boolean).join(' · ')}
                searchPlaceholder="Search points"
              />
            </FormField>
          </div>
          {view === 'chart' ? (
            <LineChart
              className="mt-6"
              height={260}
              data={point.readings.map((r) => ({ label: fmtDateShort(r.at), value: r.value }))}
              format={fmtReading}
              zones={limitZones(point.limits)}
              referenceLines={limitLines(point.limits)}
              showDots
              ariaLabel={`${point.label} on ${asset?.code ?? 'the asset'}, ${point.readings.length} readings in ${point.unit || 'units'}`}
            />
          ) : (
            <ReadingsTable point={point} />
          )}
        </CardContent>
      </Card>

      <div className="grid min-w-0 grid-cols-1 content-start gap-4 md:grid-cols-2 xl:grid-cols-1">
        <LatestReadingCard point={point} />
        <Card>
          <CardHeader>
            <CardTitle>Points at risk</CardTitle>
            <CardDescription>Measurement points whose latest reading is a warning or a fail.</CardDescription>
          </CardHeader>
          <CardContent>
            {atRisk.length ? (
              <ul className="space-y-2">
                {atRisk.map((p) => (
                  <PointRow key={p.key} point={p} reading={p.latest} selected={p === point} onSelect={() => setPickedKey(p.key)} />
                ))}
              </ul>
            ) : (
              <div className="rounded-2xl bg-success-soft p-3 text-sm">
                <p className="flex items-center gap-2 font-semibold text-success">
                  <CircleCheck aria-hidden="true" className="size-4 shrink-0" />
                  Every point reads inside its limits
                </p>
                <p className="mt-1 text-body/70">The next readings come in with the upcoming routes.</p>
                <Button variant="link" size="sm" className="mt-1 h-auto px-0" onClick={onShowUpcoming}>
                  See upcoming routes
                </Button>
              </div>
            )}
            {recovered.length > 0 && (
              <>
                <Kicker className="mb-2 mt-5">Flagged in the last {RECENT_DAYS} days</Kicker>
                <ul className="space-y-2">
                  {recovered.map(({ point: p, flag }) => (
                    <PointRow key={p.key} point={p} reading={flag} selected={p === point} onSelect={() => setPickedKey(p.key)} />
                  ))}
                </ul>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function LatestReadingCard({ point }: { point: MeasurementPoint }) {
  const { personName } = useScoped()
  const { latest, readings } = point
  const previous = readings.at(-2)
  const change = previous ? readingChange(latest.value, previous.value) : null

  return (
    <Card>
      <CardHeader>
        <CardTitle>Latest reading</CardTitle>
        <CardDescription>
          {fmtDateTime(latest.at)} by {personName(latest.by)}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-start gap-1.5 leading-none">
          <span className="text-5xl font-bold tracking-tight tabular-nums">{fmtReading(latest.value)}</span>
          {point.unit && <span className="pt-1 text-sm font-semibold text-muted">{point.unit}</span>}
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
          <OutcomeBadge outcome={latest.outcome} />
          {change && previous && (
            <span className="text-muted">
              {change.direction === 'same'
                ? `Same as ${fmtDateShort(previous.at)}`
                : `${change.direction === 'up' ? 'Up' : 'Down'} ${change.amount} from ${fmtDateShort(previous.at)}`}
            </span>
          )}
        </div>
        <p className="mt-3 text-sm">
          <WoLink woId={latest.woId} />
        </p>
      </CardContent>
    </Card>
  )
}

function PointRow({ point, reading, selected, onSelect }: { point: MeasurementPoint; reading: Reading; selected: boolean; onSelect: () => void }) {
  const { maps } = useScoped()
  const recovered = reading !== point.latest
  return (
    <li>
      <button
        type="button"
        aria-pressed={selected}
        onClick={onSelect}
        className={cn(
          'flex w-full items-center gap-3 rounded-2xl p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 active:scale-[0.98]',
          selected ? 'bg-ink text-on-ink' : 'bg-surface-2 hover:bg-surface',
        )}
      >
        <span className="min-w-0 flex-1">
          <span className={cn('block font-mono text-[11px]', selected ? 'text-on-ink-muted' : 'text-muted')}>{maps.asset.get(point.assetId)?.code}</span>
          <span className="block truncate text-sm font-semibold">{point.label}</span>
          <span className={cn('block text-xs', selected ? 'text-on-ink-muted' : 'text-muted')}>
            {recovered
              ? `${fmtReading(reading.value)} ${point.unit} on ${fmtDateShort(reading.at)}, now ${fmtReading(point.latest.value)}`
              : `${fmtReading(reading.value)} ${point.unit} on ${fmtDateShort(reading.at)}`}
          </span>
        </span>
        <OutcomeBadge outcome={reading.outcome} />
      </button>
    </li>
  )
}

function ReadingsTable({ point }: { point: MeasurementPoint }) {
  const { personName } = useScoped()
  const table = useTableHistory('trends.readings')
  const columns: Column<Reading>[] = [
    {
      id: 'at',
      header: 'Recorded',
      cell: (r) => (
        <div>
          <p className="whitespace-nowrap tabular-nums">{fmtDateTime(r.at)}</p>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5 sm:hidden">
            <OutcomeBadge outcome={r.outcome} />
            <WoLink woId={r.woId} className="text-[11px]" />
          </div>
        </div>
      ),
      sortValue: (r) => r.at,
    },
    {
      id: 'value',
      header: 'Value',
      align: 'right',
      cell: (r) => (
        <span className="whitespace-nowrap font-semibold tabular-nums">
          {fmtReading(r.value)} <span className="text-xs font-medium text-muted">{point.unit}</span>
        </span>
      ),
      sortValue: (r) => r.value,
    },
    { id: 'outcome', header: 'Result', cell: (r) => <OutcomeBadge outcome={r.outcome} />, hideBelow: 'sm' },
    { id: 'by', header: 'Inspector', cell: (r) => <PersonChip personId={r.by} />, sortValue: (r) => personName(r.by), hideBelow: 'md' },
    { id: 'wo', header: 'Work order', cell: (r) => <WoLink woId={r.woId} />, hideBelow: 'sm' },
  ]
  return (
    <DataTable
      {...table}
      className="mt-4"
      columns={columns}
      rows={point.readings}
      getRowKey={(r) => `${r.woId}-${r.at}`}
      initialSort={{ id: 'at', desc: true }}
      pageSize={8}
      resetPageKey={point.key}
    />
  )
}
