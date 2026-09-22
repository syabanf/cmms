import {
  estimatedCost,
  fmtIdr,
  fmtIdrShort,
  fmtNumber,
  isActive,
  plural,
  weeklyCapacity,
} from '@cmms/fixtures'
import type { ApprovalRule, Criticality } from '@cmms/types'
import { CRITICALITIES, CRITICALITY_LABEL, PRIORITIES, PRIORITY_HINT, PRIORITY_LABEL } from '@cmms/types'
import {
  Banner,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Chip,
  FormField,
  Input,
  Kicker,
  PageHeader,
  SegmentedControl,
  cn,
  toast,
} from '@cmms/ui'
import { ArrowRight, Lock, RotateCcw, Save } from 'lucide-react'
import { type ReactNode, useMemo, useState } from 'react'
import { useAuth } from '../../auth/auth'
import { PriorityBadge } from '../../components/badges'
import { useScoped } from '../../state/scoped'
import { type RulesDraft, rulesErrors, rulesPatch, toRulesDraft } from './lib'

const APPROVAL: Record<ApprovalRule, { option: string; outcome: string; className: string }> = {
  auto: { option: 'Auto', outcome: 'Auto allow', className: 'bg-success-soft text-success' },
  supervisor: { option: 'Supervisor', outcome: 'Supervisor approval', className: 'bg-info-soft text-info' },
  manager: { option: 'Manager', outcome: 'Manager approval', className: 'bg-ink text-on-ink' },
}
const APPROVAL_RULES: ApprovalRule[] = ['auto', 'supervisor', 'manager']
const APPROVAL_OPTIONS = APPROVAL_RULES.map((r) => ({ value: r, label: APPROVAL[r].option }))

const unit = (text: string) => <span className="pr-2 text-xs font-semibold">{text}</span>

/** Parsed number, or the fallback while the field does not hold a valid value. */
const numberOr = (value: string, valid: boolean, fallback: number) => (valid ? Number(value) : fallback)

function FlowRow({ from, rule }: { from: string; rule: ApprovalRule }) {
  return (
    <li className="gap-2 text-sm flex flex-wrap items-center">
      <span className="px-3 py-1.5 font-medium rounded-full bg-surface-2">{from}</span>
      <ArrowRight aria-hidden="true" className="size-4 shrink-0 text-muted" />
      <span className={cn('px-3 py-1.5 font-semibold rounded-full', APPROVAL[rule].className)}>
        {APPROVAL[rule].outcome}
      </span>
    </li>
  )
}

function Chain({ steps }: { steps: string[] }) {
  return (
    <ol className="mt-2 gap-2 text-sm flex flex-wrap items-center">
      {steps.map((step, i) => (
        <li key={step} className="gap-2 flex items-center">
          {i > 0 && <ArrowRight aria-hidden="true" className="size-4 shrink-0 text-muted" />}
          <span
            className={cn(
              'px-3 py-1.5 font-medium rounded-full',
              i === steps.length - 1 ? 'bg-ink text-on-ink' : 'bg-surface-2',
            )}
          >
            {step}
          </span>
        </li>
      ))}
    </ol>
  )
}

function RuleCard({
  title,
  description,
  className,
  children,
}: {
  title: string
  description: string
  className?: string
  children: ReactNode
}) {
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  )
}

export function RulesPage() {
  const { settings, technicians, assets, workOrders, site, dispatch } = useScoped()
  const { can } = useAuth()
  const canEdit = can('settings.manage')
  const saved = useMemo(() => toRulesDraft(settings), [settings])
  const [draft, setDraft] = useState(saved)
  const set = (patch: Partial<RulesDraft>) => setDraft((d) => ({ ...d, ...patch }))

  const errors = rulesErrors(draft)
  const invalid = Object.keys(errors).length > 0
  const dirty = JSON.stringify(draft) !== JSON.stringify(saved)

  const threshold = numberOr(
    draft.managerApprovalAbove,
    !errors.managerApprovalAbove,
    settings.managerApprovalAbove,
  )
  const wrenchTime = numberOr(draft.wrenchTimePct, !errors.wrenchTimePct, settings.wrenchTime * 100) / 100
  const weeklyHours = numberOr(draft.weeklyHours, !errors.weeklyHours, settings.weeklyHours)
  const capacity = weeklyCapacity(technicians, { ...settings, wrenchTime, weeklyHours })
  const rostered = technicians.filter((p) => p.technician?.availability !== 'leave').length
  const aboveThreshold = workOrders.filter((w) => isActive(w) && estimatedCost(w) > threshold).length
  const classAssets = (c: Criticality) => assets.filter((a) => a.criticality === c).length
  const verifiedAssets = draft.verifyCriticalities.reduce((sum, c) => sum + classAssets(c), 0)

  const toggleClass = (c: Criticality) => {
    const on = draft.verifyCriticalities.includes(c)
    set({
      verifyCriticalities: CRITICALITIES.filter((x) =>
        x === c ? !on : draft.verifyCriticalities.includes(x),
      ),
    })
  }
  const save = () => {
    dispatch({ type: 'settings/update', patch: rulesPatch(draft) })
    toast('Work rules saved', { tone: 'success', description: 'New work orders follow them from now on.' })
  }
  const actions = (
    <>
      <Button variant="outline" disabled={!dirty} onClick={() => setDraft(saved)}>
        <RotateCcw />
        Reset changes
      </Button>
      <Button disabled={!dirty || invalid} onClick={save}>
        <Save />
        Save rules
      </Button>
    </>
  )

  const hoursHint = (value: string) => {
    const hours = Number(value)
    return hours >= 24 ? `${fmtNumber(hours / 24, hours % 24 ? 1 : 0)} days` : undefined
  }

  return (
    <>
      <PageHeader
        title="Work rules"
        description="Response times, approvals, verification and capacity for every site."
        actions={canEdit ? actions : undefined}
      />

      {!canEdit && (
        <Banner tone="neutral" icon={<Lock />} title="View only" className="mb-4">
          Administrators and maintenance managers change work rules.
        </Banner>
      )}

      <div className="gap-4 lg:grid-cols-2 grid grid-cols-1">
        <RuleCard
          title="Response time by priority"
          description="Hours from the request to the due time. New work orders take their due date from these."
        >
          <ul className="space-y-4">
            {PRIORITIES.map((p) => (
              <li key={p} className="gap-3 flex flex-wrap items-start justify-between">
                <div className="min-w-0 flex-1">
                  <PriorityBadge priority={p} long />
                  <p className="mt-1 text-xs text-muted">{PRIORITY_HINT[p]}</p>
                </div>
                <FormField className="w-32" error={errors[`sla.${p}`]} hint={hoursHint(draft.slaHours[p])}>
                  <Input
                    type="number"
                    min={1}
                    aria-label={`${p} ${PRIORITY_LABEL[p]} response time in hours`}
                    value={draft.slaHours[p]}
                    disabled={!canEdit}
                    rightSlot={unit('h')}
                    onChange={(e) => set({ slaHours: { ...draft.slaHours, [p]: e.target.value } })}
                  />
                </FormField>
              </li>
            ))}
          </ul>
        </RuleCard>

        <RuleCard
          title="Approval by priority"
          description="Work orders that need approval wait as drafts until someone signs them off."
        >
          <ul className="space-y-4">
            {PRIORITIES.map((p) => (
              <li key={p} className="gap-3 flex flex-wrap items-center justify-between">
                <PriorityBadge priority={p} long />
                <SegmentedControl
                  size="sm"
                  aria-label={`Approval for ${p} ${PRIORITY_LABEL[p]}`}
                  options={APPROVAL_OPTIONS}
                  value={draft.approvalByPriority[p]}
                  disabled={!canEdit}
                  onChange={(v) =>
                    set({ approvalByPriority: { ...draft.approvalByPriority, [p]: v as ApprovalRule } })
                  }
                />
              </li>
            ))}
          </ul>
        </RuleCard>

        <RuleCard
          title="Manager approval above"
          description="Work orders whose estimated parts, vendor and other costs exceed this amount go to the maintenance manager, whatever the priority."
        >
          <FormField label="Amount (Rp)" htmlFor="rules-threshold" error={errors.managerApprovalAbove}>
            <Input
              id="rules-threshold"
              type="number"
              min={0}
              step={500000}
              value={draft.managerApprovalAbove}
              disabled={!canEdit}
              onChange={(e) => set({ managerApprovalAbove: e.target.value })}
            />
          </FormField>
          <p className="mt-4 text-3xl font-bold tracking-tight leading-none break-all tabular-nums">
            {fmtIdr(threshold)}
          </p>
          <p className="mt-2 text-xs text-muted">
            Approval reasons show it as {fmtIdrShort(threshold)}. {plural(aboveThreshold, 'open work order')}{' '}
            at {site.name} {aboveThreshold === 1 ? 'is' : 'are'} estimated above it.
          </p>
        </RuleCard>

        <RuleCard
          title="Verification before closing"
          description="Completed work on assets in these classes waits for a supervisor to verify it before anyone can close it."
        >
          <div
            role="group"
            aria-label="Criticality classes that need verification"
            className="gap-2 flex flex-wrap"
          >
            {CRITICALITIES.map((c) => (
              <Chip
                key={c}
                active={draft.verifyCriticalities.includes(c)}
                disabled={!canEdit}
                count={classAssets(c)}
                onClick={() => toggleClass(c)}
              >
                {c} · {CRITICALITY_LABEL[c]}
              </Chip>
            ))}
          </div>
          <p className="mt-3 text-xs text-muted">
            {draft.verifyCriticalities.length
              ? `${plural(verifiedAssets, 'asset')} at ${site.name} need verification. The chip counts show assets per class.`
              : 'Completed work closes without verification.'}
          </p>
        </RuleCard>

        <RuleCard
          title="Repeat failure window"
          description="A failure mode that returns on the same asset within this many days counts as a repeat failure and raises a reliability alert."
        >
          <FormField
            label="Window"
            htmlFor="rules-repeat"
            error={errors.repeatWindowDays}
            className="max-w-48"
          >
            <Input
              id="rules-repeat"
              type="number"
              min={1}
              max={365}
              value={draft.repeatWindowDays}
              disabled={!canEdit}
              rightSlot={unit('days')}
              onChange={(e) => set({ repeatWindowDays: e.target.value })}
            />
          </FormField>
        </RuleCard>

        <RuleCard
          title="Labor capacity"
          description="Wrench time is the share of paid hours spent hands-on. The backlog divides open man-hours by this capacity."
        >
          <div className="gap-4 sm:grid-cols-2 grid grid-cols-1">
            <FormField label="Wrench time" htmlFor="rules-wrench" error={errors.wrenchTimePct}>
              <Input
                id="rules-wrench"
                type="number"
                min={1}
                max={100}
                value={draft.wrenchTimePct}
                disabled={!canEdit}
                rightSlot={unit('%')}
                onChange={(e) => set({ wrenchTimePct: e.target.value })}
              />
            </FormField>
            <FormField label="Paid hours per week" htmlFor="rules-weekly" error={errors.weeklyHours}>
              <Input
                id="rules-weekly"
                type="number"
                min={1}
                max={80}
                value={draft.weeklyHours}
                disabled={!canEdit}
                rightSlot={unit('h')}
                onChange={(e) => set({ weeklyHours: e.target.value })}
              />
            </FormField>
            <div className="rounded-2xl p-4 sm:col-span-2 bg-surface-2">
              <p className="text-xs text-muted">Weekly capacity at {site.name}</p>
              <p className="mt-1 gap-1 flex items-start leading-none">
                <span className="text-3xl font-bold tracking-tight tabular-nums">{fmtNumber(capacity)}</span>
                <span className="pt-1 text-sm font-semibold text-muted">h</span>
              </p>
              <p className="mt-2 text-xs text-muted">
                {plural(rostered, 'technician')} not on leave × {fmtNumber(weeklyHours)} h ×{' '}
                {fmtNumber(wrenchTime * 100)}%
              </p>
            </div>
          </div>
        </RuleCard>

        <RuleCard
          className="lg:col-span-2"
          title="How work flows with these rules"
          description="The preview follows your edits. Saved rules apply to work orders created after you save."
        >
          <div className="gap-6 md:grid-cols-2 grid grid-cols-1">
            <section>
              <Kicker>When someone creates a work order</Kicker>
              <ul className="mt-3 space-y-2">
                {PRIORITIES.map((p) => (
                  <FlowRow key={p} from={`${p} ${PRIORITY_LABEL[p]}`} rule={draft.approvalByPriority[p]} />
                ))}
                <FlowRow from={`Cost > ${fmtIdrShort(threshold)}`} rule="manager" />
              </ul>
            </section>
            <section>
              <Kicker>When the technician completes it</Kicker>
              {draft.verifyCriticalities.length > 0 ? (
                <>
                  <p className="mt-3 text-sm font-medium">
                    Critical asset closure, class {draft.verifyCriticalities.join(', ')}
                  </p>
                  <Chain steps={['Technician complete', 'Supervisor verify', 'Closed']} />
                  <p className="mt-4 text-sm font-medium">Every other class</p>
                  <Chain steps={['Technician complete', 'Closed']} />
                </>
              ) : (
                <>
                  <p className="mt-3 text-sm font-medium">Every class</p>
                  <Chain steps={['Technician complete', 'Closed']} />
                </>
              )}
            </section>
          </div>
        </RuleCard>
      </div>

      {canEdit && dirty && (
        <div className="mt-4 gap-2 flex flex-wrap items-center justify-end">
          <p className="text-sm mr-auto text-muted">
            {invalid ? 'Fix the highlighted fields to save.' : 'You have unsaved changes.'}
          </p>
          {actions}
        </div>
      )}
    </>
  )
}
