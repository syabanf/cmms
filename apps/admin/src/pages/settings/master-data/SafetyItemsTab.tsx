import { fmtNumber, newId, plural } from '@cmms/fixtures'
import type { SafetyItem, SafetyKind } from '@cmms/types'
import { SAFETY_KIND_LABEL } from '@cmms/types'
import {
  Badge,
  Card,
  type Column,
  DataTable,
  FormField,
  IconTile,
  Input,
  PillTabs,
  SegmentedControl,
  toast,
} from '@cmms/ui'
import { HardHat, ShieldAlert, TriangleAlert } from 'lucide-react'
import { type ReactNode, useMemo } from 'react'
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

type KindFilter = 'all' | SafetyKind

const KINDS: SafetyKind[] = ['hazard', 'ppe']
const KIND_ICON: Record<SafetyKind, ReactNode> = { hazard: <TriangleAlert />, ppe: <HardHat /> }
const KIND_OPTIONS = KINDS.map((k) => ({ value: k, label: SAFETY_KIND_LABEL[k] }))
const EXAMPLE: Record<SafetyKind, string> = { hazard: 'Arc flash', ppe: 'Safety glasses' }

const safetyIds = (s: { hazardIds: string[]; ppeIds: string[] }) => [...s.hazardIds, ...s.ppeIds]

export function SafetyItemsTab({ canEdit }: { canEdit: boolean }) {
  const { state, dispatch } = useScoped()
  const [query, setQuery] = useHistoryState('safety-items.query', '')
  const [kind, setKind] = useHistoryState<KindFilter>('safety-items.kind', 'all')
  const table = useTableHistory('safety-items')
  const editor = useEditor<SafetyItem, SafetyKind>()

  const planUse = useMemo(() => tally(state.jobPlans.flatMap((j) => safetyIds(j.safety))), [state.jobPlans])
  const woUse = useMemo(() => tally(state.workOrders.flatMap((w) => safetyIds(w.safety))), [state.workOrders])
  const terms = searchTerms(query)
  const searched = state.safetyItems.filter((s) => matches(terms, s.name, SAFETY_KIND_LABEL[s.kind]))
  const rows = kind === 'all' ? searched : searched.filter((s) => s.kind === kind)
  const plans = (s: SafetyItem) => planUse.get(s.id) ?? 0
  const orders = (s: SafetyItem) => woUse.get(s.id) ?? 0

  const columns: Column<SafetyItem>[] = [
    {
      id: 'name',
      header: 'Item',
      sortValue: (s) => s.name,
      cell: (s) => (
        <div className="gap-3 flex items-center">
          <IconTile size="sm" tone={s.kind === 'hazard' ? 'warning' : 'default'}>
            {KIND_ICON[s.kind]}
          </IconTile>
          <div className="min-w-0">
            <p className="font-semibold">{s.name}</p>
            <p className="text-xs sm:hidden text-muted">
              {SAFETY_KIND_LABEL[s.kind]} · {plural(plans(s), 'job plan')}
            </p>
          </div>
        </div>
      ),
    },
    {
      id: 'kind',
      header: 'Kind',
      hideBelow: 'sm',
      sortValue: (s) => s.kind,
      cell: (s) => <Badge>{SAFETY_KIND_LABEL[s.kind]}</Badge>,
    },
    {
      id: 'plans',
      header: 'Job plans',
      hideBelow: 'sm',
      align: 'right',
      sortValue: plans,
      cell: (s) => <span className="tabular-nums">{fmtNumber(plans(s))}</span>,
    },
    {
      id: 'orders',
      header: 'Work orders',
      hideBelow: 'md',
      align: 'right',
      sortValue: orders,
      cell: (s) => <span className="tabular-nums">{fmtNumber(orders(s))}</span>,
    },
  ]
  if (canEdit) {
    columns.push({
      id: 'actions',
      header: '',
      align: 'right',
      cell: (s) => (
        <RowActions name={s.name} onEdit={() => editor.edit(s)} onDelete={() => editor.remove(s)} />
      ),
    })
  }

  const target = editor.removal.item
  const add = canEdit ? () => editor.create(kind === 'all' ? 'hazard' : kind) : undefined

  return (
    <Card>
      <ListHeader
        title="Safety items"
        usedIn="The phone's Safety step lists these before work starts."
        query={query}
        onQuery={setQuery}
        searchLabel="Search safety items"
        addLabel="Add item"
        onAdd={add}
      />
      <div className="px-5 pb-4">
        <PillTabs
          size="sm"
          className="bg-surface shadow-none"
          value={kind}
          onValueChange={(v) => setKind(v as KindFilter)}
          items={[
            { value: 'all', label: 'All', count: searched.length },
            ...KINDS.map((k) => ({
              value: k,
              label: k === 'hazard' ? 'Hazards' : SAFETY_KIND_LABEL[k],
              count: searched.filter((s) => s.kind === k).length,
            })),
          ]}
        />
      </div>
      <DataTable
        columns={columns}
        rows={rows}
        getRowKey={(s) => s.id}
        initialSort={{ id: 'name' }}
        resetPageKey={`${kind}|${query}`}
        {...table}
        empty={
          <ListEmpty
            query={query}
            noun="safety items"
            onClear={() => setQuery('')}
            onAdd={add}
            icon={<ShieldAlert />}
          />
        }
      />

      <FormDialog open={editor.dialog.open} onOpenChange={editor.setDialogOpen}>
        <SafetyItemForm
          editing={editor.dialog.editing}
          initialKind={editor.dialog.preset ?? 'hazard'}
          inUse={
            editor.dialog.editing ? plans(editor.dialog.editing) + orders(editor.dialog.editing) > 0 : false
          }
          onDone={(saved) => {
            editor.setDialogOpen(false)
            if (saved)
              toast(editor.dialog.editing ? `${saved.name} updated` : `${saved.name} added`, {
                tone: 'success',
                description: SAFETY_KIND_LABEL[saved.kind],
              })
          }}
        />
      </FormDialog>
      <DeleteDialog
        open={editor.removal.open}
        onOpenChange={editor.setRemovalOpen}
        name={target?.name ?? 'Safety item'}
        noun="safety item"
        usage={
          target
            ? usageOf([
                [plans(target), 'job plan'],
                [orders(target), 'work order'],
              ])
            : []
        }
        consequence="No job plan or work order lists it."
        onConfirm={() => {
          if (!target) return
          dispatch({ type: 'safetyItems/remove', id: target.id })
          toast(`${target.name} deleted`, { tone: 'success' })
        }}
      />
    </Card>
  )
}

function SafetyItemForm({
  editing,
  initialKind,
  inUse,
  onDone,
}: {
  editing: SafetyItem | null
  initialKind: SafetyKind
  inUse: boolean
  onDone: (saved: SafetyItem | null) => void
}) {
  const { state, dispatch } = useScoped()
  const { draft, set, attempt, show } = useDraft(() => ({
    kind: editing?.kind ?? initialKind,
    name: editing?.name ?? '',
  }))
  const name = draft.name.trim()
  const errors = {
    name: !name
      ? `Enter a name, such as ${EXAMPLE[draft.kind]}.`
      : isTaken(
            name,
            state.safetyItems.filter((s) => s.id !== editing?.id && s.kind === draft.kind).map((s) => s.name),
          )
        ? `${name} is already on the ${SAFETY_KIND_LABEL[draft.kind]} list.`
        : undefined,
  }

  const submit = () => {
    if (!attempt(errors)) return
    const item: SafetyItem = { id: editing?.id ?? newId('sf'), kind: draft.kind, name }
    dispatch({ type: 'safetyItems/upsert', item })
    onDone(item)
  }

  return (
    <EntityForm
      title={editing ? `Edit ${editing.name}` : 'Add safety item'}
      description="Job plans list the hazards and PPE for a task, and the technician confirms them on the phone."
      submitLabel={editing ? 'Save changes' : 'Add item'}
      onSubmit={submit}
      onCancel={() => onDone(null)}
    >
      <FormField
        label="Kind"
        hint={inUse ? 'Job plans or work orders list it, so its kind stays.' : undefined}
        className="sm:col-span-2"
      >
        <SegmentedControl
          aria-label="Kind"
          options={KIND_OPTIONS}
          value={draft.kind}
          disabled={inUse}
          onChange={(v) => set({ kind: v as SafetyKind })}
          className="sm:w-72 w-full"
        />
      </FormField>
      <FormField label="Name" required htmlFor="sf-name" error={show(errors.name)} className="sm:col-span-2">
        <Input
          id="sf-name"
          value={draft.name}
          placeholder={EXAMPLE[draft.kind]}
          onChange={(e) => set({ name: e.target.value })}
        />
      </FormField>
    </EntityForm>
  )
}
