import {
  applyJobPlan,
  approvalFor,
  dueFromSla,
  emptyWorkOrder,
  fmtDate,
  fmtIdrShort,
  failureEvents,
  fromInput,
  nowIso,
  nowMs,
  recentFailures,
  suggestPriority,
  toDateTimeInput,
  toMs,
} from '@cmms/fixtures'
import type { ExecutionType, Priority, WoType, WorkOrder } from '@cmms/types'
import { EXECUTION_LABEL, PRIORITIES, PRIORITY_HINT, WO_TYPES, WO_TYPE_LABEL } from '@cmms/types'
import {
  Banner,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  FormField,
  Input,
  NativeSelect,
  SegmentedControl,
  Switch,
  Textarea,
} from '@cmms/ui'
import { ShieldCheck, TriangleAlert } from 'lucide-react'
import { type FormEvent, useMemo, useState } from 'react'
import { useScoped } from '../state/scoped'
import { AssetPicker, JobPlanPicker, PeoplePicker, TeamPicker, VendorPicker } from './pickers'

export interface WoPreset {
  assetId?: string
  title?: string
  description?: string
  type?: WoType
  priority?: Priority
  jobPlanId?: string
  requestId?: string
  downtime?: boolean
  scheduledAt?: string
}

interface Draft {
  assetId: string | null
  title: string
  description: string
  type: WoType
  priority: Priority
  jobPlanId: string | null
  teamId: string | null
  assigneeIds: string[]
  dueAt: string
  scheduledAt: string
  estimatedMin: number
  execution: ExecutionType
  vendorId: string | null
  vendorCost: number
  downtime: boolean
}

export function WorkOrderDialog({
  open,
  onOpenChange,
  preset,
  editing,
  onSaved,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  preset?: WoPreset
  editing?: WorkOrder | null
  onSaved?: (wo: WorkOrder) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        {open && <WorkOrderForm preset={preset} editing={editing ?? null} onDone={(wo) => {
          onOpenChange(false)
          if (wo) onSaved?.(wo)
        }} />}
      </DialogContent>
    </Dialog>
  )
}

function WorkOrderForm({ preset, editing, onDone }: { preset?: WoPreset; editing: WorkOrder | null; onDone: (wo: WorkOrder | null) => void }) {
  const scoped = useScoped()
  const { maps, settings, dispatch, user, siteId, workOrders } = scoped
  const [tried, setTried] = useState(false)
  const [draft, setDraft] = useState<Draft>(() => {
    const now = nowIso()
    const asset = preset?.assetId ? maps.asset.get(preset.assetId) : undefined
    const priority = editing?.priority ?? preset?.priority ?? 'P3'
    return {
      assetId: editing?.assetId ?? preset?.assetId ?? null,
      title: editing?.title ?? preset?.title ?? '',
      description: editing?.description ?? preset?.description ?? '',
      type: editing?.type ?? preset?.type ?? 'corrective',
      priority,
      jobPlanId: editing?.jobPlanId ?? preset?.jobPlanId ?? null,
      teamId: editing?.teamId ?? asset?.teamId ?? null,
      assigneeIds: editing?.assigneeIds ?? [],
      dueAt: editing?.dueAt ?? dueFromSla(now, priority, settings),
      scheduledAt: editing?.scheduledAt ?? preset?.scheduledAt ?? '',
      estimatedMin: editing?.estimatedMin ?? 60,
      execution: editing?.execution ?? 'internal',
      vendorId: editing?.vendorId ?? null,
      vendorCost: editing?.vendorCost ?? 0,
      downtime: editing?.downtime ?? preset?.downtime ?? false,
    }
  })
  const set = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }))

  const asset = draft.assetId ? maps.asset.get(draft.assetId) : undefined
  const plan = draft.jobPlanId ? maps.jobPlan.get(draft.jobPlanId) : undefined
  const suggested = asset ? suggestPriority(draft.downtime ? 'critical' : 'medium', asset.criticality, draft.downtime ? 'stopped' : 'reduced') : null
  const warrantyActive = !!asset?.warranty && toMs(asset.warranty.end) > nowMs()
  const recent = useMemo(
    () => (asset ? recentFailures(asset.id, failureEvents(workOrders), settings.repeatWindowDays * 2) : []),
    [asset, workOrders, settings.repeatWindowDays],
  )

  const build = (): WorkOrder => {
    const now = nowIso()
    let wo: WorkOrder = {
      ...emptyWorkOrder(siteId, user.id, now, settings),
      assetId: draft.assetId!,
      title: draft.title.trim(),
      description: draft.description.trim(),
      type: draft.type,
      priority: draft.priority,
      requestId: preset?.requestId ?? null,
      teamId: draft.teamId ?? asset?.teamId ?? '',
      assigneeIds: draft.assigneeIds,
      dueAt: draft.dueAt,
      scheduledAt: draft.scheduledAt || null,
      estimatedMin: draft.estimatedMin,
      execution: draft.execution,
      vendorId: draft.execution === 'internal' ? null : draft.vendorId,
      vendorCost: draft.execution === 'internal' ? 0 : draft.vendorCost,
      downtime: draft.downtime,
    }
    if (plan) wo = { ...applyJobPlan(wo, plan, maps.part, scoped.warehouseIds[0] ?? ''), type: draft.type, estimatedMin: draft.estimatedMin }
    return wo
  }
  const preview = draft.assetId && draft.title.trim() && !editing ? approvalFor(build(), settings) : null

  const submit = (e: FormEvent) => {
    e.preventDefault()
    setTried(true)
    if (!draft.assetId || !draft.title.trim()) return
    if (editing) {
      dispatch({
        type: 'workOrders/update',
        id: editing.id,
        patch: {
          assetId: draft.assetId,
          title: draft.title.trim(),
          description: draft.description.trim(),
          type: draft.type,
          priority: draft.priority,
          teamId: draft.teamId ?? editing.teamId,
          dueAt: draft.dueAt,
          scheduledAt: draft.scheduledAt || null,
          estimatedMin: draft.estimatedMin,
          execution: draft.execution,
          vendorId: draft.execution === 'internal' ? null : draft.vendorId,
          vendorCost: draft.execution === 'internal' ? 0 : draft.vendorCost,
          downtime: draft.downtime,
        },
      })
      if (draft.assigneeIds.join() !== editing.assigneeIds.join()) {
        dispatch({ type: 'workOrders/assign', id: editing.id, assigneeIds: draft.assigneeIds })
      }
      onDone(editing)
      return
    }
    const wo = build()
    if (preset?.requestId) dispatch({ type: 'requests/convert', id: preset.requestId, workOrder: wo })
    else dispatch({ type: 'workOrders/create', item: wo })
    onDone(wo)
  }

  return (
    <form onSubmit={submit}>
      <DialogHeader>
        <DialogTitle>{editing ? `Edit ${editing.code}` : preset?.requestId ? 'Convert request to work order' : 'New work order'}</DialogTitle>
        <DialogDescription>
          {editing ? 'Changes are logged on the work order timeline.' : 'Pick the asset first. A job plan fills the checklist, parts, tools and safety steps.'}
        </DialogDescription>
      </DialogHeader>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FormField label="Asset" required htmlFor="wo-asset" error={tried && !draft.assetId ? 'Choose the asset this work is for.' : undefined} className="sm:col-span-2">
          <AssetPicker
            id="wo-asset"
            value={draft.assetId}
            invalid={tried && !draft.assetId}
            onChange={(assetId) => set({ assetId, teamId: assetId ? (maps.asset.get(assetId)?.teamId ?? null) : draft.teamId })}
          />
        </FormField>

        {asset && warrantyActive && (
          <Banner tone="info" icon={<ShieldCheck />} title="Covered by warranty" className="sm:col-span-2">
            {asset.name} is under warranty until {fmtDate(asset.warranty!.end)}
            {asset.warranty!.vendorId ? ` with ${maps.vendor.get(asset.warranty!.vendorId)?.name}` : ''}. Check before replacing parts.
          </Banner>
        )}
        {asset && recent.length >= 2 && (
          <Banner tone="warning" icon={<TriangleAlert />} title={`${recent.length} failures in the last ${settings.repeatWindowDays * 2} days`} className="sm:col-span-2">
            Most recent: {recent[0]!.wo.title} ({fmtDate(recent[0]!.wo.requestedAt)}). Consider an RCA.
          </Banner>
        )}

        <FormField label="Title" required htmlFor="wo-title" error={tried && !draft.title.trim() ? 'Give the work a short title.' : undefined} className="sm:col-span-2">
          <Input id="wo-title" value={draft.title} invalid={tried && !draft.title.trim()} placeholder="High vibration on spindle" onChange={(e) => set({ title: e.target.value })} />
        </FormField>

        <FormField label="Type" htmlFor="wo-type">
          <NativeSelect
            id="wo-type"
            value={draft.type}
            onChange={(e) => set({ type: e.target.value as WoType })}
            options={WO_TYPES.map((t) => ({ value: t, label: WO_TYPE_LABEL[t] }))}
          />
        </FormField>
        <FormField label="Job plan" hint="Optional. Fills checklist, parts and tools." htmlFor="wo-plan">
          <JobPlanPicker
            id="wo-plan"
            value={draft.jobPlanId}
            clearable
            assetTypeId={asset?.typeId}
            onChange={(jobPlanId) => {
              const p = jobPlanId ? maps.jobPlan.get(jobPlanId) : undefined
              set({ jobPlanId, ...(p ? { type: p.woType, estimatedMin: p.durationMin, title: draft.title || p.name } : {}) })
            }}
          />
        </FormField>

        <FormField
          label="Priority"
          hint={`${PRIORITY_HINT[draft.priority]}${suggested && suggested !== draft.priority ? `. Suggested ${suggested} from criticality ${asset?.criticality}.` : '.'}`}
          className="sm:col-span-2"
        >
          <SegmentedControl
            aria-label="Priority"
            value={draft.priority}
            onChange={(v) => {
              const priority = v as Priority
              set({ priority, dueAt: editing ? draft.dueAt : dueFromSla(nowIso(), priority, settings) })
            }}
            options={PRIORITIES.map((p) => ({ value: p, label: p, tone: p === 'P1' ? 'danger' : p === 'P2' ? 'warning' : 'default' }))}
          />
        </FormField>

        <FormField label="Description" htmlFor="wo-desc" className="sm:col-span-2">
          <Textarea id="wo-desc" value={draft.description} placeholder="What is wrong, where, and what was already tried" onChange={(e) => set({ description: e.target.value })} />
        </FormField>

        <FormField label="Team" htmlFor="wo-team">
          <TeamPicker id="wo-team" value={draft.teamId} onChange={(teamId) => set({ teamId })} />
        </FormField>
        <FormField label="Technicians" htmlFor="wo-people" hint={plan ? `Needs ${maps.skill.get(plan.skillId)?.name} L${plan.skillLevel}+` : undefined}>
          <PeoplePicker id="wo-people" values={draft.assigneeIds} skillId={plan?.skillId} onChange={(assigneeIds) => set({ assigneeIds })} />
        </FormField>

        <FormField label="Due" htmlFor="wo-due" hint={`SLA ${settings.slaHours[draft.priority]} h for ${draft.priority}`}>
          <Input id="wo-due" type="datetime-local" value={toDateTimeInput(draft.dueAt)} onChange={(e) => e.target.value && set({ dueAt: fromInput(e.target.value) })} />
        </FormField>
        <FormField label="Scheduled start" htmlFor="wo-sched" hint="Optional. Puts the work on the calendar.">
          <Input
            id="wo-sched"
            type="datetime-local"
            value={draft.scheduledAt ? toDateTimeInput(draft.scheduledAt) : ''}
            onChange={(e) => set({ scheduledAt: e.target.value ? fromInput(e.target.value) : '' })}
          />
        </FormField>

        <FormField label="Estimated duration (minutes)" htmlFor="wo-est">
          <Input id="wo-est" type="number" min={5} step={5} value={draft.estimatedMin} onChange={(e) => set({ estimatedMin: Math.max(5, Number(e.target.value) || 0) })} />
        </FormField>
        <FormField label="Execution" htmlFor="wo-exec">
          <NativeSelect
            id="wo-exec"
            value={draft.execution}
            onChange={(e) => set({ execution: e.target.value as ExecutionType })}
            options={(['internal', 'vendor', 'mixed'] as const).map((x) => ({ value: x, label: EXECUTION_LABEL[x] }))}
          />
        </FormField>

        {draft.execution !== 'internal' && (
          <>
            <FormField label="Vendor" htmlFor="wo-vendor">
              <VendorPicker id="wo-vendor" value={draft.vendorId} onChange={(vendorId) => set({ vendorId })} />
            </FormField>
            <FormField label="Vendor cost estimate (Rp)" htmlFor="wo-vcost">
              <Input id="wo-vcost" type="number" min={0} step={50000} value={draft.vendorCost} onChange={(e) => set({ vendorCost: Math.max(0, Number(e.target.value) || 0) })} />
            </FormField>
          </>
        )}

        <label className="flex items-center justify-between gap-3 rounded-2xl bg-surface px-4 py-3 sm:col-span-2">
          <span>
            <span className="block text-sm font-medium">Production stopped</span>
            <span className="block text-xs text-muted">Marks the asset as down until the work is completed.</span>
          </span>
          <Switch checked={draft.downtime} onCheckedChange={(downtime) => set({ downtime })} aria-label="Production stopped" />
        </label>

        {preview && (
          <Banner tone="warning" title={preview.level === 'manager' ? 'Needs manager approval' : 'Needs supervisor approval'} className="sm:col-span-2">
            {preview.reason} The work order stays in draft until someone approves it.
          </Banner>
        )}
        {plan && !editing && (
          <p className="text-xs text-muted sm:col-span-2">
            {plan.code} adds {plan.tasks.length} checklist lines, {plan.parts.length} reserved parts
            {plan.parts.length ? ` (${fmtIdrShort(plan.parts.reduce((s, p) => s + p.qty * (maps.part.get(p.partId)?.unitCost ?? 0), 0))})` : ''} and{' '}
            {plan.toolCategories.length} tool types.
          </p>
        )}
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={() => onDone(null)}>
          Cancel
        </Button>
        <Button type="submit">{editing ? 'Save changes' : 'Create work order'}</Button>
      </DialogFooter>
    </form>
  )
}
