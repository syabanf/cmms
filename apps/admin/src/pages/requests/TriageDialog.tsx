import { fmtDate } from '@cmms/fixtures'
import type { MaintenanceRequest } from '@cmms/types'
import { REQUEST_STATUS_LABEL } from '@cmms/types'
import { Combobox, ConfirmDialog, FormField, Textarea, toast } from '@cmms/ui'
import { useMemo, useState } from 'react'
import { useScoped } from '../../state/scoped'
import { newestFirst } from './lib'

export type TriageMode = 'monitor' | 'reject' | 'duplicate' | 'reopen'

interface ModeCopy {
  status: 'new' | 'monitor' | 'rejected' | 'duplicate'
  title: (code: string) => string
  description: string
  confirm: string
  noteLabel: string
  placeholder: string
  noteRequired: boolean
  destructive: boolean
  done: (code: string) => string
}

const MODES: Record<TriageMode, ModeCopy> = {
  monitor: {
    status: 'monitor',
    title: (code) => `Put ${code} on monitoring`,
    description: 'The request stays open without a work order. Note what to watch and when someone checks again.',
    confirm: 'Monitor',
    noteLabel: 'What to watch',
    placeholder: 'Recheck the noise at the weekly inspection on 29 Sep.',
    noteRequired: true,
    destructive: false,
    done: (code) => `${code} is on the monitoring list`,
  },
  reject: {
    status: 'rejected',
    title: (code) => `Reject ${code}?`,
    description: 'This closes the request without a work order. The reason stays on the request.',
    confirm: 'Reject request',
    noteLabel: 'Reason',
    placeholder: 'Normal operating noise. Explained to the operator.',
    noteRequired: true,
    destructive: true,
    done: (code) => `${code} rejected`,
  },
  duplicate: {
    status: 'duplicate',
    title: (code) => `Mark ${code} as a duplicate`,
    description: 'Pick the request on the same asset that already covers this problem.',
    confirm: 'Mark as duplicate',
    noteLabel: 'Note',
    placeholder: 'Optional',
    noteRequired: false,
    destructive: false,
    done: (code) => `${code} marked as a duplicate`,
  },
  reopen: {
    status: 'new',
    title: (code) => `Reopen ${code}?`,
    description: 'It goes back to the triage queue as a new request.',
    confirm: 'Reopen',
    noteLabel: 'Note',
    placeholder: 'Why it needs another look (optional)',
    noteRequired: false,
    destructive: false,
    done: (code) => `${code} is back in the triage queue`,
  },
}

/** Collects the note (and the original request for duplicates) behind a triage decision. */
export function TriageDialog({ request, mode, onClose }: { request: MaintenanceRequest; mode: TriageMode; onClose: () => void }) {
  const { requests, maps, dispatch } = useScoped()
  const [note, setNote] = useState('')
  const [originalId, setOriginalId] = useState<string | null>(null)
  const copy = MODES[mode]
  const asset = maps.asset.get(request.assetId)

  const candidates = useMemo(
    () => requests.filter((r) => r.assetId === request.assetId && r.id !== request.id && r.status !== 'duplicate').sort(newestFirst),
    [requests, request.assetId, request.id],
  )

  const missing = (copy.noteRequired && !note.trim()) || (mode === 'duplicate' && !originalId)

  const confirm = () => {
    dispatch({
      type: 'requests/triage',
      id: request.id,
      status: copy.status,
      note: note.trim(),
      duplicateOfId: mode === 'duplicate' ? originalId : null,
    })
    const original = originalId ? maps.request.get(originalId) : undefined
    toast(copy.done(request.code), { tone: 'success', description: original ? `Linked to ${original.code}.` : undefined })
  }

  return (
    <ConfirmDialog
      open
      onOpenChange={(open) => !open && onClose()}
      title={copy.title(request.code)}
      description={copy.description}
      confirmLabel={copy.confirm}
      destructive={copy.destructive}
      confirmDisabled={missing}
      onConfirm={confirm}
    >
      <div className="space-y-4">
        {mode === 'duplicate' &&
          (candidates.length ? (
            <FormField label="Original request" required htmlFor="triage-original">
              <Combobox
                id="triage-original"
                items={candidates}
                value={originalId}
                onChange={setOriginalId}
                placeholder="Select the original request"
                searchPlaceholder="Search requests"
                getKey={(r) => r.id}
                getLabel={(r) => `${r.code} · ${r.title}`}
                getDescription={(r) => `${REQUEST_STATUS_LABEL[r.status]} · ${fmtDate(r.reportedAt)}`}
              />
            </FormField>
          ) : (
            <p className="rounded-2xl bg-surface-2 px-4 py-3 text-sm text-muted">
              No other request on {asset?.code ?? 'this asset'} to link to. Reject it or convert it instead.
            </p>
          ))}
        <FormField label={copy.noteLabel} required={copy.noteRequired} htmlFor="triage-note">
          <Textarea id="triage-note" value={note} placeholder={copy.placeholder} onChange={(e) => setNote(e.target.value)} />
        </FormField>
      </div>
    </ConfirmDialog>
  )
}
