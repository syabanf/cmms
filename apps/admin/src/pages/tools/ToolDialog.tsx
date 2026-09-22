import { addMonths, dayKey, emptyTool, fromDayKey, fromInput, newId, toDateInput } from '@cmms/fixtures'
import type { Tool, ToolCondition } from '@cmms/types'
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
  SegmentedControl,
  Switch,
  toast,
} from '@cmms/ui'
import { type FormEvent, useMemo, useState } from 'react'
import { VendorPicker } from '../../components/pickers'
import { useScoped } from '../../state/scoped'
import { CONDITION_OPTIONS, asCondition, distinct } from './lib'

interface Draft {
  code: string
  name: string
  category: string
  location: string
  serialNumber: string
  condition: ToolCondition
  calibrated: boolean
  intervalMonths: string
  lastAt: string
  due: string
  vendorId: string | null
}

const toDraft = (tool: Tool | null): Draft => ({
  code: tool?.code ?? '',
  name: tool?.name ?? '',
  category: tool?.category ?? '',
  location: tool?.location ?? '',
  serialNumber: tool?.serialNumber ?? '',
  condition: tool?.condition ?? 'good',
  calibrated: !!tool?.calibration,
  intervalMonths: String(tool?.calibration?.intervalMonths ?? 12),
  lastAt: tool?.calibration?.lastAt ? toDateInput(tool.calibration.lastAt) : '',
  due: tool?.calibration ? toDateInput(tool.calibration.due) : '',
  vendorId: tool?.calibration?.vendorId ?? null,
})

/** Next due follows the last calibration plus the interval whenever both are set. */
function withIntervalDue(draft: Draft): Draft {
  const months = Number(draft.intervalMonths)
  if (!draft.lastAt || !Number.isInteger(months) || months < 1) return draft
  return { ...draft, due: dayKey(addMonths(fromDayKey(draft.lastAt), months)) }
}

export function ToolDialog({
  open,
  onOpenChange,
  editing,
  onSaved,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  editing: Tool | null
  onSaved?: (tool: Tool) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <ToolForm
          editing={editing}
          onCancel={() => onOpenChange(false)}
          onSaved={(tool) => {
            onOpenChange(false)
            onSaved?.(tool)
          }}
        />
      </DialogContent>
    </Dialog>
  )
}

function ToolForm({ editing, onCancel, onSaved }: { editing: Tool | null; onCancel: () => void; onSaved: (tool: Tool) => void }) {
  const { tools, siteId, dispatch } = useScoped()
  const [draft, setDraft] = useState(() => toDraft(editing))
  const [tried, setTried] = useState(false)
  const set = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }))
  const setPlanDate = (patch: Pick<Partial<Draft>, 'lastAt' | 'intervalMonths'>) => setDraft((d) => withIntervalDue({ ...d, ...patch }))

  const categories = useMemo(() => distinct([...tools.map((t) => t.category), draft.category]), [tools, draft.category])
  const locations = useMemo(() => distinct([...tools.map((t) => t.location), draft.location]), [tools, draft.location])

  const code = draft.code.trim()
  const clash = tools.find((t) => t.id !== editing?.id && t.code.toLowerCase() === code.toLowerCase())
  const months = Number(draft.intervalMonths)
  const errors = {
    code: !code ? 'Enter the code on the tool label' : clash ? `${clash.code} already belongs to ${clash.name}` : null,
    name: draft.name.trim() ? null : 'Enter a name',
    category: draft.category.trim() ? null : 'Pick or add a category',
    interval: draft.calibrated && !(Number.isInteger(months) && months >= 1) ? 'Whole months, 1 or more' : null,
    due: !draft.calibrated
      ? null
      : !draft.due
        ? 'Set the next due date'
        : draft.lastAt && draft.due <= draft.lastAt
          ? 'Next due must fall after the last calibration'
          : null,
  }
  const shown = (error: string | null) => (tried ? error : null)

  const submit = (e: FormEvent) => {
    e.preventDefault()
    setTried(true)
    if (Object.values(errors).some(Boolean)) return
    const tool: Tool = {
      ...(editing ?? emptyTool(siteId)),
      id: editing?.id ?? newId('tool'),
      code,
      name: draft.name.trim(),
      category: draft.category.trim(),
      location: draft.location.trim(),
      serialNumber: draft.serialNumber.trim(),
      condition: draft.condition,
      calibration: draft.calibrated
        ? { intervalMonths: months, lastAt: draft.lastAt ? fromInput(draft.lastAt) : null, due: fromInput(draft.due), vendorId: draft.vendorId }
        : null,
    }
    dispatch({ type: 'tools/upsert', item: tool })
    toast(editing ? `${tool.code} updated` : `${tool.code} added to the register`, { tone: 'success', description: tool.name })
    onSaved(tool)
  }

  return (
    <form onSubmit={submit} noValidate>
      <DialogHeader>
        <DialogTitle>{editing ? `Edit ${editing.code}` : 'Add tool'}</DialogTitle>
        <DialogDescription>
          {editing ? 'Changes apply to the register right away.' : 'Register a tool so technicians can check it out on work orders.'}
        </DialogDescription>
      </DialogHeader>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FormField label="Code" required error={shown(errors.code)}>
          <Input value={draft.code} placeholder="TW-03" inputClassName="font-mono" onChange={(e) => set({ code: e.target.value })} />
        </FormField>
        <FormField label="Name" required error={shown(errors.name)}>
          <Input value={draft.name} placeholder="Torque Wrench 20-100 N·m" onChange={(e) => set({ name: e.target.value })} />
        </FormField>
        <FormField label="Category" required error={shown(errors.category)}>
          <Combobox
            items={categories}
            value={draft.category || null}
            onChange={(category) => set({ category: category ?? '' })}
            getKey={(c) => c}
            getLabel={(c) => c}
            placeholder="Select category"
            searchPlaceholder="Search or add a category"
            onCreate={(category) => set({ category })}
            createLabel={(q) => `Add "${q}" as a category`}
          />
        </FormField>
        <FormField label="Location">
          <Combobox
            items={locations}
            value={draft.location || null}
            onChange={(location) => set({ location: location ?? '' })}
            getKey={(l) => l}
            getLabel={(l) => l}
            clearable
            placeholder="Where it is kept"
            searchPlaceholder="Search or add a location"
            onCreate={(location) => set({ location })}
            createLabel={(q) => `Add "${q}"`}
          />
        </FormField>
        <FormField label="Serial number">
          <Input value={draft.serialNumber} inputClassName="font-mono" onChange={(e) => set({ serialNumber: e.target.value })} />
        </FormField>
        <FormField label="Condition">
          <SegmentedControl
            className="w-full"
            aria-label="Condition"
            value={draft.condition}
            onChange={(value) => set({ condition: asCondition(value) })}
            options={CONDITION_OPTIONS}
          />
        </FormField>

        <div className="flex items-center justify-between gap-3 rounded-2xl bg-surface px-4 py-3 sm:col-span-2">
          <div className="min-w-0">
            <p className="text-sm font-medium">Needs periodic calibration</p>
            <p className="text-xs text-muted">Once the due date passes, work orders cannot use the tool.</p>
          </div>
          <Switch checked={draft.calibrated} aria-label="Needs periodic calibration" onCheckedChange={(calibrated) => set({ calibrated })} />
        </div>

        {draft.calibrated && (
          <>
            <FormField label="Interval (months)" required error={shown(errors.interval)}>
              <Input
                type="number"
                min={1}
                step={1}
                inputMode="numeric"
                value={draft.intervalMonths}
                onChange={(e) => setPlanDate({ intervalMonths: e.target.value })}
              />
            </FormField>
            <FormField label="Vendor" hint="Leave empty when you calibrate in house.">
              <VendorPicker clearable placeholder="In house" value={draft.vendorId} onChange={(vendorId) => set({ vendorId })} />
            </FormField>
            <FormField label="Last calibrated" hint="Leave empty for a new tool.">
              <Input type="date" value={draft.lastAt} onChange={(e) => setPlanDate({ lastAt: e.target.value })} />
            </FormField>
            <FormField label="Next due" required hint="Follows the interval. Change it for an early recall." error={shown(errors.due)}>
              <Input type="date" value={draft.due} min={draft.lastAt || undefined} onChange={(e) => set({ due: e.target.value })} />
            </FormField>
          </>
        )}
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit">{editing ? 'Save changes' : 'Add tool'}</Button>
      </DialogFooter>
    </form>
  )
}
