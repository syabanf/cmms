import {
  DAY,
  dayKey,
  emptyPm,
  fmtDate,
  fmtDateShort,
  fmtDuration,
  fmtNumber,
  fromInput,
  newId,
  nextPmCode,
  nowIso,
  plural,
  pmDue,
  toDateInput,
} from '@cmms/fixtures'
import type { IntervalUnit, Meter, PmSchedule, PmTrigger, PmTriggerKind } from '@cmms/types'
import { INTERVAL_UNIT_LABEL, METER_KIND_LABEL, PM_TRIGGER_LABEL } from '@cmms/types'
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
  NativeSelect,
  SegmentedControl,
  Switch,
  cn,
  toast,
} from '@cmms/ui'
import { type FormEvent, useMemo, useState } from 'react'
import { AssetPicker, JobPlanPicker, PersonPicker, TeamPicker } from '../../components/pickers'
import { useNow, useScoped } from '../../state/scoped'
import { PmStateBadge } from './badges'
import { dueRelative, inputNumber, meterLeftText, readNumber } from './lib'

const INTERVAL_UNITS: IntervalUnit[] = ['day', 'week', 'month', 'year']
const TRIGGER_KINDS: PmTriggerKind[] = ['calendar', 'meter', 'combined']
const TRIGGER_HINT: Record<PmTriggerKind, string> = {
  calendar: 'Due a fixed time after the last PM.',
  meter: 'Due once the meter advances by the interval.',
  combined: 'Whichever comes first: the date limit or the meter limit.',
}

interface Draft {
  assetId: string | null
  jobPlanId: string | null
  name: string
  /** Once the user types a name, asset and plan changes stop rewriting it. */
  nameTouched: boolean
  kind: PmTriggerKind
  every: number
  unit: IntervalUnit
  meterId: string | null
  meterEvery: number
  lastDone: string
  lastDoneMeter: number | null
  leadDays: number
  teamId: string | null
  assigneeId: string | null
  active: boolean
}

type Field = 'asset' | 'plan' | 'name' | 'every' | 'meter' | 'meterEvery' | 'lastDone' | 'lastDoneMeter' | 'leadDays' | 'team'

function toDraft(pm: PmSchedule): Draft {
  const t = pm.trigger
  return {
    assetId: pm.assetId || null,
    jobPlanId: pm.jobPlanId || null,
    name: pm.name,
    nameTouched: pm.name !== '',
    kind: t.kind,
    every: t.kind === 'meter' ? 1 : t.every,
    unit: t.kind === 'meter' ? 'month' : t.unit,
    meterId: t.kind === 'calendar' ? null : t.meterId,
    meterEvery: t.kind === 'meter' ? t.every : t.kind === 'combined' ? t.meterEvery : 500,
    lastDone: toDateInput(pm.lastDoneAt),
    lastDoneMeter: pm.lastDoneMeter,
    leadDays: pm.leadDays,
    teamId: pm.teamId || null,
    assigneeId: pm.assigneeId,
    active: pm.active,
  }
}

function toTrigger(d: Draft): PmTrigger | null {
  if (d.kind === 'calendar') return { kind: 'calendar', every: d.every, unit: d.unit }
  if (!d.meterId) return null
  if (d.kind === 'meter') return { kind: 'meter', meterId: d.meterId, every: d.meterEvery }
  return { kind: 'combined', every: d.every, unit: d.unit, meterId: d.meterId, meterEvery: d.meterEvery }
}

function validate(d: Draft, assetMeters: readonly Meter[]): Partial<Record<Field, string>> {
  const e: Partial<Record<Field, string>> = {}
  const usesDate = d.kind !== 'meter'
  const usesMeter = d.kind !== 'calendar'
  if (!d.assetId) e.asset = 'Choose the asset this schedule maintains.'
  if (!d.jobPlanId) e.plan = 'Choose the job plan each work order copies.'
  if (!d.name.trim()) e.name = 'Give the schedule a name.'
  if (usesDate && !(d.every >= 1)) e.every = 'Enter an interval of 1 or more.'
  if (usesMeter && !d.meterId) {
    e.meter = assetMeters.length ? 'Pick the meter that drives this schedule.' : 'This asset has no meter. Use a calendar trigger instead.'
  }
  if (usesMeter && !(d.meterEvery >= 1)) e.meterEvery = 'Enter an interval of 1 or more.'
  if (!d.lastDone) e.lastDone = 'Enter the date of the last PM.'
  if (usesMeter && (d.lastDoneMeter === null || !(d.lastDoneMeter >= 0))) e.lastDoneMeter = 'Enter the meter reading at the last PM.'
  if (!(d.leadDays >= 0)) e.leadDays = 'Use 0 or more days.'
  if (!d.teamId) e.team = 'Choose the team that owns the work.'
  return e
}

export function PmDialog({
  open,
  pm,
  presetPlanId = null,
  onClose,
}: {
  open: boolean
  /** null creates a new schedule. */
  pm: PmSchedule | null
  presetPlanId?: string | null
  onClose: () => void
}) {
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent size="lg">{open && <PmForm key={pm?.id ?? 'new'} pm={pm} presetPlanId={presetPlanId} onClose={onClose} />}</DialogContent>
    </Dialog>
  )
}

function PmForm({ pm, presetPlanId, onClose }: { pm: PmSchedule | null; presetPlanId: string | null; onClose: () => void }) {
  const { maps, state, siteId, meters, technicians, dispatch } = useScoped()
  const now = useNow(60_000)
  const [tried, setTried] = useState(false)

  const autoName = (assetId: string | null, planId: string | null) =>
    [assetId ? maps.asset.get(assetId)?.code : '', planId ? maps.jobPlan.get(planId)?.name : ''].filter(Boolean).join(' ')

  const [draft, setDraft] = useState<Draft>(() => {
    const base = toDraft(pm ?? emptyPm(siteId, nowIso()))
    if (pm || !presetPlanId || !maps.jobPlan.has(presetPlanId)) return base
    return { ...base, jobPlanId: presetPlanId, name: autoName(null, presetPlanId) }
  })
  const set = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }))

  const asset = draft.assetId ? maps.asset.get(draft.assetId) : undefined
  const plan = draft.jobPlanId ? maps.jobPlan.get(draft.jobPlanId) : undefined
  const meter = draft.meterId ? maps.meter.get(draft.meterId) : undefined
  const assetMeters = useMemo(() => meters.filter((m) => m.assetId === draft.assetId), [meters, draft.assetId])
  const teamPeople = useMemo(
    () => technicians.filter((p) => !draft.teamId || p.technician?.teamId === draft.teamId),
    [technicians, draft.teamId],
  )
  const errors = validate(draft, assetMeters)
  const err = (field: Field) => (tried ? errors[field] : undefined)
  const usesDate = draft.kind !== 'meter'
  const usesMeter = draft.kind !== 'calendar'
  const trigger = toTrigger(draft)
  // Keep the original time of day when the date is unchanged.
  const lastDoneAt = pm && toDateInput(pm.lastDoneAt) === draft.lastDone ? pm.lastDoneAt : draft.lastDone ? fromInput(draft.lastDone) : null
  const due =
    trigger && lastDoneAt
      ? pmDue(
          { ...(pm ?? emptyPm(siteId, lastDoneAt)), trigger, lastDoneAt, lastDoneMeter: usesMeter ? draft.lastDoneMeter : null, leadDays: draft.leadDays },
          maps.meter,
          now,
        )
      : null

  /** Point the draft at a meter; the last reading resets to that meter's current value. */
  const withMeter = (d: Draft, meterId: string | null): Draft =>
    meterId === d.meterId ? d : { ...d, meterId, lastDoneMeter: meterId ? (maps.meter.get(meterId)?.value ?? null) : null }

  const changeAsset = (assetId: string | null) =>
    setDraft((d) => {
      const own = meters.filter((m) => m.assetId === assetId)
      const meterId = own.some((m) => m.id === d.meterId) ? d.meterId : d.kind === 'calendar' ? null : (own[0]?.id ?? null)
      const teamId = (assetId ? maps.asset.get(assetId)?.teamId : undefined) ?? d.teamId
      return {
        ...withMeter(d, meterId),
        assetId,
        teamId,
        assigneeId: teamId === d.teamId ? d.assigneeId : null,
        name: d.nameTouched ? d.name : autoName(assetId, d.jobPlanId),
      }
    })

  const changeKind = (value: string) => {
    const kind = TRIGGER_KINDS.find((k) => k === value)
    if (!kind) return
    setDraft((d) => (kind === 'calendar' || d.meterId ? { ...d, kind } : withMeter({ ...d, kind }, assetMeters[0]?.id ?? null)))
  }

  const changeTeam = (teamId: string | null) =>
    setDraft((d) => {
      const keep = d.assigneeId !== null && technicians.some((p) => p.id === d.assigneeId && p.technician?.teamId === teamId)
      return { ...d, teamId, assigneeId: keep ? d.assigneeId : null }
    })

  const submit = (e: FormEvent) => {
    e.preventDefault()
    setTried(true)
    if (Object.keys(errors).length || !trigger || !lastDoneAt || !draft.assetId || !draft.jobPlanId || !draft.teamId) return
    const item: PmSchedule = {
      id: pm?.id ?? newId('pm'),
      code: pm?.code ?? nextPmCode(state.pmSchedules),
      name: draft.name.trim(),
      siteId: pm?.siteId ?? siteId,
      assetId: draft.assetId,
      jobPlanId: draft.jobPlanId,
      trigger,
      lastDoneAt,
      lastDoneMeter: usesMeter ? draft.lastDoneMeter : null,
      leadDays: draft.leadDays,
      teamId: draft.teamId,
      assigneeId: draft.assigneeId,
      active: draft.active,
    }
    dispatch({ type: 'pm/upsert', item })
    toast(pm ? `${item.code} saved` : `${item.code} created`, {
      tone: 'success',
      description: due ? `Next due ${fmtDate(due.dueAt)}.` : undefined,
    })
    onClose()
  }

  const skillName = plan ? (maps.skill.get(plan.skillId)?.name ?? 'Skill') : ''
  const assignee = draft.assigneeId ? maps.person.get(draft.assigneeId) : undefined
  const level = plan && assignee?.technician ? (assignee.technician.skills[plan.skillId] ?? 0) : null
  const assigneeHint =
    plan && assignee && level !== null && level < plan.skillLevel
      ? `${assignee.name} is ${level ? `${skillName} L${level}` : `not trained in ${skillName}`}. The plan asks for L${plan.skillLevel}+.`
      : plan
        ? `The plan asks for ${skillName} L${plan.skillLevel}+.`
        : undefined

  const unitSlot = meter ? <span className="text-xs font-medium">{meter.unit}</span> : undefined
  const dueDetail = due
    ? [
        dueRelative(due.daysLeft),
        meterLeftText(due, meter),
        draft.kind === 'combined' && due.dueBy === 'meter' && due.calendarDueAt !== null ? `date limit ${fmtDateShort(due.calendarDueAt)}` : null,
        draft.kind === 'combined' && due.dueBy === 'calendar' && due.meterDueValue !== null && meter
          ? `meter limit ${fmtNumber(due.meterDueValue)} ${meter.unit}`
          : null,
        draft.leadDays > 0 ? `work order from ${fmtDateShort(due.dueAt - draft.leadDays * DAY)}` : null,
      ]
        .filter(Boolean)
        .join(' · ')
    : ''

  return (
    <form onSubmit={submit} noValidate>
      <DialogHeader>
        <DialogTitle>{pm ? `${pm.code} ${pm.name}` : 'New PM schedule'}</DialogTitle>
        <DialogDescription>
          {pm
            ? 'Changes apply from the next work order this schedule generates.'
            : `Saves as ${nextPmCode(state.pmSchedules)}. Pair an asset with a job plan, then choose what triggers the work.`}
        </DialogDescription>
      </DialogHeader>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FormField label="Asset" required htmlFor="pm-asset" error={err('asset')} className="sm:col-span-2">
          <AssetPicker id="pm-asset" value={draft.assetId} invalid={!!err('asset')} onChange={changeAsset} />
        </FormField>
        <FormField
          label="Job plan"
          required
          htmlFor="pm-plan"
          error={err('plan')}
          hint={plan ? `${fmtDuration(plan.durationMin)} · ${plural(plan.tasks.length, 'check')} · ${skillName} L${plan.skillLevel}+` : undefined}
          className="sm:col-span-2"
        >
          <JobPlanPicker
            id="pm-plan"
            value={draft.jobPlanId}
            assetTypeId={asset?.typeId}
            invalid={!!err('plan')}
            onChange={(jobPlanId) => setDraft((d) => ({ ...d, jobPlanId, name: d.nameTouched ? d.name : autoName(d.assetId, jobPlanId) }))}
          />
        </FormField>
        <FormField label="Name" required htmlFor="pm-name" error={err('name')} className="sm:col-span-2">
          <Input id="pm-name" value={draft.name} placeholder="POL-03 Polishing Machine Monthly PM" onChange={(e) => set({ name: e.target.value, nameTouched: true })} />
        </FormField>

        <FormField label="Trigger" hint={TRIGGER_HINT[draft.kind]} className="sm:col-span-2">
          <SegmentedControl
            aria-label="Trigger"
            className="w-full sm:w-auto"
            value={draft.kind}
            onChange={changeKind}
            options={TRIGGER_KINDS.map((k) => ({ value: k, label: PM_TRIGGER_LABEL[k] }))}
          />
        </FormField>

        {usesDate && (
          <>
            <FormField label={draft.kind === 'combined' ? 'Date limit, every' : 'Every'} required htmlFor="pm-every" error={err('every')}>
              <Input id="pm-every" type="number" min={1} step={1} value={inputNumber(draft.every)} onChange={(e) => set({ every: readNumber(e.target.value) })} />
            </FormField>
            <FormField label="Unit" htmlFor="pm-unit">
              <NativeSelect
                id="pm-unit"
                value={draft.unit}
                onChange={(e) => {
                  const unit = INTERVAL_UNITS.find((u) => u === e.target.value)
                  if (unit) set({ unit })
                }}
                options={INTERVAL_UNITS.map((u) => ({ value: u, label: INTERVAL_UNIT_LABEL[u] }))}
              />
            </FormField>
          </>
        )}
        {usesMeter && (
          <>
            <FormField label="Meter" required htmlFor="pm-meter" error={err('meter')}>
              <Combobox
                id="pm-meter"
                items={assetMeters}
                value={draft.meterId}
                invalid={!!err('meter')}
                disabled={!assetMeters.length}
                placeholder={!asset ? 'Pick the asset first' : assetMeters.length ? 'Select meter' : 'No meters on this asset'}
                searchPlaceholder="Search meters"
                getKey={(m) => m.id}
                getLabel={(m) => `${METER_KIND_LABEL[m.kind]} (${m.unit})`}
                getDescription={(m) => `${fmtNumber(m.value)} ${m.unit} now · ${fmtNumber(m.dailyRate, m.dailyRate < 10 ? 1 : 0)} ${m.unit} a day`}
                onChange={(meterId) => setDraft((d) => withMeter(d, meterId))}
              />
            </FormField>
            <FormField label={draft.kind === 'combined' ? 'Meter limit, every' : 'Every'} required htmlFor="pm-meter-every" error={err('meterEvery')}>
              <Input
                id="pm-meter-every"
                type="number"
                min={1}
                value={inputNumber(draft.meterEvery)}
                rightSlot={unitSlot}
                onChange={(e) => set({ meterEvery: readNumber(e.target.value) })}
              />
            </FormField>
          </>
        )}

        <FormField label="Last done" required htmlFor="pm-last" error={err('lastDone')}>
          <Input id="pm-last" type="date" max={dayKey(now)} value={draft.lastDone} onChange={(e) => set({ lastDone: e.target.value })} />
        </FormField>
        {usesMeter && (
          <FormField
            label="Meter at last PM"
            required
            htmlFor="pm-last-meter"
            error={err('lastDoneMeter')}
            hint={meter ? `Reads ${fmtNumber(meter.value)} ${meter.unit} now.` : undefined}
          >
            <Input
              id="pm-last-meter"
              type="number"
              min={0}
              value={draft.lastDoneMeter ?? ''}
              rightSlot={unitSlot}
              onChange={(e) => set({ lastDoneMeter: e.target.value === '' ? null : Number(e.target.value) })}
            />
          </FormField>
        )}
        <FormField label="Lead time" htmlFor="pm-lead" error={err('leadDays')} hint="Days before the due date to generate the work order.">
          <Input
            id="pm-lead"
            type="number"
            min={0}
            value={inputNumber(draft.leadDays)}
            rightSlot={<span className="text-xs font-medium">days</span>}
            onChange={(e) => set({ leadDays: readNumber(e.target.value) })}
          />
        </FormField>
        <FormField label="Team" required htmlFor="pm-team" error={err('team')}>
          <TeamPicker id="pm-team" value={draft.teamId} invalid={!!err('team')} onChange={changeTeam} />
        </FormField>
        <FormField label="Default assignee" htmlFor="pm-assignee" hint={assigneeHint}>
          <PersonPicker id="pm-assignee" clearable people={teamPeople} placeholder="Leave unassigned" value={draft.assigneeId} onChange={(assigneeId) => set({ assigneeId })} />
        </FormField>
        <FormField label="Status" className={usesMeter ? undefined : 'sm:col-span-2'}>
          <label className="flex h-11 items-center justify-between gap-3 rounded-2xl bg-surface px-4 text-sm">
            <span className="truncate">{draft.active ? 'Active, generates work when due' : 'Paused'}</span>
            <Switch checked={draft.active} onCheckedChange={(active) => set({ active })} aria-label="Active" />
          </label>
        </FormField>

        {due && (
          <div className="rounded-2xl bg-surface px-4 py-3 sm:col-span-2" aria-live="polite">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-semibold">
                Next due {fmtDate(due.dueAt)}{' '}
                {due.dueBy === 'meter' && meter && due.meterDueValue !== null ? `by meter (${fmtNumber(due.meterDueValue)} ${meter.unit})` : 'by date'}
              </p>
              <PmStateBadge state={due.state} />
            </div>
            <p className={cn('mt-0.5 text-xs', due.state === 'overdue' ? 'text-accent' : 'text-muted')}>
              {dueDetail.charAt(0).toUpperCase() + dueDetail.slice(1)}
            </p>
          </div>
        )}
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit">{pm ? 'Save schedule' : 'Create schedule'}</Button>
      </DialogFooter>
    </form>
  )
}
