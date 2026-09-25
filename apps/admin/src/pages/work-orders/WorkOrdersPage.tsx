import { fmtAgo, fmtDateShort, isActive, isOverdue, toMs, urgency } from '@cmms/fixtures'
import type { Priority, WoType, WorkOrder } from '@cmms/types'
import { PRIORITIES, PRIORITY_LABEL, REVIEW_WO_STATUSES, WO_TYPES, WO_TYPE_LABEL } from '@cmms/types'
import {
  Button,
  Card,
  Chip,
  type Column,
  DataTable,
  EmptyState,
  Input,
  PageHeader,
  Sheet,
  SheetBody,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  UnderlineTabs,
  cn,
  useIsPhone,
} from '@cmms/ui'
import { ClipboardList, Funnel, Plus, Search, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { useAuth } from '../../auth/auth'
import { PriorityBadge, WoStatusBadge, WoStatusCell } from '../../components/badges'
import { useCreate } from '../../components/create'
import { AssetLink, PeopleStack, paths } from '../../components/links'
import { PersonPicker, TeamPicker } from '../../components/pickers'
import { useHistoryState, useTableHistory } from '../../lib/history-state'
import { useNow, useScoped } from '../../state/scoped'

type View = 'active' | 'overdue' | 'review' | 'closed' | 'all'

interface Filters {
  types: WoType[]
  priorities: Priority[]
  teamId: string | null
  assigneeId: string | null
}

const EMPTY_FILTERS: Filters = { types: [], priorities: [], teamId: null, assigneeId: null }

const byUrgency = (now: number) => (a: WorkOrder, b: WorkOrder) => urgency(a, now) - urgency(b, now)
const newestFirst = (key: (w: WorkOrder) => string) => () => (a: WorkOrder, b: WorkOrder) =>
  key(b).localeCompare(key(a))

/** Default order per view before the user picks a column. */
const SORT: Record<View, (now: number) => (a: WorkOrder, b: WorkOrder) => number> = {
  active: byUrgency,
  overdue: byUrgency,
  review: () => (a, b) => (a.completedAt ?? '').localeCompare(b.completedAt ?? ''),
  closed: newestFirst((w) => w.closedAt ?? w.completedAt ?? w.requestedAt),
  all: newestFirst((w) => w.requestedAt),
}

const VIEW_TEST: Record<View, (wo: WorkOrder, now: number) => boolean> = {
  active: (wo) => isActive(wo),
  overdue: (wo, now) => isOverdue(wo, now),
  review: (wo) => REVIEW_WO_STATUSES.includes(wo.status),
  closed: (wo) => wo.status === 'closed' || wo.status === 'cancelled',
  all: () => true,
}

export function WorkOrdersPage() {
  const s = useScoped()
  const now = useNow()
  const navigate = useNavigate()
  const create = useCreate()
  const { can } = useAuth()
  const isPhone = useIsPhone()
  const [params, setParams] = useSearchParams()
  const view = (params.get('view') as View | null) ?? 'active'
  const [query, setQuery] = useHistoryState('query', '')
  const [filters, setFilters] = useHistoryState<Filters>('filters', EMPTY_FILTERS)
  const table = useTableHistory()
  const [filtersOpen, setFiltersOpen] = useState(false)

  const counts = useMemo(
    () =>
      Object.fromEntries(
        (Object.keys(VIEW_TEST) as View[]).map((v) => [
          v,
          s.workOrders.filter((w) => VIEW_TEST[v](w, now)).length,
        ]),
      ) as Record<View, number>,
    [s.workOrders, now],
  )

  const rows = useMemo(() => {
    const terms = query.toLowerCase().split(/\s+/).filter(Boolean)
    return s.workOrders
      .filter((w) => VIEW_TEST[view](w, now))
      .filter((w) => !filters.types.length || filters.types.includes(w.type))
      .filter((w) => !filters.priorities.length || filters.priorities.includes(w.priority))
      .filter((w) => !filters.teamId || w.teamId === filters.teamId)
      .filter((w) => !filters.assigneeId || w.assigneeIds.includes(filters.assigneeId))
      .filter((w) => {
        if (!terms.length) return true
        const asset = s.maps.asset.get(w.assetId)
        const text = `${w.code} ${w.title} ${asset?.code ?? ''} ${asset?.name ?? ''}`.toLowerCase()
        return terms.every((t) => text.includes(t))
      })
      .sort(SORT[view](now))
  }, [s.workOrders, s.maps.asset, view, filters, query, now])

  const activeFilterCount =
    filters.types.length + filters.priorities.length + (filters.teamId ? 1 : 0) + (filters.assigneeId ? 1 : 0)

  const columns: Column<WorkOrder>[] = [
    {
      id: 'wo',
      header: 'Work order',
      cell: (wo) => (
        <div className="min-w-0 max-w-[18rem]">
          <Link
            to={paths.workOrder(wo.id)}
            onClick={(event) => event.stopPropagation()}
            className="font-semibold block truncate underline-offset-2 hover:text-accent-strong hover:underline"
          >
            {wo.title}
          </Link>
          <p className="text-[11px] text-muted">
            <span className="font-mono">{wo.code}</span> · {WO_TYPE_LABEL[wo.type]}
          </p>
          <p className="lg:hidden truncate text-[11px] text-muted">{s.maps.asset.get(wo.assetId)?.name}</p>
          <div className="mt-1.5 gap-1.5 sm:hidden flex flex-wrap items-center">
            <PriorityBadge priority={wo.priority} />
            <WoStatusBadge status={wo.status} waitingReason={wo.waitingReason} />
            <span
              className={cn(
                'text-[11px] tabular-nums',
                isOverdue(wo, now) ? 'font-semibold text-accent' : 'text-muted',
              )}
            >
              {isOverdue(wo, now)
                ? `${fmtAgo(wo.dueAt, now).replace(' ago', '')} late`
                : `Due ${fmtDateShort(wo.dueAt)}`}
            </span>
          </div>
        </div>
      ),
      sortValue: (wo) => wo.code,
    },
    {
      id: 'asset',
      header: 'Asset',
      cell: (wo) => <AssetLink assetId={wo.assetId} className="max-w-[11rem]" />,
      sortValue: (wo) => s.maps.asset.get(wo.assetId)?.code ?? '',
      hideBelow: 'lg',
    },
    {
      id: 'priority',
      header: 'Priority',
      cell: (wo) => <PriorityBadge priority={wo.priority} />,
      sortValue: (wo) => wo.priority,
      hideBelow: 'sm',
    },
    {
      id: 'status',
      header: 'Status',
      cell: (wo) => <WoStatusCell status={wo.status} waitingReason={wo.waitingReason} />,
      sortValue: (wo) => wo.status,
      hideBelow: 'sm',
    },
    {
      id: 'people',
      header: 'Assigned',
      cell: (wo) => <PeopleStack personIds={wo.assigneeIds} size="xs" />,
      hideBelow: 'xl',
    },
    {
      id: 'due',
      header: view === 'closed' ? 'Closed' : 'Due',
      cell: (wo) => {
        const when = view === 'closed' ? (wo.closedAt ?? wo.completedAt ?? wo.dueAt) : wo.dueAt
        const late = isOverdue(wo, now)
        return (
          <div className="whitespace-nowrap">
            <p className={cn('text-sm tabular-nums', late && 'font-semibold text-accent')}>
              {fmtDateShort(when)}
            </p>
            <p className={cn('text-[11px]', late ? 'text-accent' : 'text-muted')}>
              {late ? `${fmtAgo(wo.dueAt, now).replace(' ago', '')} late` : fmtAgo(when, now)}
            </p>
          </div>
        )
      },
      sortValue: (wo) => toMs(wo.dueAt),
      hideBelow: 'sm',
    },
  ]

  const setView = (v: string) => {
    const next = new URLSearchParams(params)
    if (v === 'active') next.delete('view')
    else next.set('view', v)
    setParams(next, { replace: true })
  }

  const filterControls = <FilterControls filters={filters} onChange={setFilters} stacked={isPhone} />

  return (
    <>
      <PageHeader
        title="Work orders"
        description="Every job on an asset, from request to verified closure."
        actions={
          <>
            <Input
              variant="pill"
              type="search"
              className="sm:w-64 w-full"
              leftIcon={<Search />}
              placeholder="Search code, title or asset"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            {can('wo.create') && (
              <Button onClick={() => create.workOrder()}>
                <Plus />
                New work order
              </Button>
            )}
          </>
        }
      />

      <Card>
        <div className="gap-3 px-5 pt-3 flex flex-wrap items-end">
          <UnderlineTabs
            className="min-w-0 flex-1"
            value={view}
            onValueChange={setView}
            items={[
              { value: 'active', label: 'Active', count: counts.active },
              { value: 'overdue', label: 'Overdue', count: counts.overdue },
              { value: 'review', label: 'To verify and close', count: counts.review },
              { value: 'closed', label: 'Closed', count: counts.closed },
              { value: 'all', label: 'All', count: counts.all },
            ]}
          />
          {isPhone && (
            <Button variant="outline" size="sm" className="mb-2" onClick={() => setFiltersOpen(true)}>
              <Funnel />
              Filters{activeFilterCount ? ` · ${activeFilterCount}` : ''}
            </Button>
          )}
        </div>
        {!isPhone && (
          <div className="gap-3 px-5 py-3 flex flex-wrap items-center border-b border-border">
            <div className="min-w-0 flex-1">{filterControls}</div>
            {activeFilterCount > 0 && (
              <Button variant="ghost" size="sm" onClick={() => setFilters(EMPTY_FILTERS)}>
                <X />
                Clear {activeFilterCount} {activeFilterCount === 1 ? 'filter' : 'filters'}
              </Button>
            )}
          </div>
        )}
        <DataTable
          columns={columns}
          rows={rows}
          getRowKey={(wo) => wo.id}
          onRowClick={(wo) => navigate(paths.workOrder(wo.id))}
          rowClassName={(wo) => (wo.priority === 'P1' && isActive(wo) ? 'bg-accent-soft/40' : undefined)}
          resetPageKey={`${view}|${query}|${JSON.stringify(filters)}`}
          {...table}
          empty={
            <EmptyState
              icon={<ClipboardList />}
              title={query || activeFilterCount ? 'No work orders match' : 'Nothing here'}
              description={
                query || activeFilterCount
                  ? 'Clear the search or filters to see more.'
                  : 'New work orders from requests and PM schedules land here.'
              }
              action={
                query || activeFilterCount ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setQuery('')
                      setFilters(EMPTY_FILTERS)
                    }}
                  >
                    Clear filters
                  </Button>
                ) : undefined
              }
            />
          }
        />
      </Card>
      {(view === 'active' || view === 'overdue') && (
        <p className="mt-3 text-xs text-muted">
          Sorted by urgency: overdue first, then priority and due date. Click a column header to sort.
        </p>
      )}

      <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
        <SheetContent side="bottom">
          <SheetHeader>
            <SheetTitle>Filters</SheetTitle>
          </SheetHeader>
          <SheetBody>{filterControls}</SheetBody>
          <SheetFooter>
            <Button variant="outline" onClick={() => setFilters(EMPTY_FILTERS)}>
              Clear
            </Button>
            <Button onClick={() => setFiltersOpen(false)}>Show {rows.length} results</Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </>
  )
}

function FilterControls({
  filters,
  onChange,
  stacked,
}: {
  filters: Filters
  onChange: (f: Filters) => void
  stacked: boolean
}) {
  const toggle = <T,>(list: T[], value: T) =>
    list.includes(value) ? list.filter((x) => x !== value) : [...list, value]
  return (
    <div className={cn('gap-3 flex', stacked ? 'flex-col' : 'flex-wrap items-center')}>
      <div className="gap-2 flex flex-wrap">
        {WO_TYPES.map((t) => (
          <Chip
            key={t}
            active={filters.types.includes(t)}
            onClick={() => onChange({ ...filters, types: toggle(filters.types, t) })}
          >
            {WO_TYPE_LABEL[t]}
          </Chip>
        ))}
      </div>
      <div className="gap-2 flex flex-wrap">
        {PRIORITIES.map((p) => (
          <Chip
            key={p}
            active={filters.priorities.includes(p)}
            title={PRIORITY_LABEL[p]}
            onClick={() => onChange({ ...filters, priorities: toggle(filters.priorities, p) })}
          >
            {p}
          </Chip>
        ))}
      </div>
      <div className={cn('gap-2 flex', stacked ? 'flex-col' : 'flex-wrap')}>
        <TeamPicker aria-label="Filter by team"
          variant="inline"
          clearable
          placeholder="All teams"
          value={filters.teamId}
          onChange={(teamId) => onChange({ ...filters, teamId })}
        />
        <PersonPicker aria-label="Filter by assignee"
          variant="inline"
          clearable
          allowOnLeave
          placeholder="Anyone"
          value={filters.assigneeId}
          onChange={(assigneeId) => onChange({ ...filters, assigneeId })}
        />
      </div>
    </div>
  )
}
