import { fmtNumber, newId, plural } from '@cmms/fixtures'
import type { FailureCode, FailureCodeKind } from '@cmms/types'
import { FAILURE_CODE_KINDS, FAILURE_CODE_KIND_LABEL } from '@cmms/types'
import {
  Badge,
  Card,
  type Column,
  DataTable,
  FormField,
  Input,
  NativeSelect,
  PillTabs,
  toast,
} from '@cmms/ui'
import { Tags } from 'lucide-react'
import { useMemo } from 'react'
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

type KindFilter = 'all' | FailureCodeKind

const CODE_PREFIX: Record<FailureCodeKind, string> = {
  problem: 'PRB-',
  mode: 'FM-',
  cause: 'CS-',
  remedy: 'RM-',
}
const KIND_OPTIONS = FAILURE_CODE_KINDS.map((k) => ({ value: k, label: FAILURE_CODE_KIND_LABEL[k] }))

export function FailureCodesTab({ canEdit }: { canEdit: boolean }) {
  const { state, dispatch } = useScoped()
  const [query, setQuery] = useHistoryState('failure-codes.query', '')
  const [kind, setKind] = useHistoryState<KindFilter>('failure-codes.kind', 'all')
  const table = useTableHistory('failure-codes')
  const editor = useEditor<FailureCode, FailureCodeKind>()

  const woUse = useMemo(
    () =>
      tally(
        state.workOrders.flatMap((w) =>
          w.failure ? [w.failure.problemId, w.failure.modeId, w.failure.causeId, w.failure.remedyId] : [],
        ),
      ),
    [state.workOrders],
  )
  const rcaUse = useMemo(() => tally(state.rcas.map((r) => r.modeId)), [state.rcas])
  const terms = searchTerms(query)
  const searched = state.failureCodes.filter((f) => matches(terms, f.code, f.name))
  const rows = kind === 'all' ? searched : searched.filter((f) => f.kind === kind)
  const used = (f: FailureCode) => woUse.get(f.id) ?? 0

  const columns: Column<FailureCode>[] = [
    {
      id: 'code',
      header: 'Code',
      sortValue: (f) => f.code,
      cell: (f) => (
        <div className="min-w-0">
          <p className="text-xs font-semibold font-mono">{f.code}</p>
          <p className="mt-0.5 sm:hidden">{f.name}</p>
          <p className="mt-1 text-xs sm:hidden text-muted">
            {FAILURE_CODE_KIND_LABEL[f.kind]} · {plural(used(f), 'work order')}
          </p>
        </div>
      ),
    },
    {
      id: 'name',
      header: 'Name',
      hideBelow: 'sm',
      sortValue: (f) => f.name,
      cell: (f) => <span className="font-medium">{f.name}</span>,
    },
    {
      id: 'kind',
      header: 'Kind',
      hideBelow: 'md',
      sortValue: (f) => FAILURE_CODE_KINDS.indexOf(f.kind),
      cell: (f) => <Badge>{FAILURE_CODE_KIND_LABEL[f.kind]}</Badge>,
    },
    {
      id: 'used',
      header: 'Work orders',
      hideBelow: 'sm',
      align: 'right',
      sortValue: used,
      cell: (f) => <span className="tabular-nums">{fmtNumber(used(f))}</span>,
    },
  ]
  if (canEdit) {
    columns.push({
      id: 'actions',
      header: '',
      align: 'right',
      cell: (f) => (
        <RowActions name={f.code} onEdit={() => editor.edit(f)} onDelete={() => editor.remove(f)} />
      ),
    })
  }

  const target = editor.removal.item
  const add = canEdit ? () => editor.create(kind === 'all' ? 'problem' : kind) : undefined

  return (
    <Card>
      <ListHeader
        title="Failure codes"
        usedIn="Technicians pick these in the Findings step on the phone and planners see them in failure analysis."
        query={query}
        onQuery={setQuery}
        searchLabel="Search failure codes"
        addLabel="Add code"
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
            ...FAILURE_CODE_KINDS.map((k) => ({
              value: k,
              label: FAILURE_CODE_KIND_LABEL[k],
              count: searched.filter((f) => f.kind === k).length,
            })),
          ]}
        />
      </div>
      <DataTable
        columns={columns}
        rows={rows}
        getRowKey={(f) => f.id}
        initialSort={{ id: 'code' }}
        resetPageKey={`${kind}|${query}`}
        {...table}
        empty={
          <ListEmpty
            query={query}
            noun="failure codes"
            onClear={() => setQuery('')}
            onAdd={add}
            icon={<Tags />}
          />
        }
      />

      <FormDialog open={editor.dialog.open} onOpenChange={editor.setDialogOpen}>
        <FailureCodeForm
          editing={editor.dialog.editing}
          initialKind={editor.dialog.preset ?? 'problem'}
          inUse={
            editor.dialog.editing
              ? used(editor.dialog.editing) + (rcaUse.get(editor.dialog.editing.id) ?? 0) > 0
              : false
          }
          onDone={(saved) => {
            editor.setDialogOpen(false)
            if (saved)
              toast(editor.dialog.editing ? `${saved.code} updated` : `${saved.code} added`, {
                tone: 'success',
                description: saved.name,
              })
          }}
        />
      </FormDialog>
      <DeleteDialog
        open={editor.removal.open}
        onOpenChange={editor.setRemovalOpen}
        name={target?.code ?? 'Failure code'}
        noun="failure code"
        usage={
          target
            ? usageOf([
                [used(target), 'work order'],
                [rcaUse.get(target.id) ?? 0, 'RCA'],
              ])
            : []
        }
        consequence="No work order or RCA uses it."
        onConfirm={() => {
          if (!target) return
          dispatch({ type: 'failureCodes/remove', id: target.id })
          toast(`${target.code} deleted`, { tone: 'success', description: target.name })
        }}
      />
    </Card>
  )
}

function FailureCodeForm({
  editing,
  initialKind,
  inUse,
  onDone,
}: {
  editing: FailureCode | null
  initialKind: FailureCodeKind
  inUse: boolean
  onDone: (saved: FailureCode | null) => void
}) {
  const { state, dispatch } = useScoped()
  const { draft, set, attempt, show } = useDraft(() => ({
    kind: editing?.kind ?? initialKind,
    code: editing?.code ?? CODE_PREFIX[initialKind],
    name: editing?.name ?? '',
  }))
  const others = state.failureCodes.filter((f) => f.id !== editing?.id)
  const code = draft.code.trim().toUpperCase()
  const name = draft.name.trim()
  const kindLabel = FAILURE_CODE_KIND_LABEL[draft.kind].toLowerCase()
  const errors = {
    code:
      !code || code === CODE_PREFIX[draft.kind]
        ? `Enter a code, such as ${CODE_PREFIX[draft.kind]}BW.`
        : isTaken(
              code,
              others.map((f) => f.code),
            )
          ? `${code} is already used.`
          : undefined,
    name: !name
      ? 'Enter a short name, such as Bearing wear.'
      : isTaken(
            name,
            others.filter((f) => f.kind === draft.kind).map((f) => f.name),
          )
        ? `Another ${kindLabel} already has this name.`
        : undefined,
  }

  const submit = () => {
    if (!attempt(errors)) return
    const item: FailureCode = { id: editing?.id ?? newId('fc'), kind: draft.kind, code, name }
    dispatch({ type: 'failureCodes/upsert', item })
    onDone(item)
  }

  return (
    <EntityForm
      title={editing ? `Edit ${editing.code}` : `Add ${kindLabel}`}
      description="Failure codes are shared by every site."
      submitLabel={editing ? 'Save changes' : 'Add code'}
      onSubmit={submit}
      onCancel={() => onDone(null)}
    >
      <FormField
        label="Kind"
        htmlFor="fc-kind"
        hint={inUse ? 'Work orders or RCAs use this code, so its kind stays.' : undefined}
        className="sm:col-span-2"
      >
        <NativeSelect
          id="fc-kind"
          options={KIND_OPTIONS}
          value={draft.kind}
          disabled={inUse}
          onChange={(e) => {
            const next = e.target.value as FailureCodeKind
            // Swap an untouched prefix for the new kind's prefix.
            set({ kind: next, code: draft.code === CODE_PREFIX[draft.kind] ? CODE_PREFIX[next] : draft.code })
          }}
        />
      </FormField>
      <FormField
        label="Code"
        required
        htmlFor="fc-code"
        error={show(errors.code)}
        hint="Unique across the library."
      >
        <Input
          id="fc-code"
          value={draft.code}
          inputClassName="font-mono uppercase"
          onChange={(e) => set({ code: e.target.value })}
        />
      </FormField>
      <FormField label="Name" required htmlFor="fc-name" error={show(errors.name)}>
        <Input
          id="fc-name"
          value={draft.name}
          placeholder="Bearing wear"
          onChange={(e) => set({ name: e.target.value })}
        />
      </FormField>
    </EntityForm>
  )
}
