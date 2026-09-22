import { fmtNumber, lastMonths, nowMs } from '@cmms/fixtures'
import type { Part, PartLineStatus, StockItem, StockTxn, WoPartLine, WorkOrder } from '@cmms/types'
import { PART_LINE_STATUS_LABEL } from '@cmms/types'
import {
  Badge,
  type BadgeProps,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  type Column,
  ColumnChart,
  DataTable,
  EmptyState,
  Input,
  toast,
} from '@cmms/ui'
import { Check, ClipboardList, History, PackageCheck, PackagePlus, Pencil, Warehouse, X } from 'lucide-react'
import { type FormEvent, useMemo, useState } from 'react'
import { AssetLink, WoLink } from '../../components/links'
import { useScoped } from '../../state/scoped'
import { useLedgerColumns } from '../stock/ledger'
import { issueBlock } from '../stock/lib'
import { consumptionByPeriod } from './lib'

// ─── Stock per warehouse ────────────────────────────────────────

function BinCell({ item, editable }: { item: StockItem; editable: boolean }) {
  const { dispatch } = useScoped()
  // null while not editing
  const [draft, setDraft] = useState<string | null>(null)

  if (draft === null) {
    return (
      <span className="inline-flex items-center gap-1">
        <span className={item.bin ? 'whitespace-nowrap' : 'text-muted'}>{item.bin || 'No bin'}</span>
        {editable && (
          <Button variant="ghost" size="icon-sm" aria-label="Edit bin" onClick={() => setDraft(item.bin)}>
            <Pencil />
          </Button>
        )}
      </span>
    )
  }

  const save = (e: FormEvent) => {
    e.preventDefault()
    const bin = draft.trim()
    setDraft(null)
    if (bin === item.bin) return
    dispatch({ type: 'stock/setBin', id: item.id, bin })
    toast(bin ? `Bin set to ${bin}` : 'Bin cleared', { tone: 'success' })
  }

  return (
    <form onSubmit={save} className="flex items-center gap-1">
      <Input
        autoFocus
        aria-label="Bin"
        value={draft}
        placeholder="Rack 03-A"
        className="w-32"
        inputClassName="h-8 rounded-full px-3"
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') setDraft(null)
        }}
      />
      <Button type="submit" variant="ghost" size="icon-sm" aria-label="Save bin">
        <Check />
      </Button>
      <Button type="button" variant="ghost" size="icon-sm" aria-label="Cancel" onClick={() => setDraft(null)}>
        <X />
      </Button>
    </form>
  )
}

export function WarehouseStockCard({ part, items, canManage, onReceive }: { part: Part; items: StockItem[]; canManage: boolean; onReceive: () => void }) {
  const { maps, site } = useScoped()
  const available = (s: StockItem) => s.onHand - s.reserved
  const columns: Column<StockItem>[] = [
    {
      id: 'warehouse',
      header: 'Warehouse',
      cell: (s) => {
        const warehouse = maps.warehouse.get(s.warehouseId)
        return (
          <div>
            <span className="whitespace-nowrap font-medium">{warehouse?.name ?? 'Removed warehouse'}</span>
            {warehouse && <span className="ml-2 font-mono text-[11px] text-muted">{warehouse.code}</span>}
            <div className="mt-1.5 flex flex-wrap gap-1.5 sm:hidden">
              <Badge variant={available(s) < 0 ? 'danger' : 'outline'}>
                {fmtNumber(available(s))} {part.unit} available
              </Badge>
              <Badge variant="muted">
                {fmtNumber(s.onHand)} on hand · {fmtNumber(s.reserved)} reserved
              </Badge>
            </div>
          </div>
        )
      },
    },
    { id: 'bin', header: 'Bin', cell: (s) => <BinCell item={s} editable={canManage} /> },
    { id: 'onHand', header: 'On hand', align: 'right', cell: (s) => <span className="tabular-nums">{fmtNumber(s.onHand)}</span>, hideBelow: 'sm' },
    {
      id: 'reserved',
      header: 'Reserved',
      align: 'right',
      cell: (s) => <span className={s.reserved ? 'tabular-nums' : 'tabular-nums text-muted'}>{fmtNumber(s.reserved)}</span>,
      hideBelow: 'sm',
    },
    {
      id: 'available',
      header: 'Available',
      align: 'right',
      cell: (s) => (
        <span className="whitespace-nowrap tabular-nums">
          <span className={available(s) < 0 ? 'font-semibold text-accent' : 'font-semibold'}>{fmtNumber(available(s))}</span>{' '}
          <span className="text-xs text-muted">{part.unit}</span>
        </span>
      ),
      hideBelow: 'sm',
    },
  ]
  return (
    <Card>
      <CardHeader>
        <CardTitle>Stock by warehouse</CardTitle>
        <CardDescription>Available is on hand minus what work orders reserve.</CardDescription>
      </CardHeader>
      {items.length ? (
        <DataTable columns={columns} rows={items} getRowKey={(s) => s.id} pageSize={0} />
      ) : (
        <EmptyState
          compact
          icon={<Warehouse />}
          title={`Not stocked at ${site.name}`}
          description="The first receipt creates the stock record. Set its bin here afterwards."
          action={
            canManage ? (
              <Button size="sm" variant="outline" onClick={onReceive}>
                <PackagePlus />
                Receive stock
              </Button>
            ) : undefined
          }
        />
      )}
    </Card>
  )
}

// ─── Work order lines ───────────────────────────────────────────

export interface WoLine {
  wo: WorkOrder
  line: WoPartLine
}

const LINE_VARIANT: Record<PartLineStatus, BadgeProps['variant']> = { reserved: 'warning', issued: 'info', consumed: 'success', returned: 'muted' }

export function WorkOrderLinesCard({ part, lines, stock, canIssue }: { part: Part; lines: WoLine[]; stock: StockItem[]; canIssue: boolean }) {
  const { maps, dispatch } = useScoped()

  const issue = ({ wo, line }: WoLine) => {
    dispatch({ type: 'workOrders/partStatus', id: wo.id, lineId: line.id, status: 'issued' })
    const warehouse = maps.warehouse.get(line.warehouseId)?.name ?? 'the warehouse'
    toast(`Issued ${fmtNumber(line.qty)} ${part.unit} ${part.code}`, { tone: 'success', description: `To ${wo.code} from ${warehouse}.` })
  }

  const columns: Column<WoLine>[] = [
    {
      id: 'wo',
      header: 'Work order',
      cell: ({ wo, line }) => (
        <div className="max-w-44 sm:max-w-72">
          <WoLink woId={wo.id} />
          <p className="truncate text-xs text-muted">{wo.title}</p>
          <div className="mt-1.5 flex flex-wrap gap-1.5 sm:hidden">
            <Badge variant="outline">
              {fmtNumber(line.qty)} {part.unit}
            </Badge>
            <Badge variant={LINE_VARIANT[line.status]}>{PART_LINE_STATUS_LABEL[line.status]}</Badge>
          </div>
        </div>
      ),
    },
    { id: 'asset', header: 'Asset', cell: ({ wo }) => <AssetLink assetId={wo.assetId} className="max-w-56" />, hideBelow: 'lg' },
    {
      id: 'qty',
      header: 'Qty',
      align: 'right',
      cell: ({ line }) => (
        <span className="whitespace-nowrap tabular-nums">
          <span className="font-semibold">{fmtNumber(line.qty)}</span> <span className="text-xs text-muted">{part.unit}</span>
        </span>
      ),
      hideBelow: 'sm',
    },
    {
      id: 'status',
      header: 'Line',
      cell: ({ line }) => <Badge variant={LINE_VARIANT[line.status]}>{PART_LINE_STATUS_LABEL[line.status]}</Badge>,
      hideBelow: 'sm',
    },
  ]
  if (canIssue) {
    columns.push({
      id: 'action',
      header: <span className="sr-only">Action</span>,
      align: 'right',
      cell: (row) => {
        if (row.line.status !== 'reserved') return null
        const onHand = stock.find((s) => s.warehouseId === row.line.warehouseId)?.onHand ?? 0
        const block = issueBlock(row.wo, row.line, onHand)
        return (
          <div className="flex flex-col items-end gap-1">
            <Button size="sm" variant="outline" disabled={!!block} onClick={() => issue(row)}>
              <PackageCheck />
              Issue
            </Button>
            {block && <span className="whitespace-nowrap text-[11px] text-muted">{block}</span>}
          </div>
        )
      },
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>On open work orders</CardTitle>
        <CardDescription>Reserved lines wait in the pick list. Issued lines are with the technician.</CardDescription>
      </CardHeader>
      <DataTable
        columns={columns}
        rows={lines}
        getRowKey={({ line, wo }) => `${wo.id}-${line.id}`}
        pageSize={6}
        empty={
          <EmptyState
            compact
            icon={<ClipboardList />}
            title="No open reservations"
            description="A work order reserves this part when a planner adds it or its job plan lists it."
          />
        }
      />
    </Card>
  )
}

// ─── Consumption ────────────────────────────────────────────────

export function ConsumptionCard({ part, txns }: { part: Part; txns: StockTxn[] }) {
  const { periods, values } = useMemo(() => {
    const months = lastMonths(12, nowMs())
    return { periods: months, values: consumptionByPeriod(txns, months) }
  }, [txns])
  const total = values.reduce((sum, v) => sum + v, 0)
  const data = periods.map((p, i) => ({ label: p.label, value: values[i] ?? 0, highlight: i === periods.length - 1 }))

  return (
    <Card>
      <CardHeader action={<span className="text-sm text-muted">{fmtNumber(total / 12, 1)} {part.unit} a month</span>}>
        <CardTitle>Consumption</CardTitle>
        <CardDescription>
          {fmtNumber(total)} {part.unit} used in the last 12 months, returns deducted. The current month is highlighted.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ColumnChart data={data} tone="muted" height={180} format={(v) => fmtNumber(v)} ariaLabel={`${part.code} units used per month over the last 12 months`} />
      </CardContent>
    </Card>
  )
}

// ─── Ledger ─────────────────────────────────────────────────────

export function LedgerCard({ txns }: { txns: StockTxn[] }) {
  const { warehouses } = useScoped()
  const columns = useLedgerColumns({ showPart: false, showWarehouse: warehouses.length > 1 })
  return (
    <Card>
      <CardHeader>
        <CardTitle>Stock ledger</CardTitle>
        <CardDescription>Every receipt, issue, return and count, newest first.</CardDescription>
      </CardHeader>
      <DataTable
        columns={columns}
        rows={txns}
        getRowKey={(t) => t.id}
        initialSort={{ id: 'at', desc: true }}
        pageSize={8}
        empty={<EmptyState compact icon={<History />} title="No movements yet" description="Receipts, issues and counts for this part land here." />}
      />
    </Card>
  )
}
