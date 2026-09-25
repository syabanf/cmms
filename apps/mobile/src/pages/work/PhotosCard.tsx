import { newId, nowIso } from '@cmms/fixtures'
import type { AttachmentStage, WorkOrder } from '@cmms/types'
import { ATTACHMENT_STAGE_LABEL } from '@cmms/types'
import { Card, CardContent, CardDescription, CardHeader, CardTitle, Kicker, PhotoInput, toast } from '@cmms/ui'
import { PhotoGrid } from '../../components/PhotoGrid'
import { useMobileScope } from '../../state/scope'

const STAGES: AttachmentStage[] = ['before', 'after']
const PER_STAGE = 6

/** Before and after shots by stage. Photos with no stage, taken during the work or seeded, sit under Other photos. */
export function PhotosCard({ wo, editable }: { wo: WorkOrder; editable: boolean }) {
  const { user, dispatch } = useMobileScope()
  const photos = wo.attachments.filter((a) => a.kind === 'photo')
  const other = photos.filter((p) => p.stage === null)

  const add = (stage: AttachmentStage, count: number, urls: string[]) => {
    const label = ATTACHMENT_STAGE_LABEL[stage]
    const at = nowIso()
    urls.forEach((url, i) =>
      dispatch({
        type: 'workOrders/attach',
        id: wo.id,
        attachment: { id: newId('att'), kind: 'photo', name: `${label} photo ${count + i + 1}.jpg`, url, stage, at, by: user.id },
      }),
    )
    toast(urls.length === 1 ? `${label} photo added` : `${urls.length} ${label.toLowerCase()} photos added`, { tone: 'success' })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Photos</CardTitle>
        <CardDescription>Before and after shots stay in the machine history.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {STAGES.map((stage) => {
          const label = ATTACHMENT_STAGE_LABEL[stage]
          const list = photos.filter((p) => p.stage === stage)
          return (
            <div key={stage} className="space-y-2">
              <Kicker>{label}</Kicker>
              {editable ? (
                // Work order photos cannot be deleted, so the input shows no remove button.
                <PhotoInput
                  photos={list.map((p) => p.url ?? '')}
                  onAdd={(urls) => add(stage, list.length, urls)}
                  max={PER_STAGE}
                  label={`${label} photo`}
                />
              ) : list.length ? (
                <PhotoGrid photos={list} />
              ) : (
                <p className="text-sm text-muted">No {label.toLowerCase()} photo.</p>
              )}
            </div>
          )
        })}
        {other.length > 0 && (
          <div className="space-y-2">
            <Kicker>Other photos</Kicker>
            <PhotoGrid photos={other} />
          </div>
        )}
      </CardContent>
    </Card>
  )
}
