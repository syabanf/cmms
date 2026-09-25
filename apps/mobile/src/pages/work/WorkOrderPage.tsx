import { isActive, needsVerification } from '@cmms/fixtures'
import type { WorkOrder } from '@cmms/types'
import { Banner, Button, Kicker, toast } from '@cmms/ui'
import { ArrowRight } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router'
import { SuccessCard } from '../../components/SuccessCard'
import { paths } from '../../lib/paths'
import { dueText } from '../../lib/time'
import { byUrgency } from '../../lib/work'
import { useMobileScope, useNow } from '../../state/scope'
import { NotFound } from '../NotFoundPage'
import { STEPS, type StepAccess, type StepId, type StepNav, autoStep, flowStatus, hasBegun, isStepId, stepBeside } from './flow'
import { FlowHeader } from './FlowHeader'
import { LogTimeSheet } from './LogTimeSheet'
import { Stepper } from './Stepper'
import { ChecklistStep } from './steps/ChecklistStep'
import { FindingsStep } from './steps/FindingsStep'
import { FinishStep } from './steps/FinishStep'
import { JobStep } from './steps/JobStep'
import { PartsStep } from './steps/PartsStep'
import { SafetyStep } from './steps/SafetyStep'
import { WaitSheet } from './WaitSheet'

export function WorkOrderPage() {
  const { id = '' } = useParams()
  const { maps, site, isTechnician } = useMobileScope()
  const wo = maps.workOrder.get(id)
  const fallback = isTechnician ? paths.work() : paths.home

  if (!wo || wo.siteId !== site.id) {
    return (
      <NotFound
        title="Work order"
        heading="Work order not found"
        description={`It does not exist at ${site.name}, or the link is out of date.`}
        back={fallback}
        backLabel={isTechnician ? 'Back to my work' : 'Back home'}
      />
    )
  }
  return <WorkOrderFlow key={wo.id} wo={wo} fallback={fallback} />
}

/**
 * The work order as a guided flow: Job, Safety, Checklist, Parts and tools, Findings, Finish.
 * The step lives in `?step=` (replaced, so the back button still leaves the order), and every
 * action saves at once, so leaving mid-flow loses nothing.
 */
function WorkOrderFlow({ wo, fallback }: { wo: WorkOrder; fallback: string }) {
  const { user, isTechnician, dispatch } = useMobileScope()
  const [params, setParams] = useSearchParams()
  const [sheet, setSheet] = useState<'wait' | 'time' | null>(null)
  const [completed, setCompleted] = useState(false)

  if (completed) return <CompletedView wo={wo} fallback={fallback} />

  const status = flowStatus(wo)
  const requested = params.get('step')
  const step: StepId = isStepId(requested) && status[requested].reachable ? requested : autoStep(wo)
  const go = (target: StepId) => setParams({ step: target }, { replace: true })

  const assigned = isTechnician && wo.assigneeIds.includes(user.id)
  const access: StepAccess = {
    assigned,
    editable: assigned && isActive(wo) && wo.status !== 'draft',
    working: assigned && wo.status === 'in_progress',
  }
  const back = stepBeside(step, -1, status)
  const next = stepBeside(step, 1, status)
  const nav: StepNav = {
    back: back ? () => go(back) : null,
    next: next && status[next].reachable ? () => go(next) : null,
    go,
  }

  const resume = () => {
    dispatch({ type: 'workOrders/resume', id: wo.id })
    toast('Work resumed', { tone: 'success', description: 'Your clock is running again.' })
    go(autoStep({ ...wo, status: 'in_progress', waitingReason: null }))
  }

  const shown = STEPS.filter((s) => !status[s.id].skipped)
  const current = STEPS.find((s) => s.id === step)!
  const props = { wo, nav, access }

  return (
    <div className="space-y-5 pb-36">
      <FlowHeader
        wo={wo}
        fallback={fallback}
        onPause={access.working ? () => setSheet('wait') : undefined}
        onResume={assigned && wo.status === 'waiting' ? resume : undefined}
        onLogTime={access.editable && hasBegun(wo) ? () => setSheet('time') : undefined}
      />
      <Stepper status={status} current={step} onPick={go} />
      <div>
        <Kicker>
          Step {shown.findIndex((s) => s.id === step) + 1} of {shown.length}
        </Kicker>
        <h1 className="mt-1 text-[28px] font-bold leading-tight tracking-tight">
          {step === 'finish' && status.finish.done ? 'Work summary' : current.title}
          <span className="text-accent">.</span>
        </h1>
      </div>

      {!assigned && isActive(wo) && (
        <Banner tone="neutral" title="View only">
          Only the technicians assigned to this work order can update it.
        </Banner>
      )}
      {wo.status === 'draft' && wo.approval && (
        <Banner tone="warning" title="Waiting for approval">
          {wo.approval.reason}
        </Banner>
      )}

      {step === 'job' && <JobStep {...props} onResume={resume} />}
      {step === 'safety' && <SafetyStep {...props} />}
      {step === 'checklist' && <ChecklistStep {...props} />}
      {step === 'parts' && <PartsStep {...props} />}
      {step === 'findings' && <FindingsStep {...props} />}
      {step === 'finish' && <FinishStep {...props} onCompleted={() => setCompleted(true)} />}

      {access.working && <WaitSheet wo={wo} open={sheet === 'wait'} onOpenChange={(open) => setSheet(open ? 'wait' : null)} />}
      {access.editable && (
        <LogTimeSheet wo={wo} canClock={access.working} open={sheet === 'time'} onOpenChange={(open) => setSheet(open ? 'time' : null)} />
      )}
    </div>
  )
}

/** After Complete: what happens next and the technician's next job. */
function CompletedView({ wo, fallback }: { wo: WorkOrder; fallback: string }) {
  const { myWork, maps, settings, personName, requests } = useMobileScope()
  const now = useNow()
  const navigate = useNavigate()
  const asset = maps.asset.get(wo.assetId)
  const nextJob = myWork.filter((w) => w.id !== wo.id && isActive(w) && w.status !== 'draft').sort(byUrgency(now))[0]
  const nextAsset = nextJob ? maps.asset.get(nextJob.assetId) : undefined
  const supervisorId = maps.team.get(wo.teamId)?.supervisorId
  const supervisor = supervisorId ? personName(supervisorId) : 'Your supervisor'
  const raised = requests.find((r) => r.inspectionWoId === wo.id)

  return (
    <div className="space-y-5">
      <FlowHeader wo={wo} fallback={fallback} />
      <SuccessCard
        title="Work completed"
        actions={
          <>
            {nextJob && (
              <Button size="lg" className="w-full" onClick={() => navigate(paths.workOrder(nextJob.id))}>
                Open next job
                <ArrowRight />
              </Button>
            )}
            <Button asChild size="lg" variant={nextJob ? 'onInk' : 'primary'} className="w-full">
              <Link to={paths.work()}>Back to my work</Link>
            </Button>
          </>
        }
      >
        <p className="font-semibold text-white">
          {wo.title}
          {asset ? ` on ${asset.name}` : ''}
        </p>
        <p>
          {needsVerification(asset, settings)
            ? `${supervisor} verifies the result on this critical machine next.`
            : `${supervisor} reviews it and closes the work order.`}
        </p>
        {raised && <p>{raised.code} was raised from the checklist result.</p>}
        {nextJob ? (
          <div className="mt-5 rounded-2xl bg-white/5 p-4">
            <Kicker className="text-on-ink-muted">Your next job</Kicker>
            <p className="mt-1 text-sm font-semibold text-white">{nextJob.title}</p>
            <p className="mt-0.5 text-xs tabular-nums">
              <span className="font-mono">{nextJob.code}</span> · {nextAsset?.name ?? 'Removed asset'} · {dueText(nextJob.dueAt, now)}
            </p>
          </div>
        ) : (
          <p>Nothing else is assigned to you right now.</p>
        )}
      </SuccessCard>
    </div>
  )
}
