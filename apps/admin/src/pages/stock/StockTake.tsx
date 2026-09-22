import { fmtIdr, fmtNumber, plural } from '@cmms/fixtures'
import type { Part, StockItem } from '@cmms/types'
import {
  Badge,
  Button,
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
  type Column,
  ConfirmDialog,
  DataTable,
  EmptyState,
  Input,
  toast,
} from '@cmms/ui'
import { ClipboardCheck, Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useHistoryState } from '../../lib/history-state'
import { usePersistentState } from '../../lib/storage'
import { useScoped } from '../../state/scoped'
import { SignedQty } from './ledger'
import { parseQuantity } from './lib'

interface CountRow {
  item: StockItem
  part: Part
}

export function StockTake() {
  const { stock, maps, warehouses, site, dispatch } = useScoped()
  // Kept per viewer so a count survives a detour to another page.
  const [counts, setCounts] = usePersistentState<Record<string, string>>('cmms.admin.stockTake', {})
  const [note, setNote] = useState('')
  const [query, setQuery] = useHistoryState('stockTake.query', '')
  const [confirming, setConfirming] = useState(false)
  const multiWarehouse = warehouses.length > 1

  const rows = useMemo(
    () =>
      stock
        .flatMap((item) => {
          const part = maps.part.get(item.partId)
          return part ? [{ item, part }] : []
        })
        .sort(
          (a, b) =>
            a.item.warehouseId.localeCompare(b.item.warehouseId) ||
            (a.item.bin || '~').localeCompare(b.item.bin || '~', undefined, { numeric: true }) ||
            a.part.code.localeCompare(b.part.code),
        ),
    [stock, maps.part],
  )

  const changes = rows.flatMap((row) => {
    const counted = parseQuantity(counts[row.item.id])
    return counted === null || counted === row.item.onHand ? [] : [{ ...row, delta: counted - row.item.onHand }]
  })
  const countedRows = rows.filter((row) => parseQuantity(counts[row.item.id]) !== null).length
  const netUnits = changes.reduce((sum, c) => sum + c.delta, 0)
  const netValue = changes.reduce((sum, c) => sum + c.delta * c.part.unitCost, 0)

  const q = query.trim().toLowerCase()
  const visible = q ? rows.filter(({ item, part }) => [part.code, part.name, item.bin].some((f) => f.toLowerCase().includes(q))) : rows

  const setCount = (id: string, value: string) =>
    setCounts((prev) => {
      const next = { ...prev }
      if (value === '') delete next[id]
      else next[id] = value
      return next
    })

  const post = () => {
    const text = note.trim() || 'Stock take count'
    for (const { item, delta } of changes) {
      dispatch({ type: 'stock/move', partId: item.partId, warehouseId: item.warehouseId, kind: 'adjust', qty: delta, ref: 'Stock take', note: text })
    }
    toast(`Posted ${plural(changes.length, 'adjustment')}`, {
      tone: 'success',
      description: `Net ${netUnits > 0 ? '+' : ''}${fmtNumber(netUnits)} units, ${fmtIdr(netValue)}. The ledger shows them as Stock take.`,
    })
    setCounts({})
    setNote('')
  }

  const difference = ({ item, part }: CountRow) => {
    const counted = parseQuantity(counts[item.id])
    if (counted === null) return null
    const delta = counted - item.onHand
    if (delta === 0) return <span className="text-xs text-muted">Matches</span>
    return (
      <span className="whitespace-nowrap">
        <SignedQty qty={delta} unit={part.unit} />
        <span className="block text-xs text-muted">{fmtIdr(delta * part.unitCost)}</span>
      </span>
    )
  }

  const columnList: (Column<CountRow> | false)[] = [
    {
      id: 'bin',
      header: 'Bin',
      cell: ({ item }) => <span className={item.bin ? 'whitespace-nowrap font-medium' : 'text-muted'}>{item.bin || 'No bin'}</span>,
      sortValue: ({ item }) => item.bin || null,
      hideBelow: 'sm',
    },
    {
      id: 'part',
      header: 'Part',
      cell: (row) => (
        <div className="max-w-44 sm:max-w-72">
          <span className="block font-mono text-xs font-medium">{row.part.code}</span>
          <span className="block truncate text-sm">{row.part.name}</span>
          <div className="mt-1.5 flex flex-wrap gap-1.5 sm:hidden">
            <Badge variant="muted">{row.item.bin || 'No bin'}</Badge>
            <Badge variant="outline">
              {fmtNumber(row.item.onHand)} {row.part.unit} in system
            </Badge>
          </div>
        </div>
      ),
      sortValue: ({ part }) => part.code,
    },
    multiWarehouse && {
      id: 'warehouse',
      header: 'Warehouse',
      cell: ({ item }) => <span className="whitespace-nowrap">{maps.warehouse.get(item.warehouseId)?.name ?? 'Removed warehouse'}</span>,
      hideBelow: 'lg',
    },
    {
      id: 'onHand',
      header: 'In system',
      align: 'right',
      cell: ({ item, part }) => (
        <span className="whitespace-nowrap tabular-nums">
          {fmtNumber(item.onHand)} <span className="text-xs text-muted">{part.unit}</span>
        </span>
      ),
      hideBelow: 'sm',
    },
    {
      id: 'counted',
      header: 'Counted',
      align: 'right',
      cell: (row) => {
        const raw = counts[row.item.id] ?? ''
        return (
          <div className="flex flex-col items-end gap-1">
            <Input
              type="number"
              min={0}
              inputMode="decimal"
              value={raw}
              invalid={raw !== '' && parseQuantity(raw) === null}
              aria-label={`Counted ${row.part.code}${row.item.bin ? ` in ${row.item.bin}` : ''}`}
              className="w-20"
              inputClassName="h-9 rounded-xl px-3 text-right tabular-nums"
              onChange={(e) => setCount(row.item.id, e.target.value)}
            />
            <span className="sm:hidden">{difference(row)}</span>
          </div>
        )
      },
    },
    { id: 'delta', header: 'Difference', align: 'right', cell: difference, hideBelow: 'sm' },
  ]
  const columns = columnList.filter((c): c is Column<CountRow> => c !== false)

  return (
    <Card>
      <CardHeader action={<Input variant="soft" leftIcon={<Search />} value={query} placeholder="Search part or bin" aria-label="Search the count sheet" className="w-full sm:w-64" onChange={(e) => setQuery(e.target.value)} />}>
        <CardTitle>Count sheet</CardTitle>
        <CardDescription>
          Walk the bins at {site.name} and type what is on the shelf. Rows that differ post as adjustments.
        </CardDescription>
      </CardHeader>
      <DataTable
        columns={columns}
        rows={visible}
        getRowKey={({ item }) => item.id}
        pageSize={0}
        rowClassName={({ item }) => {
          const counted = parseQuantity(counts[item.id])
          return counted !== null && counted !== item.onHand ? 'bg-warning-soft/40' : undefined
        }}
        empty={
          q ? (
            <EmptyState compact icon={<Search />} title={`No stock rows match "${query.trim()}"`} description="Search by part number, name or bin." />
          ) : (
            <EmptyState compact icon={<ClipboardCheck />} title="No stock to count" description={`Receive stock at ${site.name} first. Each receipt creates a row on this sheet.`} />
          )
        }
      />
      <div className="flex flex-wrap items-center gap-3 border-t border-border px-5 py-4">
        <p className="min-w-48 flex-1 text-sm">
          <span className="font-semibold">{plural(countedRows, 'row')} counted</span>
          <span className="text-muted">
            {changes.length
              ? `, ${plural(changes.length, 'difference')}: net ${netUnits > 0 ? '+' : ''}${fmtNumber(netUnits)} units, ${fmtIdr(netValue)}`
              : countedRows
                ? ', every count matches the system'
                : ` of ${fmtNumber(rows.length)}`}
          </span>
        </p>
        <Input value={note} placeholder="Note for the ledger, such as Q3 count rack 03 to 07" aria-label="Note for the ledger" className="w-full sm:w-80" onChange={(e) => setNote(e.target.value)} />
        {countedRows > 0 && (
          <Button variant="ghost" onClick={() => setCounts({})}>
            Clear counts
          </Button>
        )}
        <Button disabled={changes.length === 0} onClick={() => setConfirming(true)}>
          <ClipboardCheck />
          Post adjustments
        </Button>
      </div>
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={`Post ${plural(changes.length, 'adjustment')}?`}
        description={`Each difference posts to the ledger as a Stock take adjustment and changes on hand to the counted quantity. Net ${netUnits > 0 ? '+' : ''}${fmtNumber(netUnits)} units, ${fmtIdr(netValue)}.`}
        confirmLabel="Post adjustments"
        onConfirm={post}
      />
    </Card>
  )
}
