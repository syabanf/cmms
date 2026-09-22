import { emptyVendor, fromInput, newId, nowIso, toDateInput, toMs } from '@cmms/fixtures'
import type { Vendor } from '@cmms/types'
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
  MultiCombobox,
  SegmentedControl,
} from '@cmms/ui'
import { type FormEvent, useState } from 'react'
import { useScoped } from '../../state/scoped'
import { serviceTypesOf } from './lib'

export function VendorDialog({
  open,
  onOpenChange,
  editing,
  onSaved,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  editing: Vendor | null
  onSaved: (vendor: Vendor) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        {open && (
          <VendorForm
            editing={editing}
            onDone={(vendor) => {
              onOpenChange(false)
              if (vendor) onSaved(vendor)
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const RATINGS = [1, 2, 3, 4, 5].map((n) => ({ value: String(n), label: String(n) }))

/** Non-negative number from a number input; an empty field reads as 0. */
const toAmount = (value: string) => Math.max(0, Number(value) || 0)

function VendorForm({ editing, onDone }: { editing: Vendor | null; onDone: (vendor: Vendor | null) => void }) {
  const { vendors, dispatch } = useScoped()
  const [draft, setDraft] = useState<Vendor>(() => editing ?? emptyVendor(nowIso()))
  const [tried, setTried] = useState(false)
  const set = (patch: Partial<Vendor>) => setDraft((d) => ({ ...d, ...patch }))

  const name = draft.name.trim()
  const email = draft.email.trim()
  const duplicate = vendors.find((v) => v.id !== editing?.id && v.name.trim().toLowerCase() === name.toLowerCase())
  const errors = {
    name: !name ? 'Enter the company name.' : duplicate ? `${duplicate.name} is already on the list.` : undefined,
    email: email && !EMAIL.test(email) ? 'Enter an address such as service@vendor.co.id.' : undefined,
    contractEnd: toMs(draft.contractEnd) < toMs(draft.contractStart) ? 'The contract must end after it starts.' : undefined,
  }
  const show = (error: string | undefined) => (tried ? error : undefined)
  const serviceTypes = serviceTypesOf([...vendors, draft])

  const submit = (e: FormEvent) => {
    e.preventDefault()
    setTried(true)
    if (Object.values(errors).some(Boolean)) return
    const vendor: Vendor = {
      ...draft,
      id: editing?.id ?? newId('ven'),
      name,
      email,
      pic: draft.pic.trim(),
      phone: draft.phone.trim(),
      contractNo: draft.contractNo.trim(),
    }
    dispatch({ type: 'vendors/upsert', item: vendor })
    onDone(vendor)
  }

  return (
    <form onSubmit={submit} noValidate>
      <DialogHeader>
        <DialogTitle>{editing ? `Edit ${editing.name}` : 'Add vendor'}</DialogTitle>
        <DialogDescription>Vendors are shared by every site. Work orders and parts pick them from this list.</DialogDescription>
      </DialogHeader>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FormField label="Company name" required htmlFor="ven-name" error={show(errors.name)} className="sm:col-span-2">
          <Input id="ven-name" value={draft.name} placeholder="PT Teknik Mandiri" onChange={(e) => set({ name: e.target.value })} />
        </FormField>
        <FormField label="Service types" htmlFor="ven-types" hint="Pick existing types so the filters stay tidy, or type a new one." className="sm:col-span-2">
          <MultiCombobox
            id="ven-types"
            items={serviceTypes}
            values={draft.serviceTypes}
            onChange={(values) => set({ serviceTypes: values })}
            getKey={(t) => t}
            getLabel={(t) => t}
            placeholder="Add service types"
            searchPlaceholder="Search or type a new type"
            onCreate={(type) => set({ serviceTypes: [...draft.serviceTypes, type] })}
            createLabel={(type) => `Add "${type}"`}
          />
        </FormField>
        <FormField label="PIC" htmlFor="ven-pic">
          <Input id="ven-pic" value={draft.pic} placeholder="Contact person" onChange={(e) => set({ pic: e.target.value })} />
        </FormField>
        <FormField label="Phone" htmlFor="ven-phone">
          <Input id="ven-phone" type="tel" value={draft.phone} placeholder="+62 22 7301 884" onChange={(e) => set({ phone: e.target.value })} />
        </FormField>
        <FormField label="Email" htmlFor="ven-email" error={show(errors.email)}>
          <Input id="ven-email" type="email" value={draft.email} placeholder="service@vendor.co.id" onChange={(e) => set({ email: e.target.value })} />
        </FormField>
        <FormField label="Contract number" htmlFor="ven-contract">
          <Input id="ven-contract" value={draft.contractNo} inputClassName="font-mono" placeholder="CTR-2026-021" onChange={(e) => set({ contractNo: e.target.value })} />
        </FormField>
        <FormField label="Contract start" htmlFor="ven-start">
          <Input id="ven-start" type="date" value={toDateInput(draft.contractStart)} onChange={(e) => e.target.value && set({ contractStart: fromInput(e.target.value) })} />
        </FormField>
        <FormField label="Contract end" htmlFor="ven-end" error={show(errors.contractEnd)}>
          <Input id="ven-end" type="date" value={toDateInput(draft.contractEnd)} onChange={(e) => e.target.value && set({ contractEnd: fromInput(e.target.value) })} />
        </FormField>
        <FormField label="SLA (hours)" htmlFor="ven-sla" hint="Time to respond on site after a call.">
          <Input id="ven-sla" type="number" min={0} value={draft.slaHours} onChange={(e) => set({ slaHours: toAmount(e.target.value) })} />
        </FormField>
        <FormField label="Hourly rate (Rp)" htmlFor="ven-rate" hint="0 for parts suppliers.">
          <Input id="ven-rate" type="number" min={0} step={25000} value={draft.hourlyRate} onChange={(e) => set({ hourlyRate: toAmount(e.target.value) })} />
        </FormField>
        <FormField
          label="Rating"
          hint={Number.isInteger(draft.rating) ? '1 is poor, 5 is excellent.' : `Current score ${draft.rating.toFixed(1)}. Picking a value replaces it.`}
          className="sm:col-span-2"
        >
          <SegmentedControl aria-label="Rating" options={RATINGS} value={String(Math.round(draft.rating))} onChange={(v) => set({ rating: Number(v) })} className="w-full sm:w-80" />
        </FormField>
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={() => onDone(null)}>
          Cancel
        </Button>
        <Button type="submit">{editing ? 'Save changes' : 'Add vendor'}</Button>
      </DialogFooter>
    </form>
  )
}
