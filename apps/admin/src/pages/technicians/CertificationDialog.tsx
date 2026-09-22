import { fromInput, newId, nowIso, toDateInput, toMs } from '@cmms/fixtures'
import type { Certification, Person } from '@cmms/types'
import {
  Button,
  Combobox,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  FormField,
  Input,
} from '@cmms/ui'
import { type FormEvent, useMemo, useState } from 'react'
import { useScoped } from '../../state/scoped'
import { CERT_WARNING_DAYS } from './lib'

export function CertificationDialog({
  open,
  onOpenChange,
  person,
  onSaved,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  person: Person
  onSaved: (cert: Certification) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        {open && (
          <CertificationForm
            person={person}
            onDone={(cert) => {
              onOpenChange(false)
              if (cert) onSaved(cert)
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

function CertificationForm({
  person,
  onDone,
}: {
  person: Person
  onDone: (cert: Certification | null) => void
}) {
  const { state, dispatch } = useScoped()
  const [draft, setDraft] = useState({ name: '', issuer: '', issuedAt: toDateInput(nowIso()), expiresAt: '' })
  const [tried, setTried] = useState(false)
  const set = (patch: Partial<typeof draft>) => setDraft((d) => ({ ...d, ...patch }))

  // Certificates other people hold, so the same course keeps one name and issuer.
  const issuerOf = useMemo(
    () =>
      new Map(state.people.flatMap((p) => p.technician?.certifications ?? []).map((c) => [c.name, c.issuer])),
    [state.people],
  )
  const names = [...new Set([...issuerOf.keys(), ...(draft.name ? [draft.name] : [])])].sort((a, b) =>
    a.localeCompare(b),
  )

  const name = draft.name.trim()
  const issuer = draft.issuer.trim()
  const errors = {
    name: name ? undefined : 'Pick a certificate or type its name.',
    issuer: issuer ? undefined : 'Enter who issued it, such as Kemnaker RI.',
    issuedAt: draft.issuedAt ? undefined : 'Enter the issue date.',
    expiresAt:
      draft.expiresAt && draft.issuedAt && toMs(fromInput(draft.expiresAt)) <= toMs(fromInput(draft.issuedAt))
        ? 'The certificate must expire after it was issued.'
        : undefined,
  }
  const show = (error: string | undefined) => (tried ? error : undefined)

  const submit = (e: FormEvent) => {
    e.preventDefault()
    setTried(true)
    const profile = person.technician
    if (!profile || Object.values(errors).some(Boolean)) return
    const cert: Certification = {
      id: newId('crt'),
      name,
      issuer,
      issuedAt: fromInput(draft.issuedAt),
      expiresAt: draft.expiresAt ? fromInput(draft.expiresAt) : null,
    }
    dispatch({
      type: 'people/upsert',
      item: { ...person, technician: { ...profile, certifications: [...profile.certifications, cert] } },
    })
    onDone(cert)
  }

  return (
    <form onSubmit={submit} noValidate>
      <DialogHeader>
        <DialogTitle>Add certificate</DialogTitle>
        <DialogDescription>
          The profile warns {CERT_WARNING_DAYS} days before a certificate expires.
        </DialogDescription>
      </DialogHeader>

      <div className="gap-4 sm:grid-cols-2 grid grid-cols-1">
        <FormField
          label="Certificate"
          required
          htmlFor="cert-name"
          error={show(errors.name)}
          className="sm:col-span-2"
        >
          <Combobox
            id="cert-name"
            items={names}
            value={draft.name || null}
            onChange={(value) =>
              set({ name: value ?? '', issuer: draft.issuer || (value ? (issuerOf.get(value) ?? '') : '') })
            }
            getKey={(n) => n}
            getLabel={(n) => n}
            getDescription={(n) => issuerOf.get(n)}
            placeholder="Pick or type a certificate"
            searchPlaceholder="Search or type a new name"
            onCreate={(value) => set({ name: value })}
            createLabel={(value) => `Use "${value}"`}
          />
        </FormField>
        <FormField
          label="Issuer"
          required
          htmlFor="cert-issuer"
          error={show(errors.issuer)}
          className="sm:col-span-2"
        >
          <Input
            id="cert-issuer"
            value={draft.issuer}
            placeholder="Kemnaker RI"
            onChange={(e) => set({ issuer: e.target.value })}
          />
        </FormField>
        <FormField label="Issued on" required htmlFor="cert-issued" error={show(errors.issuedAt)}>
          <Input
            id="cert-issued"
            type="date"
            value={draft.issuedAt}
            onChange={(e) => set({ issuedAt: e.target.value })}
          />
        </FormField>
        <FormField
          label="Expires on"
          htmlFor="cert-expires"
          error={show(errors.expiresAt)}
          hint="Leave empty when it does not expire."
        >
          <Input
            id="cert-expires"
            type="date"
            value={draft.expiresAt}
            onChange={(e) => set({ expiresAt: e.target.value })}
          />
        </FormField>
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={() => onDone(null)}>
          Cancel
        </Button>
        <Button type="submit">Add certificate</Button>
      </DialogFooter>
    </form>
  )
}
