import { emptyPerson, fmtIdr, newId } from '@cmms/fixtures'
import type { Availability, Person, Shift } from '@cmms/types'
import { AVAILABILITY_LABEL, SHIFT_LABEL } from '@cmms/types'
import {
  Avatar,
  Button,
  Chip,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  FormField,
  Input,
  MultiCombobox,
  NativeSelect,
  SegmentedControl,
  cn,
} from '@cmms/ui'
import { Plus } from 'lucide-react'
import { type FormEvent, useState } from 'react'
import { TeamPicker } from '../../components/pickers'
import { useScoped } from '../../state/scoped'
import { AVAILABILITIES, AVATAR_COLORS } from './lib'

const SHIFTS: Shift[] = ['A', 'B', 'C', 'N']
const SHIFT_OPTIONS = SHIFTS.map((s) => ({ value: s, label: SHIFT_LABEL[s] }))
const AVAILABILITY_OPTIONS = AVAILABILITIES.map((a) => ({ value: a, label: AVAILABILITY_LABEL[a] }))
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function TechnicianDialog({
  open,
  onOpenChange,
  editing,
  onSaved,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  editing: Person | null
  onSaved: (person: Person, created: boolean) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        {open && (
          <TechnicianForm
            editing={editing}
            onDone={(person) => {
              onOpenChange(false)
              if (person) onSaved(person, !editing)
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

function TechnicianForm({
  editing,
  onDone,
}: {
  editing: Person | null
  onDone: (person: Person | null) => void
}) {
  const { siteId, site, state, teams, technicians, safetyItems, dispatch } = useScoped()
  const [base] = useState(
    () =>
      editing ?? {
        ...emptyPerson(siteId),
        color: AVATAR_COLORS[technicians.length % AVATAR_COLORS.length].value,
      },
  )
  const profile = base.technician
  const [draft, setDraft] = useState(() => ({
    name: base.name,
    title: base.title,
    email: base.email,
    phone: base.phone,
    color: base.color,
    teamId: profile?.teamId || (teams.length === 1 ? teams[0].id : null),
    shift: profile?.shift ?? 'A',
    hourlyCost: String(profile?.hourlyCost ?? 0),
    availability: profile?.availability ?? 'on_shift',
    authorizations: profile?.authorizations ?? [],
  }))
  const [tried, setTried] = useState(false)
  const set = (patch: Partial<typeof draft>) => setDraft((d) => ({ ...d, ...patch }))

  const name = draft.name.trim()
  const email = draft.email.trim()
  const cost = Number(draft.hourlyCost)
  const emailOwner = email
    ? state.people.find((p) => p.id !== base.id && p.email.toLowerCase() === email.toLowerCase())
    : undefined
  const errors = {
    name: name ? undefined : 'Enter the full name.',
    title: draft.title.trim() ? undefined : 'Enter a job title, such as Mechanical Technician.',
    email:
      email && !EMAIL.test(email)
        ? 'Enter an address such as budi@nusapresisi.co.id.'
        : emailOwner
          ? `${emailOwner.name} already uses this address.`
          : undefined,
    teamId: draft.teamId ? undefined : 'Pick the team this technician works in.',
    hourlyCost:
      draft.hourlyCost.trim() !== '' && Number.isFinite(cost) && cost >= 0
        ? undefined
        : 'Enter the hourly cost in rupiah.',
  }
  const show = (error: string | undefined) => (tried ? error : undefined)

  // Keep a colour from outside the palette selectable when editing.
  const colors = AVATAR_COLORS.some((c) => c.value.toLowerCase() === base.color.toLowerCase())
    ? AVATAR_COLORS
    : [{ value: base.color, label: 'Current colour' }, ...AVATAR_COLORS]
  // Permits from master data lead the list; a permit counts as held when its name matches, ignoring case.
  const held = (name: string) => draft.authorizations.some((a) => a.toLowerCase() === name.toLowerCase())
  const addPermit = (name: string) => {
    const permit = name.trim()
    if (permit && !held(permit)) set({ authorizations: [...draft.authorizations, permit] })
  }
  const masterPermits = safetyItems.filter((i) => i.kind === 'permit').map((i) => i.name)
  const permits = [
    ...new Set([...masterPermits, ...technicians.flatMap((t) => t.technician?.authorizations ?? []), ...draft.authorizations]),
  ]
  const suggested = masterPermits.filter((p) => !held(p))

  const submit = (e: FormEvent) => {
    e.preventDefault()
    setTried(true)
    if (!draft.teamId || Object.values(errors).some(Boolean)) return
    const person: Person = {
      ...base,
      id: editing?.id ?? newId('per'),
      name,
      title: draft.title.trim(),
      email,
      phone: draft.phone.trim(),
      color: draft.color,
      technician: {
        skills: profile?.skills ?? {},
        certifications: profile?.certifications ?? [],
        teamId: draft.teamId,
        shift: draft.shift,
        hourlyCost: cost,
        availability: draft.availability,
        authorizations: draft.authorizations,
      },
    }
    dispatch({ type: 'people/upsert', item: person })
    onDone(person)
  }

  return (
    <form onSubmit={submit} noValidate>
      <DialogHeader>
        <DialogTitle>{editing ? `Edit ${editing.name}` : 'Add technician'}</DialogTitle>
        <DialogDescription>
          Technicians show up in assignment pickers, the skill matrix and labor reports for {site.name}.
        </DialogDescription>
      </DialogHeader>

      <div className="gap-4 sm:grid-cols-2 grid grid-cols-1">
        <FormField label="Full name" required htmlFor="tech-name" error={show(errors.name)}>
          <Input
            id="tech-name"
            value={draft.name}
            placeholder="Budi Santoso"
            onChange={(e) => set({ name: e.target.value })}
          />
        </FormField>
        <FormField label="Job title" required htmlFor="tech-title" error={show(errors.title)}>
          <Input
            id="tech-title"
            value={draft.title}
            placeholder="Mechanical Technician"
            onChange={(e) => set({ title: e.target.value })}
          />
        </FormField>
        <FormField label="Email" htmlFor="tech-email" error={show(errors.email)}>
          <Input
            id="tech-email"
            type="email"
            value={draft.email}
            placeholder="name@nusapresisi.co.id"
            onChange={(e) => set({ email: e.target.value })}
          />
        </FormField>
        <FormField label="Phone" htmlFor="tech-phone" hint="Used for WhatsApp alerts.">
          <Input
            id="tech-phone"
            type="tel"
            value={draft.phone}
            placeholder="+62 812 3370 7210"
            onChange={(e) => set({ phone: e.target.value })}
          />
        </FormField>
        <FormField label="Team" required htmlFor="tech-team" error={show(errors.teamId)}>
          <TeamPicker id="tech-team" value={draft.teamId} onChange={(teamId) => set({ teamId })} />
        </FormField>
        <FormField label="Shift" htmlFor="tech-shift">
          <NativeSelect
            id="tech-shift"
            options={SHIFT_OPTIONS}
            value={draft.shift}
            onChange={(e) => set({ shift: e.target.value as Shift })}
          />
        </FormField>
        <FormField
          label="Hourly cost (Rp)"
          required
          htmlFor="tech-cost"
          error={show(errors.hourlyCost)}
          hint={
            errors.hourlyCost
              ? 'Wage plus overhead, used for labor cost.'
              : `${fmtIdr(cost)} per hour, used for labor cost.`
          }
        >
          <Input
            id="tech-cost"
            type="number"
            min={0}
            step={5000}
            value={draft.hourlyCost}
            onChange={(e) => set({ hourlyCost: e.target.value })}
          />
        </FormField>
        <FormField label="Availability" hint="On leave hides them from assignment pickers.">
          <SegmentedControl
            aria-label="Availability"
            options={AVAILABILITY_OPTIONS}
            value={draft.availability}
            onChange={(v) => set({ availability: v as Availability })}
            size="sm"
            className="w-full"
          />
        </FormField>
        <FormField
          label="Authorizations"
          htmlFor="tech-permits"
          hint="Work permits this person may sign for. Pick a permit from master data or type one that is missing."
          className="sm:col-span-2"
        >
          <MultiCombobox
            id="tech-permits"
            items={permits}
            values={draft.authorizations}
            onChange={(authorizations) => set({ authorizations })}
            getKey={(p) => p}
            getLabel={(p) => p}
            placeholder="Add work permits"
            searchPlaceholder="Search or type a permit"
            onCreate={addPermit}
            createLabel={(p) => `Add "${p}"`}
          />
          {suggested.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {suggested.map((p) => (
                <Chip key={p} icon={<Plus />} aria-label={`Add ${p}`} onClick={() => addPermit(p)}>
                  {p}
                </Chip>
              ))}
            </div>
          )}
        </FormField>
        <FormField label="Avatar colour" className="sm:col-span-2">
          <div className="gap-3 flex flex-wrap items-center">
            <Avatar name={name || 'New technician'} color={draft.color} size="lg" />
            <div role="group" aria-label="Avatar colour" className="gap-2 flex flex-wrap">
              {colors.map((c) => {
                const selected = draft.color.toLowerCase() === c.value.toLowerCase()
                return (
                  <button
                    key={c.value}
                    type="button"
                    aria-pressed={selected}
                    aria-label={c.label}
                    title={c.label}
                    onClick={() => set({ color: c.value })}
                    style={{ backgroundColor: c.value }}
                    className={cn(
                      'size-8 rounded-full ring-offset-2 ring-offset-card transition-transform focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:outline-none active:scale-95',
                      selected && 'ring-2 ring-ink',
                    )}
                  />
                )
              })}
            </div>
          </div>
        </FormField>
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={() => onDone(null)}>
          Cancel
        </Button>
        <Button type="submit">{editing ? 'Save changes' : 'Add technician'}</Button>
      </DialogFooter>
    </form>
  )
}
