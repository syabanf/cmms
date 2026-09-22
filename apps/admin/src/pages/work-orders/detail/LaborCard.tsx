import {
  DEFAULT_HOURLY_COST,
  fmtDateShort,
  fmtDuration,
  fmtHours,
  fmtIdrShort,
  fmtTime,
  fromInput,
  isSameDay,
  laborEntryMinutes,
  laborMinutes,
  newId,
  nowIso,
  toDateTimeInput,
  toMs,
  woCost,
} from '@cmms/fixtures'
import type { WorkOrder } from '@cmms/types'
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  EmptyState,
  FormField,
  Input,
  StatusDot,
  toast,
} from '@cmms/ui'
import { Play, Plus, Square, Timer, Trash } from 'lucide-react'
import { type FormEvent, useState } from 'react'
import { PersonAvatar } from '../../../components/links'
import { PersonPicker } from '../../../components/pickers'
import { useNow, useScoped } from '../../../state/scoped'
import type { WoAccess } from './useWoAccess'

export function LaborCard({ wo, access }: { wo: WorkOrder; access: WoAccess }) {
  const { dispatch, maps, personName } = useScoped()
  const now = useNow(15_000)
  const [logging, setLogging] = useState(false)
  const rate = (personId: string) => maps.person.get(personId)?.technician?.hourlyCost ?? DEFAULT_HOURLY_COST
  const total = laborMinutes(wo, now)
  const cost = woCost(wo, maps.person, now).labor
  const clockable = wo.status === 'in_progress' ? wo.assigneeIds.filter((id) => !wo.labor.some((e) => e.personId === id && e.end === null)) : []

  return (
    <Card>
      <CardHeader
        action={
          access.execute && (
            <Button variant="outline" size="sm" onClick={() => setLogging(true)}>
              <Plus />
              Log time
            </Button>
          )
        }
      >
        <CardTitle>Labor</CardTitle>
        <p className="text-sm text-muted">
          {fmtHours(total, 2)} man-hours · {fmtIdrShort(cost)}
        </p>
      </CardHeader>
      <CardContent className="space-y-2">
        {access.execute && clockable.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 rounded-2xl bg-surface-2 p-3">
            <span className="text-xs font-medium text-muted">Clock in</span>
            {clockable.map((id) => (
              <Button
                key={id}
                variant="soft"
                size="sm"
                className="bg-card"
                onClick={() => dispatch({ type: 'workOrders/clock', id: wo.id, personId: id, running: true })}
              >
                <Play />
                {personName(id).split(' ')[0]}
              </Button>
            ))}
          </div>
        )}
        {wo.labor.length === 0 ? (
          <EmptyState compact icon={<Timer />} title="No time logged" description="Clocks start when a technician starts the work, or log time from a paper job card." />
        ) : (
          wo.labor.map((e) => {
            const minutes = laborEntryMinutes(e, now)
            const running = e.end === null
            return (
              <div key={e.id} className="flex flex-wrap items-center gap-3 rounded-2xl bg-surface-2 p-3">
                <PersonAvatar personId={e.personId} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{personName(e.personId)}</p>
                  <p className="text-xs tabular-nums text-muted">
                    {fmtDateShort(e.start)} {fmtTime(e.start)}
                    {' to '}
                    {running ? 'now' : `${e.end && !isSameDay(toMs(e.start), toMs(e.end)) ? `${fmtDateShort(e.end)} ` : ''}${fmtTime(e.end!)}`}
                  </p>
                </div>
                <div className="text-right">
                  <p className="flex items-center justify-end gap-1.5 text-sm font-bold tabular-nums">
                    {running && <StatusDot tone="info" pulse />}
                    {fmtDuration(minutes)}
                  </p>
                  <p className="text-[11px] text-muted tabular-nums">{fmtIdrShort((minutes / 60) * rate(e.personId))}</p>
                </div>
                {access.execute &&
                  (running ? (
                    <Button variant="outline" size="sm" onClick={() => dispatch({ type: 'workOrders/clock', id: wo.id, personId: e.personId, running: false })}>
                      <Square />
                      Stop
                    </Button>
                  ) : (
                    <Button variant="ghost" size="icon-sm" aria-label="Remove entry" onClick={() => dispatch({ type: 'workOrders/removeLabor', id: wo.id, entryId: e.id })}>
                      <Trash />
                    </Button>
                  ))}
              </div>
            )
          })
        )}
      </CardContent>
      <LogTimeDialog
        open={logging}
        onOpenChange={setLogging}
        defaultPerson={wo.assigneeIds[0] ?? null}
        onLog={(personId, start, end) => {
          dispatch({ type: 'workOrders/addLabor', id: wo.id, entry: { id: newId('lab'), personId, start, end } })
          toast(`Logged ${fmtDuration((toMs(end) - toMs(start)) / 60_000)} for ${personName(personId)}`, { tone: 'success' })
        }}
      />
    </Card>
  )
}

function LogTimeDialog({
  open,
  onOpenChange,
  defaultPerson,
  onLog,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  defaultPerson: string | null
  onLog: (personId: string, start: string, end: string) => void
}) {
  const [personId, setPersonId] = useState<string | null>(defaultPerson)
  const [start, setStart] = useState(() => toDateTimeInput(nowIso()))
  const [end, setEnd] = useState(() => toDateTimeInput(nowIso()))
  const valid = !!personId && !!start && !!end && toMs(fromInput(end)) > toMs(fromInput(start))

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!valid) return
    onLog(personId!, fromInput(start), fromInput(end))
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>Log time</DialogTitle>
            <DialogDescription>For work recorded on a paper job card or done without the app.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField label="Technician" htmlFor="log-person" className="sm:col-span-2">
              <PersonPicker id="log-person" allowOnLeave value={personId} onChange={setPersonId} />
            </FormField>
            <FormField label="Start" htmlFor="log-start">
              <Input id="log-start" type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} />
            </FormField>
            <FormField label="End" htmlFor="log-end" error={start && end && !valid && personId ? 'End must be after start.' : undefined}>
              <Input id="log-end" type="datetime-local" value={end} onChange={(e) => setEnd(e.target.value)} />
            </FormField>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!valid}>
              Log time
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
