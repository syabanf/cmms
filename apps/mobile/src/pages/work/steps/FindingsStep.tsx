import { fmtAgo, fmtNumber, isFailureWork } from '@cmms/fixtures'
import type { Meter, WorkOrder } from '@cmms/types'
import { FAILURE_CODE_KIND_LABEL, METER_KIND_LABEL } from '@cmms/types'
import { Card, CardContent, CardDescription, CardHeader, CardTitle, Textarea } from '@cmms/ui'
import { MeterReadingForm } from '../../../components/MeterReadingForm'
import { useMobileScope } from '../../../state/scope'
import { FailureCard } from '../FailureCard'
import { type StepProps, missingFailureCodes } from '../flow'
import { PhotosCard } from '../PhotosCard'
import { ContinueButton, StepActions } from '../StepActions'
import { useDraft } from '../useDraft'

/** Failure coding, work notes, before and after photos, and the PM meter reading. */
export function FindingsStep({ wo, nav, access }: StepProps) {
  const { maps } = useMobileScope()
  const missing = missingFailureCodes(wo)
  const blocked = !nav.next && missing.length > 0
  const pm = wo.pmScheduleId ? maps.pm.get(wo.pmScheduleId) : undefined
  const meter = pm && pm.trigger.kind !== 'calendar' ? maps.meter.get(pm.trigger.meterId) : undefined
  const failure = <FailureCard wo={wo} editable={access.editable} />

  return (
    <>
      {/* Breakdown work leads with the required coding; on planned work it is optional and goes last. */}
      {isFailureWork(wo) && failure}
      <NotesCard wo={wo} editable={access.editable} />
      <PhotosCard wo={wo} editable={access.editable} />
      {meter && <MeterCard wo={wo} meter={meter} editable={access.editable} />}
      {!isFailureWork(wo) && failure}
      <StepActions
        onBack={nav.back}
        note={blocked ? `Code the failure: ${missing.map((k) => FAILURE_CODE_KIND_LABEL[k].toLowerCase()).join(', ')}` : null}
        blocked={blocked}
      >
        <ContinueButton onClick={nav.next} />
      </StepActions>
    </>
  )
}

/** Saved as the completion note on blur, so it survives leaving the flow. */
function NotesCard({ wo, editable }: { wo: WorkOrder; editable: boolean }) {
  const { dispatch } = useMobileScope()
  const [draft, setDraft] = useDraft(wo.completionNote)
  const saved = draft.trim() === wo.completionNote
  return (
    <Card>
      <CardHeader>
        <CardTitle>Work notes</CardTitle>
        <CardDescription>What you found and what you did. It becomes the completion note.</CardDescription>
      </CardHeader>
      <CardContent>
        <Textarea
          variant="soft"
          aria-label="Work notes"
          value={draft}
          disabled={!editable}
          placeholder="Chain replaced, tension set, test run 10 minutes without noise"
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => {
            if (!saved) dispatch({ type: 'workOrders/update', id: wo.id, patch: { completionNote: draft.trim() } })
          }}
        />
        {editable && <p className="mt-1.5 text-xs text-muted">{saved && wo.completionNote ? 'Saved' : 'Saves when you leave the box'}</p>}
      </CardContent>
    </Card>
  )
}

function MeterCard({ wo, meter, editable }: { wo: WorkOrder; meter: Meter; editable: boolean }) {
  const { maps } = useMobileScope()
  const asset = maps.asset.get(wo.assetId)
  return (
    <Card>
      <CardHeader>
        <CardTitle>Meter reading</CardTitle>
        <CardDescription>
          This PM runs on the {METER_KIND_LABEL[meter.kind].toLowerCase()} meter. A fresh reading plans the next one from real use.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {editable ? (
          <MeterReadingForm meters={[meter]} initialId={meter.id} assetCode={asset?.code ?? ''} />
        ) : (
          <p className="text-sm text-body tabular-nums">
            Last reading {fmtNumber(meter.value)} {meter.unit}, {fmtAgo(meter.updatedAt)}.
          </p>
        )}
      </CardContent>
    </Card>
  )
}
