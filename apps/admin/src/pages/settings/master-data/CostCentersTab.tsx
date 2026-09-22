import { fmtNumber, newId, plural } from '@cmms/fixtures'
import type { CostCenter } from '@cmms/types'
import { Card, type Column, DataTable, toast } from '@cmms/ui'
import { Wallet } from 'lucide-react'
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

export function CostCentersTab({ canEdit }: { canEdit: boolean }) {
  const { state, siteId, dispatch } = useScoped()
  const userSites = useUserSites()
  const [query, setQuery] = useHistoryState('cost-centers.query', '')
  const table = useTableHistory('cost-centers')
  const editor = useEditor<CostCenter>()

  const assetUse = useMemo(() => tally(state.assets.map((a) => a.costCenterId)), [state.assets])
  const terms = searchTerms(query)
  const rows = userSites
    .inScope(state.costCenters)
    .filter((c) => matches(terms, c.code, c.name, userSites.name(c.siteId)))
  const assets = (c: CostCenter) => assetUse.get(c.id) ?? 0

  const columns: Column<CostCenter>[] = [
    {
      id: 'name',
      header: 'Cost center',
      sortValue: (c) => c.code,
      cell: (c) => (
        <div className="min-w-0">
          <p className="font-semibold">{c.name}</p>
          <p className="font-mono text-[11px] text-muted">{c.code}</p>
          <p className="mt-1 text-xs sm:hidden text-muted">
            {userSites.name(c.siteId)} · {plural(assets(c), 'asset')}
          </p>
        </div>
      ),
    },
    {
      id: 'site',
      header: 'Site',
      hideBelow: 'md',
      sortValue: (c) => userSites.name(c.siteId),
      cell: (c) => userSites.name(c.siteId),
    },
    {
      id: 'assets',
      header: 'Assets charged',
      hideBelow: 'sm',
      align: 'right',
      sortValue: assets,
      cell: (c) => <span className="tabular-nums">{fmtNumber(assets(c))}</span>,
    },
  ]
  if (canEdit) {
    columns.push({
      id: 'actions',
      header: '',
      align: 'right',
      cell: (c) => (
        <RowActions name={c.name} onEdit={() => editor.edit(c)} onDelete={() => editor.remove(c)} />
      ),
    })
  }

  const editing = editor.dialog.editing
  const target = editor.removal.item
  const add = canEdit ? () => editor.create() : undefined

  return (
    <Card>
      <ListHeader
        title="Cost centers"
        usedIn="Every asset charges its maintenance cost to one of these, and cost reports group by them."
        query={query}
        onQuery={setQuery}
        searchLabel="Search cost centers"
        addLabel="Add cost center"
        onAdd={add}
      />
      <DataTable
        columns={columns}
        rows={rows}
        getRowKey={(c) => c.id}
        resetPageKey={query}
        {...table}
        empty={
          <ListEmpty
            query={query}
            noun="cost centers"
            onClear={() => setQuery('')}
            onAdd={add}
            icon={<Wallet />}
          />
        }
      />

      <FormDialog open={editor.dialog.open} onOpenChange={editor.setDialogOpen}>
        <SiteCodeForm
          noun="cost center"
          description="Assets at the site pick a cost center when they are registered."
          example={{ code: 'CC-FIN', name: 'Finishing' }}
          editing={editing}
          defaultSiteId={siteId}
          takenCodes={state.costCenters.filter((c) => c.id !== editing?.id).map((c) => c.code)}
          siteLocked={!!editing && assets(editing) > 0}
          onCancel={() => editor.setDialogOpen(false)}
          onSave={(values) => {
            const item: CostCenter = { id: editing?.id ?? newId('cc'), ...values }
            dispatch({ type: 'costCenters/upsert', item })
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
        name={target?.name ?? 'Cost center'}
        noun="cost center"
        usage={target ? usageOf([[assets(target), 'asset']]) : []}
        consequence="No asset charges its cost here."
        onConfirm={() => {
          if (!target) return
          dispatch({ type: 'costCenters/remove', id: target.id })
          toast(`${target.name} deleted`, { tone: 'success', description: target.code })
        }}
      />
    </Card>
  )
}
