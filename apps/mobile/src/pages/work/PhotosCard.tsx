import { newId, nowIso } from '@cmms/fixtures'
import type { WorkOrder } from '@cmms/types'
import { Card, CardContent, CardDescription, CardHeader, CardTitle, Kicker, PhotoInput, toast } from '@cmms/ui'
import { PhotoGrid } from '../../components/PhotoGrid'
import { useMobileScope } from '../../state/scope'

// Attachments carry no before/after field, so the file name holds it: "Before photo 1.jpg".
const GROUPS = ['Before', 'After'] as const
const PER_GROUP = 6

export function PhotosCard({ wo, editable }: { wo: WorkOrder; editable: boolean }) {
  const { user, dispatch } = useMobileScope()
  const photos = wo.attachments.filter((a) => a.kind === 'photo')
  const inGroup = (group: string) => photos.filter((p) => p.name.startsWith(`${group} photo`))
  const earlier = photos.filter((p) => !GROUPS.some((g) => p.name.startsWith(`${g} photo`)))

  const add = (group: string, count: number, urls: string[]) => {
    const at = nowIso()
    urls.forEach((url, i) =>
      dispatch({
        type: 'workOrders/attach',
        id: wo.id,
        attachment: { id: newId('att'), kind: 'photo', name: `${group} photo ${count + i + 1}.jpg`, url, at, by: user.id },
      }),
    )
    toast(urls.length === 1 ? `${group} photo added` : `${urls.length} ${group.toLowerCase()} photos added`, { tone: 'success' })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Photos</CardTitle>
        <CardDescription>Before and after shots stay in the machine history.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {GROUPS.map((group) => {
          const list = inGroup(group)
          return (
            <div key={group} className="space-y-2">
              <Kicker>{group}</Kicker>
              {editable ? (
                // Work order photos cannot be deleted, so the input shows no remove button.
                <PhotoInput
                  photos={list.map((p) => p.url ?? '')}
                  onAdd={(urls) => add(group, list.length, urls)}
                  max={PER_GROUP}
                  label={`${group} photo`}
                />
              ) : list.length ? (
                <PhotoGrid photos={list} />
              ) : (
                <p className="text-sm text-muted">No {group.toLowerCase()} photo.</p>
              )}
            </div>
          )
        })}
        {earlier.length > 0 && (
          <div className="space-y-2">
            <Kicker>Earlier photos</Kicker>
            <PhotoGrid photos={earlier} />
          </div>
        )}
      </CardContent>
    </Card>
  )
}
