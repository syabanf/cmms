import { fmtWhen, newId, nowIso } from '@cmms/fixtures'
import type { WoEventKind, WorkOrder } from '@cmms/types'
import { ATTACHMENT_STAGE_LABEL } from '@cmms/types'
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, Textarea, cn } from '@cmms/ui'
import type { LucideIcon } from 'lucide-react'
import {
  BadgeCheck,
  CalendarClock,
  CirclePlus,
  ClipboardCheck,
  MessageSquare,
  Package,
  Paperclip,
  Pencil,
  RefreshCw,
  ShieldCheck,
  Timer,
  TriangleAlert,
  UserCheck,
  Wrench,
} from 'lucide-react'
import { useState } from 'react'
import { useScoped } from '../../../state/scoped'

const EVENT_ICON: Record<WoEventKind, LucideIcon> = {
  created: CirclePlus,
  status: RefreshCw,
  assigned: UserCheck,
  scheduled: CalendarClock,
  labor: Timer,
  part: Package,
  tool: Wrench,
  task: ClipboardCheck,
  failure: TriangleAlert,
  comment: MessageSquare,
  approval: BadgeCheck,
  attachment: Paperclip,
  safety: ShieldCheck,
  edit: Pencil,
}

const PAGE = 12

export function ActivityCard({ wo }: { wo: WorkOrder }) {
  const { dispatch, personName } = useScoped()
  const [comment, setComment] = useState('')
  const [shown, setShown] = useState(PAGE)
  const events = [...wo.events].reverse()

  const post = () => {
    if (!comment.trim()) return
    dispatch({ type: 'workOrders/comment', id: wo.id, text: comment.trim() })
    setComment('')
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Activity</CardTitle>
        <p className="text-sm text-muted">Every change on this work order, newest first</p>
      </CardHeader>
      <CardContent>
        <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end">
          <Textarea
            variant="soft"
            className="min-h-11 flex-1"
            rows={2}
            aria-label="Note for the team"
            placeholder="Add a note for the team"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            onKeyDown={(e) => (e.metaKey || e.ctrlKey) && e.key === 'Enter' && post()}
          />
          <Button variant="secondary" onClick={post} disabled={!comment.trim()}>
            Post
          </Button>
        </div>
        <ol className="relative space-y-4 before:absolute before:bottom-2 before:left-[17px] before:top-2 before:w-px before:bg-border">
          {events.slice(0, shown).map((e) => {
            const Icon = EVENT_ICON[e.kind]
            return (
              <li key={e.id || `${e.at}-${e.text}`} className="relative flex gap-3">
                <span
                  className={cn(
                    'relative flex size-9 shrink-0 items-center justify-center rounded-full ring-4 ring-card [&_svg]:size-4',
                    e.kind === 'comment' ? 'bg-info-soft text-info' : e.kind === 'failure' || e.text.startsWith('Fail') ? 'bg-accent-soft text-accent' : 'bg-surface text-body',
                  )}
                >
                  <Icon />
                </span>
                <div className="min-w-0 pt-1">
                  <p className={cn('text-sm', e.kind === 'comment' ? 'rounded-2xl bg-surface-2 px-3 py-2' : 'font-medium')}>{e.text}</p>
                  <p className="mt-0.5 text-xs text-muted">
                    {e.by ? personName(e.by) : 'System'} · {fmtWhen(e.at)}
                  </p>
                </div>
              </li>
            )
          })}
        </ol>
        {events.length > shown && (
          <div className="mt-4 flex justify-center">
            <Button variant="outline" size="sm" onClick={() => setShown((n) => n + PAGE)}>
              Show {Math.min(PAGE, events.length - shown)} older
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

/** Photos and files attached to the work order. */
export function AttachmentsCard({ wo, canAdd }: { wo: WorkOrder; canAdd: boolean }) {
  const { dispatch, user, personName } = useScoped()
  const add = (files: FileList | null) => {
    for (const file of Array.from(files ?? [])) {
      dispatch({
        type: 'workOrders/attach',
        id: wo.id,
        attachment: {
          id: newId('att'),
          kind: file.type.startsWith('image/') ? 'photo' : file.type.startsWith('video/') ? 'video' : 'document',
          name: file.name,
          url: URL.createObjectURL(file),
          stage: null,
          at: nowIso(),
          by: user.id,
        },
      })
    }
  }
  if (!wo.attachments.length && !canAdd) return null
  return (
    <Card>
      <CardHeader
        action={
          canAdd && (
            <Button asChild variant="outline" size="sm">
              <label className="relative cursor-pointer">
                <Paperclip />
                Attach
                <input type="file" multiple accept="image/*,video/*,application/pdf" className="sr-only" onChange={(e) => add(e.target.files)} />
              </label>
            </Button>
          )
        }
      >
        <CardTitle>Photos and files</CardTitle>
        <p className="text-sm text-muted">{wo.attachments.length ? `${wo.attachments.length} attached` : 'Before and after photos help the next technician.'}</p>
      </CardHeader>
      {wo.attachments.length > 0 && (
        <CardContent className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {wo.attachments.map((a) => (
            <figure key={a.id} className="relative overflow-hidden rounded-2xl bg-surface">
              {a.stage && (
                <Badge variant="ink" className="absolute left-1.5 top-1.5">
                  {ATTACHMENT_STAGE_LABEL[a.stage]}
                </Badge>
              )}
              {a.url && a.kind === 'photo' ? (
                <img src={a.url} alt={a.name} className="aspect-square w-full object-cover" />
              ) : (
                <div className="flex aspect-square items-center justify-center text-muted">
                  <Paperclip className="size-5" />
                </div>
              )}
              <figcaption className="truncate px-2 py-1.5 text-[11px] text-muted" title={`${a.name} · ${personName(a.by)}`}>
                {a.name}
              </figcaption>
            </figure>
          ))}
        </CardContent>
      )}
    </Card>
  )
}
