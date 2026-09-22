import { emptyCapa, fromInput, nowIso, toDateInput } from '@cmms/fixtures'
import type { CapaAction, CapaKind } from '@cmms/types'
import { CAPA_KIND_LABEL } from '@cmms/types'
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
  SegmentedControl,
  Textarea,
} from '@cmms/ui'
import { type FormEvent, useState } from 'react'
import { PersonPicker } from '../../components/pickers'
import { useScoped } from '../../state/scoped'

export const CAPA_KINDS: CapaKind[] = ['corrective', 'preventive']

export function CapaDialog({
  open,
  onOpenChange,
  ownerId,
  onAdd,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Preselected owner, usually the RCA owner. */
  ownerId: string
  onAdd: (action: CapaAction) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md">
        {open && (
          <CapaForm
            ownerId={ownerId}
            onDone={(action) => {
              onOpenChange(false)
              if (action) onAdd(action)
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

function CapaForm({ ownerId, onDone }: { ownerId: string; onDone: (action: CapaAction | null) => void }) {
  const { people } = useScoped()
  const [draft, setDraft] = useState(() => emptyCapa(ownerId, nowIso()))
  const [tried, setTried] = useState(false)
  const set = (patch: Partial<CapaAction>) => setDraft((d) => ({ ...d, ...patch }))
  const missingText = !draft.text.trim()

  const submit = (e: FormEvent) => {
    e.preventDefault()
    setTried(true)
    if (missingText) return
    onDone({ ...draft, text: draft.text.trim() })
  }

  return (
    <form onSubmit={submit} noValidate>
      <DialogHeader>
        <DialogTitle>Add an action</DialogTitle>
        <DialogDescription>A corrective action fixes this failure. A preventive action removes the root cause.</DialogDescription>
      </DialogHeader>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FormField
          label="Action"
          required
          htmlFor="capa-text"
          error={tried && missingText ? 'Describe what has to be done.' : undefined}
          hint="Name a PM code and runtime hours, such as PM-0003 and 400 hours, to apply the new interval in one click."
          className="sm:col-span-2"
        >
          <Textarea
            id="capa-text"
            rows={3}
            className="min-h-0"
            value={draft.text}
            placeholder="Change PM-0003 from every 30 days to every 400 runtime hours"
            onChange={(e) => set({ text: e.target.value })}
          />
        </FormField>
        <FormField label="Type" className="sm:col-span-2">
          <SegmentedControl
            aria-label="Type"
            value={draft.kind}
            onChange={(kind) => set({ kind: kind === 'corrective' ? 'corrective' : 'preventive' })}
            options={CAPA_KINDS.map((kind) => ({ value: kind, label: CAPA_KIND_LABEL[kind] }))}
          />
        </FormField>
        <FormField label="Owner" htmlFor="capa-owner">
          <PersonPicker id="capa-owner" people={people} value={draft.ownerId} onChange={(id) => id && set({ ownerId: id })} />
        </FormField>
        <FormField label="Due" htmlFor="capa-due">
          <Input
            id="capa-due"
            type="date"
            value={toDateInput(draft.dueAt)}
            onChange={(e) => e.target.value && set({ dueAt: fromInput(`${e.target.value}T09:00`) })}
          />
        </FormField>
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={() => onDone(null)}>
          Cancel
        </Button>
        <Button type="submit">Add action</Button>
      </DialogFooter>
    </form>
  )
}
