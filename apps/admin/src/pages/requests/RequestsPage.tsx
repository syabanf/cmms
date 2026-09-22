import { fmtAgo, fmtDuration, fmtMonthShort, fmtNumber, plural } from '@cmms/fixtures'
import type { Asset } from '@cmms/types'
import { REQUEST_SOURCE_LABEL, SEVERITIES, SEVERITY_LABEL } from '@cmms/types'
import {
  Button,
  Card,
  Chip,
  EmptyState,
  Input,
  LazySentinel,
  PageHeader,
  Sheet,
  SheetBody,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  StatCard,
  UnderlineTabs,
  cn,
  useIsPhone,
  useLazyList,
} from '@cmms/ui'
import type { LucideIcon } from 'lucide-react'
import { Ban, ClipboardCheck, Eye, Funnel, Inbox, Plus, Search, Timer } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router'
import { useAuth } from '../../auth/auth'
import { useCreate } from '../../components/create'
import { AssetPicker } from '../../components/pickers'
import { useHistoryState } from '../../lib/history-state'
import { useNow, useScoped } from '../../state/scoped'
import {
  NO_FILTERS,
  REQUEST_SOURCES,
  REQUEST_VIEWS,
  type RequestFilters,
  type RequestView,
  TRIAGE_WINDOW_DAYS,
  asView,
  filterCount,
  inView,
  newestFirst,
  requestStats,
  toggle,
} from './lib'
import { RequestRow } from './RequestRow'
import { SOURCE_ICON } from './SourceBadge'

const VIEW_LABEL: Record<RequestView, string> = {
  new: 'New',
  monitor: 'Monitoring',
  converted: 'Converted',
  closed: 'Closed',
  all: 'All',
}

const EMPTY: Record<RequestView, { icon: LucideIcon; title: string; description: string }> = {
  new: { icon: Inbox, title: 'No requests waiting for triage', description: 'Reports from operators, technicians and inspections land here first.' },
  monitor: { icon: Eye, title: 'Nothing on the monitoring list', description: 'Requests you decide to watch before converting show up here with the note.' },
  converted: { icon: ClipboardCheck, title: 'No converted requests', description: 'Convert a new request to create its work order.' },
  closed: { icon: Ban, title: 'No rejected or duplicate requests', description: 'Requests closed without a work order show up here with the reason.' },
  all: { icon: Inbox, title: 'No requests yet', description: 'Operators report problems from the mobile app, or you can log one here.' },
}

export function RequestsPage() {
  const s = useScoped()
  const now = useNow()
  const { can } = useAuth()
  const create = useCreate()
  const isPhone = useIsPhone()
  const [params, setParams] = useSearchParams()
  const [query, setQuery] = useHistoryState('query', '')
  const [filters, setFilters] = useHistoryState<RequestFilters>('filters', NO_FILTERS)
  const [loaded, setLoaded] = useHistoryState<number | undefined>('loaded', undefined)
  const [filtersOpen, setFiltersOpen] = useState(false)

  // The tab lives in the URL so the back button from a request returns to it.
  const view = asView(params.get('view'))
  const setView = (v: RequestView) => setParams(v === 'new' ? {} : { view: v }, { replace: true })

  const stats = useMemo(() => requestStats(s.requests, now), [s.requests, now])

  const { maps, personName } = s
  const matching = useMemo(() => {
    const terms = query.toLowerCase().split(/\s+/).filter(Boolean)
    return s.requests
      .filter((r) => !filters.severities.length || filters.severities.includes(r.severity))
      .filter((r) => !filters.sources.length || filters.sources.includes(r.source))
      .filter((r) => !filters.assetId || r.assetId === filters.assetId)
      .filter((r) => {
        if (!terms.length) return true
        const asset = maps.asset.get(r.assetId)
        const text = `${r.code} ${r.title} ${r.description} ${asset?.code ?? ''} ${asset?.name ?? ''} ${personName(r.reportedBy)}`.toLowerCase()
        return terms.every((t) => text.includes(t))
      })
      .sort(newestFirst)
  }, [s.requests, maps, personName, filters, query])

  const counts = useMemo(
    () => Object.fromEntries(REQUEST_VIEWS.map((v) => [v, matching.filter((r) => inView(r, v)).length])) as Record<RequestView, number>,
    [matching],
  )
  const rows = useMemo(() => matching.filter((r) => inView(r, view)), [matching, view])
  const list = useLazyList(rows, { pageSize: 12, resetKey: [view, query, filters], initialCount: loaded, onCountChange: setLoaded })

  // The asset filter only offers assets that have requests.
  const hasRequests = useMemo(() => {
    const ids = new Set(s.requests.map((r) => r.assetId))
    return (a: Asset) => ids.has(a.id)
  }, [s.requests])

  const activeFilters = filterCount(filters)
  const narrowed = query.trim() !== '' || activeFilters > 0
  const empty = EMPTY[view]
  const EmptyIcon = narrowed ? Search : empty.icon

  const emptyAction = () => {
    if (narrowed) {
      return (
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setQuery('')
            setFilters(NO_FILTERS)
          }}
        >
          Clear filters
        </Button>
      )
    }
    if (view === 'new' || view === 'all') {
      return can('request.create') ? (
        <Button size="sm" onClick={() => create.request()}>
          <Plus />
          Report problem
        </Button>
      ) : undefined
    }
    const target: RequestView = view === 'closed' ? 'all' : 'new'
    return (
      <Button variant="outline" size="sm" onClick={() => setView(target)}>
        {target === 'all' ? 'View all requests' : 'View new requests'}
      </Button>
    )
  }

  const filterControls = <FilterControls filters={filters} onChange={setFilters} assetFilter={hasRequests} stacked={isPhone} />

  return (
    <>
      <PageHeader
        title="Maintenance requests"
        description="A request is a report that something needs checking. It becomes a work order only after triage."
        actions={
          <>
            <Input
              variant="pill"
              type="search"
              className="w-full sm:w-64"
              leftIcon={<Search />}
              placeholder="Search code, title, asset or reporter"
              aria-label="Search requests"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            {can('request.create') && (
              <Button onClick={() => create.request()}>
                <Plus />
                Report problem
              </Button>
            )}
          </>
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <StatCard
          label="New"
          value={fmtNumber(stats.waiting)}
          hint={stats.oldestWaiting ? `Oldest reported ${fmtAgo(stats.oldestWaiting.reportedAt, now)}` : 'Triage queue is clear'}
          icon={<Inbox />}
          tone={stats.waiting > 0 ? 'danger' : 'default'}
          onClick={() => setView('new')}
        />
        <StatCard
          label="Monitoring"
          value={fmtNumber(stats.monitoring)}
          hint="Watched without a work order"
          icon={<Eye />}
          tone="warning"
          onClick={() => setView('monitor')}
        />
        <StatCard
          label="Converted this month"
          value={fmtNumber(stats.convertedThisMonth)}
          hint={`Of ${plural(stats.decidedThisMonth, 'request')} triaged in ${fmtMonthShort(now)}`}
          icon={<ClipboardCheck />}
          tone="success"
          onClick={() => setView('converted')}
        />
        <StatCard
          label="Median time to triage"
          value={stats.medianTriageMin === null ? 'None' : fmtDuration(stats.medianTriageMin)}
          hint={`Last ${TRIAGE_WINDOW_DAYS} days · ${plural(stats.triageSamples, 'request')}`}
          icon={<Timer />}
          tone="info"
        />
      </div>

      <Card>
        <div className="flex flex-wrap items-end gap-3 px-5 pt-3">
          <UnderlineTabs
            className="min-w-0 flex-1"
            value={view}
            onValueChange={(v) => setView(asView(v))}
            items={REQUEST_VIEWS.map((v) => ({ value: v, label: VIEW_LABEL[v], count: counts[v] }))}
          />
          {isPhone && (
            <Button variant="outline" size="sm" className="mb-2" onClick={() => setFiltersOpen(true)}>
              <Funnel />
              Filters{activeFilters ? ` · ${activeFilters}` : ''}
            </Button>
          )}
        </div>
        {!isPhone && <div className="border-b border-border px-5 py-3">{filterControls}</div>}

        {rows.length ? (
          <>
            <ul className="divide-y divide-border">
              {list.visible.map((r) => (
                <RequestRow key={r.id} request={r} now={now} />
              ))}
            </ul>
            <LazySentinel remaining={list.remaining} onLoad={list.loadMore} sentinelRef={list.sentinelRef} className="border-t border-border" />
          </>
        ) : (
          <EmptyState
            icon={<EmptyIcon />}
            title={narrowed ? 'No requests match' : empty.title}
            description={narrowed ? 'Clear the search or filters to see more.' : empty.description}
            action={emptyAction()}
          />
        )}
      </Card>

      <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
        <SheetContent side="bottom" aria-describedby={undefined}>
          <SheetHeader>
            <SheetTitle>Filters</SheetTitle>
          </SheetHeader>
          <SheetBody>{filterControls}</SheetBody>
          <SheetFooter>
            <Button variant="outline" onClick={() => setFilters(NO_FILTERS)}>
              Clear
            </Button>
            <Button onClick={() => setFiltersOpen(false)}>Show {plural(rows.length, 'request')}</Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </>
  )
}

function FilterControls({
  filters,
  onChange,
  assetFilter,
  stacked,
}: {
  filters: RequestFilters
  onChange: (next: RequestFilters) => void
  assetFilter: (a: Asset) => boolean
  stacked: boolean
}) {
  return (
    <div className={cn('flex gap-3', stacked ? 'flex-col' : 'flex-wrap items-center')}>
      <div role="group" aria-label="Severity" className="flex flex-wrap gap-2">
        {SEVERITIES.map((sev) => (
          <Chip key={sev} active={filters.severities.includes(sev)} onClick={() => onChange({ ...filters, severities: toggle(filters.severities, sev) })}>
            {SEVERITY_LABEL[sev]}
          </Chip>
        ))}
      </div>
      <div role="group" aria-label="Source" className="flex flex-wrap gap-2">
        {REQUEST_SOURCES.map((source) => {
          const Icon = SOURCE_ICON[source]
          return (
            <Chip
              key={source}
              icon={<Icon />}
              active={filters.sources.includes(source)}
              onClick={() => onChange({ ...filters, sources: toggle(filters.sources, source) })}
            >
              {REQUEST_SOURCE_LABEL[source]}
            </Chip>
          )
        })}
      </div>
      <AssetPicker
        variant="inline"
        clearable
        placeholder="All assets"
        filter={assetFilter}
        value={filters.assetId}
        onChange={(assetId) => onChange({ ...filters, assetId })}
      />
    </div>
  )
}
