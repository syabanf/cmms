import { fmtNumber, newId, plural } from '@cmms/fixtures'
import type { SafetyItem, SafetyKind, SafetyRequirement } from '@cmms/types'
import { SAFETY_KIND_LABEL } from '@cmms/types'
import {
  Badge,
  Card,
  type Column,
  DataTable,
  FormField,
  IconTile,
  Input,
  NativeSelect,
  PillTabs,
  type Tone,
  toast,
} from '@cmms/ui'
import { FileBadge, HardHat, Lock, ShieldAlert, TriangleAlert } from 'lucide-react'
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

const KINDS: SafetyKind[] = ['hazard', 'ppe', 'loto', 'permit']
const KIND_ICON: Record<SafetyKind, ReactNode> = {
  hazard: <TriangleAlert />,
  ppe: <HardHat />,
  loto: <Lock />,
  permit: <FileBadge />,
}
const KIND_TONE: Record<SafetyKind, Tone> = { hazard: 'warning', ppe: 'default', loto: 'ink', permit: 'info' }
const KIND_PLURAL: Record<SafetyKind, string> = {
  hazard: 'Hazards',
  ppe: 'PPE',
  loto: 'Lock-out points',
  permit: 'Permits',
}
const KIND_OPTIONS = KINDS.map((k) => ({ value: k, label: SAFETY_KIND_LABEL[k] }))
const EXAMPLE: Record<SafetyKind, string> = {
  hazard: 'Arc flash',
  ppe: 'Safety glasses',
  loto: 'Electrical isolation at the main breaker',
  permit: 'Hot work',
}

/** Every safety item a job plan or work order lists, whatever its kind. */
const safetyIds = (s: SafetyRequirement) => [...s.hazardIds, ...s.ppeIds, ...s.lotoIds, ...s.permitIds]

/** A permit counts as held when its name matches an authorization, ignoring case. */
const holds = (authorizations: readonly string[], permit: string) =>
  authorizations.some((a) => a.toLowerCase() === permit.toLowerCase())

export function SafetyItemsTab({ canEdit }: { canEdit: boolean }) {
  const { state, dispatch } = useScoped()
  const [query, setQuery] = useHistoryState('safety-items.query', '')
  const [kind, setKind] = useHistoryState<KindFilter>('safety-items.kind', 'all')
  const table = useTableHistory('safety-items')
  const editor = useEditor<SafetyItem, SafetyKind>()

  const planUse = useMemo(() => tally(state.jobPlans.flatMap((j) => safetyIds(j.safety))), [state.jobPlans])
  const woUse = useMemo(() => tally(state.workOrders.flatMap((w) => safetyIds(w.safety))), [state.workOrders])
  const authorizations = useMemo(
    () => state.people.flatMap((p) => (p.technician ? [p.technician.authorizations] : [])),
    [state.people],
  )
  const terms = searchTerms(query)
  const searched = state.safetyItems.filter((s) => matches(terms, s.name, SAFETY_KIND_LABEL[s.kind]))
  const rows = kind === 'all' ? searched : searched.filter((s) => s.kind === kind)
  const plans = (s: SafetyItem) => planUse.get(s.id) ?? 0
  const orders = (s: SafetyItem) => woUse.get(s.id) ?? 0
  const technicians = (s: SafetyItem) =>
    s.kind === 'permit' ? authorizations.filter((held) => holds(held, s.name)).length : 0

  const columns: Column<SafetyItem>[] = [
    {
      id: 'name',
      header: 'Item',
      sortValue: (s) => s.name,
      cell: (s) => (
        <div className="gap-3 flex items-center">
          <IconTile size="sm" tone={KIND_TONE[s.kind]}>
            {KIND_ICON[s.kind]}
          </IconTile>
          <div className="min-w-0">
            <p className="font-semibold">{s.name}</p>
            <p className="text-xs sm:hidden text-muted">
              {SAFETY_KIND_LABEL[s.kind]} · {plural(plans(s), 'job plan')}
              {s.kind === 'permit' ? ` · ${plural(technicians(s), 'technician')}` : ''}
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
    {
      id: 'technicians',
      header: 'Technicians',
      hideBelow: 'lg',
      align: 'right',
      sortValue: technicians,
      cell: (s) => (s.kind === 'permit' ? <span className="tabular-nums">{fmtNumber(technicians(s))}</span> : null),
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
        usedIn="The phone's Safety step lists these before work starts. Permits also match technicians' authorizations by name."
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
              label: KIND_PLURAL[k],
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
            editor.dialog.editing
              ? plans(editor.dialog.editing) + orders(editor.dialog.editing) + technicians(editor.dialog.editing) > 0
              : false
          }
          holders={editor.dialog.editing ? technicians(editor.dialog.editing) : 0}
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
                [technicians(target), 'technician'],
              ])
            : []
        }
        consequence="No job plan, work order or technician lists it."
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
  holders,
  onDone,
}: {
  editing: SafetyItem | null
  initialKind: SafetyKind
  inUse: boolean
  /** Technicians whose authorizations name this permit. */
  holders: number
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
      description="Job plans list the hazards, PPE, lock-out points and permits for a task, and the technician confirms them on the phone before work starts."
      submitLabel={editing ? 'Save changes' : 'Add item'}
      onSubmit={submit}
      onCancel={() => onDone(null)}
    >
      <FormField
        label="Kind"
        htmlFor="sf-kind"
        hint={inUse ? 'Job plans, work orders or technicians list it, so its kind stays.' : undefined}
        className="sm:col-span-2"
      >
        <NativeSelect
          id="sf-kind"
          options={KIND_OPTIONS}
          value={draft.kind}
          disabled={inUse}
          onChange={(e) => set({ kind: e.target.value as SafetyKind })}
        />
      </FormField>
      <FormField
        label="Name"
        required
        htmlFor="sf-name"
        error={show(errors.name)}
        hint={holders ? `${plural(holders, 'technician')} hold it by name. After a rename, update their authorizations to match.` : undefined}
        className="sm:col-span-2"
      >
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
