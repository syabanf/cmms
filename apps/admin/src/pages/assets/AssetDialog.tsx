import {
  addMonths,
  criticalityFromScores,
  criticalityTotal,
  dayKey,
  emptyAsset,
  fromDayKey,
  fromInput,
  newId,
  nowIso,
  nowMs,
  subtreeIds,
  toDateInput,
} from '@cmms/fixtures'
import type { Asset, AssetSpec, AssetStatus, CriticalityScores } from '@cmms/types'
import { ASSET_STATUS_LABEL } from '@cmms/types'
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
  Kicker,
  NativeSelect,
  SegmentedControl,
  Switch,
  Textarea,
  toast,
} from '@cmms/ui'
import { Plus, X } from 'lucide-react'
import { type FormEvent, useCallback, useMemo, useState } from 'react'
import { CriticalityBadge } from '../../components/badges'
import {
  AssetPicker,
  AssetTypePicker,
  LocationPicker,
  TeamPicker,
  VendorPicker,
} from '../../components/pickers'
import { useScoped } from '../../state/scoped'
import { ASSET_STATUSES, CLASS_RULE, SCORE_FACTORS } from './lib'

type AssetPreset = Partial<Pick<Asset, 'parentId' | 'locationId' | 'teamId' | 'costCenterId'>>

const SCORE_OPTIONS = [1, 2, 3, 4, 5].map((n) => ({ value: String(n), label: String(n) }))

/** Date input values (YYYY-MM-DD) compare correctly as strings. */
const plusMonths = (day: string, months: number) => dayKey(addMonths(fromDayKey(day), months))

interface Draft {
  code: string
  name: string
  typeId: string | null
  status: AssetStatus
  locationId: string | null
  parentId: string | null
  manufacturer: string
  model: string
  serialNumber: string
  installedAt: string
  teamId: string | null
  costCenterId: string | null
  scores: CriticalityScores
  warrantyOn: boolean
  warrantyVendorId: string | null
  warrantyStart: string
  warrantyEnd: string
  warrantyTerms: string
  calibrationOn: boolean
  calInterval: number
  calLast: string
  calDue: string
  calVendorId: string | null
  specs: AssetSpec[]
  notes: string
}

function initialDraft(asset: Asset | null, preset: AssetPreset | undefined, siteId: string): Draft {
  const base: Asset = asset ?? { ...emptyAsset(siteId, nowIso()), ...preset }
  const installed = toDateInput(base.installedAt)
  return {
    code: base.code,
    name: base.name,
    typeId: base.typeId || null,
    status: base.status,
    locationId: base.locationId || null,
    parentId: base.parentId ?? null,
    manufacturer: base.manufacturer,
    model: base.model,
    serialNumber: base.serialNumber,
    installedAt: installed,
    teamId: base.teamId || null,
    costCenterId: base.costCenterId || null,
    scores: { ...base.scores },
    warrantyOn: !!base.warranty,
    warrantyVendorId: base.warranty?.vendorId ?? null,
    warrantyStart: base.warranty ? toDateInput(base.warranty.start) : installed,
    warrantyEnd: base.warranty ? toDateInput(base.warranty.end) : plusMonths(installed, 12),
    warrantyTerms: base.warranty?.terms ?? '',
    calibrationOn: !!base.calibration,
    calInterval: base.calibration?.intervalMonths ?? 12,
    calLast: base.calibration?.lastAt ? toDateInput(base.calibration.lastAt) : '',
    calDue: base.calibration ? toDateInput(base.calibration.due) : plusMonths(dayKey(nowMs()), 12),
    calVendorId: base.calibration?.vendorId ?? null,
    specs: base.specs.map((s) => ({ ...s })),
    notes: base.notes,
  }
}

/** Create or edit an asset. Pass `asset` to edit; `preset` fills a new one (for example a component's parent). */
export function AssetDialog({
  open,
  onOpenChange,
  asset = null,
  preset,
  onSaved,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  asset?: Asset | null
  preset?: AssetPreset
  onSaved?: (asset: Asset, created: boolean) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        {open && (
          <AssetForm
            asset={asset}
            preset={preset}
            onDone={(saved) => {
              onOpenChange(false)
              if (saved) onSaved?.(saved, !asset)
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

function AssetForm({
  asset,
  preset,
  onDone,
}: {
  asset: Asset | null
  preset?: AssetPreset
  onDone: (saved: Asset | null) => void
}) {
  const { siteId, assets, costCenters, maps, dispatch } = useScoped()
  const [draft, setDraft] = useState(() => initialDraft(asset, preset, siteId))
  const [tried, setTried] = useState(false)
  const set = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }))

  const type = draft.typeId ? maps.assetType.get(draft.typeId) : undefined
  const parentName = preset?.parentId ? maps.asset.get(preset.parentId)?.code : undefined
  const total = criticalityTotal(draft.scores)
  const criticality = criticalityFromScores(draft.scores)

  // A component cannot sit under itself or one of its own components.
  const blocked = useMemo(() => (asset ? subtreeIds(assets, asset.id) : new Set<string>()), [assets, asset])
  const parentFilter = useCallback((a: Asset) => !blocked.has(a.id), [blocked])

  const code = draft.code.trim()
  const name = draft.name.trim()
  const duplicate = code
    ? assets.find((a) => a.id !== asset?.id && a.code.toLowerCase() === code.toLowerCase())
    : undefined
  const errors = {
    code: !code
      ? 'Give the asset a code, for example POL-04.'
      : duplicate
        ? `${duplicate.name} already uses ${duplicate.code}.`
        : null,
    name: !name ? 'Name the asset.' : null,
    typeId: !draft.typeId ? 'Choose an asset type.' : null,
    locationId: !draft.locationId ? 'Choose where the asset is installed.' : null,
    teamId: !draft.teamId ? 'Choose the team that maintains it.' : null,
    installedAt: !draft.installedAt ? 'Enter the installation date.' : null,
    warranty:
      draft.warrantyOn &&
      (!draft.warrantyStart || !draft.warrantyEnd || draft.warrantyEnd <= draft.warrantyStart)
        ? 'The warranty has to end after it starts.'
        : null,
    calibration:
      draft.calibrationOn && (draft.calInterval < 1 || !draft.calDue)
        ? 'Set an interval of at least 1 month and a due date.'
        : null,
  }
  const show = (message: string | null) => (tried ? (message ?? undefined) : undefined)

  const submit = (e: FormEvent) => {
    e.preventDefault()
    setTried(true)
    const { typeId, locationId, teamId } = draft
    if (Object.values(errors).some(Boolean) || !typeId || !locationId || !teamId) return
    const item: Asset = {
      ...(asset ?? emptyAsset(siteId, nowIso())),
      id: asset?.id ?? newId('ast'),
      code,
      name,
      typeId,
      locationId,
      parentId: draft.parentId,
      manufacturer: draft.manufacturer.trim(),
      model: draft.model.trim(),
      serialNumber: draft.serialNumber.trim(),
      installedAt: fromInput(draft.installedAt),
      criticality,
      scores: draft.scores,
      teamId,
      costCenterId: draft.costCenterId ?? '',
      status: draft.status,
      warranty: draft.warrantyOn
        ? {
            vendorId: draft.warrantyVendorId,
            start: fromInput(draft.warrantyStart),
            end: fromInput(draft.warrantyEnd),
            terms: draft.warrantyTerms.trim(),
          }
        : null,
      calibration: draft.calibrationOn
        ? {
            intervalMonths: draft.calInterval,
            lastAt: draft.calLast ? fromInput(draft.calLast) : null,
            due: fromInput(draft.calDue),
            vendorId: draft.calVendorId,
          }
        : null,
      specs: draft.specs
        .map((s) => ({ label: s.label.trim(), value: s.value.trim() }))
        .filter((s) => s.label && s.value),
      notes: draft.notes.trim(),
    }
    dispatch({ type: 'assets/upsert', item })
    toast(asset ? `${item.code} updated` : `${item.code} added to the register`, {
      tone: 'success',
      description: item.name,
    })
    onDone(item)
  }

  const setScore = (key: keyof CriticalityScores, value: number) =>
    set({ scores: { ...draft.scores, [key]: value } })
  const setSpec = (index: number, patch: Partial<AssetSpec>) =>
    set({ specs: draft.specs.map((s, i) => (i === index ? { ...s, ...patch } : s)) })

  return (
    <form onSubmit={submit} noValidate>
      <DialogHeader>
        <DialogTitle>
          {asset ? `Edit ${asset.code}` : parentName ? `Add a component to ${parentName}` : 'New asset'}
        </DialogTitle>
        <DialogDescription>
          {asset
            ? 'Changes show on the passport and in every picker.'
            : 'Each asset keeps its own history, parts list and PM. Give a component its parent machine.'}
        </DialogDescription>
      </DialogHeader>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Kicker className="sm:col-span-2">Identity</Kicker>
        <FormField
          label="Code"
          required
          htmlFor="asset-code"
          hint="Printed on the QR label. Unique within the site."
          error={show(errors.code)}
        >
          <Input
            id="asset-code"
            value={draft.code}
            placeholder="POL-04"
            autoComplete="off"
            inputClassName="font-mono"
            onChange={(e) => set({ code: e.target.value.toUpperCase() })}
          />
        </FormField>
        <FormField label="Name" required htmlFor="asset-name" error={show(errors.name)}>
          <Input
            id="asset-name"
            value={draft.name}
            placeholder="Mesin Poles 04"
            onChange={(e) => set({ name: e.target.value })}
          />
        </FormField>
        <FormField label="Asset type" required htmlFor="asset-type" error={show(errors.typeId)}>
          <AssetTypePicker
            id="asset-type"
            value={draft.typeId}
            invalid={tried && !!errors.typeId}
            onChange={(typeId) => {
              const instrument = typeId ? maps.assetType.get(typeId)?.category === 'instrument' : false
              set({ typeId, ...(!asset && instrument ? { calibrationOn: true } : {}) })
            }}
          />
        </FormField>
        <FormField label="Status" htmlFor="asset-status">
          <NativeSelect
            id="asset-status"
            value={draft.status}
            onChange={(e) =>
              set({ status: ASSET_STATUSES.find((st) => st === e.target.value) ?? draft.status })
            }
            options={ASSET_STATUSES.map((s) => ({ value: s, label: ASSET_STATUS_LABEL[s] }))}
          />
        </FormField>

        <Kicker className="pt-2 sm:col-span-2">Placement</Kicker>
        <FormField label="Location" required htmlFor="asset-location" error={show(errors.locationId)}>
          <LocationPicker
            id="asset-location"
            value={draft.locationId}
            invalid={tried && !!errors.locationId}
            onChange={(locationId) => set({ locationId })}
          />
        </FormField>
        <FormField
          label="Parent asset"
          htmlFor="asset-parent"
          hint="Only for components, such as a motor inside a machine."
        >
          <AssetPicker
            id="asset-parent"
            value={draft.parentId}
            clearable
            placeholder="None, it is a machine"
            filter={parentFilter}
            onChange={(parentId) => {
              const parent = parentId ? maps.asset.get(parentId) : undefined
              set({
                parentId,
                ...(parent
                  ? {
                      locationId: draft.locationId ?? parent.locationId,
                      teamId: draft.teamId ?? parent.teamId,
                      costCenterId: draft.costCenterId ?? (parent.costCenterId || null),
                    }
                  : {}),
              })
            }}
          />
        </FormField>

        <Kicker className="pt-2 sm:col-span-2">Make and installation</Kicker>
        <FormField label="Manufacturer" htmlFor="asset-maker">
          <Input
            id="asset-maker"
            value={draft.manufacturer}
            placeholder="XYZ Machinery"
            onChange={(e) => set({ manufacturer: e.target.value })}
          />
        </FormField>
        <FormField label="Model" htmlFor="asset-model">
          <Input
            id="asset-model"
            value={draft.model}
            placeholder="P-750"
            onChange={(e) => set({ model: e.target.value })}
          />
        </FormField>
        <FormField label="Serial number" htmlFor="asset-serial">
          <Input
            id="asset-serial"
            value={draft.serialNumber}
            placeholder="SN92822"
            inputClassName="font-mono"
            onChange={(e) => set({ serialNumber: e.target.value })}
          />
        </FormField>
        <FormField label="Installed" required htmlFor="asset-installed" error={show(errors.installedAt)}>
          <Input
            id="asset-installed"
            type="date"
            value={draft.installedAt}
            onChange={(e) => set({ installedAt: e.target.value })}
          />
        </FormField>

        <Kicker className="pt-2 sm:col-span-2">Ownership</Kicker>
        <FormField label="Responsible team" required htmlFor="asset-team" error={show(errors.teamId)}>
          <TeamPicker
            id="asset-team"
            value={draft.teamId}
            invalid={tried && !!errors.teamId}
            onChange={(teamId) => set({ teamId })}
          />
        </FormField>
        <FormField label="Cost center" htmlFor="asset-cc">
          <Combobox
            id="asset-cc"
            items={costCenters}
            value={draft.costCenterId}
            clearable
            placeholder="Select cost center"
            searchPlaceholder="Search cost centers"
            getKey={(c) => c.id}
            getLabel={(c) => c.name}
            getDescription={(c) => c.code}
            onChange={(costCenterId) => set({ costCenterId })}
          />
        </FormField>

        <section className="rounded-2xl bg-surface-2 p-4 sm:col-span-2" aria-labelledby="asset-crit-title">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-[12rem] flex-1">
              <p id="asset-crit-title" className="text-sm font-semibold">
                Criticality
              </p>
              <p className="mt-0.5 text-xs text-muted">
                Score each factor from 1 (low) to 5 (high). {CLASS_RULE}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="flex items-start gap-0.5 leading-none">
                <span className="text-2xl font-bold tabular-nums">{total}</span>
                <span className="pt-0.5 text-xs font-semibold text-muted">/25</span>
              </span>
              <CriticalityBadge criticality={criticality} long />
            </div>
          </div>
          <div className="mt-4 space-y-3">
            {SCORE_FACTORS.map((factor) => (
              <div key={factor.key} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
                <div className="min-w-[10rem] flex-1">
                  <p className="text-sm font-medium">{factor.label}</p>
                  <p className="text-xs text-muted">{factor.hint}</p>
                </div>
                <SegmentedControl
                  size="sm"
                  aria-label={factor.label}
                  value={String(draft.scores[factor.key])}
                  onChange={(v) => setScore(factor.key, Number(v))}
                  options={SCORE_OPTIONS}
                  className="bg-card"
                />
              </div>
            ))}
          </div>
        </section>

        <div className="space-y-4 sm:col-span-2">
          <ToggleRow
            title="Under warranty"
            hint="Work orders on this asset show a warranty reminder while it runs."
            checked={draft.warrantyOn}
            onChange={(warrantyOn) => set({ warrantyOn })}
          />
          {draft.warrantyOn && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField label="Warranty vendor" htmlFor="asset-w-vendor" className="sm:col-span-2">
                <VendorPicker
                  id="asset-w-vendor"
                  value={draft.warrantyVendorId}
                  clearable
                  onChange={(warrantyVendorId) => set({ warrantyVendorId })}
                />
              </FormField>
              <FormField label="Starts" required htmlFor="asset-w-start">
                <Input
                  id="asset-w-start"
                  type="date"
                  value={draft.warrantyStart}
                  onChange={(e) => set({ warrantyStart: e.target.value })}
                />
              </FormField>
              <FormField label="Ends" required htmlFor="asset-w-end" error={show(errors.warranty)}>
                <Input
                  id="asset-w-end"
                  type="date"
                  value={draft.warrantyEnd}
                  onChange={(e) => set({ warrantyEnd: e.target.value })}
                />
              </FormField>
              <FormField label="Terms" htmlFor="asset-w-terms" className="sm:col-span-2">
                <Textarea
                  id="asset-w-terms"
                  className="min-h-20"
                  value={draft.warrantyTerms}
                  placeholder="36 months parts and labour. Excludes wear parts."
                  onChange={(e) => set({ warrantyTerms: e.target.value })}
                />
              </FormField>
            </div>
          )}
        </div>

        {(type?.category === 'instrument' || draft.calibrationOn) && (
          <div className="space-y-4 sm:col-span-2">
            <ToggleRow
              title="Calibration plan"
              hint="Instruments stay valid until the due date. The calibration schedule tracks them."
              checked={draft.calibrationOn}
              onChange={(calibrationOn) => set({ calibrationOn })}
            />
            {draft.calibrationOn && (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <FormField
                  label="Interval (months)"
                  required
                  htmlFor="asset-c-interval"
                  error={show(errors.calibration)}
                >
                  <Input
                    id="asset-c-interval"
                    type="number"
                    min={1}
                    max={60}
                    value={draft.calInterval}
                    onChange={(e) => {
                      const calInterval = Math.max(0, Math.round(Number(e.target.value) || 0))
                      set({
                        calInterval,
                        ...(draft.calLast && calInterval > 0
                          ? { calDue: plusMonths(draft.calLast, calInterval) }
                          : {}),
                      })
                    }}
                  />
                </FormField>
                <FormField label="Calibration vendor" htmlFor="asset-c-vendor">
                  <VendorPicker
                    id="asset-c-vendor"
                    value={draft.calVendorId}
                    clearable
                    onChange={(calVendorId) => set({ calVendorId })}
                  />
                </FormField>
                <FormField
                  label="Last calibrated"
                  htmlFor="asset-c-last"
                  hint="Optional. Sets the due date from the interval."
                >
                  <Input
                    id="asset-c-last"
                    type="date"
                    value={draft.calLast}
                    onChange={(e) => {
                      const calLast = e.target.value
                      set({
                        calLast,
                        ...(calLast && draft.calInterval > 0
                          ? { calDue: plusMonths(calLast, draft.calInterval) }
                          : {}),
                      })
                    }}
                  />
                </FormField>
                <FormField label="Next due" required htmlFor="asset-c-due">
                  <Input
                    id="asset-c-due"
                    type="date"
                    value={draft.calDue}
                    onChange={(e) => set({ calDue: e.target.value })}
                  />
                </FormField>
              </div>
            )}
          </div>
        )}

        <div className="sm:col-span-2">
          <Kicker className="mb-2">Specifications</Kicker>
          <div className="space-y-2">
            {draft.specs.map((spec, index) => (
              <div key={index} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] gap-2">
                <Input
                  aria-label="Specification"
                  placeholder="Motor power"
                  value={spec.label}
                  onChange={(e) => setSpec(index, { label: e.target.value })}
                />
                <Input
                  aria-label="Value"
                  placeholder="7.5 kW"
                  value={spec.value}
                  onChange={(e) => setSpec(index, { value: e.target.value })}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={`Remove ${spec.label || 'specification'}`}
                  onClick={() => set({ specs: draft.specs.filter((_, i) => i !== index) })}
                >
                  <X />
                </Button>
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => set({ specs: [...draft.specs, { label: '', value: '' }] })}
            >
              <Plus />
              Add specification
            </Button>
          </div>
        </div>

        <FormField label="Notes" htmlFor="asset-notes" className="sm:col-span-2">
          <Textarea
            id="asset-notes"
            className="min-h-20"
            value={draft.notes}
            placeholder="Operating pattern, known quirks, access notes"
            onChange={(e) => set({ notes: e.target.value })}
          />
        </FormField>
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={() => onDone(null)}>
          Cancel
        </Button>
        <Button type="submit">{asset ? 'Save changes' : 'Add asset'}</Button>
      </DialogFooter>
    </form>
  )
}

function ToggleRow({
  title,
  hint,
  checked,
  onChange,
}: {
  title: string
  hint: string
  checked: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3 rounded-2xl bg-surface px-4 py-3">
      <span className="min-w-0">
        <span className="block text-sm font-medium">{title}</span>
        <span className="block text-xs text-muted">{hint}</span>
      </span>
      <Switch checked={checked} onCheckedChange={onChange} aria-label={title} />
    </label>
  )
}
