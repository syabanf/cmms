import { DAY, nowMs, plural, toMs } from '@cmms/fixtures'
import type { StockTxnKind } from '@cmms/types'
import { STOCK_TXN_LABEL } from '@cmms/types'
import { Button, Card, CardDescription, CardHeader, CardTitle, Chip, ChipRow, DataTable, EmptyState, SegmentedControl } from '@cmms/ui'
import { History } from 'lucide-react'
import { PartPicker } from '../../components/pickers'
import { useHistoryState, useTableHistory } from '../../lib/history-state'
import { useScoped } from '../../state/scoped'
import { useLedgerColumns } from './ledger'

const KINDS = Object.keys(STOCK_TXN_LABEL) as StockTxnKind[]

const PERIODS = [
  { value: '7', label: '7 days' },
  { value: '30', label: '30 days' },
  { value: '90', label: '90 days' },
  { value: 'all', label: 'All' },
]

export function Movements() {
  const { stockTxns, site } = useScoped()
  const columns = useLedgerColumns({ showPart: true, showWarehouse: true })
  const [kind, setKind] = useHistoryState<StockTxnKind | null>('movements.kind', null)
  const [partId, setPartId] = useHistoryState<string | null>('movements.partId', null)
  const [period, setPeriod] = useHistoryState('movements.period', '30')
  const table = useTableHistory('movements.table')

  const since = period === 'all' ? Number.NEGATIVE_INFINITY : nowMs() - Number(period) * DAY
  const inScope = stockTxns.filter((t) => toMs(t.at) >= since && (!partId || t.partId === partId))
  const rows = kind ? inScope.filter((t) => t.kind === kind) : inScope
  const filtered = kind !== null || partId !== null || period !== 'all'

  const reset = () => {
    setKind(null)
    setPartId(null)
    setPeriod('all')
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Stock movements</CardTitle>
        <CardDescription>
          {plural(rows.length, 'movement')} at {site.name}, newest first. Receipts, issues, returns and count adjustments.
        </CardDescription>
      </CardHeader>
      <div className="flex flex-wrap items-center gap-2 px-5">
        <ChipRow className="min-w-0 flex-1" aria-label="Filter by movement">
          <Chip variant="filter" active={kind === null} count={inScope.length} onClick={() => setKind(null)}>
            All
          </Chip>
          {KINDS.map((k) => (
            <Chip key={k} variant="filter" active={kind === k} count={inScope.filter((t) => t.kind === k).length} onClick={() => setKind(kind === k ? null : k)}>
              {STOCK_TXN_LABEL[k]}
            </Chip>
          ))}
        </ChipRow>
        <div className="flex flex-wrap items-center gap-2">
          <PartPicker variant="inline" clearable value={partId} onChange={setPartId} placeholder="All parts" className="max-w-60" />
          <SegmentedControl size="sm" aria-label="Period" options={PERIODS} value={period} onChange={setPeriod} />
        </div>
      </div>
      <DataTable
        className="mt-3"
        columns={columns}
        rows={rows}
        getRowKey={(t) => t.id}
        initialSort={{ id: 'at', desc: true }}
        pageSize={15}
        resetPageKey={`${kind}|${partId}|${period}`}
        {...table}
        empty={
          <EmptyState
            compact
            icon={<History />}
            title="No movements in this view"
            description={filtered ? 'Nothing matches these filters. Widen the period or clear the part and movement filters.' : 'Receipts, issues and counts post here as the warehouse works.'}
            action={
              filtered ? (
                <Button variant="outline" size="sm" onClick={reset}>
                  Show all movements
                </Button>
              ) : undefined
            }
          />
        }
      />
    </Card>
  )
}
