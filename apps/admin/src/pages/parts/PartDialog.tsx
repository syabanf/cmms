import { emptyPart, newId } from '@cmms/fixtures'
import type { Part } from '@cmms/types'
import { PART_CATEGORY_LABEL } from '@cmms/types'
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
  Switch,
} from '@cmms/ui'
import { type FormEvent, useState } from 'react'
import { VendorPicker } from '../../components/pickers'
import { useScoped } from '../../state/scoped'
import { PART_CATEGORIES } from './lib'

export function PartDialog({
  open,
  onOpenChange,
  editing,
  onSaved,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  editing: Part | null
  onSaved: (part: Part) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        {open && (
          <PartForm
            editing={editing}
            onDone={(part) => {
              onOpenChange(false)
              if (part) onSaved(part)
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

/** Non-negative number from a number input; an empty field reads as 0. */
const toCount = (value: string) => Math.max(0, Number(value) || 0)

function PartForm({ editing, onDone }: { editing: Part | null; onDone: (part: Part | null) => void }) {
  const { parts, dispatch } = useScoped()
  const [draft, setDraft] = useState<Part>(() => editing ?? emptyPart())
  const [tried, setTried] = useState(false)
  const set = (patch: Partial<Part>) => setDraft((d) => ({ ...d, ...patch }))

  const code = draft.code.trim().toUpperCase()
  const duplicate = parts.find((p) => p.id !== editing?.id && p.code.toLowerCase() === code.toLowerCase())
  const errors = {
    code: !code ? 'Enter the part number.' : duplicate ? `${duplicate.name} already uses ${duplicate.code}.` : undefined,
    name: !draft.name.trim() ? 'Name the part.' : undefined,
    unit: !draft.unit.trim() ? 'Enter the stock unit, such as pcs or L.' : undefined,
    max: draft.max < draft.min ? 'Max must be at least the minimum.' : undefined,
    reorderQty: draft.reorderQty < 1 ? 'Order at least 1.' : undefined,
  }
  const show = (error: string | undefined) => (tried ? error : undefined)

  const submit = (e: FormEvent) => {
    e.preventDefault()
    setTried(true)
    if (Object.values(errors).some(Boolean)) return
    const part: Part = {
      ...draft,
      id: editing?.id ?? newId('part'),
      code,
      name: draft.name.trim(),
      unit: draft.unit.trim(),
      manufacturer: draft.manufacturer.trim(),
      spec: draft.spec.trim(),
    }
    dispatch({ type: 'parts/upsert', item: part })
    onDone(part)
  }

  return (
    <form onSubmit={submit} noValidate>
      <DialogHeader>
        <DialogTitle>{editing ? `Edit ${editing.code}` : 'New part'}</DialogTitle>
        <DialogDescription>
          {editing ? 'Changes apply to every site. Stock and ledger stay as they are.' : 'The part joins the catalog for every site. The first receipt creates its stock record.'}
        </DialogDescription>
      </DialogHeader>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FormField label="Part number" required htmlFor="part-code" error={show(errors.code)}>
          <Input id="part-code" value={draft.code} inputClassName="font-mono uppercase" placeholder="BRG-6206" autoComplete="off" onChange={(e) => set({ code: e.target.value })} />
        </FormField>
        <FormField label="Category" htmlFor="part-category">
          <Combobox
            id="part-category"
            items={PART_CATEGORIES}
            value={draft.category}
            onChange={(value) => {
              const category = PART_CATEGORIES.find((c) => c === value)
              if (category) set({ category })
            }}
            getKey={(c) => c}
            getLabel={(c) => PART_CATEGORY_LABEL[c]}
            placeholder="Select category"
            searchPlaceholder="Search categories"
          />
        </FormField>
        <FormField label="Name" required htmlFor="part-name" error={show(errors.name)} className="sm:col-span-2">
          <Input id="part-name" value={draft.name} placeholder="Bearing 6206-2RS" onChange={(e) => set({ name: e.target.value })} />
        </FormField>
        <FormField label="Manufacturer" htmlFor="part-maker">
          <Input id="part-maker" value={draft.manufacturer} placeholder="SKF" onChange={(e) => set({ manufacturer: e.target.value })} />
        </FormField>
        <FormField label="Specification" htmlFor="part-spec">
          <Input id="part-spec" value={draft.spec} placeholder="30 × 62 × 16 mm, sealed" onChange={(e) => set({ spec: e.target.value })} />
        </FormField>
        <FormField label="Unit" required htmlFor="part-unit" hint="pcs, set, kg, L" error={show(errors.unit)}>
          <Input id="part-unit" value={draft.unit} onChange={(e) => set({ unit: e.target.value })} />
        </FormField>
        <FormField label="Unit cost (Rp)" htmlFor="part-cost">
          <Input id="part-cost" type="number" min={0} step={1000} value={draft.unitCost} onChange={(e) => set({ unitCost: toCount(e.target.value) })} />
        </FormField>
        <FormField label="Minimum" htmlFor="part-min" hint="Reorder when available stock falls to this level.">
          <Input id="part-min" type="number" min={0} value={draft.min} onChange={(e) => set({ min: toCount(e.target.value) })} />
        </FormField>
        <FormField label="Maximum" htmlFor="part-max" error={show(errors.max)}>
          <Input id="part-max" type="number" min={0} value={draft.max} onChange={(e) => set({ max: toCount(e.target.value) })} />
        </FormField>
        <FormField label="Reorder quantity" htmlFor="part-reorder" hint="Smallest order the purchase list suggests." error={show(errors.reorderQty)}>
          <Input id="part-reorder" type="number" min={1} value={draft.reorderQty} onChange={(e) => set({ reorderQty: toCount(e.target.value) })} />
        </FormField>
        <FormField label="Lead time (days)" htmlFor="part-lead">
          <Input id="part-lead" type="number" min={0} value={draft.leadTimeDays} onChange={(e) => set({ leadTimeDays: toCount(e.target.value) })} />
        </FormField>
        <FormField label="Vendor" htmlFor="part-vendor" className="sm:col-span-2">
          <VendorPicker id="part-vendor" clearable value={draft.vendorId} onChange={(vendorId) => set({ vendorId })} />
        </FormField>
        <label className="flex items-center justify-between gap-3 rounded-2xl bg-surface px-4 py-3 sm:col-span-2">
          <span>
            <span className="block text-sm font-medium">Critical spare</span>
            <span className="block text-xs text-muted">Keep it in stock even when it is rarely used. A breakdown without it stops production.</span>
          </span>
          <Switch checked={draft.critical} onCheckedChange={(critical) => set({ critical })} aria-label="Critical spare" />
        </label>
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={() => onDone(null)}>
          Cancel
        </Button>
        <Button type="submit">{editing ? 'Save changes' : 'Add part'}</Button>
      </DialogFooter>
    </form>
  )
}
