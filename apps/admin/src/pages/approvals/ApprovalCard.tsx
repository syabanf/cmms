import { estimatedCost, fmtAgo, fmtIdr, fmtIdrShort, fmtWhen, isOverdue } from '@cmms/fixtures'
import { APPROVAL_LEVEL_LABEL } from '@cmms/types'
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, ConfirmDialog, FormField, Kicker, Textarea, cn, toast } from '@cmms/ui'
import { ArrowRight, Check, ShieldAlert, ShieldCheck, X } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { useAuth } from '../../auth/auth'
import { PriorityBadge, WoTypeBadge } from '../../components/badges'
import { AssetLink, PersonChip, paths } from '../../components/links'
import { useScoped } from '../../state/scoped'
import { type WithApproval, approversFor, costLines, joinList, mayDecide } from './lib'

type Decision = 'approved' | 'rejected'

/** A work order held in draft until someone with the right level approves or rejects it. */
export function ApprovalCard({ wo, now }: { wo: WithApproval; now: number }) {
  const { user, people, maps } = useScoped()
  const { can } = useAuth()
  const [decision, setDecision] = useState<Decision | null>(null)
  const { level, reason } = wo.approval
  const allowed = mayDecide(level, user.role, can('wo.approve'))
  const approvers = approversFor(wo, level, people, maps.team).map((p) => p.name)
  const late = isOverdue(wo, now)

  return (
    <Card className="flex flex-col">
      <CardHeader
        action={
          <Badge variant={level === 'manager' ? 'ink' : 'outline'}>
            <ShieldCheck aria-hidden="true" />
            {APPROVAL_LEVEL_LABEL[level]}
          </Badge>
        }
      >
        <div className="flex flex-wrap items-center gap-2">
          <Link to={paths.workOrder(wo.id)} className="font-mono text-xs font-medium text-muted hover:text-accent hover:underline">
            {wo.code}
          </Link>
          <PriorityBadge priority={wo.priority} long />
          <WoTypeBadge type={wo.type} />
        </div>
        <CardTitle className="mt-1.5 text-lg leading-snug">{wo.title}</CardTitle>
      </CardHeader>

      <CardContent className="flex flex-1 flex-col gap-4">
        <AssetLink assetId={wo.assetId} showIcon />
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-sm">
          <PersonChip personId={wo.requestedBy} hint={`requested ${fmtAgo(wo.requestedAt, now)}`} />
          <span className={cn('text-xs', late ? 'font-semibold text-accent' : 'text-muted')}>
            {late ? 'Overdue since' : 'Due'} {fmtWhen(wo.dueAt, now)}
          </span>
        </div>
        <p className="flex items-start gap-2 rounded-2xl bg-surface-2 px-3 py-2.5 text-sm">
          <ShieldAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-warning" />
          {reason}
        </p>
        <CostBreakdown wo={wo} />

        <div className="mt-auto space-y-2 border-t border-border pt-4">
          <div className="flex flex-wrap items-center gap-2">
            <Button disabled={!allowed} onClick={() => setDecision('approved')}>
              <Check />
              Approve
            </Button>
            <Button variant="outline" disabled={!allowed} onClick={() => setDecision('rejected')}>
              <X />
              Reject
            </Button>
            <Button asChild variant="ghost" size="sm" className="ml-auto">
              <Link to={paths.workOrder(wo.id)}>
                Open work order
                <ArrowRight />
              </Link>
            </Button>
          </div>
          {!allowed && (
            <p className="text-xs text-muted">
              {approvers.length ? `${joinList(approvers, 'or')} can approve this.` : 'A maintenance manager has to approve this.'}
            </p>
          )}
        </div>
      </CardContent>

      {decision && <DecisionDialog wo={wo} decision={decision} onClose={() => setDecision(null)} />}
    </Card>
  )
}

function CostBreakdown({ wo }: { wo: WithApproval }) {
  const { maps, settings } = useScoped()
  const lines = costLines(wo, maps.part, maps.vendor)
  const total = estimatedCost(wo)
  const over = total - settings.managerApprovalAbove
  return (
    <div>
      <Kicker className="mb-2">Estimated cost</Kicker>
      <ul className="divide-y divide-border rounded-2xl bg-surface-2 px-4">
        {lines.length ? (
          lines.map((line) => (
            <li key={line.key} className="flex items-start justify-between gap-3 py-2.5 text-sm">
              <span className="min-w-0">
                <span className="block truncate">{line.label}</span>
                {line.detail && <span className="block truncate text-xs text-muted">{line.detail}</span>}
              </span>
              <span className="shrink-0 tabular-nums">{fmtIdr(line.amount)}</span>
            </li>
          ))
        ) : (
          <li className="py-2.5 text-sm text-muted">No parts, vendor quote or other cost planned yet.</li>
        )}
        <li className="flex items-center justify-between gap-3 py-2.5 text-sm font-semibold">
          <span>Total</span>
          <span className="tabular-nums">{fmtIdr(total)}</span>
        </li>
      </ul>
      {over > 0 && (
        <p className="mt-1.5 text-xs text-muted">
          {fmtIdrShort(over)} above the {fmtIdrShort(settings.managerApprovalAbove)} manager threshold.
        </p>
      )}
    </div>
  )
}

function DecisionDialog({ wo, decision, onClose }: { wo: WithApproval; decision: Decision; onClose: () => void }) {
  const { dispatch, personName } = useScoped()
  const [note, setNote] = useState('')
  const approve = decision === 'approved'
  const assignees = joinList(
    wo.assigneeIds.map((id) => personName(id)),
    'and',
  )

  const confirm = () => {
    dispatch({ type: 'workOrders/decide', id: wo.id, decision, note: note.trim() })
    toast(`${wo.code} ${decision}`, {
      tone: 'success',
      description: approve ? (assignees ? `${assignees} can start the work.` : 'It is open and waits for a technician.') : 'The work order is cancelled.',
    })
  }

  return (
    <ConfirmDialog
      open
      onOpenChange={(open) => !open && onClose()}
      title={approve ? `Approve ${wo.code}?` : `Reject ${wo.code}?`}
      description={
        approve
          ? `${wo.approval.reason} Once approved, ${assignees ? `${assignees} can start` : 'the planner can assign it'}.`
          : 'Rejecting cancels the work order and puts its reserved parts back in stock.'
      }
      confirmLabel={approve ? 'Approve' : 'Reject work order'}
      destructive={!approve}
      confirmDisabled={!approve && !note.trim()}
      onConfirm={confirm}
    >
      <FormField label={approve ? 'Note' : 'Reason'} required={!approve} htmlFor={`decision-${wo.id}`}>
        <Textarea
          id={`decision-${wo.id}`}
          value={note}
          placeholder={approve ? 'Optional, for example: ask the vendor for the seal warranty' : 'Why the work should not go ahead'}
          onChange={(e) => setNote(e.target.value)}
        />
      </FormField>
    </ConfirmDialog>
  )
}
