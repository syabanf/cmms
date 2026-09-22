import { fmtDate, fmtNumber, fmtTime, toMs } from '@cmms/fixtures'
import type { StockTxn, StockTxnKind } from '@cmms/types'
import { STOCK_TXN_LABEL } from '@cmms/types'
import { Badge, type BadgeProps, type Column, cn } from '@cmms/ui'
import { useMemo } from 'react'
import { Link } from 'react-router'
import { WoLink, paths } from '../../components/links'
import { useScoped } from '../../state/scoped'

const KIND_VARIANT: Record<StockTxnKind, BadgeProps['variant']> = {
  receive: 'success',
  issue: 'default',
  return: 'info',
  adjust: 'warning',
}

function TxnKindBadge({ kind }: { kind: StockTxnKind }) {
  return <Badge variant={KIND_VARIANT[kind]}>{STOCK_TXN_LABEL[kind]}</Badge>
}

/** Signed quantity: additions in success green, removals muted. */
export function SignedQty({ qty, unit }: { qty: number; unit?: string }) {
  return (
    <span className="whitespace-nowrap tabular-nums">
      <span className={cn('font-semibold', qty > 0 ? 'text-success' : 'text-muted')}>
        {qty > 0 ? '+' : ''}
        {fmtNumber(qty)}
      </span>
      {unit && <span className="text-xs text-muted"> {unit}</span>}
    </span>
  )
}

/** Work order link when the movement belongs to one, otherwise the free-text reference. */
function TxnRef({ txn }: { txn: StockTxn }) {
  const { maps } = useScoped()
  if (txn.woId && maps.workOrder.has(txn.woId)) return <WoLink woId={txn.woId} />
  if (!txn.ref) return <span className="text-xs text-muted">No reference</span>
  return <span className="whitespace-nowrap text-xs">{txn.ref}</span>
}

/**
 * Ledger columns shared by the movements tab and the part page. Who posted the movement and its note
 * sit under the reference, and phones get kind and quantity inside the date cell.
 */
export function useLedgerColumns({ showPart, showWarehouse }: { showPart: boolean; showWarehouse: boolean }): Column<StockTxn>[] {
  const { maps, personName } = useScoped()
  return useMemo(() => {
    const columns: (Column<StockTxn> | false)[] = [
      {
        id: 'at',
        header: 'Date',
        cell: (t) => {
          const part = maps.part.get(t.partId)
          return (
            <div>
              <span className="block whitespace-nowrap">{fmtDate(t.at)}</span>
              <span className="block text-xs text-muted">{fmtTime(t.at)}</span>
              <div className="mt-1.5 flex flex-wrap gap-1.5 sm:hidden">
                {showPart && <Badge variant="outline" className="font-mono">{part?.code ?? 'Removed part'}</Badge>}
                <TxnKindBadge kind={t.kind} />
                <Badge variant="muted">
                  <SignedQty qty={t.qty} unit={part?.unit} />
                </Badge>
                <TxnRef txn={t} />
              </div>
            </div>
          )
        },
        sortValue: (t) => toMs(t.at),
      },
      showPart && {
        id: 'part',
        header: 'Part',
        cell: (t) => {
          const part = maps.part.get(t.partId)
          if (!part) return <span className="text-muted">Removed part</span>
          return (
            <Link to={paths.part(part.id)} className="block max-w-52 hover:text-accent">
              <span className="block font-mono text-xs font-medium">{part.code}</span>
              <span className="block truncate text-xs text-muted">{part.name}</span>
            </Link>
          )
        },
        sortValue: (t) => maps.part.get(t.partId)?.code ?? null,
        hideBelow: 'sm',
      },
      showWarehouse && {
        id: 'warehouse',
        header: 'Warehouse',
        cell: (t) => <span className="whitespace-nowrap">{maps.warehouse.get(t.warehouseId)?.name ?? 'Removed warehouse'}</span>,
        hideBelow: 'xl',
      },
      { id: 'kind', header: 'Movement', cell: (t) => <TxnKindBadge kind={t.kind} />, sortValue: (t) => STOCK_TXN_LABEL[t.kind], hideBelow: 'sm' },
      {
        id: 'qty',
        header: 'Qty',
        align: 'right',
        cell: (t) => <SignedQty qty={t.qty} unit={maps.part.get(t.partId)?.unit} />,
        sortValue: (t) => t.qty,
        hideBelow: 'sm',
      },
      {
        id: 'balance',
        header: 'Balance',
        align: 'right',
        cell: (t) => <span className="tabular-nums">{fmtNumber(t.balance)}</span>,
        hideBelow: 'md',
      },
      {
        id: 'ref',
        header: 'Reference',
        cell: (t) => (
          <div className="max-w-44">
            <TxnRef txn={t} />
            <span className="block truncate text-xs text-muted">{personName(t.by)}</span>
            {t.note && (
              <span className="block truncate text-xs text-muted" title={t.note}>
                {t.note}
              </span>
            )}
          </div>
        ),
        hideBelow: 'md',
      },
    ]
    return columns.filter((c): c is Column<StockTxn> => c !== false)
  }, [maps, personName, showPart, showWarehouse])
}
