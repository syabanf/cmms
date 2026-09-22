import { DAY, HISTORY_KINDS, HISTORY_KIND_LABEL, type HistoryKind, fmtIdrShort, historyItems, plural, subtreeIds } from '@cmms/fixtures'
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Chip, ChipRow, EmptyState, PageHeader, PillTabs, useLazyList } from '@cmms/ui'
import { ChevronDown, ClockFading } from 'lucide-react'
import { useMemo } from 'react'
import { useSearchParams } from 'react-router'
import { AssetPicker } from '../../components/pickers'
import { useHistoryState } from '../../lib/history-state'
import { useNow, useScoped } from '../../state/scoped'
import { HistoryTimeline } from './HistoryTimeline'
import { HISTORY_PERIODS, type HistoryPeriod, KIND_STYLE, PAGE_SIZE, countByKind, isHistoryPeriod } from './lib'

/** `?asset=<id>` opens the page on one machine; its components are included. */
export function HistoryPage() {
  const s = useScoped()
  const now = useNow(60_000)
  const [params, setParams] = useSearchParams()
  const [period, setPeriod] = useHistoryState<HistoryPeriod>('period', 90)
  const [kinds, setKinds] = useHistoryState<HistoryKind[]>('kinds', [])
  const [loaded, setLoaded] = useHistoryState<number | undefined>('loaded', undefined)

  const assetParam = params.get('asset')
  const asset = assetParam && s.assetIds.has(assetParam) ? s.maps.asset.get(assetParam) : undefined

  const setAsset = (id: string | null) => {
    const next = new URLSearchParams(params)
    if (id) next.set('asset', id)
    else next.delete('asset')
    setParams(next, { replace: true })
  }

  const toggleKind = (kind: HistoryKind) =>
    setKinds((prev) => {
      const next = prev.includes(kind) ? prev.filter((k) => k !== kind) : [...prev, kind]
      return next.length === HISTORY_KINDS.length ? [] : next
    })

  const scope = useMemo(() => (asset ? subtreeIds(s.assets, asset.id) : null), [s.assets, asset])

  const inPeriod = useMemo(() => {
    const from = now - period * DAY
    const input = {
      workOrders: s.workOrders,
      meters: s.meters,
      meterReadings: s.meterReadings,
      documents: s.documents,
      calibrations: s.calibrations,
      parts: s.maps.part,
      failureCodes: s.maps.failureCode,
      people: s.maps.person,
    }
    return historyItems(input, scope, now).filter((item) => item.at >= from)
  }, [s.workOrders, s.meters, s.meterReadings, s.documents, s.calibrations, s.maps, scope, period, now])

  const items = useMemo(() => (kinds.length ? inPeriod.filter((item) => kinds.includes(item.kind)) : inPeriod), [inPeriod, kinds])
  const counts = useMemo(() => countByKind(items), [items])
  const booked = useMemo(() => items.reduce((sum, item) => sum + (item.kind === 'cost' ? (item.amount ?? 0) : 0), 0), [items])
  const list = useLazyList(items, {
    pageSize: PAGE_SIZE,
    resetKey: [asset?.id ?? '', period, kinds.join()],
    initialCount: loaded,
    onCountChange: setLoaded,
  })

  const components = scope ? scope.size - 1 : 0
  const filtered = kinds.length > 0 || asset !== undefined
  const clearFilters = () => {
    setKinds([])
    setAsset(null)
  }

  return (
    <>
      <PageHeader title="Maintenance history" description="Everything that happened to an asset, in one place." />

      <div className="space-y-4">
        <Card className="space-y-3 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <AssetPicker
              variant="inline"
              clearable
              className="border border-border"
              placeholder="All assets"
              value={asset?.id ?? null}
              onChange={setAsset}
            />
            <PillTabs
              value={String(period)}
              onValueChange={(value) => {
                const next = Number(value)
                if (isHistoryPeriod(next)) setPeriod(next)
              }}
              items={HISTORY_PERIODS.map((days) => ({ value: String(days), label: `${days} days` }))}
            />
          </div>
          <ChipRow role="group" aria-label="Filter by kind">
            <Chip active={!kinds.length} onClick={() => setKinds([])}>
              All
            </Chip>
            {HISTORY_KINDS.map((kind) => {
              const Icon = KIND_STYLE[kind].icon
              return (
                <Chip key={kind} icon={<Icon />} active={kinds.includes(kind)} onClick={() => toggleKind(kind)}>
                  {HISTORY_KIND_LABEL[kind]}
                </Chip>
              )
            })}
          </ChipRow>
        </Card>

        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-card bg-card px-5 py-3 text-sm shadow-card">
          <span>
            <span className="font-bold tabular-nums">{items.length}</span> <span className="text-muted">events</span>
          </span>
          {HISTORY_KINDS.filter((kind) => counts[kind] > 0).map((kind) => {
            const Icon = KIND_STYLE[kind].icon
            return (
              <span key={kind} className="inline-flex items-center gap-1.5 text-muted">
                <Icon aria-hidden className="size-3.5" />
                {HISTORY_KIND_LABEL[kind]}
                <span className="font-semibold tabular-nums text-foreground">{counts[kind]}</span>
              </span>
            )
          })}
          {booked > 0 && (
            <span className="sm:ml-auto">
              <span className="font-semibold tabular-nums">{fmtIdrShort(booked)}</span> <span className="text-muted">booked</span>
            </span>
          )}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Timeline</CardTitle>
            <CardDescription>
              {asset ? `${asset.name}${components ? ` and ${plural(components, 'component')}` : ''}` : `All assets at ${s.site.name}`}, last {period} days
            </CardDescription>
          </CardHeader>
          <CardContent>
            {items.length ? (
              <>
                <HistoryTimeline items={list.visible} assetId={asset?.id ?? null} />
                {list.hasMore && (
                  <div className="flex flex-col items-center gap-1.5 pt-5">
                    <Button variant="outline" onClick={list.loadMore}>
                      <ChevronDown />
                      Show more
                    </Button>
                    <span className="text-xs tabular-nums text-muted">{list.remaining} more</span>
                  </div>
                )}
              </>
            ) : (
              <EmptyState
                icon={<ClockFading />}
                title="Nothing recorded for this filter"
                description={
                  filtered
                    ? 'Clear the asset or kind filter to see more of what happened.'
                    : period < 365
                      ? 'Look further back to find older work, readings and documents.'
                      : 'Completed work, meter readings, documents and calibrations show up here.'
                }
                action={
                  filtered ? (
                    <Button variant="outline" onClick={clearFilters}>
                      Clear filters
                    </Button>
                  ) : period < 365 ? (
                    <Button variant="outline" onClick={() => setPeriod(365)}>
                      Show the last 365 days
                    </Button>
                  ) : undefined
                }
              />
            )}
          </CardContent>
        </Card>
      </div>
    </>
  )
}
