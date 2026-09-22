import { failureEvents, fmtDateShort, isFailureWork } from '@cmms/fixtures'
import type { FailureReport, WorkOrder } from '@cmms/types'
import { Banner, Button, Card, CardContent, CardHeader, CardTitle, FormField, Textarea, toast } from '@cmms/ui'
import { Repeat } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { paths } from '../../../components/links'
import { FailureCodePicker } from '../../../components/pickers'
import { useScoped } from '../../../state/scoped'
import type { WoAccess } from './useWoAccess'

const EMPTY: FailureReport = { problemId: null, modeId: null, causeId: null, remedyId: null, note: '' }

/** Problem, failure mode, cause and remedy from the failure library, plus a free-text note. */
export function FailureCard({ wo, access }: { wo: WorkOrder; access: WoAccess }) {
  const { dispatch, workOrders, rcas, maps, settings } = useScoped()
  const [draft, setDraft] = useState<FailureReport>(wo.failure ?? EMPTY)
  const saved = wo.failure ?? EMPTY
  const dirty = JSON.stringify(draft) !== JSON.stringify(saved)
  const editable = access.execute || (access.edit && wo.status !== 'closed')

  const earlier = useMemo(() => {
    if (!draft.modeId) return []
    const windowMs = settings.repeatWindowDays * 86_400_000
    const at = Date.parse(wo.requestedAt)
    return failureEvents(workOrders).filter(
      (e) => e.wo.id !== wo.id && e.assetId === wo.assetId && e.modeId === draft.modeId && e.at < at && at - e.at <= windowMs * 2,
    )
  }, [draft.modeId, workOrders, wo.id, wo.assetId, wo.requestedAt, settings.repeatWindowDays])
  const rca = draft.modeId ? rcas.find((r) => r.assetId === wo.assetId && r.modeId === draft.modeId && r.status !== 'closed') : undefined

  const set = (patch: Partial<FailureReport>) => setDraft((d) => ({ ...d, ...patch }))

  return (
    <Card>
      <CardHeader
        action={
          editable && (
            <Button
              size="sm"
              disabled={!dirty}
              onClick={() => {
                dispatch({ type: 'workOrders/setFailure', id: wo.id, failure: draft })
                toast('Failure report saved', { tone: 'success' })
              }}
            >
              Save
            </Button>
          )
        }
      >
        <CardTitle>Failure report</CardTitle>
        <p className="text-sm text-muted">
          {isFailureWork(wo) ? 'Required before completion. It feeds MTBF, the Pareto and repeat detection.' : 'Optional on planned work. Code it when you find a defect.'}
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField label="Problem" hint="What the operator saw">
            <FailureCodePicker kind="problem" disabled={!editable} value={draft.problemId} onChange={(problemId) => set({ problemId })} />
          </FormField>
          <FormField label="Failure mode" hint="How the part failed">
            <FailureCodePicker kind="mode" disabled={!editable} value={draft.modeId} onChange={(modeId) => set({ modeId })} />
          </FormField>
          <FormField label="Cause" hint="Why it failed">
            <FailureCodePicker kind="cause" disabled={!editable} value={draft.causeId} onChange={(causeId) => set({ causeId })} />
          </FormField>
          <FormField label="Remedy" hint="What fixed it">
            <FailureCodePicker kind="remedy" disabled={!editable} value={draft.remedyId} onChange={(remedyId) => set({ remedyId })} />
          </FormField>
        </div>
        <FormField label="Note" hint="Free text stays available for what the codes cannot say.">
          <Textarea value={draft.note} disabled={!editable} placeholder="Both bearings dry, grease dark and hard" onChange={(e) => set({ note: e.target.value })} />
        </FormField>
        {earlier.length > 0 && (
          <Banner
            tone="danger"
            icon={<Repeat />}
            title={`${maps.failureCode.get(draft.modeId!)?.name} failed here before`}
            action={
              rca ? (
                <Button asChild size="sm" variant="outline">
                  <Link to={paths.rca(rca.id)}>{rca.code}</Link>
                </Button>
              ) : undefined
            }
          >
            Earlier: {earlier.map((e) => fmtDateShort(e.at)).join(', ')}. Repeat failures point to a cause the repair did not remove.
          </Banner>
        )}
      </CardContent>
    </Card>
  )
}
