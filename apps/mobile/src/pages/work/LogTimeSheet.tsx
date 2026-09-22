import {
  MINUTE,
  dayKey,
  fmtDuration,
  fmtHours,
  fmtTime,
  fromInput,
  laborEntryMinutes,
  laborMinutes,
  newId,
  nowMs,
  toDateTimeInput,
  toIso,
  toMs,
} from '@cmms/fixtures'
import type { WorkOrder } from '@cmms/types'
import { Avatar, Button, FormField, Input, Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, toast } from '@cmms/ui'
import { Play, Plus, Square } from 'lucide-react'
import { type FormEvent, useState } from 'react'
import { RunningTimer } from '../../components/RunningTimer'
import { useMobileScope, useNow } from '../../state/scope'

const MAX_MINUTES = 12 * 60

export function LogTimeSheet({
  wo,
  canClock,
  open,
  onOpenChange,
}: {
  wo: WorkOrder
  /** Clocking needs the job in progress; missed time can be added while paused too. */
  canClock: boolean
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom">
        <LogTimeForm wo={wo} canClock={canClock} />
      </SheetContent>
    </Sheet>
  )
}

function LogTimeForm({ wo, canClock }: { wo: WorkOrder; canClock: boolean }) {
  const { user, maps, personName, dispatch } = useMobileScope()
  const now = useNow()
  const [start, setStart] = useState(() => toDateTimeInput(toIso(nowMs() - 30 * MINUTE)).slice(11))
  const [minutes, setMinutes] = useState('30')
  const running = wo.labor.find((e) => e.personId === user.id && e.end === null)
  const entries = [...wo.labor].sort((a, b) => toMs(a.start) - toMs(b.start))

  const duration = Number(minutes)
  const startMs = /^\d{2}:\d{2}$/.test(start) ? toMs(fromInput(`${dayKey(now)}T${start}`)) : Number.NaN
  const endMs = startMs + duration * MINUTE
  const error = Number.isNaN(startMs)
    ? 'Pick the time you started.'
    : !Number.isInteger(duration) || duration < 1 || duration > MAX_MINUTES
      ? `Enter whole minutes, up to ${MAX_MINUTES}.`
      : endMs > now
        ? 'That ends later than now. Pick an earlier start.'
        : null

  const toggle = () => {
    dispatch({ type: 'workOrders/clock', id: wo.id, personId: user.id, running: !running })
    if (running) toast('Clocked out', { tone: 'success', description: `${fmtDuration(laborEntryMinutes(running))} logged on ${wo.code}` })
    else toast('Clocked in', { tone: 'success', description: 'Your time now counts on this work order.' })
  }

  const add = (e: FormEvent) => {
    e.preventDefault()
    if (error) return
    dispatch({ type: 'workOrders/addLabor', id: wo.id, entry: { id: newId('lab'), personId: user.id, start: toIso(startMs), end: toIso(endMs) } })
    toast(`${fmtDuration(duration)} logged`, { tone: 'success', description: `${fmtTime(startMs)} to ${fmtTime(endMs)} on ${wo.code}` })
  }

  return (
    <>
      <SheetHeader>
        <SheetTitle>Log time</SheetTitle>
        <SheetDescription>
          {fmtHours(laborMinutes(wo, now))} man-hours on {wo.code} so far.
        </SheetDescription>
      </SheetHeader>
      <div className="space-y-4 px-5 pb-2">
        {entries.length > 0 && (
          <div className="space-y-2">
            {entries.map((e) => (
              <div key={e.id} className="flex items-center gap-3 rounded-2xl bg-surface-2 px-3.5 py-3">
                <Avatar name={personName(e.personId)} color={maps.person.get(e.personId)?.color} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{personName(e.personId)}</p>
                  <p className="text-xs tabular-nums text-muted">
                    {fmtTime(e.start)} to {e.end ? fmtTime(e.end) : 'now'}
                  </p>
                </div>
                {e.end ? (
                  <span className="text-sm font-bold tabular-nums">{fmtDuration(laborEntryMinutes(e, now))}</span>
                ) : (
                  <RunningTimer since={e.start} className="text-sm font-bold text-info" />
                )}
              </div>
            ))}
          </div>
        )}
        {canClock && (
          <Button variant={running ? 'outline' : 'secondary'} size="lg" className="w-full" onClick={toggle}>
            {running ? <Square /> : <Play />}
            {running ? 'Clock out' : 'Clock in'}
          </Button>
        )}
        <form onSubmit={add} noValidate className="space-y-3 rounded-2xl bg-surface-2 p-4">
          <p className="text-sm font-semibold">Add time you did not clock today</p>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Started at">
              <Input type="time" value={start} onChange={(e) => setStart(e.target.value)} inputClassName="tabular-nums" />
            </FormField>
            <FormField label="Minutes">
              <Input inputMode="numeric" value={minutes} onChange={(e) => setMinutes(e.target.value)} inputClassName="tabular-nums" />
            </FormField>
          </div>
          {error && <p className="text-xs font-medium text-danger">{error}</p>}
          <Button type="submit" variant="card" className="h-11 w-full" disabled={!!error}>
            <Plus />
            {error ? 'Add time' : `Add ${fmtDuration(duration)}`}
          </Button>
        </form>
      </div>
    </>
  )
}
