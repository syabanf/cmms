import { DAY, emptyRca, failureEvents, fromInput, nowIso, nowMs, can as roleCan, toDateInput } from '@cmms/fixtures'
import type { Rca, RcaTrigger } from '@cmms/types'
import { RCA_TRIGGER_LABEL } from '@cmms/types'
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  FormField,
  Input,
  NativeSelect,
} from '@cmms/ui'
import { type FormEvent, useMemo, useState } from 'react'
import { AssetPicker, FailureCodePicker, PersonPicker } from '../../components/pickers'
import { useScoped } from '../../state/scoped'
import { createRca } from './lib'

const TRIGGERS = Object.keys(RCA_TRIGGER_LABEL) as RcaTrigger[]

interface Draft {
  title: string
  assetId: string | null
  modeId: string | null
  trigger: RcaTrigger
  ownerId: string | null
  due: string
}

/** Create a new RCA, or edit the heading fields of an existing one. */
export function RcaDialog({
  open,
  onOpenChange,
  editing,
  onSaved,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  editing?: Rca
  onSaved: (rca: Rca) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        {open && (
          <RcaForm
            editing={editing}
            onDone={(rca) => {
              onOpenChange(false)
              if (rca) onSaved(rca)
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

function RcaForm({ editing, onDone }: { editing?: Rca; onDone: (rca: Rca | null) => void }) {
  const s = useScoped()
  const [tried, setTried] = useState(false)
  const [draft, setDraft] = useState<Draft>(() => {
    const base = editing ?? emptyRca(s.siteId, s.user.id, nowIso())
    return {
      title: base.title,
      assetId: base.assetId || null,
      modeId: base.modeId,
      trigger: base.trigger,
      ownerId: base.ownerId,
      due: toDateInput(base.dueAt),
    }
  })
  const set = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }))

  const owners = useMemo(
    () => s.people.filter((p) => roleCan(p.role, 'rca.manage') || p.id === editing?.ownerId),
    [s.people, editing?.ownerId],
  )

  // A new RCA links the past year's failures with the same asset and mode.
  const matches = useMemo(() => {
    if (editing || !draft.assetId || !draft.modeId) return []
    const since = nowMs() - 365 * DAY
    return failureEvents(s.workOrders).filter((e) => e.assetId === draft.assetId && e.modeId === draft.modeId && e.at >= since)
  }, [editing, draft.assetId, draft.modeId, s.workOrders])

  const errors = {
    title: !draft.title.trim() ? 'Name the problem in a few words.' : undefined,
    asset: !draft.assetId ? 'Choose the asset that failed.' : undefined,
    owner: !draft.ownerId ? 'Someone has to own the analysis.' : undefined,
    due: !draft.due ? 'Pick a due date.' : undefined,
  }

  const submit = (e: FormEvent) => {
    e.preventDefault()
    setTried(true)
    if (!draft.assetId || !draft.ownerId || errors.title || errors.due) return
    const fields = {
      title: draft.title.trim(),
      assetId: draft.assetId,
      modeId: draft.modeId,
      trigger: draft.trigger,
      ownerId: draft.ownerId,
      dueAt: fromInput(`${draft.due}T09:00`),
    }
    const rca = editing ? { ...editing, ...fields } : createRca(s.state.rcas, s.siteId, s.user.id, { ...fields, woIds: matches.map((m) => m.wo.id) })
    s.dispatch({ type: 'rca/upsert', item: rca })
    onDone(rca)
  }

  const show = (message: string | undefined) => (tried ? message : undefined)

  return (
    <form onSubmit={submit} noValidate>
      <DialogHeader>
        <DialogTitle>{editing ? `Edit ${editing.code}` : 'New root cause analysis'}</DialogTitle>
        <DialogDescription>
          {editing ? 'Change the heading, owner or due date. The analysis stays as it is.' : 'Open an RCA for a critical, costly, repeated or unsafe failure.'}
        </DialogDescription>
      </DialogHeader>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FormField label="Title" required htmlFor="rca-title" error={show(errors.title)} className="sm:col-span-2">
          <Input
            id="rca-title"
            value={draft.title}
            placeholder="Poles-03 drive bearing fails repeatedly"
            onChange={(e) => set({ title: e.target.value })}
          />
        </FormField>
        <FormField
          label="Asset"
          required
          htmlFor="rca-asset"
          error={show(errors.asset)}
          hint={editing ? 'Linked failures belong to this asset, so it stays fixed.' : undefined}
          className="sm:col-span-2"
        >
          <AssetPicker id="rca-asset" value={draft.assetId} disabled={!!editing} onChange={(assetId) => set({ assetId })} />
        </FormField>
        <FormField
          label="Failure mode"
          htmlFor="rca-mode"
          hint={
            matches.length
              ? `${matches.length} recorded ${matches.length === 1 ? 'failure' : 'failures'} of this mode on this asset in the past year will be linked.`
              : 'Optional for safety and chronic issues.'
          }
        >
          <FailureCodePicker id="rca-mode" kind="mode" value={draft.modeId} onChange={(modeId) => set({ modeId })} />
        </FormField>
        <FormField label="Trigger" htmlFor="rca-trigger">
          <NativeSelect
            id="rca-trigger"
            value={draft.trigger}
            onChange={(e) => {
              const trigger = TRIGGERS.find((t) => t === e.target.value)
              if (trigger) set({ trigger })
            }}
            options={TRIGGERS.map((t) => ({ value: t, label: RCA_TRIGGER_LABEL[t] }))}
          />
        </FormField>
        <FormField label="Owner" required htmlFor="rca-owner" error={show(errors.owner)}>
          <PersonPicker id="rca-owner" people={owners} value={draft.ownerId} onChange={(ownerId) => set({ ownerId })} />
        </FormField>
        <FormField label="Due" required htmlFor="rca-due" error={show(errors.due)}>
          <Input id="rca-due" type="date" value={draft.due} onChange={(e) => set({ due: e.target.value })} />
        </FormField>
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={() => onDone(null)}>
          Cancel
        </Button>
        <Button type="submit">{editing ? 'Save changes' : 'Create RCA'}</Button>
      </DialogFooter>
    </form>
  )
}
