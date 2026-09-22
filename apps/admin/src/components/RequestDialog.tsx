import { emptyRequest, nowIso } from '@cmms/fixtures'
import type { MaintenanceRequest, OperationalImpact, Severity } from '@cmms/types'
import { IMPACT_LABEL, SEVERITIES, SEVERITY_LABEL } from '@cmms/types'
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
  PhotoInput,
  SegmentedControl,
  Textarea,
} from '@cmms/ui'
import { type FormEvent, useState } from 'react'
import { useScoped } from '../state/scoped'
import { AssetPicker, PersonPicker } from './pickers'

export function RequestDialog({
  open,
  onOpenChange,
  assetId,
  onSaved,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  assetId?: string
  onSaved?: (request: MaintenanceRequest) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        {open && (
          <RequestForm
            assetId={assetId}
            onDone={(r) => {
              onOpenChange(false)
              if (r) onSaved?.(r)
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

function RequestForm({ assetId, onDone }: { assetId?: string; onDone: (r: MaintenanceRequest | null) => void }) {
  const { siteId, user, people, dispatch } = useScoped()
  const [tried, setTried] = useState(false)
  const [draft, setDraft] = useState(() => ({
    ...emptyRequest(siteId, user.id, nowIso()),
    assetId: assetId ?? '',
  }))
  const [photos, setPhotos] = useState<string[]>([])
  const set = (patch: Partial<MaintenanceRequest>) => setDraft((d) => ({ ...d, ...patch }))

  const submit = (e: FormEvent) => {
    e.preventDefault()
    setTried(true)
    if (!draft.assetId || !draft.title.trim()) return
    const at = nowIso()
    const request: MaintenanceRequest = {
      ...draft,
      title: draft.title.trim(),
      description: draft.description.trim(),
      reportedAt: at,
      attachments: photos.map((url, i) => ({ id: `att-${Date.now().toString(36)}-${i}`, kind: 'photo', name: `Photo ${i + 1}.jpg`, url, at, by: user.id })),
    }
    dispatch({ type: 'requests/create', item: request })
    onDone(request)
  }

  return (
    <form onSubmit={submit}>
      <DialogHeader>
        <DialogTitle>Report a problem</DialogTitle>
        <DialogDescription>A request goes to the supervisor for triage. It becomes a work order only after review.</DialogDescription>
      </DialogHeader>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FormField label="Asset" required htmlFor="mr-asset" error={tried && !draft.assetId ? 'Choose the machine.' : undefined} className="sm:col-span-2">
          <AssetPicker id="mr-asset" value={draft.assetId || null} invalid={tried && !draft.assetId} onChange={(v) => set({ assetId: v ?? '' })} />
        </FormField>
        <FormField label="What is wrong?" required htmlFor="mr-title" error={tried && !draft.title.trim() ? 'Describe the problem in a few words.' : undefined} className="sm:col-span-2">
          <Input id="mr-title" value={draft.title} invalid={tried && !draft.title.trim()} placeholder="Spindle noise rougher than usual" onChange={(e) => set({ title: e.target.value })} />
        </FormField>
        <FormField label="Details" htmlFor="mr-desc" className="sm:col-span-2">
          <Textarea id="mr-desc" value={draft.description} placeholder="When it started, what you saw or heard" onChange={(e) => set({ description: e.target.value })} />
        </FormField>
        <FormField label="Severity" className="sm:col-span-2">
          <SegmentedControl
            aria-label="Severity"
            value={draft.severity}
            onChange={(v) => set({ severity: v as Severity })}
            options={SEVERITIES.map((s) => ({
              value: s,
              label: SEVERITY_LABEL[s],
              tone: s === 'critical' ? 'danger' : s === 'high' ? 'warning' : 'default',
            }))}
          />
        </FormField>
        <FormField label="Impact on production" className="sm:col-span-2">
          <SegmentedControl
            aria-label="Impact on production"
            value={draft.impact}
            onChange={(v) => set({ impact: v as OperationalImpact })}
            options={(['none', 'reduced', 'stopped'] as const).map((x) => ({ value: x, label: IMPACT_LABEL[x], tone: x === 'stopped' ? 'danger' : 'default' }))}
          />
        </FormField>
        <FormField label="Reported by" htmlFor="mr-by" hint="Change it when you log a call from the floor.">
          <PersonPicker id="mr-by" people={people} value={draft.reportedBy} onChange={(v) => set({ reportedBy: v ?? user.id })} />
        </FormField>
        <FormField label="Photos" className="sm:col-span-2">
          <PhotoInput photos={photos} onAdd={(urls) => setPhotos((p) => [...p, ...urls])} onRemove={(url) => setPhotos((p) => p.filter((x) => x !== url))} max={6} />
        </FormField>
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={() => onDone(null)}>
          Cancel
        </Button>
        <Button type="submit">Send request</Button>
      </DialogFooter>
    </form>
  )
}
