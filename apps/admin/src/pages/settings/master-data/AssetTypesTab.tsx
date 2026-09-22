import { fmtNumber, newId, plural } from '@cmms/fixtures'
import type { AssetCategory, AssetIconKey, AssetType } from '@cmms/types'
import { ASSET_CATEGORY_LABEL } from '@cmms/types'
import { Card, type Column, DataTable, FormField, IconTile, Input, NativeSelect, cn, toast } from '@cmms/ui'
import { Shapes } from 'lucide-react'
import { useMemo } from 'react'
import { AssetIcon } from '../../../components/icons'
import { useHistoryState, useTableHistory } from '../../../lib/history-state'
import { useScoped } from '../../../state/scoped'
import { isTaken, matches, searchTerms, tally, usageOf } from './lib'
import {
  DeleteDialog,
  EntityForm,
  FormDialog,
  ListEmpty,
  ListHeader,
  RowActions,
  useDraft,
  useEditor,
} from './shared'

// `satisfies` fails the build when an icon key is added to the union and missing here.
const ICON_KEYS = Object.keys({
  polisher: 1,
  lathe: 1,
  mill: 1,
  press: 1,
  molding: 1,
  oven: 1,
  booth: 1,
  conveyor: 1,
  robot: 1,
  tester: 1,
  packer: 1,
  forklift: 1,
  compressor: 1,
  dryer: 1,
  panel: 1,
  genset: 1,
  chiller: 1,
  tower: 1,
  pump: 1,
  motor: 1,
  spindle: 1,
  inverter: 1,
  plc: 1,
  gauge: 1,
  thermometer: 1,
  scale: 1,
  sensor: 1,
} satisfies Record<AssetIconKey, 1>) as AssetIconKey[]

const iconName = (key: AssetIconKey) => (key === 'plc' ? 'PLC' : key[0].toUpperCase() + key.slice(1))

const CATEGORIES = Object.keys(ASSET_CATEGORY_LABEL) as AssetCategory[]
const CATEGORY_OPTIONS = CATEGORIES.map((c) => ({ value: c, label: ASSET_CATEGORY_LABEL[c] }))

export function AssetTypesTab({ canEdit }: { canEdit: boolean }) {
  const { state, dispatch } = useScoped()
  const [query, setQuery] = useHistoryState('asset-types.query', '')
  const table = useTableHistory('asset-types')
  const editor = useEditor<AssetType>()

  const assetCount = useMemo(() => tally(state.assets.map((a) => a.typeId)), [state.assets])
  const planCount = useMemo(() => tally(state.jobPlans.flatMap((j) => j.assetTypeIds)), [state.jobPlans])
  const terms = searchTerms(query)
  const rows = state.assetTypes.filter((t) =>
    matches(terms, t.name, ASSET_CATEGORY_LABEL[t.category], t.icon),
  )

  const columns: Column<AssetType>[] = [
    {
      id: 'type',
      header: 'Type',
      sortValue: (t) => t.name,
      cell: (t) => (
        <div className="gap-3 flex items-center">
          <IconTile size="sm">
            <AssetIcon icon={t.icon} />
          </IconTile>
          <div className="min-w-0">
            <p className="font-semibold">{t.name}</p>
            <p className="text-xs sm:hidden text-muted">
              {ASSET_CATEGORY_LABEL[t.category]} · {plural(assetCount.get(t.id) ?? 0, 'asset')}
            </p>
          </div>
        </div>
      ),
    },
    {
      id: 'category',
      header: 'Category',
      hideBelow: 'sm',
      sortValue: (t) => ASSET_CATEGORY_LABEL[t.category],
      cell: (t) => ASSET_CATEGORY_LABEL[t.category],
    },
    {
      id: 'icon',
      header: 'Icon key',
      hideBelow: 'lg',
      cell: (t) => <span className="text-xs font-mono text-muted">{t.icon}</span>,
    },
    {
      id: 'assets',
      header: 'Assets',
      hideBelow: 'sm',
      align: 'right',
      sortValue: (t) => assetCount.get(t.id) ?? 0,
      cell: (t) => <span className="tabular-nums">{fmtNumber(assetCount.get(t.id) ?? 0)}</span>,
    },
    {
      id: 'plans',
      header: 'Job plans',
      hideBelow: 'md',
      align: 'right',
      sortValue: (t) => planCount.get(t.id) ?? 0,
      cell: (t) => <span className="tabular-nums">{fmtNumber(planCount.get(t.id) ?? 0)}</span>,
    },
  ]
  if (canEdit) {
    columns.push({
      id: 'actions',
      header: '',
      align: 'right',
      cell: (t) => (
        <RowActions name={t.name} onEdit={() => editor.edit(t)} onDelete={() => editor.remove(t)} />
      ),
    })
  }

  const target = editor.removal.item
  const usage = target
    ? usageOf([
        [assetCount.get(target.id) ?? 0, 'asset'],
        [planCount.get(target.id) ?? 0, 'job plan'],
      ])
    : []
  const add = canEdit ? () => editor.create() : undefined

  return (
    <Card>
      <ListHeader
        title="Asset types"
        usedIn="Asset registration and job plans pick a type, and its icon marks the asset in lists and on the phone."
        query={query}
        onQuery={setQuery}
        searchLabel="Search asset types"
        addLabel="Add asset type"
        onAdd={add}
      />
      <DataTable
        columns={columns}
        rows={rows}
        getRowKey={(t) => t.id}
        initialSort={{ id: 'type' }}
        resetPageKey={query}
        {...table}
        empty={
          <ListEmpty
            query={query}
            noun="asset types"
            onClear={() => setQuery('')}
            onAdd={add}
            icon={<Shapes />}
          />
        }
      />

      <FormDialog open={editor.dialog.open} onOpenChange={editor.setDialogOpen}>
        <AssetTypeForm
          editing={editor.dialog.editing}
          onDone={(saved) => {
            editor.setDialogOpen(false)
            if (saved)
              toast(editor.dialog.editing ? `${saved.name} updated` : `${saved.name} added`, {
                tone: 'success',
              })
          }}
        />
      </FormDialog>
      <DeleteDialog
        open={editor.removal.open}
        onOpenChange={editor.setRemovalOpen}
        name={target?.name ?? 'Asset type'}
        noun="asset type"
        usage={usage}
        consequence="No asset or job plan uses it."
        onConfirm={() => {
          if (!target) return
          dispatch({ type: 'assetTypes/remove', id: target.id })
          toast(`${target.name} deleted`, { tone: 'success' })
        }}
      />
    </Card>
  )
}

function AssetTypeForm({
  editing,
  onDone,
}: {
  editing: AssetType | null
  onDone: (saved: AssetType | null) => void
}) {
  const { state, dispatch } = useScoped()
  const { draft, set, attempt, show } = useDraft(() => ({
    name: editing?.name ?? '',
    category: editing?.category ?? ('production' as AssetCategory),
    icon: editing?.icon ?? ('motor' as AssetIconKey),
  }))
  const name = draft.name.trim()
  const errors = {
    name: !name
      ? 'Enter a name, such as Hydraulic Press.'
      : isTaken(
            name,
            state.assetTypes.filter((t) => t.id !== editing?.id).map((t) => t.name),
          )
        ? `${name} is already on the list.`
        : undefined,
  }

  const submit = () => {
    if (!attempt(errors)) return
    const item: AssetType = {
      id: editing?.id ?? newId('at'),
      name,
      category: draft.category,
      icon: draft.icon,
    }
    dispatch({ type: 'assetTypes/upsert', item })
    onDone(item)
  }

  return (
    <EntityForm
      title={editing ? `Edit ${editing.name}` : 'Add asset type'}
      description="Asset types are shared by every site."
      submitLabel={editing ? 'Save changes' : 'Add asset type'}
      onSubmit={submit}
      onCancel={() => onDone(null)}
    >
      <FormField label="Name" required htmlFor="at-name" error={show(errors.name)}>
        <Input
          id="at-name"
          value={draft.name}
          placeholder="Hydraulic Press"
          onChange={(e) => set({ name: e.target.value })}
        />
      </FormField>
      <FormField label="Category" htmlFor="at-category">
        <NativeSelect
          id="at-category"
          options={CATEGORY_OPTIONS}
          value={draft.category}
          onChange={(e) => set({ category: e.target.value as AssetCategory })}
        />
      </FormField>
      <FormField
        label="Icon"
        hint={`${iconName(draft.icon)}. Shown beside the asset everywhere.`}
        className="sm:col-span-2"
      >
        <div role="group" aria-label="Icon" className="gap-1.5 sm:grid-cols-9 grid grid-cols-6">
          {ICON_KEYS.map((key) => (
            <button
              key={key}
              type="button"
              aria-pressed={draft.icon === key}
              aria-label={iconName(key)}
              title={iconName(key)}
              onClick={() => set({ icon: key })}
              className={cn(
                'rounded-xl flex aspect-square items-center justify-center transition-colors focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:outline-none',
                draft.icon === key ? 'bg-ink text-on-ink' : 'bg-surface text-body hover:bg-surface-2',
              )}
            >
              <AssetIcon icon={key} className="size-4" />
            </button>
          ))}
        </div>
      </FormField>
    </EntityForm>
  )
}
