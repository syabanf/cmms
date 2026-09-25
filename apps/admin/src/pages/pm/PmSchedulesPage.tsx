import {
  DAY,
  type PmDue,
  type PmState,
  fmtDate,
  fmtDateShort,
  fmtNumber,
  fmtPercent,
  openPmWorkOrder,
  plural,
  pmCompliance,
  pmDue,
  toMs,
  triggerText,
} from '@cmms/fixtures'
import type { Asset, JobPlan, Meter, PmSchedule, PmTriggerKind, WorkOrder } from '@cmms/types'
import { PM_TRIGGER_LABEL } from '@cmms/types'
import {
  ActionMenu,
  Banner,
  Button,
  Card,
  Chip,
  type Column,
  ConfirmDialog,
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
  StatCard,
  Switch,
  cn,
  useIsPhone,
} from '@cmms/ui'
import { CalendarClock, CalendarPlus, CircleAlert, Ellipsis, Funnel, Gauge, Microscope, Pause, Pencil, Play, Plus, Search, Timer, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { useAuth } from '../../auth/auth'
import { AssetLink, PersonChip, WoLink, paths } from '../../components/links'
import { TeamPicker } from '../../components/pickers'
import { useHistoryState, useTableHistory } from '../../lib/history-state'
import { useNow, useScoped } from '../../state/scoped'
import { usePmActions } from './actions'
import { PmStateBadge } from './badges'
import { PM_STATES, PM_STATE_LABEL, capaHints, deleteEffect, dueRelative, meterLeftText, triggerMeterId } from './lib'
import { PmDialog } from './PmDialog'

type StateFilter = PmState | 'paused'

const STATE_FILTERS: StateFilter[] = [...PM_STATES, 'paused']
const STATE_FILTER_LABEL: Record<StateFilter, string> = { ...PM_STATE_LABEL, paused: 'Paused' }
const STATE_RANK: Record<StateFilter, number> = { overdue: 0, due: 1, due_soon: 2, scheduled: 3, paused: 4 }
const TRIGGER_KINDS: PmTriggerKind[] = ['calendar', 'meter', 'combined']

interface Row {
  pm: PmSchedule
  due: PmDue
  /** Paused schedules read as paused whatever their due date. */
  state: StateFilter
  asset: Asset | undefined
  plan: JobPlan | undefined
  meter: Meter | undefined
  openWo: WorkOrder | undefined
  trigger: string
}

interface Filters {
  state: StateFilter | null
  kind: PmTriggerKind | null
  teamId: string | null
}

const NO_FILTERS: Filters = { state: null, kind: null, teamId: null }

export function PmSchedulesPage() {
  const s = useScoped()
  const now = useNow(60_000)
  const { can } = useAuth()
  const canManage = can('pm.manage')
  const isPhone = useIsPhone()
  const navigate = useNavigate()
  const { blockReason, generate, setActive, remove } = usePmActions()
  const [params, setParams] = useSearchParams()
  const [editing, setEditing] = useState<PmSchedule | null>(null)
  const [query, setQuery] = useHistoryState('query', '')
  const [filters, setFilters] = useHistoryState<Filters>('filters', NO_FILTERS)
  const table = useTableHistory()
  const [filtersOpen, setFiltersOpen] = useState(false)
  // Kept after closing so the dialog text survives its exit animation.
  const [deleting, setDeleting] = useState<{ row: Row; open: boolean } | null>(null)

  const rows = useMemo<Row[]>(
    () =>
      s.pmSchedules.map((pm) => {
        const due = pmDue(pm, s.maps.meter, now)
        const meterId = triggerMeterId(pm)
        return {
          pm,
          due,
          state: pm.active ? due.state : 'paused',
          asset: s.maps.asset.get(pm.assetId),
          plan: s.maps.jobPlan.get(pm.jobPlanId),
          meter: meterId ? s.maps.meter.get(meterId) : undefined,
          openWo: openPmWorkOrder(pm, s.workOrders),
          trigger: triggerText(pm, s.maps.meter),
        }
      }),
    [s.pmSchedules, s.maps, s.workOrders, now],
  )

  const stats = useMemo(() => {
    const active = rows.filter((r) => r.pm.active)
    const week = active.filter((r) => r.due.daysLeft >= 0 && r.due.daysLeft <= 7)
    const overdue = active.filter((r) => r.due.state === 'overdue')
    return {
      active: active.length,
      paused: rows.length - active.length,
      week: week.length,
      weekByMeter: week.filter((r) => r.due.dueBy === 'meter').length,
      overdue: overdue.length,
      overdueNoWo: overdue.filter((r) => !r.openWo).length,
      overdueUnassigned: overdue.filter((r) => r.openWo && !r.openWo.assigneeIds.length).length,
      compliance: pmCompliance(s.workOrders, now - 90 * DAY, now, now),
    }
  }, [rows, s.workOrders, now])

  const counts = useMemo(() => {
    const c: Record<StateFilter, number> = { overdue: 0, due: 0, due_soon: 0, scheduled: 0, paused: 0 }
    for (const r of rows) c[r.state]++
    return c
  }, [rows])

  const visible = useMemo(() => {
    const terms = query.toLowerCase().split(/\s+/).filter(Boolean)
    return rows
      .filter((r) => !filters.state || r.state === filters.state)
      .filter((r) => !filters.kind || r.pm.trigger.kind === filters.kind)
      .filter((r) => !filters.teamId || r.pm.teamId === filters.teamId)
      .filter((r) => {
        if (!terms.length) return true
        const text = `${r.pm.code} ${r.pm.name} ${r.asset?.code ?? ''} ${r.asset?.name ?? ''} ${r.plan?.code ?? ''} ${r.plan?.name ?? ''}`.toLowerCase()
        return terms.every((t) => text.includes(t))
      })
      .sort((a, b) => STATE_RANK[a.state] - STATE_RANK[b.state] || a.due.dueAt - b.due.dueAt)
  }, [rows, filters, query])

  const hints = useMemo(() => capaHints(s.rcas, s.pmSchedules), [s.rcas, s.pmSchedules])

  // `?new=1` (with an optional `plan=<job plan id>`) opens the create dialog.
  const creating = params.get('new') === '1' && canManage
  const setCreating = (open: boolean) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        next.delete('plan')
        if (open) next.set('new', '1')
        else next.delete('new')
        return next
      },
      { replace: true },
    )

  const activeFilterCount = (filters.state ? 1 : 0) + (filters.kind ? 1 : 0) + (filters.teamId ? 1 : 0)
  const clearAll = () => {
    setQuery('')
    setFilters(NO_FILTERS)
  }

  const columns: Column<Row>[] = [
    {
      id: 'schedule',
      header: 'Schedule',
      cell: (r) => (
        <div className="min-w-0 max-w-[14rem] sm:max-w-[16rem]">
          <p className="font-mono text-[11px] text-muted">{r.pm.code}</p>
          <p className="truncate font-semibold">{r.pm.name}</p>
          <p className="truncate text-xs text-muted">{r.trigger}</p>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5 sm:hidden">
            <PmStateBadge state={r.state} />
            <span className={cn('text-[11px] tabular-nums', r.state === 'overdue' ? 'font-semibold text-accent' : 'text-muted')}>
              {fmtDateShort(r.due.dueAt)} · {r.pm.active ? dueRelative(r.due.daysLeft) : 'paused'}
            </span>
          </div>
        </div>
      ),
      sortValue: (r) => r.pm.code,
    },
    { id: 'asset', header: 'Asset', cell: (r) => <AssetLink assetId={r.pm.assetId} />, sortValue: (r) => r.asset?.code ?? '', hideBelow: 'lg' },
    {
      id: 'plan',
      header: 'Job plan',
      cell: (r) =>
        r.plan ? (
          <Link to={paths.jobPlan(r.plan.id)} onClick={(e) => e.stopPropagation()} className="block max-w-[12rem] hover:text-accent">
            <span className="block font-mono text-xs">{r.plan.code}</span>
            <span className="block truncate text-xs text-muted">{r.plan.name}</span>
          </Link>
        ) : (
          <span className="text-xs text-muted">Deleted plan</span>
        ),
      sortValue: (r) => r.plan?.code ?? '',
      className: 'hidden 2xl:table-cell',
      headerClassName: 'hidden 2xl:table-cell',
    },
    {
      id: 'last',
      header: 'Last done',
      cell: (r) => (
        <div className="whitespace-nowrap tabular-nums">
          <p>{fmtDate(r.pm.lastDoneAt)}</p>
          {r.pm.lastDoneMeter !== null && r.meter && (
            <p className="text-xs text-muted">
              {fmtNumber(r.pm.lastDoneMeter)} {r.meter.unit}
            </p>
          )}
        </div>
      ),
      sortValue: (r) => toMs(r.pm.lastDoneAt),
      className: 'hidden 2xl:table-cell',
      headerClassName: 'hidden 2xl:table-cell',
    },
    { id: 'due', header: 'Next due', cell: (r) => <DueCell row={r} />, sortValue: (r) => r.due.dueAt, hideBelow: 'sm' },
    { id: 'state', header: 'State', cell: (r) => <PmStateBadge state={r.state} />, sortValue: (r) => STATE_RANK[r.state], hideBelow: 'sm' },
    {
      id: 'wo',
      header: 'Work order',
      cell: (r) => (r.openWo ? <WoLink woId={r.openWo.id} /> : <span className="text-xs text-muted">None open</span>),
      hideBelow: 'xl',
    },
    {
      id: 'assignee',
      header: 'Assignee',
      cell: (r) => <PersonChip personId={r.pm.assigneeId} />,
      className: 'hidden 2xl:table-cell',
      headerClassName: 'hidden 2xl:table-cell',
    },
    {
      id: 'active',
      header: 'Active',
      cell: (r) => (
        <Switch
          size="sm"
          checked={r.pm.active}
          disabled={!canManage}
          aria-label={`${r.pm.code} active`}
          onCheckedChange={(active) => setActive(r.pm, active)}
        />
      ),
      className: 'hidden 2xl:table-cell',
      headerClassName: 'hidden 2xl:table-cell',
    },
  ]
  if (canManage) {
    columns.push({
      id: 'actions',
      header: <span className="sr-only">Actions</span>,
      align: 'right',
      width: '3.5rem',
      cell: (r) => {
        const reason = blockReason(r.pm)
        return (
          <ActionMenu
            title={`${r.pm.code} ${r.pm.name}`}
            trigger={
              <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${r.pm.code}`}>
                <Ellipsis />
              </Button>
            }
            items={[
              {
                key: 'generate',
                label: 'Generate work order',
                description: reason ?? `Due ${fmtDate(r.due.dueAt)}`,
                icon: <CalendarPlus />,
                disabled: reason !== null,
                onSelect: () => generate(r.pm, r.due.dueAt),
              },
              { key: 'edit', label: 'Edit', icon: <Pencil />, onSelect: () => setEditing(r.pm) },
              {
                key: 'active',
                label: r.pm.active ? 'Pause' : 'Resume',
                icon: r.pm.active ? <Pause /> : <Play />,
                onSelect: () => setActive(r.pm, !r.pm.active),
              },
              'separator',
              { key: 'delete', label: 'Delete', icon: <Trash2 />, destructive: true, onSelect: () => setDeleting({ row: r, open: true }) },
            ]}
          />
        )
      },
    })
  }

  const compliance = stats.compliance
  const filterControls = (
    <FilterControls filters={filters} counts={counts} stacked={isPhone} onChange={setFilters} />
  )

  return (
    <>
      <PageHeader
        title="PM schedules"
        description="Calendar, meter and combined triggers that turn job plans into preventive work orders."
        actions={
          <>
            <Input
              variant="pill"
              type="search"
              className="w-full sm:w-64"
              leftIcon={<Search />}
              aria-label="Search PM schedules"
              placeholder="Search code, asset or plan"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            {canManage && (
              <Button onClick={() => setCreating(true)}>
                <Plus />
                New PM schedule
              </Button>
            )}
          </>
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <StatCard
          label="Active schedules"
          value={stats.active}
          hint={stats.paused ? `${stats.paused} paused` : 'None paused'}
          icon={<CalendarClock />}
          tone="ink"
        />
        <StatCard
          label="Due within 7 days"
          value={stats.week}
          hint={stats.week ? (stats.weekByMeter ? `${stats.weekByMeter} driven by a meter` : 'All by date') : 'Nothing due this week'}
          icon={<Timer />}
          tone="info"
        />
        <StatCard
          label="Overdue"
          value={stats.overdue}
          hint={
            stats.overdueNoWo
              ? `${stats.overdueNoWo} without a work order`
              : stats.overdueUnassigned
                ? `${plural(stats.overdueUnassigned, 'work order')} not assigned`
                : stats.overdue
                  ? 'Work is assigned'
                  : 'Nothing late'
          }
          icon={<CircleAlert />}
          tone="danger"
          onClick={stats.overdue ? () => setFilters({ ...NO_FILTERS, state: 'overdue' }) : undefined}
        />
        <StatCard
          label="PM compliance"
          value={fmtPercent(compliance.ratio)}
          hint={compliance.due ? `${compliance.onTime} of ${compliance.due} on time, last 90 days` : 'No PM work due in the last 90 days'}
          icon={<Gauge />}
          tone={compliance.ratio >= 0.9 ? 'success' : compliance.ratio >= 0.75 ? 'warning' : 'danger'}
        />
      </div>

      {hints.length > 0 && (
        <div className="mb-4 space-y-3">
          {hints.map((h) => (
            <Banner
              key={`${h.action.id}-${h.pm.id}`}
              tone="info"
              icon={<Microscope />}
              title={h.title}
              action={
                <>
                  <Button asChild size="sm" variant="outline">
                    <Link to={paths.rca(h.rca.id)}>Open {h.rca.code}</Link>
                  </Button>
                  <Button asChild size="sm">
                    <Link to={paths.pm(h.pm.id)}>Open {h.pm.code}</Link>
                  </Button>
                </>
              }
            >
              {h.rca.title}. {h.action.text}, owned by {s.personName(h.action.ownerId)}, due {fmtDate(h.action.dueAt)}.
            </Banner>
          ))}
        </div>
      )}

      <Card>
        <div className="flex flex-wrap items-center gap-3 border-b border-border px-5 py-3">
          {isPhone ? (
            <>
              <p className="min-w-0 flex-1 text-sm text-muted">{plural(visible.length, 'schedule')}</p>
              <Button variant="outline" size="sm" onClick={() => setFiltersOpen(true)}>
                <Funnel />
                Filters{activeFilterCount ? ` · ${activeFilterCount}` : ''}
              </Button>
            </>
          ) : (
            filterControls
          )}
        </div>
        <DataTable
          {...table}
          columns={columns}
          rows={visible}
          getRowKey={(r) => r.pm.id}
          onRowClick={(r) => navigate(paths.pm(r.pm.id))}
          rowClassName={(r) => (r.pm.active ? undefined : 'text-muted')}
          resetPageKey={`${query}|${JSON.stringify(filters)}`}
          empty={
            rows.length === 0 ? (
              <EmptyState
                icon={<CalendarClock />}
                title="No PM schedules yet"
                description="Pair an asset with a job plan and a calendar or meter trigger to plan preventive work."
                action={
                  canManage ? (
                    <Button size="sm" onClick={() => setCreating(true)}>
                      <Plus />
                      New PM schedule
                    </Button>
                  ) : undefined
                }
              />
            ) : (
              <EmptyState
                icon={<CalendarClock />}
                title="No schedules match"
                description="Clear the search or filters to see every schedule."
                action={
                  <Button variant="outline" size="sm" onClick={clearAll}>
                    Clear filters
                  </Button>
                }
              />
            )
          }
        />
      </Card>

      <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
        <SheetContent side="bottom">
          <SheetHeader>
            <SheetTitle>Filters</SheetTitle>
          </SheetHeader>
          <SheetBody>{filterControls}</SheetBody>
          <SheetFooter>
            <Button variant="outline" onClick={() => setFilters(NO_FILTERS)}>
              Clear
            </Button>
            <Button onClick={() => setFiltersOpen(false)}>Show {plural(visible.length, 'schedule')}</Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <PmDialog
        open={creating || editing !== null}
        pm={editing}
        presetPlanId={params.get('plan')}
        onClose={() => (editing ? setEditing(null) : setCreating(false))}
      />

      <ConfirmDialog
        open={!!deleting?.open}
        onOpenChange={(open) => setDeleting((d) => d && { ...d, open })}
        destructive
        confirmLabel="Delete schedule"
        title={deleting ? `Delete ${deleting.row.pm.code}?` : ''}
        description={deleting ? deleteEffect(deleting.row.pm, deleting.row.openWo).description : undefined}
        onConfirm={() => deleting && remove(deleting.row.pm)}
      />
    </>
  )
}

function DueCell({ row }: { row: Row }) {
  const { due, pm, meter } = row
  const late = row.state === 'overdue'
  const left = meterLeftText(due, meter)
  return (
    <div className="whitespace-nowrap tabular-nums">
      <p className={cn(late && 'font-semibold text-accent', !pm.active && 'text-muted')}>{fmtDate(due.dueAt)}</p>
      <p className={cn('text-xs', late ? 'text-accent' : 'text-muted')}>
        {pm.active ? dueRelative(due.daysLeft) : 'Paused'}
        {left ? ` · ${left}` : ''}
      </p>
    </div>
  )
}

function FilterControls({
  filters,
  counts,
  stacked,
  onChange,
}: {
  filters: Filters
  counts: Record<StateFilter, number>
  stacked: boolean
  onChange: (f: Filters) => void
}) {
  return (
    <div className={cn('flex gap-3', stacked ? 'flex-col' : 'flex-wrap items-center')}>
      <div className="flex flex-wrap gap-2">
        {STATE_FILTERS.map((st) => (
          <Chip key={st} active={filters.state === st} count={counts[st]} onClick={() => onChange({ ...filters, state: filters.state === st ? null : st })}>
            {STATE_FILTER_LABEL[st]}
          </Chip>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        {TRIGGER_KINDS.map((k) => (
          <Chip key={k} active={filters.kind === k} onClick={() => onChange({ ...filters, kind: filters.kind === k ? null : k })}>
            {PM_TRIGGER_LABEL[k]}
          </Chip>
        ))}
      </div>
      <TeamPicker aria-label="Team" variant="inline" clearable placeholder="All teams" value={filters.teamId} onChange={(teamId) => onChange({ ...filters, teamId })} />
    </div>
  )
}
