import { fmtDate, fromInput, nowIso, nowMs, toDateInput, triggerText } from '@cmms/fixtures'
import type { CapaAction, Rca } from '@cmms/types'
import { CAPA_KIND_LABEL } from '@cmms/types'
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  ConfirmDialog,
  EmptyState,
  Input,
  NativeSelect,
  ProgressBar,
  Switch,
  cn,
  toast,
} from '@cmms/ui'
import { CalendarClock, ListChecks, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { useAuth } from '../../auth/auth'
import { PersonChip, paths } from '../../components/links'
import { PersonPicker } from '../../components/pickers'
import { useScoped } from '../../state/scoped'
import { CAPA_KINDS, CapaDialog } from './CapaDialog'
import { EditableText } from './EditableText'
import { type RcaUpdate, doneCount, isPastDue, overdueActions, pmChangeIn, runsOnMeter, withRuntimeTrigger } from './lib'

/** Corrective and preventive actions (CAPA) with owners, due dates and a done switch. */
export function CapaCard({ rca, editable, update, now }: { rca: Rca; editable: boolean; update: RcaUpdate; now: number }) {
  const { can } = useAuth()
  const [adding, setAdding] = useState(false)
  const [deleting, setDeleting] = useState<CapaAction | null>(null)
  const done = doneCount(rca.actions)
  const total = rca.actions.length
  const overdue = overdueActions(rca.actions, now).length

  const patch = (id: string, fields: Partial<CapaAction>) =>
    update((r) => ({ ...r, actions: r.actions.map((a) => (a.id === id ? { ...a, ...fields } : a)) }))

  return (
    <Card>
      <CardHeader
        action={
          editable ? (
            <Button variant="outline" size="sm" onClick={() => setAdding(true)}>
              <Plus />
              Add action
            </Button>
          ) : undefined
        }
      >
        <CardTitle>Corrective and preventive actions</CardTitle>
        <CardDescription>
          {total ? `${done} of ${total} done${overdue ? `, ${overdue} overdue` : ''}` : 'What fixes this failure and what stops it from coming back.'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {total ? (
          <>
            <ProgressBar value={done / total} tone={done === total ? 'success' : 'ink'} aria-label="Actions done" className="mb-4" />
            <ul className="space-y-2">
              {rca.actions.map((action) => (
                <CapaRow
                  key={action.id}
                  action={action}
                  editable={editable}
                  canApply={editable && can('pm.manage')}
                  now={now}
                  onPatch={(fields) => patch(action.id, fields)}
                  onDelete={() => setDeleting(action)}
                />
              ))}
            </ul>
          </>
        ) : (
          <EmptyState
            compact
            icon={<ListChecks />}
            title="No actions yet"
            description="Add a corrective action for this failure and a preventive action for the root cause."
            action={
              editable ? (
                <Button size="sm" onClick={() => setAdding(true)}>
                  <Plus />
                  Add action
                </Button>
              ) : undefined
            }
          />
        )}
      </CardContent>

      <CapaDialog
        open={adding}
        onOpenChange={setAdding}
        ownerId={rca.ownerId}
        onAdd={(action) => {
          update((r) => ({ ...r, actions: [...r.actions, action] }))
          toast('Action added', { tone: 'success', description: action.text })
        }}
      />
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => {
          if (!open) setDeleting(null)
        }}
        title="Delete this action?"
        description={deleting ? `"${deleting.text}" leaves the RCA together with its owner and due date.` : undefined}
        confirmLabel="Delete action"
        destructive
        onConfirm={() => {
          if (!deleting) return
          update((r) => ({ ...r, actions: r.actions.filter((a) => a.id !== deleting.id) }))
          toast('Action deleted', { tone: 'success' })
          setDeleting(null)
        }}
      />
    </Card>
  )
}

function CapaRow({
  action,
  editable,
  canApply,
  now,
  onPatch,
  onDelete,
}: {
  action: CapaAction
  editable: boolean
  canApply: boolean
  now: number
  onPatch: (fields: Partial<CapaAction>) => void
  onDelete: () => void
}) {
  const s = useScoped()
  const navigate = useNavigate()
  const done = action.status === 'done'
  const late = !done && isPastDue(action.dueAt, now)

  // "Change PM-0003 ... to every 400 runtime hours" can be applied to the schedule directly.
  const change = pmChangeIn(action.text)
  const pm = change ? s.pmSchedules.find((p) => p.code === change.code) : undefined
  const meter = pm ? s.meters.find((m) => m.assetId === pm.assetId && m.kind === 'runtime') : undefined
  const applicable = canApply && !done && !!change && !!pm && !!meter && !runsOnMeter(pm, meter.id, change.hours)

  const setDone = (value: boolean) => {
    onPatch({ status: value ? 'done' : 'open', doneAt: value ? nowIso() : null })
    toast(value ? 'Action marked done' : 'Action reopened', { tone: value ? 'success' : 'default' })
  }

  const apply = () => {
    if (!change || !pm || !meter) return
    const next = withRuntimeTrigger(pm, meter, change.hours, nowMs())
    s.dispatch({ type: 'pm/upsert', item: next })
    onPatch({ status: 'done', doneAt: nowIso() })
    toast(`${pm.code} follows runtime now`, {
      tone: 'success',
      description: `${triggerText(next, s.maps.meter)}. Action marked done.`,
      action: { label: 'Open PM', onClick: () => navigate(paths.pm(pm.id)) },
    })
  }

  return (
    <li className="rounded-2xl bg-surface-2 p-3">
      <div className="flex items-start gap-3">
        <div className={editable ? 'pt-3' : 'pt-0.5'}>
          <Switch size="sm" checked={done} disabled={!editable} onCheckedChange={setDone} aria-label={done ? 'Mark as open' : 'Mark as done'} />
        </div>
        <div className="min-w-0 flex-1">
          {editable ? (
            <EditableText
              label="Action"
              value={action.text}
              className={cn('bg-card', done && 'text-muted line-through')}
              onCommit={(text) => {
                if (!text) return onDelete()
                onPatch({ text })
                toast('Action updated', { tone: 'success' })
              }}
            />
          ) : (
            <p className={cn('text-sm font-medium', done && 'text-muted line-through')}>{action.text}</p>
          )}

          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
            {editable ? (
              <NativeSelect
                variant="inline"
                aria-label="Action type"
                value={action.kind}
                onChange={(e) => {
                  const kind = e.target.value === 'corrective' ? 'corrective' : 'preventive'
                  onPatch({ kind })
                  toast(`Marked as ${CAPA_KIND_LABEL[kind].toLowerCase()}`, { tone: 'success' })
                }}
                options={CAPA_KINDS.map((kind) => ({ value: kind, label: CAPA_KIND_LABEL[kind] }))}
                className={action.kind === 'preventive' ? '[&_select]:bg-info-soft [&_select]:text-info' : '[&_select]:bg-card'}
              />
            ) : (
              <Badge variant={action.kind === 'preventive' ? 'info' : 'default'}>{CAPA_KIND_LABEL[action.kind]}</Badge>
            )}

            {editable ? (
              <PersonPicker
                variant="inline"
                people={s.people}
                value={action.ownerId}
                onChange={(id) => {
                  if (!id) return
                  onPatch({ ownerId: id })
                  toast(`Owner set to ${s.personName(id)}`, { tone: 'success' })
                }}
              />
            ) : (
              <PersonChip personId={action.ownerId} />
            )}

            {editable ? (
              <label className="inline-flex items-center gap-1.5 text-muted">
                Due
                <Input
                  type="date"
                  value={toDateInput(action.dueAt)}
                  className="w-auto"
                  inputClassName={cn('h-8 w-[9.5rem] rounded-full px-3 text-xs', late && 'font-semibold text-accent')}
                  onChange={(e) => {
                    if (!e.target.value) return
                    onPatch({ dueAt: fromInput(`${e.target.value}T09:00`) })
                    toast('Due date updated', { tone: 'success' })
                  }}
                />
              </label>
            ) : (
              <span className={cn('tabular-nums', late ? 'font-semibold text-accent' : 'text-muted')}>Due {fmtDate(action.dueAt)}</span>
            )}
            {late && <span className="font-semibold text-accent">Late</span>}
            {done && action.doneAt && <span className="text-muted">Done {fmtDate(action.doneAt)}</span>}

            {applicable && (
              <Button variant="secondary" size="sm" onClick={apply}>
                <CalendarClock />
                Apply to PM
              </Button>
            )}
          </div>

          {pm && (
            <p className="mt-2 text-xs text-muted">
              <Link to={paths.pm(pm.id)} className="font-mono font-medium text-foreground hover:text-accent hover:underline">
                {pm.code}
              </Link>
              : {triggerText(pm, s.maps.meter)}
              {!meter && '. This asset has no runtime meter to follow.'}
            </p>
          )}
        </div>
        {editable && (
          <Button variant="ghost" size="icon-sm" aria-label="Delete action" onClick={onDelete} className="mt-1.5">
            <Trash2 />
          </Button>
        )}
      </div>
    </li>
  )
}
