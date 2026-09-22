import {
  dayKey,
  fmtDate,
  fmtDateShort,
  fmtDateTime,
  fmtDuration,
  fmtNumber,
  fmtTime,
  fmtWeekday,
  fromDayKey,
  isActive,
  isSameDay,
  plannedAt,
  plural,
  pmDue,
  toMs,
  triggerText,
} from '@cmms/fixtures'
import { WO_TYPE_LABEL } from '@cmms/types'
import { Badge, Button, IconTile, Input, type Tone, cn, toast } from '@cmms/ui'
import { CalendarClock, CalendarPlus, Plus, UserPlus } from 'lucide-react'
import { Fragment, type ReactNode, useState } from 'react'
import { Link } from 'react-router'
import { useAuth } from '../../auth/auth'
import { PriorityBadge, WoStatusBadge } from '../../components/badges'
import { useCreate } from '../../components/create'
import { WoTypeIcon } from '../../components/icons'
import { AssetLink, PersonChip, paths } from '../../components/links'
import { PeoplePicker } from '../../components/pickers'
import { useNow, useScoped } from '../../state/scoped'
import { usePmActions } from '../pm/actions'
import type { CalendarEntry, EntryTone } from './lib'
import { useReschedule } from './useReschedule'

const CALIBRATION_PLAN_ID = 'jp-jp-cal-001'

const TILE_TONE: Record<EntryTone, Tone> = { forecast: 'default', done: 'default', urgent: 'accent', planned: 'info', neutral: 'default' }

/** What a calendar entry opens to: facts plus the actions that entry allows. */
export function EntryDetails({ entry, onDone }: { entry: CalendarEntry; onDone: () => void }) {
  if (entry.item.kind === 'work_order') return <WorkOrderDetails entry={entry} onDone={onDone} />
  if (entry.item.kind === 'pm_forecast') return <ForecastDetails entry={entry} onDone={onDone} />
  return <CalibrationDetails entry={entry} onDone={onDone} />
}

function Header({ entry, code, kind, title, badge }: { entry: CalendarEntry; code: string; kind: string; title: string; badge: ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <IconTile size="sm" tone={TILE_TONE[entry.tone]}>
        <WoTypeIcon type={entry.item.woType} />
      </IconTile>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">
          <span className="font-mono normal-case tracking-normal">{code}</span> · {kind}
        </p>
        <p className="mt-0.5 font-semibold leading-snug">{title}</p>
      </div>
      <span className="shrink-0">{badge}</span>
    </div>
  )
}

function Facts({ rows }: { rows: ([string, ReactNode] | null)[] }) {
  return (
    <dl className="mt-3 grid grid-cols-[5.5rem_minmax(0,1fr)] gap-x-3 gap-y-2 text-sm">
      {rows.map(
        (row) =>
          row && (
            <Fragment key={row[0]}>
              <dt className="text-muted">{row[0]}</dt>
              <dd className="min-w-0 break-words">{row[1]}</dd>
            </Fragment>
          ),
      )}
    </dl>
  )
}

function WorkOrderDetails({ entry, onDone }: { entry: CalendarEntry; onDone: () => void }) {
  const { maps, dispatch, personName, locationPath } = useScoped()
  const { can } = useAuth()
  const now = useNow()
  const reschedule = useReschedule()
  const wo = entry.item.woId ? maps.workOrder.get(entry.item.woId) : undefined
  const planned = wo ? toMs(plannedAt(wo)) : now
  const [mode, setMode] = useState<'view' | 'schedule' | 'assign'>('view')
  const [date, setDate] = useState(dayKey(planned))
  const [time, setTime] = useState(fmtTime(planned))
  const [people, setPeople] = useState<string[]>(wo?.assigneeIds ?? [])
  if (!wo) return <p className="text-sm text-muted">This work order no longer exists.</p>

  const asset = maps.asset.get(wo.assetId)
  const plan = wo.jobPlanId ? maps.jobPlan.get(wo.jobPlanId) : undefined
  const canPlan = can('wo.assign') && isActive(wo)
  const late = entry.item.overdue
  const today = dayKey(now)
  const names = wo.assigneeIds.map((id) => personName(id)).join(', ')

  const saveSchedule = () => {
    const [hours = 0, minutes = 0] = time.split(':').map(Number)
    reschedule(wo.id, fromDayKey(date, hours, minutes))
    onDone()
  }
  const saveAssign = () => {
    dispatch({ type: 'workOrders/assign', id: wo.id, assigneeIds: people })
    toast(people.length ? `Assigned to ${people.map((id) => personName(id)).join(', ')}` : 'Work order unassigned', {
      tone: 'success',
      description: `${wo.code} ${wo.title}`,
    })
    onDone()
  }

  return (
    <div>
      <Header entry={entry} code={wo.code} kind={WO_TYPE_LABEL[wo.type]} title={wo.title} badge={<WoStatusBadge status={wo.status} waitingReason={wo.waitingReason} />} />
      <Facts
        rows={[
          ['Asset', <AssetLink assetId={wo.assetId} />],
          asset ? ['Location', locationPath(asset.locationId)] : null,
          [
            'Start',
            `${wo.scheduledAt ? `${fmtWeekday(planned)} ${fmtDateShort(planned)}, ${fmtTime(planned)}` : 'Not scheduled'} · ${fmtDuration(wo.estimatedMin)}`,
          ],
          ['Due', <span className={cn(late && 'font-semibold text-accent')}>{`${fmtDateTime(wo.dueAt)}${late ? ', overdue' : ''}`}</span>],
          ['Priority', <PriorityBadge priority={wo.priority} long />],
          ['Assigned', names || <span className="text-muted">Nobody yet</span>],
        ]}
      />

      {mode === 'schedule' && (
        <div className="mt-4 space-y-3 rounded-2xl bg-surface p-3">
          <p className="text-sm font-semibold">New start</p>
          <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,7.5rem)] gap-2">
            <Input type="date" aria-label="Start date" min={today} value={date} onChange={(e) => setDate(e.target.value)} />
            <Input type="time" aria-label="Start time" step={900} value={time} onChange={(e) => setTime(e.target.value)} />
          </div>
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={() => setMode('view')}>
              Cancel
            </Button>
            <Button size="sm" disabled={!date || !time || date < today} onClick={saveSchedule}>
              Save
            </Button>
          </div>
        </div>
      )}

      {mode === 'assign' && (
        <div className="mt-4 space-y-3 rounded-2xl bg-surface p-3">
          <p className="text-sm font-semibold">Technicians</p>
          <PeoplePicker values={people} skillId={plan?.skillId} onChange={setPeople} />
          {plan && (
            <p className="text-xs text-muted">
              {plan.code} asks for {maps.skill.get(plan.skillId)?.name ?? 'the plan skill'} L{plan.skillLevel}+.
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={() => setMode('view')}>
              Cancel
            </Button>
            <Button size="sm" disabled={people.join() === wo.assigneeIds.join()} onClick={saveAssign}>
              Save
            </Button>
          </div>
        </div>
      )}

      {mode === 'view' && (
        <div className="mt-4 flex flex-wrap gap-2">
          <Button asChild size="sm">
            <Link to={paths.workOrder(wo.id)}>Open work order</Link>
          </Button>
          {canPlan && (
            <Button size="sm" variant="outline" onClick={() => setMode('schedule')}>
              <CalendarClock />
              Reschedule
            </Button>
          )}
          {canPlan && (
            <Button size="sm" variant="outline" onClick={() => setMode('assign')}>
              <UserPlus />
              Assign
            </Button>
          )}
        </div>
      )}
    </div>
  )
}

function ForecastDetails({ entry, onDone }: { entry: CalendarEntry; onDone: () => void }) {
  const { maps } = useScoped()
  const { can } = useAuth()
  const now = useNow()
  const { blockReason, generate } = usePmActions()
  const pm = entry.item.pmId ? maps.pm.get(entry.item.pmId) : undefined
  if (!pm) return <p className="text-sm text-muted">This PM schedule no longer exists.</p>

  const at = entry.item.at
  const plan = maps.jobPlan.get(pm.jobPlanId)
  const due = pmDue(pm, maps.meter, now)
  const meter = pm.trigger.kind === 'calendar' ? undefined : maps.meter.get(pm.trigger.meterId)
  const next = isSameDay(due.dueAt, at)
  const basis =
    next && due.dueBy === 'meter' && meter && due.meterDueValue !== null
      ? ` by meter (${fmtNumber(due.meterDueValue)} ${meter.unit})`
      : next
        ? ' by date'
        : ', projected'
  const canGenerate = can('pm.manage')
  const reason = blockReason(pm)

  return (
    <div>
      <Header entry={entry} code={pm.code} kind="PM forecast" title={pm.name} badge={<Badge variant="outline">Not generated</Badge>} />
      <Facts
        rows={[
          ['Asset', <AssetLink assetId={pm.assetId} />],
          ['Due', <span className={cn(entry.item.overdue && 'font-semibold text-accent')}>{`${fmtWeekday(at)} ${fmtDate(at)}${basis}`}</span>],
          ['Trigger', triggerText(pm, maps.meter)],
          [
            'Job plan',
            plan ? (
              <Link to={paths.jobPlan(plan.id)} className="hover:text-accent">
                <span className="font-mono text-xs">{plan.code}</span> {plan.name}
              </Link>
            ) : (
              <span className="text-muted">Deleted</span>
            ),
          ],
          ['Duration', fmtDuration(entry.item.durationMin)],
          ['Assignee', <PersonChip personId={pm.assigneeId} />],
        ]}
      />
      {canGenerate && reason && <p className="mt-3 text-xs text-muted">{reason}, so this occurrence can't be generated yet.</p>}
      <div className="mt-4 flex flex-wrap gap-2">
        {canGenerate && (
          <Button
            size="sm"
            disabled={reason !== null}
            onClick={() => {
              generate(pm, at)
              onDone()
            }}
          >
            <CalendarPlus />
            Generate work order now
          </Button>
        )}
        <Button asChild size="sm" variant="outline">
          <Link to={paths.pm(pm.id)}>Open schedule</Link>
        </Button>
      </div>
    </div>
  )
}

function CalibrationDetails({ entry, onDone }: { entry: CalendarEntry; onDone: () => void }) {
  const { maps, workOrders } = useScoped()
  const { can } = useAuth()
  const create = useCreate()
  const asset = entry.item.assetId ? maps.asset.get(entry.item.assetId) : undefined
  const tool = entry.item.toolId ? maps.tool.get(entry.item.toolId) : undefined
  const plan = asset?.calibration ?? tool?.calibration ?? null
  const vendor = plan?.vendorId ? maps.vendor.get(plan.vendorId)?.name : undefined
  const openWo = asset ? workOrders.find((w) => w.assetId === asset.id && w.type === 'calibration' && isActive(w)) : undefined
  const at = entry.item.at

  return (
    <div>
      <Header
        entry={entry}
        code={entry.code}
        kind="Calibration"
        title={asset?.name ?? tool?.name ?? 'Removed item'}
        badge={
          entry.item.overdue ? (
            <Badge variant="danger" dot>
              Overdue
            </Badge>
          ) : (
            <Badge variant="info">Due</Badge>
          )
        }
      />
      <Facts
        rows={[
          ['Due', `${fmtWeekday(at)} ${fmtDate(at)}`],
          ['Last done', plan?.lastAt ? fmtDate(plan.lastAt) : 'Never'],
          plan ? ['Interval', `Every ${plural(plan.intervalMonths, 'month')}`] : null,
          ['Vendor', vendor ?? 'In house'],
          asset ? ['Asset', <AssetLink assetId={asset.id} />] : tool ? ['Kept at', tool.location] : null,
        ]}
      />
      {openWo && (
        <p className="mt-3 text-xs text-muted">
          {openWo.code} covers this calibration, planned for {fmtDate(plannedAt(openWo))}.
        </p>
      )}
      <div className="mt-4 flex flex-wrap gap-2">
        {openWo && (
          <Button asChild size="sm">
            <Link to={paths.workOrder(openWo.id)}>Open {openWo.code}</Link>
          </Button>
        )}
        {asset && !openWo && can('wo.create') && (
          <Button
            size="sm"
            onClick={() => {
              create.workOrder({
                assetId: asset.id,
                type: 'calibration',
                jobPlanId: maps.jobPlan.has(CALIBRATION_PLAN_ID) ? CALIBRATION_PLAN_ID : undefined,
                title: `${asset.name} calibration`,
              })
              onDone()
            }}
          >
            <Plus />
            Create calibration work order
          </Button>
        )}
        {tool && (
          <Button asChild size="sm" variant="outline">
            <Link to={paths.tool(tool.id)}>Open tool</Link>
          </Button>
        )}
      </div>
    </div>
  )
}
