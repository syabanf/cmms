import { fmtNumber, isActive, newId, plural } from '@cmms/fixtures'
import type { Warehouse } from '@cmms/types'
import { Card, type Column, DataTable, toast } from '@cmms/ui'
import { Warehouse as WarehouseIcon } from 'lucide-react'
import { useMemo } from 'react'
import { useHistoryState, useTableHistory } from '../../../lib/history-state'
import { useScoped } from '../../../state/scoped'
import { matches, searchTerms, tally, usageOf } from './lib'
import {
  DeleteDialog,
  FormDialog,
  ListEmpty,
  ListHeader,
  RowActions,
  SiteCodeForm,
  useEditor,
  useUserSites,
} from './shared'

interface Held {
  lines: number
  units: number
  records: number
}

export function WarehousesTab({ canEdit }: { canEdit: boolean }) {
  const { state, siteId, dispatch } = useScoped()
  const userSites = useUserSites()
  const [query, setQuery] = useHistoryState('warehouses.query', '')
  const table = useTableHistory('warehouses')
  const editor = useEditor<Warehouse>()

  // A stock line holds stock when something sits on the shelf or is promised to a work order.
  const held = useMemo(() => {
    const byWarehouse = new Map<string, Held>()
    for (const s of state.stock) {
      const h = byWarehouse.get(s.warehouseId) ?? { lines: 0, units: 0, records: 0 }
      byWarehouse.set(s.warehouseId, {
        lines: h.lines + (s.onHand > 0 || s.reserved > 0 ? 1 : 0),
        units: h.units + s.onHand,
        records: h.records + 1,
      })
    }
    return byWarehouse
  }, [state.stock])
  const openWork = useMemo(
    () =>
      tally(
        state.workOrders
          .filter(isActive)
          .flatMap((w) => [
            ...new Set(
              w.parts
                .filter((l) => l.status === 'reserved' || l.status === 'issued')
                .map((l) => l.warehouseId),
            ),
          ]),
      ),
    [state.workOrders],
  )
  const terms = searchTerms(query)
  const rows = userSites
    .inScope(state.warehouses)
    .filter((w) => matches(terms, w.code, w.name, userSites.name(w.siteId)))
  const stockOf = (w: Warehouse) => held.get(w.id) ?? { lines: 0, units: 0, records: 0 }
  const works = (w: Warehouse) => openWork.get(w.id) ?? 0

  const columns: Column<Warehouse>[] = [
    {
      id: 'name',
      header: 'Warehouse',
      sortValue: (w) => w.code,
      cell: (w) => (
        <div className="min-w-0">
          <p className="font-semibold">{w.name}</p>
          <p className="font-mono text-[11px] text-muted">{w.code}</p>
          <p className="mt-1 text-xs sm:hidden text-muted">
            {userSites.name(w.siteId)} · {plural(stockOf(w).lines, 'stock line')}
          </p>
        </div>
      ),
    },
    {
      id: 'site',
      header: 'Site',
      hideBelow: 'md',
      sortValue: (w) => userSites.name(w.siteId),
      cell: (w) => userSites.name(w.siteId),
    },
    {
      id: 'lines',
      header: 'Stock lines',
      hideBelow: 'sm',
      align: 'right',
      sortValue: (w) => stockOf(w).lines,
      cell: (w) => <span className="tabular-nums">{fmtNumber(stockOf(w).lines)}</span>,
    },
    {
      id: 'units',
      header: 'Units on hand',
      hideBelow: 'md',
      align: 'right',
      sortValue: (w) => stockOf(w).units,
      cell: (w) => <span className="tabular-nums">{fmtNumber(stockOf(w).units)}</span>,
    },
  ]
  if (canEdit) {
    columns.push({
      id: 'actions',
      header: '',
      align: 'right',
      cell: (w) => (
        <RowActions name={w.name} onEdit={() => editor.edit(w)} onDelete={() => editor.remove(w)} />
      ),
    })
  }

  const editing = editor.dialog.editing
  const target = editor.removal.item
  const add = canEdit ? () => editor.create() : undefined

  return (
    <Card>
      <ListHeader
        title="Warehouses"
        usedIn="Parts availability on work orders and the phone comes from stock in these warehouses."
        query={query}
        onQuery={setQuery}
        searchLabel="Search warehouses"
        addLabel="Add warehouse"
        onAdd={add}
      />
      <DataTable
        columns={columns}
        rows={rows}
        getRowKey={(w) => w.id}
        resetPageKey={query}
        {...table}
        empty={
          <ListEmpty
            query={query}
            noun="warehouses"
            onClear={() => setQuery('')}
            onAdd={add}
            icon={<WarehouseIcon />}
          />
        }
      />

      <FormDialog open={editor.dialog.open} onOpenChange={editor.setDialogOpen}>
        <SiteCodeForm
          noun="warehouse"
          description="Stock receipts, issues and work order reservations name a warehouse at the site."
          example={{ code: 'WH-B', name: 'Warehouse B' }}
          editing={editing}
          defaultSiteId={siteId}
          takenCodes={state.warehouses.filter((w) => w.id !== editing?.id).map((w) => w.code)}
          siteLocked={!!editing && (stockOf(editing).records > 0 || works(editing) > 0)}
          onCancel={() => editor.setDialogOpen(false)}
          onSave={(values) => {
            const item: Warehouse = { id: editing?.id ?? newId('wh'), ...values }
            dispatch({ type: 'warehouses/upsert', item })
            editor.setDialogOpen(false)
            toast(editing ? `${item.name} updated` : `${item.name} added`, {
              tone: 'success',
              description: item.code,
            })
          }}
        />
      </FormDialog>
      <DeleteDialog
        open={editor.removal.open}
        onOpenChange={editor.setRemovalOpen}
        name={target?.name ?? 'Warehouse'}
        noun="warehouse"
        usage={
          target
            ? usageOf([
                [stockOf(target).lines, 'stock line'],
                [works(target), 'open work order'],
              ])
            : []
        }
        consequence={
          target && stockOf(target).records > 0
            ? 'Its empty stock records go too. Past movements stay in the ledger.'
            : 'No stock sits in it.'
        }
        onConfirm={() => {
          if (!target) return
          dispatch({ type: 'warehouses/remove', id: target.id })
          toast(`${target.name} deleted`, { tone: 'success', description: target.code })
        }}
      />
    </Card>
  )
}
