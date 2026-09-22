import { fmtWhen, fromInput, isFailureWork, nowIso, taskProgress, toDateTimeInput, transitionsFor } from '@cmms/fixtures'
import type { WaitingReason, WoStatus, WorkOrder } from '@cmms/types'
import { WAITING_REASONS, WAITING_REASON_LABEL, WO_STATUS_LABEL } from '@cmms/types'
import {
  ActionMenu,
  type ActionMenuItem,
  Badge,
  Banner,
  Button,
  Combobox,
  ConfirmDialog,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  FormField,
  Input,
  Steps,
  type StepState,
  Textarea,
  cn,
  toast,
} from '@cmms/ui'
import {
  BadgeCheck,
  Ban,
  CalendarClock,
  Check,
  CircleCheck,
  Ellipsis,
  Lock,
  Pause,
  Pencil,
  Play,
  Printer,
  RotateCcw,
  ShieldCheck,
  UserPlus,
  X,
} from 'lucide-react'
import { type ReactNode, useState } from 'react'
import { BackButton } from '../../../components/BackButton'
import { PriorityBadge, WoStatusBadge, WoTypeBadge } from '../../../components/badges'
import { useCreate } from '../../../components/create'
import { AssetLink } from '../../../components/links'
import { PeoplePicker, TeamPicker } from '../../../components/pickers'
import { useScoped } from '../../../state/scoped'
import type { WoAccess } from './useWoAccess'

type Pending = 'safety' | 'safety-start' | 'wait' | 'complete' | 'verify' | 'close' | 'reopen' | 'cancel' | 'approve' | 'reject' | 'assign' | 'schedule' | null

function stepsFor(wo: WorkOrder, verificationNeeded: boolean) {
  const flow: WoStatus[] = [
    'draft',
    'open',
    'assigned',
    'in_progress',
    ...(wo.status === 'waiting' ? (['waiting'] as const) : []),
    'completed',
    ...(verificationNeeded || wo.status === 'verified' ? (['verified'] as const) : []),
    'closed',
  ]
  const current = wo.status === 'cancelled' ? -1 : flow.indexOf(wo.status)
  const hint: Partial<Record<WoStatus, string | null>> = {
    in_progress: wo.startedAt && fmtWhen(wo.startedAt),
    completed: wo.completedAt && fmtWhen(wo.completedAt),
    verified: wo.verification && fmtWhen(wo.verification.at),
    closed: wo.closedAt && fmtWhen(wo.closedAt),
  }
  return flow.map((status, i) => {
    const state: StepState = current < 0 ? 'skipped' : i < current ? 'done' : i === current ? 'current' : 'upcoming'
    return { key: status, label: WO_STATUS_LABEL[status], state, hint: state !== 'upcoming' ? (hint[status] ?? undefined) : undefined }
  })
}

export function WoHeader({ wo, access }: { wo: WorkOrder; access: WoAccess }) {
  const { dispatch, user } = useScoped()
  const create = useCreate()
  const [pending, setPending] = useState<Pending>(null)
  const t = transitionsFor(wo, access.verificationNeeded)
  const has = (x: (typeof t)[number]) => t.includes(x)
  const needsSafety = (wo.safety.loto || wo.safety.ppeIds.length > 0) && !wo.safety.confirmedAt
  const close = () => setPending(null)
  const done = (message: string) => {
    toast(message, { tone: 'success' })
    close()
  }

  const start = () => {
    if (needsSafety) return setPending('safety-start')
    dispatch({ type: 'workOrders/start', id: wo.id })
    toast('Work started', { tone: 'success' })
  }

  let primary: ReactNode = null
  if (has('approve') && access.approve) {
    primary = (
      <Button onClick={() => setPending('approve')}>
        <BadgeCheck />
        Approve
      </Button>
    )
  } else if (has('start') && access.execute && (wo.assigneeIds.length || !access.assign)) {
    primary = (
      <Button onClick={start}>
        <Play />
        Start work
      </Button>
    )
  } else if (has('assign') && access.assign && !wo.assigneeIds.length) {
    primary = (
      <Button onClick={() => setPending('assign')}>
        <UserPlus />
        Assign
      </Button>
    )
  } else if (has('complete') && access.execute) {
    primary = (
      <Button onClick={() => setPending('complete')}>
        <CircleCheck />
        Complete
      </Button>
    )
  } else if (has('resume') && access.execute) {
    primary = (
      <Button
        onClick={() => {
          dispatch({ type: 'workOrders/resume', id: wo.id })
          toast('Work resumed', { tone: 'success' })
        }}
      >
        <Play />
        Resume
      </Button>
    )
  } else if (has('verify') && access.verify) {
    primary = (
      <Button onClick={() => setPending('verify')}>
        <ShieldCheck />
        Verify
      </Button>
    )
  } else if (has('close') && access.close) {
    primary = (
      <Button onClick={() => setPending('close')}>
        <Lock />
        Close
      </Button>
    )
  }

  const secondary: ReactNode[] = []
  if (has('reject') && access.approve) {
    secondary.push(
      <Button key="reject" variant="outline" onClick={() => setPending('reject')}>
        <X />
        Reject
      </Button>,
    )
  }
  if (has('wait') && access.execute) {
    secondary.push(
      <Button key="wait" variant="outline" onClick={() => setPending('wait')}>
        <Pause />
        Pause
      </Button>,
    )
  }

  const menuOptions: (ActionMenuItem | false)[] = [
    access.edit && { key: 'edit', label: 'Edit details', icon: <Pencil />, onSelect: () => create.editWorkOrder(wo) },
    has('assign') && access.assign && { key: 'assign', label: wo.assigneeIds.length ? 'Reassign' : 'Assign', icon: <UserPlus />, onSelect: () => setPending('assign') },
    access.assign && { key: 'schedule', label: wo.scheduledAt ? 'Reschedule' : 'Schedule', icon: <CalendarClock />, onSelect: () => setPending('schedule') },
    needsSafety && access.execute && { key: 'safety', label: 'Confirm safety', icon: <ShieldCheck />, onSelect: () => setPending('safety') },
    has('reopen') && (access.verify || access.close) && { key: 'reopen', label: 'Reopen', icon: <RotateCcw />, onSelect: () => setPending('reopen') },
    { key: 'print', label: 'Print job card', icon: <Printer />, onSelect: () => window.print() },
    has('cancel') && access.edit && { key: 'cancel', label: 'Cancel work order', icon: <Ban />, destructive: true, onSelect: () => setPending('cancel') },
  ]
  const menu = menuOptions.filter((x): x is ActionMenuItem => !!x)

  return (
    <div className="mb-4 space-y-4">
      <BackButton fallback="/work/orders" />

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 max-w-3xl">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs font-medium text-muted">{wo.code}</span>
            <WoTypeBadge type={wo.type} />
            <PriorityBadge priority={wo.priority} long />
            <WoStatusBadge status={wo.status} waitingReason={wo.waitingReason} />
          </div>
          <h1 className="mt-2 text-2xl font-bold tracking-tight">{wo.title}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
            <AssetLink assetId={wo.assetId} className="text-foreground" />
            {wo.description && <span className="hidden sm:inline">·</span>}
            {wo.description && <span className="min-w-0 max-w-xl text-body/80">{wo.description}</span>}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 print:hidden">
          {secondary}
          {primary}
          {menu.length > 0 && (
            <ActionMenu
              title={wo.code}
              trigger={
                <Button variant="card" size="icon" aria-label="More actions">
                  <Ellipsis />
                </Button>
              }
              items={menu}
            />
          )}
        </div>
      </div>

      {wo.status === 'cancelled' ? (
        <Badge variant="muted">Cancelled</Badge>
      ) : (
        <Steps steps={stepsFor(wo, access.verificationNeeded)} />
      )}

      {pending === 'safety' || pending === 'safety-start' ? (
        <SafetyDialog
          wo={wo}
          startAfter={pending === 'safety-start'}
          onClose={close}
          onConfirm={() => {
            dispatch({ type: 'workOrders/confirmSafety', id: wo.id })
            if (pending === 'safety-start') dispatch({ type: 'workOrders/start', id: wo.id })
            done(pending === 'safety-start' ? 'Safety confirmed, work started' : 'Safety confirmed')
          }}
        />
      ) : null}
      {pending === 'wait' && (
        <WaitDialog
          onClose={close}
          onWait={(reason, note) => {
            dispatch({ type: 'workOrders/wait', id: wo.id, reason, note })
            done(`Paused: waiting for ${WAITING_REASON_LABEL[reason].toLowerCase()}`)
          }}
        />
      )}
      {pending === 'complete' && (
        <CompleteDialog
          wo={wo}
          onClose={close}
          onComplete={(note) => {
            dispatch({ type: 'workOrders/complete', id: wo.id, note })
            done(access.verificationNeeded ? 'Completed. A supervisor verifies it next.' : 'Work completed')
          }}
        />
      )}
      {pending === 'assign' && (
        <AssignDialog
          wo={wo}
          onClose={close}
          onAssign={(assigneeIds, teamId) => {
            dispatch({ type: 'workOrders/assign', id: wo.id, assigneeIds, teamId })
            done(assigneeIds.length ? 'Assignment updated' : 'Unassigned')
          }}
        />
      )}
      {pending === 'schedule' && (
        <ScheduleDialog
          wo={wo}
          onClose={close}
          onSchedule={(scheduledAt) => {
            dispatch({ type: 'workOrders/schedule', id: wo.id, scheduledAt })
            done(scheduledAt ? `Scheduled for ${fmtWhen(scheduledAt)}` : 'Schedule cleared')
          }}
        />
      )}
      <NoteDialog
        open={pending === 'approve' || pending === 'reject'}
        title={pending === 'reject' ? `Reject ${wo.code}?` : `Approve ${wo.code}?`}
        description={wo.approval?.reason}
        confirmLabel={pending === 'reject' ? 'Reject' : 'Approve'}
        destructive={pending === 'reject'}
        noteRequired={pending === 'reject'}
        onClose={close}
        onConfirm={(note) => {
          dispatch({ type: 'workOrders/decide', id: wo.id, decision: pending === 'reject' ? 'rejected' : 'approved', note })
          done(pending === 'reject' ? 'Work order rejected and cancelled' : 'Approved. The work order is open.')
        }}
      />
      <NoteDialog
        open={pending === 'verify'}
        title={`Verify ${wo.code}`}
        description="Confirm the machine runs as expected and the work meets the acceptance criteria."
        confirmLabel="Verify"
        onClose={close}
        onConfirm={(note) => {
          dispatch({ type: 'workOrders/verify', id: wo.id, note })
          done('Verified. The planner can close it.')
        }}
      />
      <NoteDialog
        open={pending === 'close'}
        title={`Close ${wo.code}?`}
        description="Closed work moves into the asset history and cost reports. You can reopen it later."
        confirmLabel="Close work order"
        withNote={false}
        onClose={close}
        onConfirm={() => {
          dispatch({ type: 'workOrders/close', id: wo.id })
          done('Work order closed')
        }}
      />
      <NoteDialog
        open={pending === 'reopen'}
        title={`Reopen ${wo.code}?`}
        description="It goes back to in progress and needs completing again."
        confirmLabel="Reopen"
        noteRequired
        onClose={close}
        onConfirm={(note) => {
          dispatch({ type: 'workOrders/reopen', id: wo.id, note })
          done('Work order reopened')
        }}
      />
      <NoteDialog
        open={pending === 'cancel'}
        title={`Cancel ${wo.code}?`}
        description="Running clocks stop, reserved parts go back to stock and checked-out tools are released."
        confirmLabel="Cancel work order"
        destructive
        noteRequired
        onClose={close}
        onConfirm={(note) => {
          dispatch({ type: 'workOrders/cancel', id: wo.id, note })
          done('Work order cancelled')
        }}
      />
      <span className="sr-only">Signed in as {user.name}</span>
    </div>
  )
}

function NoteDialog({
  open,
  title,
  description,
  confirmLabel,
  destructive = false,
  noteRequired = false,
  withNote = true,
  onClose,
  onConfirm,
}: {
  open: boolean
  title: string
  description?: string
  confirmLabel: string
  destructive?: boolean
  noteRequired?: boolean
  withNote?: boolean
  onClose: () => void
  onConfirm: (note: string) => void
}) {
  const [note, setNote] = useState('')
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={(o) => {
        if (!o) {
          setNote('')
          onClose()
        }
      }}
      title={title}
      description={description}
      confirmLabel={confirmLabel}
      destructive={destructive}
      confirmDisabled={noteRequired && !note.trim()}
      onConfirm={() => {
        onConfirm(note.trim())
        setNote('')
      }}
    >
      {withNote && (
        <FormField label={noteRequired ? 'Reason' : 'Note'} required={noteRequired} htmlFor="wo-note">
          <Textarea id="wo-note" value={note} placeholder={noteRequired ? 'Why?' : 'Optional'} onChange={(e) => setNote(e.target.value)} />
        </FormField>
      )}
    </ConfirmDialog>
  )
}

function SafetyDialog({ wo, startAfter, onClose, onConfirm }: { wo: WorkOrder; startAfter: boolean; onClose: () => void; onConfirm: () => void }) {
  const { maps } = useScoped()
  const items = [
    ...(wo.safety.loto ? [{ id: 'loto', label: 'Lockout and tagout applied on every energy source' }] : []),
    ...wo.safety.ppeIds.map((id) => ({ id, label: `Wearing ${maps.safetyItem.get(id)?.name.toLowerCase() ?? 'PPE'}` })),
    ...wo.safety.hazardIds.map((id) => ({ id, label: `${maps.safetyItem.get(id)?.name} hazard understood and controlled` })),
  ]
  const [checked, setChecked] = useState<string[]>([])
  const all = checked.length === items.length

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Safety confirmation</DialogTitle>
          <DialogDescription>Tick every line before work starts. The confirmation is logged on the work order.</DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          {items.map((item) => {
            const on = checked.includes(item.id)
            return (
              <button
                key={item.id}
                type="button"
                aria-pressed={on}
                onClick={() => setChecked((c) => (on ? c.filter((x) => x !== item.id) : [...c, item.id]))}
                className={cn(
                  'flex w-full items-center gap-3 rounded-2xl p-3 text-left text-sm font-medium transition-colors',
                  on ? 'bg-success-soft text-success' : 'bg-surface hover:bg-surface-2',
                )}
              >
                <span className={cn('flex size-6 shrink-0 items-center justify-center rounded-full', on ? 'bg-success text-white' : 'bg-card shadow-card')}>
                  {on && <Check className="size-3.5" />}
                </span>
                {item.label}
              </button>
            )
          })}
        </div>
        {wo.safety.notes && <Banner tone="warning" className="mt-4">{wo.safety.notes}</Banner>}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={onConfirm} disabled={!all}>
            <ShieldCheck />
            {startAfter ? 'Confirm and start' : 'Confirm'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function WaitDialog({ onClose, onWait }: { onClose: () => void; onWait: (reason: WaitingReason, note: string) => void }) {
  const [reason, setReason] = useState<WaitingReason | null>(null)
  const [note, setNote] = useState('')
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Pause work</DialogTitle>
          <DialogDescription>The reason shows on the backlog, so the team can see what blocks the job.</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-1 gap-4">
          <FormField label="Waiting for" required htmlFor="wait-reason">
            <Combobox
              id="wait-reason"
              items={WAITING_REASONS}
              value={reason}
              onChange={(v) => setReason(v as WaitingReason | null)}
              getKey={(r) => r}
              getLabel={(r) => WAITING_REASON_LABEL[r]}
              placeholder="Choose a reason"
            />
          </FormField>
          <FormField label="Note" htmlFor="wait-note">
            <Textarea id="wait-note" value={note} placeholder="PO number, vendor visit date, production window" onChange={(e) => setNote(e.target.value)} />
          </FormField>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={!reason} onClick={() => reason && onWait(reason, note.trim())}>
            <Pause />
            Pause work
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function CompleteDialog({ wo, onClose, onComplete }: { wo: WorkOrder; onClose: () => void; onComplete: (note: string) => void }) {
  const [note, setNote] = useState(wo.completionNote)
  const progress = taskProgress(wo.tasks)
  const missingFailure = isFailureWork(wo) && !wo.failure?.modeId
  const running = wo.labor.filter((e) => e.end === null).length
  const reserved = wo.parts.filter((l) => l.status === 'reserved').length
  const checks = [
    progress.missingRequired > 0 && `${progress.missingRequired} required ${progress.missingRequired === 1 ? 'check is' : 'checks are'} still open.`,
    missingFailure && 'No failure mode is coded. Corrective work needs one for MTBF and repeat detection.',
    running > 0 && `${running} running ${running === 1 ? 'clock stops' : 'clocks stop'} now.`,
    reserved > 0 && `${reserved} reserved ${reserved === 1 ? 'part goes' : 'parts go'} back to stock. Issued parts count as used.`,
  ].filter((x): x is string => !!x)

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Complete {wo.code}</DialogTitle>
          <DialogDescription>Describe what was done. The asset history keeps this note.</DialogDescription>
        </DialogHeader>
        {checks.length > 0 && (
          <ul className="mb-4 space-y-1.5 rounded-2xl bg-warning-soft p-4 text-sm text-body">
            {checks.map((c) => (
              <li key={c} className="flex gap-2">
                <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-warning" />
                {c}
              </li>
            ))}
          </ul>
        )}
        <FormField label="What was done" htmlFor="complete-note">
          <Textarea id="complete-note" value={note} placeholder="Replaced both bearings and the seal. Run test 2.1 mm/s." onChange={(e) => setNote(e.target.value)} />
        </FormField>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => onComplete(note.trim())}>
            <CircleCheck />
            Mark complete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function AssignDialog({ wo, onClose, onAssign }: { wo: WorkOrder; onClose: () => void; onAssign: (assigneeIds: string[], teamId: string) => void }) {
  const { maps } = useScoped()
  const [assigneeIds, setAssigneeIds] = useState(wo.assigneeIds)
  const [teamId, setTeamId] = useState<string | null>(wo.teamId || null)
  const plan = wo.jobPlanId ? maps.jobPlan.get(wo.jobPlanId) : undefined
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Assign {wo.code}</DialogTitle>
          <DialogDescription>
            {plan ? `The job plan asks for ${maps.skill.get(plan.skillId)?.name} L${plan.skillLevel}+ and ${plan.personnel} ${plan.personnel === 1 ? 'person' : 'people'}.` : 'Pick the team and the technicians.'}
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-1 gap-4">
          <FormField label="Team" htmlFor="assign-team">
            <TeamPicker id="assign-team" value={teamId} onChange={setTeamId} />
          </FormField>
          <FormField label="Technicians" htmlFor="assign-people">
            <PeoplePicker id="assign-people" values={assigneeIds} skillId={plan?.skillId} onChange={setAssigneeIds} />
          </FormField>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => onAssign(assigneeIds, teamId ?? wo.teamId)}>
            <UserPlus />
            Save assignment
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function ScheduleDialog({ wo, onClose, onSchedule }: { wo: WorkOrder; onClose: () => void; onSchedule: (at: string | null) => void }) {
  const [value, setValue] = useState(toDateTimeInput(wo.scheduledAt ?? nowIso()))
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>Schedule {wo.code}</DialogTitle>
          <DialogDescription>Due {fmtWhen(wo.dueAt)}. The calendar shows the work on this date.</DialogDescription>
        </DialogHeader>
        <FormField label="Start" htmlFor="schedule-at">
          <Input id="schedule-at" type="datetime-local" value={value} onChange={(e) => setValue(e.target.value)} />
        </FormField>
        <DialogFooter>
          {wo.scheduledAt && (
            <Button variant="ghost" onClick={() => onSchedule(null)}>
              Clear schedule
            </Button>
          )}
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={!value} onClick={() => onSchedule(fromInput(value))}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
