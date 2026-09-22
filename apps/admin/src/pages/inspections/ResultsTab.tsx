import { fmtDateShort, fmtTime, toMs, worstOutcome } from '@cmms/fixtures'
import type { CheckOutcome, MaintenanceRequest } from '@cmms/types'
import { CHECK_OUTCOME_LABEL } from '@cmms/types'
import { Button, Card, Chip, ChipRow, type Column, DataTable, EmptyState, Input } from '@cmms/ui'
import { ClipboardCheck, Search } from 'lucide-react'
import { useMemo } from 'react'
import { Link, useNavigate } from 'react-router'
import { OutcomeBadge } from '../../components/badges'
import { AssetLink, PersonChip, WoLink, paths } from '../../components/links'
import { useHistoryState, useTableHistory } from '../../lib/history-state'
import { useScoped } from '../../state/scoped'
import { type DoneInspection, flaggedSummary, inspectorOf, routeName } from './lib'

interface ResultRow {
  wo: DoneInspection
  outcome: CheckOutcome | null
  flagged: string
  inspectorId: string | null
  route: string
  request: MaintenanceRequest | undefined
}

const OUTCOMES: CheckOutcome[] = ['fail', 'warning', 'pass']

/** Pass also covers inspections without an evaluated reading. */
const outcomeOf = (row: ResultRow): CheckOutcome => row.outcome ?? 'pass'

export function ResultsTab({ done, onShowUpcoming }: { done: DoneInspection[]; onShowUpcoming: () => void }) {
  const { maps, requests, personName } = useScoped()
  const navigate = useNavigate()
  const [outcome, setOutcome] = useHistoryState<CheckOutcome | null>('results.outcome', null)
  const [query, setQuery] = useHistoryState('results.query', '')
  const table = useTableHistory('results.table')

  const rows = useMemo<ResultRow[]>(() => {
    const raised = new Map(requests.flatMap((r) => (r.inspectionWoId ? [[r.inspectionWoId, r] as const] : [])))
    return done.map((wo) => ({
      wo,
      outcome: worstOutcome(wo.tasks),
      flagged: flaggedSummary(wo),
      inspectorId: inspectorOf(wo),
      route: routeName(maps.jobPlan, wo.jobPlanId, wo.title),
      request: raised.get(wo.id),
    }))
  }, [done, requests, maps.jobPlan])

  const q = query.trim().toLowerCase()
  const searched = q
    ? rows.filter((r) => {
        const asset = maps.asset.get(r.wo.assetId)
        return [r.wo.code, r.route, asset?.code ?? '', asset?.name ?? '', personName(r.inspectorId), r.request?.code ?? ''].some((f) => f.toLowerCase().includes(q))
      })
    : rows
  const visible = outcome ? searched.filter((r) => outcomeOf(r) === outcome) : searched

  const columns: Column<ResultRow>[] = [
    {
      id: 'date',
      header: 'Completed',
      cell: (r) => {
        const asset = maps.asset.get(r.wo.assetId)
        return (
          <div className="min-w-0">
            <p className="whitespace-nowrap font-medium tabular-nums">{fmtDateShort(r.wo.completedAt)}</p>
            <p className="text-xs text-muted tabular-nums">{fmtTime(r.wo.completedAt)}</p>
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5 sm:hidden">
              <span className="text-xs font-medium">{asset?.code ?? 'Removed asset'}</span>
              <OutcomeBadge outcome={r.outcome} />
              {r.flagged && <span className="text-xs text-muted">{r.flagged}</span>}
            </div>
          </div>
        )
      },
      sortValue: (r) => toMs(r.wo.completedAt),
    },
    { id: 'asset', header: 'Asset', cell: (r) => <AssetLink assetId={r.wo.assetId} className="max-w-[11rem]" />, sortValue: (r) => maps.asset.get(r.wo.assetId)?.code ?? '', hideBelow: 'sm' },
    {
      id: 'route',
      header: 'Route',
      cell: (r) => (
        <div className="min-w-0 max-w-[10rem]">
          <p className="truncate">{r.route}</p>
          <WoLink woId={r.wo.id} className="text-[11px] text-muted" />
        </div>
      ),
      sortValue: (r) => r.route,
      hideBelow: 'xl',
    },
    { id: 'inspector', header: 'Inspector', cell: (r) => <PersonChip personId={r.inspectorId} />, sortValue: (r) => personName(r.inspectorId), hideBelow: 'lg' },
    {
      id: 'outcome',
      header: 'Result',
      cell: (r) => <OutcomeBadge outcome={r.outcome} />,
      sortValue: (r) => OUTCOMES.indexOf(outcomeOf(r)),
      hideBelow: 'sm',
    },
    {
      id: 'flagged',
      header: 'Flagged readings',
      cell: (r) => (r.flagged ? <span className="block max-w-[18rem] text-sm">{r.flagged}</span> : <span className="text-muted">None</span>),
      hideBelow: 'md',
    },
    {
      id: 'request',
      header: 'Request',
      cell: (r) =>
        r.request ? (
          <Link to={paths.request(r.request.id)} className="font-mono text-xs font-medium hover:text-accent hover:underline">
            {r.request.code}
          </Link>
        ) : (
          <span className="text-muted">None</span>
        ),
      sortValue: (r) => r.request?.code ?? null,
      hideBelow: 'lg',
    },
  ]

  const filtering = q !== '' || outcome !== null
  const count = (o: CheckOutcome) => searched.filter((r) => outcomeOf(r) === o).length

  return (
    <Card>
      <div className="flex flex-wrap items-center gap-3 px-5 pt-5">
        <ChipRow className="min-w-0 max-w-full" aria-label="Filter by result">
          <Chip variant="filter" active={outcome === null} count={searched.length} onClick={() => setOutcome(null)}>
            All results
          </Chip>
          {OUTCOMES.map((o) => (
            <Chip key={o} variant="filter" active={outcome === o} count={count(o)} onClick={() => setOutcome(outcome === o ? null : o)}>
              {CHECK_OUTCOME_LABEL[o]}
            </Chip>
          ))}
        </ChipRow>
        <Input
          type="search"
          className="w-full sm:ml-auto sm:w-64"
          leftIcon={<Search />}
          value={query}
          placeholder="Search asset, route or inspector"
          aria-label="Search inspection results"
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      <DataTable
        {...table}
        className="mt-3"
        columns={columns}
        rows={visible}
        getRowKey={(r) => r.wo.id}
        onRowClick={(r) => navigate(paths.workOrder(r.wo.id))}
        initialSort={{ id: 'date', desc: true }}
        resetPageKey={`${outcome}|${q}`}
        empty={
          filtering ? (
            <EmptyState
              compact
              icon={<ClipboardCheck />}
              title={q ? `No results match "${query.trim()}"` : `No ${CHECK_OUTCOME_LABEL[outcome ?? 'pass'].toLowerCase()} results`}
              description="Clear the search or the result filter to see every inspection."
              action={
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setQuery('')
                    setOutcome(null)
                  }}
                >
                  Clear filters
                </Button>
              }
            />
          ) : (
            <EmptyState
              compact
              icon={<ClipboardCheck />}
              title="No inspection completed yet"
              description="Results land here once a technician completes an inspection route."
              action={
                <Button variant="outline" size="sm" onClick={onShowUpcoming}>
                  See upcoming routes
                </Button>
              }
            />
          )
        }
      />
    </Card>
  )
}
