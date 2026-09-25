import { fmtDuration, fmtNumber, fmtWhen, laborMinutes } from '@cmms/fixtures'
import type { WoTask, WorkOrder } from '@cmms/types'
import { DONE_WO_STATUSES } from '@cmms/types'
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, SignaturePad, cn, toast } from '@cmms/ui'
import { CircleCheck } from 'lucide-react'
import { useState } from 'react'
import { OutcomeBadge } from '../../../components/badges'
import { useMobileScope, useNow } from '../../../state/scope'
import type { StepProps } from '../flow'
import { StepActions } from '../StepActions'

const isFlagged = (t: WoTask) => t.result?.outcome === 'warning' || t.result?.outcome === 'fail'

/** What a flagged line recorded; pass or fail answers speak through their badge alone. */
function recorded(t: WoTask): string {
  const value = t.result?.value
  // Small readings such as 0.004 mm keep every digit the technician typed.
  if (typeof value === 'number') return `${Number.isInteger(value) ? fmtNumber(value) : String(value)}${t.unit ? ` ${t.unit}` : ''}`
  return t.type === 'choice' && typeof value === 'string' ? value : ''
}

/** Summary, signature and hand-over. A finished order shows the same summary read-only. */
export function FinishStep({ wo, nav, access, onCompleted }: StepProps & { onCompleted: () => void }) {
  const { dispatch, maps, requests } = useMobileScope()
  const now = useNow()
  const [signature, setSignature] = useState<string | null>(null)
  const finished = DONE_WO_STATUSES.includes(wo.status)
  const flagged = wo.tasks.filter(isFlagged)
  const raised = requests.find((r) => r.inspectionWoId === wo.id)
  const used = wo.parts.filter((l) => l.status === 'consumed')
  const photos =
    wo.attachments.filter((a) => a.kind === 'photo').length +
    wo.tasks.reduce((n, t) => n + (t.type === 'photo' ? (t.result?.photos.length ?? 0) : 0), 0)

  const complete = () => {
    dispatch({ type: 'workOrders/complete', id: wo.id, note: wo.completionNote, signature })
    toast('Work order completed', { tone: 'success', description: `${wo.code} goes to your supervisor for review.` })
    onCompleted()
  }

  const note =
    finished || !access.assigned ? null : wo.status === 'waiting' ? 'Resume the work before you complete it.' : !signature ? 'Sign below to hand the work over.' : null

  return (
    <>
      <Card className="grid grid-cols-2 gap-3 p-5">
        <SummaryTile label="Time on the job" value={fmtDuration(laborMinutes(wo, now))} />
        <SummaryTile label="Parts used" value={String(used.length)} />
        <SummaryTile label="Flagged readings" value={String(flagged.length)} warn={flagged.length > 0} />
        <SummaryTile label="Photos" value={String(photos)} />
      </Card>

      {flagged.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Flagged readings</CardTitle>
            <CardDescription>
              {!finished
                ? 'Completing the work raises a follow-up request for them.'
                : raised
                  ? `${raised.code} was raised for them.`
                  : 'Your supervisor sees them in the review.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {flagged.map((t) => {
              const value = recorded(t)
              return (
                <div key={t.id} className="flex items-center gap-3 rounded-2xl bg-surface-2 px-3.5 py-3">
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold">{t.label}</span>
                    {value && <span className="block text-xs tabular-nums text-muted">{value}</span>}
                  </span>
                  <OutcomeBadge outcome={t.result?.outcome ?? null} />
                </div>
              )
            })}
          </CardContent>
        </Card>
      )}

      {used.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Parts used</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5">
            {used.map((l) => {
              const part = maps.part.get(l.partId)
              return (
                <p key={l.id} className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="min-w-0 truncate">{part?.name ?? 'Removed part'}</span>
                  <span className="shrink-0 font-semibold tabular-nums">
                    {l.qty} {part?.unit}
                  </span>
                </p>
              )
            })}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader
          action={
            access.editable && (
              <Button variant="soft" className="h-11" onClick={() => nav.go('findings')}>
                Edit
              </Button>
            )
          }
        >
          <CardTitle>Work notes</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="whitespace-pre-line text-sm text-body">{wo.completionNote || 'No notes added.'}</p>
        </CardContent>
      </Card>

      {finished ? (
        <SignOff wo={wo} />
      ) : (
        access.working && (
          <Card>
            <CardHeader>
              <CardTitle>Your signature</CardTitle>
              <CardDescription>Sign with your finger to hand the work over.</CardDescription>
            </CardHeader>
            <CardContent>
              <SignaturePad value={signature} onChange={setSignature} />
            </CardContent>
          </Card>
        )
      )}

      <StepActions onBack={nav.back} note={note}>
        {!finished && access.working && (
          <Button size="lg" className="flex-1" disabled={!signature} onClick={complete}>
            <CircleCheck />
            Complete work
          </Button>
        )}
      </StepActions>
    </>
  )
}

function SummaryTile({ label, value, warn = false }: { label: string; value: string; warn?: boolean }) {
  return (
    <div className="rounded-2xl bg-surface-2 p-4">
      <p className={cn('text-2xl font-bold leading-none tabular-nums', warn && 'text-warning')}>{value}</p>
      <p className="mt-1.5 text-xs font-medium text-muted">{label}</p>
    </div>
  )
}

function SignOff({ wo }: { wo: WorkOrder }) {
  const { personName } = useMobileScope()
  return (
    <Card>
      <CardHeader>
        <CardTitle>Sign-off</CardTitle>
        <CardDescription>{wo.completedAt ? `Completed ${fmtWhen(wo.completedAt)}` : 'Completed'}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {wo.signature ? (
          <img src={wo.signature} alt="Technician signature" className="h-32 w-full rounded-2xl bg-surface object-contain" />
        ) : (
          <p className="text-sm text-muted">No signature on file.</p>
        )}
        {wo.verification ? (
          <p className="rounded-2xl bg-success-soft px-4 py-3 text-sm font-semibold text-success">
            Verified by {personName(wo.verification.by)} · {fmtWhen(wo.verification.at)}
            {wo.verification.note ? `. ${wo.verification.note}` : ''}
          </p>
        ) : (
          wo.status === 'completed' && <p className="text-sm text-muted">Waiting for the supervisor to review it.</p>
        )}
      </CardContent>
    </Card>
  )
}
