import { fmtNumber, isActive, newId, plural } from '@cmms/fixtures'
import type { Person, Team } from '@cmms/types'
import { AvatarStack, Card, type Column, DataTable, FormField, Input, NativeSelect, toast } from '@cmms/ui'
import { Users } from 'lucide-react'
import { useMemo } from 'react'
import { PersonChip } from '../../../components/links'
import { PersonPicker } from '../../../components/pickers'
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
  useUserSites,
} from './shared'

export function TeamsTab({ canEdit }: { canEdit: boolean }) {
  const { state, siteId, dispatch, personName } = useScoped()
  const userSites = useUserSites()
  const [query, setQuery] = useHistoryState('teams.query', '')
  const table = useTableHistory('teams')
  const editor = useEditor<Team>()

  const members = useMemo(() => {
    const byTeam = new Map<string, Person[]>()
    for (const p of state.people)
      if (p.technician) byTeam.set(p.technician.teamId, [...(byTeam.get(p.technician.teamId) ?? []), p])
    return byTeam
  }, [state.people])
  const assetUse = useMemo(() => tally(state.assets.map((a) => a.teamId)), [state.assets])
  const pmUse = useMemo(() => tally(state.pmSchedules.map((p) => p.teamId)), [state.pmSchedules])
  const openWork = useMemo(
    () => tally(state.workOrders.filter(isActive).map((w) => w.teamId)),
    [state.workOrders],
  )
  const terms = searchTerms(query)
  const rows = userSites
    .inScope(state.teams)
    .filter((t) =>
      matches(terms, t.name, userSites.name(t.siteId), t.supervisorId ? personName(t.supervisorId) : ''),
    )
  const crew = (t: Team) => members.get(t.id) ?? []

  const columns: Column<Team>[] = [
    {
      id: 'name',
      header: 'Team',
      sortValue: (t) => t.name,
      cell: (t) => (
        <div className="min-w-0">
          <p className="font-semibold">{t.name}</p>
          <p className="text-xs sm:hidden text-muted">
            {userSites.name(t.siteId)} · {t.supervisorId ? personName(t.supervisorId) : 'No lead'} ·{' '}
            {plural(crew(t).length, 'member')}
          </p>
        </div>
      ),
    },
    {
      id: 'lead',
      header: 'Lead',
      hideBelow: 'md',
      cell: (t) =>
        t.supervisorId ? (
          <PersonChip personId={t.supervisorId} />
        ) : (
          <span className="text-muted">No lead</span>
        ),
    },
    {
      id: 'members',
      header: 'Members',
      hideBelow: 'sm',
      sortValue: (t) => crew(t).length,
      cell: (t) =>
        crew(t).length ? (
          <span className="gap-2 flex items-center">
            <AvatarStack people={crew(t).map((p) => ({ name: p.name, color: p.color }))} max={4} size="xs" />
            <span className="text-xs text-muted tabular-nums">{fmtNumber(crew(t).length)}</span>
          </span>
        ) : (
          <span className="text-xs text-muted">None yet</span>
        ),
    },
    {
      id: 'site',
      header: 'Site',
      hideBelow: 'lg',
      sortValue: (t) => userSites.name(t.siteId),
      cell: (t) => userSites.name(t.siteId),
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
  const add = canEdit ? () => editor.create() : undefined

  return (
    <Card>
      <ListHeader
        title="Teams"
        usedIn="Assets, PM schedules and work orders belong to a team, and its lead assigns and verifies the work."
        query={query}
        onQuery={setQuery}
        searchLabel="Search teams"
        addLabel="Add team"
        onAdd={add}
      />
      <DataTable
        columns={columns}
        rows={rows}
        getRowKey={(t) => t.id}
        resetPageKey={query}
        {...table}
        empty={
          <ListEmpty query={query} noun="teams" onClear={() => setQuery('')} onAdd={add} icon={<Users />} />
        }
      />

      <FormDialog open={editor.dialog.open} onOpenChange={editor.setDialogOpen}>
        <TeamForm
          editing={editor.dialog.editing}
          defaultSiteId={siteId}
          onDone={(saved) => {
            editor.setDialogOpen(false)
            if (saved)
              toast(editor.dialog.editing ? `${saved.name} updated` : `${saved.name} team added`, {
                tone: 'success',
                description: userSites.name(saved.siteId),
              })
          }}
        />
      </FormDialog>
      <DeleteDialog
        open={editor.removal.open}
        onOpenChange={editor.setRemovalOpen}
        name={target?.name ?? 'Team'}
        noun="team"
        usage={
          target
            ? usageOf([
                [crew(target).length, 'technician'],
                [assetUse.get(target.id) ?? 0, 'asset'],
                [pmUse.get(target.id) ?? 0, 'PM schedule'],
                [openWork.get(target.id) ?? 0, 'open work order'],
              ])
            : []
        }
        consequence="No technician, asset, PM schedule or open work order belongs to it."
        onConfirm={() => {
          if (!target) return
          dispatch({ type: 'teams/remove', id: target.id })
          toast(`${target.name} deleted`, { tone: 'success' })
        }}
      />
    </Card>
  )
}

function TeamForm({
  editing,
  defaultSiteId,
  onDone,
}: {
  editing: Team | null
  defaultSiteId: string
  onDone: (saved: Team | null) => void
}) {
  const { state, dispatch } = useScoped()
  const userSites = useUserSites()
  const { draft, set, attempt, show } = useDraft(() => ({
    siteId: editing?.siteId ?? defaultSiteId,
    name: editing?.name ?? '',
    supervisorId: editing?.supervisorId ?? null,
  }))
  // Supervisors and managers at the site can lead; a lead who changed role stays pickable.
  const leads = state.people.filter(
    (p) =>
      p.siteIds.includes(draft.siteId) &&
      (p.role === 'supervisor' || p.role === 'manager' || p.id === editing?.supervisorId),
  )
  const name = draft.name.trim()
  const errors = {
    name: !name
      ? 'Enter a name, such as Mechanical.'
      : isTaken(
            name,
            state.teams.filter((t) => t.id !== editing?.id && t.siteId === draft.siteId).map((t) => t.name),
          )
        ? `${userSites.name(draft.siteId)} already has a ${name} team.`
        : undefined,
  }

  const submit = () => {
    if (!attempt(errors)) return
    const item: Team = {
      id: editing?.id ?? newId('team'),
      siteId: draft.siteId,
      name,
      supervisorId: draft.supervisorId,
    }
    dispatch({ type: 'teams/upsert', item })
    onDone(item)
  }

  return (
    <EntityForm
      title={editing ? `Edit ${editing.name}` : 'Add team'}
      description="Technicians, assets and PM schedules pick a team from their site."
      submitLabel={editing ? 'Save changes' : 'Add team'}
      onSubmit={submit}
      onCancel={() => onDone(null)}
    >
      <FormField label="Site" htmlFor="team-site" hint={editing ? 'A team stays at its site.' : undefined}>
        <NativeSelect
          id="team-site"
          options={userSites.options}
          value={draft.siteId}
          disabled={!!editing}
          onChange={(e) => set({ siteId: e.target.value, supervisorId: null })}
        />
      </FormField>
      <FormField label="Name" required htmlFor="team-name" error={show(errors.name)}>
        <Input
          id="team-name"
          value={draft.name}
          placeholder="Mechanical"
          onChange={(e) => set({ name: e.target.value })}
        />
      </FormField>
      <FormField
        label="Lead"
        htmlFor="team-lead"
        hint="The supervisor who assigns and verifies the team's work."
        className="sm:col-span-2"
      >
        <PersonPicker
          id="team-lead"
          people={leads}
          value={draft.supervisorId}
          onChange={(supervisorId) => set({ supervisorId })}
          clearable
          placeholder="No lead yet"
        />
      </FormField>
    </EntityForm>
  )
}
