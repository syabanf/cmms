import { fmtDateTime, fmtDuration, fmtIdrShort, plural, triggerText } from '@cmms/fixtures'
import type { JobPlan, JobPlanPart, SafetyKind, SafetyRequirement } from '@cmms/types'
import { ASSET_CATEGORY_LABEL, SKILL_LEVEL_LABEL, WO_TYPES, WO_TYPE_LABEL } from '@cmms/types'
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Combobox,
  EmptyState,
  FormField,
  Input,
  KeyValue,
  MultiCombobox,
  NativeSelect,
  SegmentedControl,
  Switch,
  Textarea,
  cn,
} from '@cmms/ui'
import { ChevronRight, Package, Plus, Trash2, X } from 'lucide-react'
import { type ReactNode, useMemo } from 'react'
import { Link } from 'react-router'
import { AssetIcon } from '../../components/icons'
import { paths } from '../../components/links'
import { PartPicker } from '../../components/pickers'
import { useScoped } from '../../state/scoped'
import { inputNumber, readNumber } from '../pm/lib'
import { type PlanField, listText } from './lib'

type Patch = (patch: Partial<JobPlan>) => void

interface SectionProps {
  plan: JobPlan
  set: Patch
  readOnly: boolean
}

const LEVELS = [1, 2, 3] as const

export function DetailsCard({ plan, set, errors, code }: { plan: JobPlan; set: Patch; errors: Partial<Record<PlanField, string>>; code: ReactNode }) {
  const { assetTypes, skills, technicians } = useScoped()
  const qualified = (skillId: string) => technicians.filter((p) => (p.technician?.skills[skillId] ?? 0) >= plan.skillLevel).length
  const duration = Number.isFinite(plan.durationMin) && plan.durationMin > 0 ? fmtDuration(plan.durationMin) : undefined

  return (
    <Card>
      <CardHeader>
        <CardTitle>Plan details</CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {code}
        <FormField label="Work type" htmlFor="jp-type">
          <NativeSelect
            id="jp-type"
            value={plan.woType}
            options={WO_TYPES.map((t) => ({ value: t, label: WO_TYPE_LABEL[t] }))}
            onChange={(e) => {
              const woType = WO_TYPES.find((t) => t === e.target.value)
              if (woType) set({ woType })
            }}
          />
        </FormField>
        <FormField label="Name" required htmlFor="jp-name" error={errors.name} className="sm:col-span-2">
          <Input id="jp-name" value={plan.name} placeholder="Motor Inspection" onChange={(e) => set({ name: e.target.value })} />
        </FormField>
        <FormField label="Description" htmlFor="jp-description" className="sm:col-span-2">
          <Textarea
            id="jp-description"
            className="min-h-20"
            value={plan.description}
            placeholder="When the job runs and what it protects against"
            onChange={(e) => set({ description: e.target.value })}
          />
        </FormField>
        <FormField label="Asset types" htmlFor="jp-asset-types" hint="The PM schedule form suggests this plan for assets of these types." className="sm:col-span-2">
          <MultiCombobox
            id="jp-asset-types"
            items={assetTypes}
            values={plan.assetTypeIds}
            placeholder="Choose asset types"
            searchPlaceholder="Search asset types"
            getKey={(t) => t.id}
            getLabel={(t) => t.name}
            getDescription={(t) => ASSET_CATEGORY_LABEL[t.category]}
            renderIcon={(t) => <AssetIcon icon={t.icon} />}
            onChange={(assetTypeIds) => set({ assetTypeIds })}
          />
        </FormField>
        <FormField label="Estimated duration" required htmlFor="jp-duration" error={errors.durationMin} hint={duration}>
          <Input
            id="jp-duration"
            type="number"
            min={5}
            step={5}
            value={inputNumber(plan.durationMin)}
            rightSlot={<span className="text-xs font-medium">min</span>}
            onChange={(e) => set({ durationMin: readNumber(e.target.value) })}
          />
        </FormField>
        <FormField label="Personnel" required htmlFor="jp-personnel" error={errors.personnel}>
          <Input
            id="jp-personnel"
            type="number"
            min={1}
            max={10}
            value={inputNumber(plan.personnel)}
            rightSlot={<span className="text-xs font-medium">{plan.personnel === 1 ? 'person' : 'people'}</span>}
            onChange={(e) => set({ personnel: readNumber(e.target.value) })}
          />
        </FormField>
        <FormField label="Skill" required htmlFor="jp-skill" error={errors.skill}>
          <Combobox
            id="jp-skill"
            items={skills}
            value={plan.skillId || null}
            placeholder="Choose skill"
            searchPlaceholder="Search skills"
            getKey={(k) => k.id}
            getLabel={(k) => k.name}
            getDescription={(k) => `${plural(qualified(k.id), 'technician')} here at L${plan.skillLevel} or above`}
            onChange={(skillId) => set({ skillId: skillId ?? '' })}
          />
        </FormField>
        <FormField
          label="Minimum level"
          hint={`${SKILL_LEVEL_LABEL[plan.skillLevel]}${plan.skillId ? ` · ${plural(qualified(plan.skillId), 'technician')} qualified here` : ''}`}
        >
          <SegmentedControl
            aria-label="Minimum skill level"
            className="w-full"
            value={String(plan.skillLevel)}
            options={LEVELS.map((level) => ({ value: String(level), label: `L${level}` }))}
            onChange={(value) => {
              const skillLevel = LEVELS.find((level) => String(level) === value)
              if (skillLevel) set({ skillLevel })
            }}
          />
        </FormField>
      </CardContent>
    </Card>
  )
}

export function StatusCard({
  plan,
  set,
  original,
  usedBy,
  readOnly,
  onDelete,
}: SectionProps & { original: JobPlan | null; usedBy: string[]; onDelete: () => void }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Status</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <label className="flex items-center justify-between gap-3 rounded-2xl bg-surface px-4 py-3">
          <span className="min-w-0">
            <span className="block text-sm font-medium">Active</span>
            <span className="block text-xs text-muted">Inactive plans drop out of the job plan pickers.</span>
          </span>
          <Switch checked={plan.active} aria-label="Active" onCheckedChange={(active) => set({ active })} />
        </label>
        <KeyValue
          bare
          items={[
            { label: 'Revision', value: original ? `Rev ${original.revision}` : 'Not saved yet' },
            { label: 'Last saved', value: original ? fmtDateTime(original.updatedAt) : '', hidden: !original },
            { label: 'Checklist', value: plural(plan.tasks.length, 'line') },
          ]}
        />
        {original && !readOnly && usedBy.length > 0 && (
          <p className="text-xs text-muted">
            {listText(usedBy)} {usedBy.length === 1 ? 'uses' : 'use'} this plan, so it can't be deleted. Move {usedBy.length === 1 ? 'it' : 'them'} to another
            plan first.
          </p>
        )}
        {original && !readOnly && usedBy.length === 0 && (
          <Button variant="link" className="h-auto px-0" onClick={onDelete}>
            <Trash2 />
            Delete job plan
          </Button>
        )}
      </CardContent>
    </Card>
  )
}

export function UsedByCard({ plan, canSchedule }: { plan: JobPlan | null; canSchedule: boolean }) {
  const { pmSchedules, state, maps } = useScoped()
  if (!plan) return null
  const here = pmSchedules.filter((p) => p.jobPlanId === plan.id)
  const elsewhere = state.pmSchedules.filter((p) => p.jobPlanId === plan.id).length - here.length
  return (
    <Card>
      <CardHeader>
        <CardTitle>Used by</CardTitle>
        <CardDescription>{here.length ? `${plural(here.length, 'PM schedule')} at this site` : 'No PM schedule at this site uses it yet'}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {here.map((pm) => (
          <Link key={pm.id} to={paths.pm(pm.id)} className="flex items-center gap-3 rounded-2xl bg-surface-2 p-3 transition-colors hover:bg-surface">
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold">{pm.name}</span>
              <span className="block truncate text-xs text-muted">
                <span className="font-mono">{pm.code}</span> · {triggerText(pm, maps.meter)}
              </span>
            </span>
            <ChevronRight aria-hidden="true" className="size-4 shrink-0 text-muted" />
          </Link>
        ))}
        {elsewhere > 0 && <p className="text-xs text-muted">{plural(elsewhere, 'more schedule')} at other sites.</p>}
        {canSchedule && plan.active && (
          <Button asChild variant="outline" size="sm" className="w-full">
            <Link to={`/preventive/pm?new=1&plan=${plan.id}`}>
              <Plus />
              Schedule this plan
            </Link>
          </Button>
        )}
      </CardContent>
    </Card>
  )
}

export function PartsCard({ plan, set, readOnly, error }: SectionProps & { error?: string }) {
  const { maps } = useScoped()
  const cost = plan.parts.reduce((sum, p) => sum + (Number.isFinite(p.qty) ? p.qty : 0) * (maps.part.get(p.partId)?.unitCost ?? 0), 0)
  const update = (index: number, patch: Partial<JobPlanPart>) => set({ parts: plan.parts.map((p, i) => (i === index ? { ...p, ...patch } : p)) })
  const addButton = (
    <Button variant="outline" size="sm" onClick={() => set({ parts: [...plan.parts, { partId: '', qty: 1 }] })}>
      <Plus />
      Add part
    </Button>
  )

  return (
    <Card>
      <CardHeader action={readOnly ? undefined : addButton}>
        <CardTitle>Spare parts</CardTitle>
        <CardDescription>
          {plan.parts.some((p) => p.partId) ? `Reserved on every work order · ${fmtIdrShort(cost)} per job` : 'Parts each work order reserves from stock'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {error && <p className="text-sm text-danger">{error}</p>}
        {plan.parts.map((line, index) => {
          const part = maps.part.get(line.partId)
          return (
            <div key={index} className="flex items-center gap-2">
              <PartPicker className="min-w-0 flex-1" value={line.partId || null} onChange={(partId) => update(index, { partId: partId ?? '' })} />
              <Input
                className="w-28 shrink-0"
                type="number"
                min={1}
                aria-label="Quantity"
                value={inputNumber(line.qty)}
                rightSlot={part ? <span className="text-xs font-medium">{part.unit}</span> : undefined}
                onChange={(e) => update(index, { qty: readNumber(e.target.value) })}
              />
              {!readOnly && (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="shrink-0 text-accent"
                  aria-label={`Remove ${part?.code ?? 'part'}`}
                  onClick={() => set({ parts: plan.parts.filter((_, i) => i !== index) })}
                >
                  <Trash2 />
                </Button>
              )}
            </div>
          )
        })}
        {!plan.parts.length && (
          <EmptyState
            compact
            icon={<Package />}
            title="No parts"
            description="Add the parts this job uses, so each work order reserves them."
            action={readOnly ? undefined : addButton}
          />
        )}
      </CardContent>
    </Card>
  )
}

export function ToolsCard({ plan, set, readOnly }: SectionProps) {
  const { tools } = useScoped()
  const stock = useMemo(() => {
    const byCategory = new Map<string, { total: number; free: number }>()
    for (const tool of tools) {
      const entry = byCategory.get(tool.category) ?? { total: 0, free: 0 }
      entry.total++
      if (tool.status === 'available') entry.free++
      byCategory.set(tool.category, entry)
    }
    return byCategory
  }, [tools])
  const options = [...stock.keys()].filter((c) => !plan.toolCategories.includes(c)).sort()
  const add = (category: string) => {
    const name = category.trim()
    if (name && !plan.toolCategories.some((c) => c.toLowerCase() === name.toLowerCase())) set({ toolCategories: [...plan.toolCategories, name] })
  }
  const availability = (category: string) => {
    const s = stock.get(category)
    return s ? `${s.free} of ${s.total} free at this site` : 'None at this site'
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Tools</CardTitle>
        <CardDescription>Tool types to bring. The work order checks out the actual instruments.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {plan.toolCategories.length ? (
          <div className="flex flex-wrap gap-2">
            {plan.toolCategories.map((category) => (
              <span
                key={category}
                title={availability(category)}
                className={cn('inline-flex h-8 items-center gap-1.5 rounded-full bg-surface pl-3 text-xs font-semibold', readOnly ? 'pr-3' : 'pr-1')}
              >
                {category}
                {!readOnly && (
                  <button
                    type="button"
                    aria-label={`Remove ${category}`}
                    onClick={() => set({ toolCategories: plan.toolCategories.filter((c) => c !== category) })}
                    className="flex size-6 items-center justify-center rounded-full text-muted transition-colors hover:bg-black/5 hover:text-foreground"
                  >
                    <X aria-hidden="true" className="size-3.5" />
                  </button>
                )}
              </span>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted">No tools listed.</p>
        )}
        {!readOnly && (
          <Combobox
            aria-label="Add a tool type"
            items={options}
            value={null}
            placeholder="Add a tool type"
            searchPlaceholder="Search or type a new tool type"
            getKey={(c) => c}
            getLabel={(c) => c}
            getDescription={availability}
            onChange={(c) => c && add(c)}
            onCreate={add}
            createLabel={(q) => `Add "${q}" as a new tool type`}
          />
        )}
      </CardContent>
    </Card>
  )
}

export function SafetyCard({ plan, set }: SectionProps) {
  const { safetyItems } = useScoped()
  const safety = plan.safety
  const patch = (p: Partial<SafetyRequirement>) => set({ safety: { ...safety, ...p } })
  const itemsOf = (kind: SafetyKind) => safetyItems.filter((i) => i.kind === kind)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Safety</CardTitle>
        <CardDescription>The technician confirms these before work starts.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <label className="flex items-center justify-between gap-3 rounded-2xl bg-surface px-4 py-3">
          <span className="min-w-0">
            <span className="block text-sm font-medium">LOTO required</span>
            <span className="block text-xs text-muted">Lock out and tag every energy source before work starts.</span>
          </span>
          <Switch checked={safety.loto} aria-label="LOTO required" onCheckedChange={(loto) => patch({ loto })} />
        </label>
        <FormField label="Hazards" htmlFor="jp-hazards">
          <MultiCombobox
            id="jp-hazards"
            items={itemsOf('hazard')}
            values={safety.hazardIds}
            placeholder="Choose hazards"
            searchPlaceholder="Search hazards"
            getKey={(i) => i.id}
            getLabel={(i) => i.name}
            onChange={(hazardIds) => patch({ hazardIds })}
          />
        </FormField>
        <FormField label="PPE" htmlFor="jp-ppe">
          <MultiCombobox
            id="jp-ppe"
            items={itemsOf('ppe')}
            values={safety.ppeIds}
            placeholder="Choose PPE"
            searchPlaceholder="Search PPE"
            getKey={(i) => i.id}
            getLabel={(i) => i.name}
            onChange={(ppeIds) => patch({ ppeIds })}
          />
        </FormField>
        <FormField label="Safety notes" htmlFor="jp-safety-notes">
          <Textarea
            id="jp-safety-notes"
            className="min-h-20"
            value={safety.notes}
            placeholder="Isolation points, permits, what to watch for"
            onChange={(e) => patch({ notes: e.target.value })}
          />
        </FormField>
      </CardContent>
    </Card>
  )
}

export function NotesCard({ plan, set }: SectionProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Acceptance and SOP</CardTitle>
        <CardDescription>How the technician knows the job is done right.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <FormField label="Acceptance criteria" htmlFor="jp-acceptance" hint="What must hold before the work order can close.">
          <Textarea
            id="jp-acceptance"
            className="min-h-24"
            value={plan.acceptance}
            placeholder="Temperature below 75 °C, vibration below 4.5 mm/s, no abnormal bearing noise."
            onChange={(e) => set({ acceptance: e.target.value })}
          />
        </FormField>
        <FormField label="SOP reference" htmlFor="jp-sop" hint="Document code and title of the procedure.">
          <Input id="jp-sop" value={plan.sop} placeholder="SOP-MNT-014 Motor condition check" onChange={(e) => set({ sop: e.target.value })} />
        </FormField>
      </CardContent>
    </Card>
  )
}
