import { fmtNumber, newId } from '@cmms/fixtures'
import type { Skill, SkillLevel } from '@cmms/types'
import { Card, type Column, DataTable, FormField, Input, toast } from '@cmms/ui'
import { Grid3x3 } from 'lucide-react'
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

const HELD_LEVELS = [1, 2, 3] as const satisfies readonly SkillLevel[]

export function SkillsTab({ canEdit }: { canEdit: boolean }) {
  const { state, dispatch } = useScoped()
  const [query, setQuery] = useHistoryState('skills.query', '')
  const table = useTableHistory('skills')
  const editor = useEditor<Skill>()

  // Holders per skill and level, across every site: skills are shared.
  const holders = useMemo(() => {
    const profiles = state.people.flatMap((p) => (p.technician ? [p.technician] : []))
    return new Map(
      state.skills.map(
        (skill) =>
          [
            skill.id,
            HELD_LEVELS.map((level) => profiles.filter((t) => t.skills[skill.id] === level).length),
          ] as const,
      ),
    )
  }, [state.people, state.skills])
  const planUse = useMemo(() => tally(state.jobPlans.map((j) => j.skillId)), [state.jobPlans])
  const terms = searchTerms(query)
  const rows = state.skills.filter((s) => matches(terms, s.name))

  const levels = (s: Skill) => holders.get(s.id) ?? [0, 0, 0]
  const heldBy = (s: Skill) => levels(s).reduce((sum, n) => sum + n, 0)
  const plans = (s: Skill) => planUse.get(s.id) ?? 0

  const columns: Column<Skill>[] = [
    {
      id: 'name',
      header: 'Skill',
      sortValue: (s) => s.name,
      cell: (s) => (
        <div className="min-w-0">
          <p className="font-semibold">{s.name}</p>
          <p className="text-xs sm:hidden text-muted">
            {levels(s)
              .map((n, i) => `L${i + 1}: ${n}`)
              .join(' · ')}
          </p>
        </div>
      ),
    },
    ...HELD_LEVELS.map((level): Column<Skill> => ({
      id: `l${level}`,
      header: `L${level}`,
      hideBelow: 'sm',
      align: 'right',
      sortValue: (s) => levels(s)[level - 1],
      cell: (s) => <span className="tabular-nums">{fmtNumber(levels(s)[level - 1])}</span>,
    })),
    {
      id: 'plans',
      header: 'Job plans',
      hideBelow: 'md',
      align: 'right',
      sortValue: plans,
      cell: (s) => <span className="tabular-nums">{fmtNumber(plans(s))}</span>,
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
  const add = canEdit ? () => editor.create() : undefined

  return (
    <Card>
      <ListHeader
        title="Skills"
        usedIn="Job plans ask for a skill level, and the skill matrix and assignment pickers show who holds it."
        query={query}
        onQuery={setQuery}
        searchLabel="Search skills"
        addLabel="Add skill"
        onAdd={add}
      />
      <DataTable
        columns={columns}
        rows={rows}
        getRowKey={(s) => s.id}
        resetPageKey={query}
        {...table}
        empty={
          <ListEmpty
            query={query}
            noun="skills"
            onClear={() => setQuery('')}
            onAdd={add}
            icon={<Grid3x3 />}
          />
        }
      />

      <FormDialog open={editor.dialog.open} onOpenChange={editor.setDialogOpen}>
        <SkillForm
          editing={editor.dialog.editing}
          onDone={(saved) => {
            editor.setDialogOpen(false)
            if (saved)
              toast(editor.dialog.editing ? `${saved.name} updated` : `${saved.name} added`, {
                tone: 'success',
                description: editor.dialog.editing ? undefined : 'Set levels in the skill matrix.',
              })
          }}
        />
      </FormDialog>
      <DeleteDialog
        open={editor.removal.open}
        onOpenChange={editor.setRemovalOpen}
        name={target?.name ?? 'Skill'}
        noun="skill"
        usage={
          target
            ? usageOf([
                [heldBy(target), 'technician'],
                [plans(target), 'job plan'],
              ])
            : []
        }
        consequence="No technician holds it and no job plan asks for it."
        onConfirm={() => {
          if (!target) return
          dispatch({ type: 'skills/remove', id: target.id })
          toast(`${target.name} deleted`, { tone: 'success' })
        }}
      />
    </Card>
  )
}

function SkillForm({ editing, onDone }: { editing: Skill | null; onDone: (saved: Skill | null) => void }) {
  const { state, dispatch } = useScoped()
  const { draft, set, attempt, show } = useDraft(() => ({ name: editing?.name ?? '' }))
  const name = draft.name.trim()
  const errors = {
    name: !name
      ? 'Enter a name, such as Hydraulic.'
      : isTaken(
            name,
            state.skills.filter((s) => s.id !== editing?.id).map((s) => s.name),
          )
        ? `${name} is already a skill.`
        : undefined,
  }

  const submit = () => {
    if (!attempt(errors)) return
    const item: Skill = { id: editing?.id ?? newId('skl'), name }
    dispatch({ type: 'skills/upsert', item })
    onDone(item)
  }

  return (
    <EntityForm
      title={editing ? `Edit ${editing.name}` : 'Add skill'}
      description="Skills are shared by every site. Technicians hold them at L1 basic, L2 independent or L3 expert."
      submitLabel={editing ? 'Save changes' : 'Add skill'}
      onSubmit={submit}
      onCancel={() => onDone(null)}
    >
      <FormField
        label="Name"
        required
        htmlFor="skill-name"
        error={show(errors.name)}
        className="sm:col-span-2"
      >
        <Input
          id="skill-name"
          value={draft.name}
          placeholder="Hydraulic"
          onChange={(e) => set({ name: e.target.value })}
        />
      </FormField>
    </EntityForm>
  )
}
