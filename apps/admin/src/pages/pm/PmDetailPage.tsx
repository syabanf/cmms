import {
  DAY,
  type PmDue,
  fmtDate,
  fmtDateShort,
  fmtDuration,
  fmtNumber,
  openPmWorkOrder,
  plural,
  pmCompliance,
  pmDue,
  projectPm,
  toMs,
  triggerText,
} from '@cmms/fixtures'
import type { Meter, PmSchedule, WorkOrder } from '@cmms/types'
import { METER_KIND_LABEL } from '@cmms/types'
import {
  ActionMenu,
  Banner,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  type Column,
  ConfirmDialog,
  DataTable,
  EmptyState,
  KeyValue,
  PageHeader,
  ProgressBar,
  SegmentBar,
  Switch,
  cn,
} from '@cmms/ui'
import { CalendarClock, CalendarPlus, ClipboardList, Ellipsis, Microscope, Pause, Pencil, Play, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { useAuth } from '../../auth/auth'
import { BackButton } from '../../components/BackButton'
import { WoStatusBadge, WoStatusCell } from '../../components/badges'
import { AssetLink, PeopleStack, PersonChip, paths } from '../../components/links'
import { useTableHistory } from '../../lib/history-state'
import { useNow, useScoped } from '../../state/scoped'
import { usePmActions } from './actions'
import { PmResultBadge, PmStateBadge } from './badges'
import { capaHints, deleteEffect, dueRelative, meterLeftText, pmResult, triggerMeterId } from './lib'
import { PmDialog } from './PmDialog'

export function PmDetailPage() {
  const { id } = useParams()
  const { pmSchedules } = useScoped()
  const pm = pmSchedules.find((p) => p.id === id)
  if (!pm) {
    return (
      <>
        <BackButton fallback="/preventive/pm" className="mb-2" />
        <Card className="mx-auto mt-6 max-w-lg">
          <EmptyState
            icon={<CalendarClock />}
            title="PM schedule not found"
            description="It may have been deleted, or it belongs to another site."
            action={
              <Button asChild variant="outline">
                <Link to="/preventive/pm">All PM schedules</Link>
              </Button>
            }
          />
        </Card>
      </>
    )
  }
  return <PmView key={pm.id} pm={pm} />
}

function PmView({ pm }: { pm: PmSchedule }) {
  const s = useScoped()
  const now = useNow(60_000)
  const navigate = useNavigate()
  const { can } = useAuth()
  const canManage = can('pm.manage')
  const { blockReason, generate, setActive, remove } = usePmActions()
  const [editing, setEditing] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const historyTable = useTableHistory('history')

  const due = pmDue(pm, s.maps.meter, now)
  const plan = s.maps.jobPlan.get(pm.jobPlanId)
  const meterId = triggerMeterId(pm)
  const meter = meterId ? s.maps.meter.get(meterId) : undefined
  const openWo = openPmWorkOrder(pm, s.workOrders)
  const reason = blockReason(pm)
  const history = useMemo(
    () => s.workOrders.filter((w) => w.pmScheduleId === pm.id).sort((a, b) => toMs(b.dueAt) - toMs(a.dueAt)),
    [s.workOrders, pm.id],
  )
  const hints = useMemo(() => capaHints(s.rcas, [pm]), [s.rcas, pm])
  const upcoming = useMemo(() => projectPm(pm, s.maps.meter, 0, now + 120 * DAY, now).slice(0, 6), [pm, s.maps.meter, now])

  const historyColumns: Column<WorkOrder>[] = [
    {
      id: 'wo',
      header: 'Work order',
      cell: (w) => (
        <div className="min-w-0">
          <p className="font-mono text-xs font-medium">{w.code}</p>
          <p className="truncate text-xs text-muted">{w.title}</p>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5 sm:hidden">
            <PmResultBadge result={pmResult(w, now)} />
            <span className="text-[11px] text-muted">Due {fmtDateShort(w.dueAt)}</span>
          </div>
        </div>
      ),
      sortValue: (w) => w.code,
    },
    { id: 'status', header: 'Status', cell: (w) => <WoStatusCell status={w.status} waitingReason={w.waitingReason} />, hideBelow: 'sm' },
    { id: 'due', header: 'Due', cell: (w) => <span className="whitespace-nowrap tabular-nums">{fmtDate(w.dueAt)}</span>, sortValue: (w) => toMs(w.dueAt), hideBelow: 'md' },
    {
      id: 'done',
      header: 'Completed',
      cell: (w) => (w.completedAt ? <span className="whitespace-nowrap tabular-nums">{fmtDate(w.completedAt)}</span> : <span className="text-xs text-muted">Not yet</span>),
      sortValue: (w) => (w.completedAt ? toMs(w.completedAt) : null),
      hideBelow: 'md',
    },
    { id: 'result', header: 'Result', cell: (w) => <PmResultBadge result={pmResult(w, now)} />, hideBelow: 'sm' },
    { id: 'people', header: 'Assigned', cell: (w) => <PeopleStack personIds={w.assigneeIds} size="xs" />, className: 'hidden 2xl:table-cell', headerClassName: 'hidden 2xl:table-cell' },
  ]

  const late = pm.active && due.state === 'overdue'
  const left = meterLeftText(due, meter)
  const generateAt = due.dueAt - pm.leadDays * DAY
  const schedulerNote = !pm.active
    ? ''
    : reason
      ? ` The scheduler cannot create one: ${reason.charAt(0).toLowerCase()}${reason.slice(1)}.`
      : generateAt > now
        ? ` The scheduler creates one on ${fmtDate(generateAt)}.`
        : ''

  return (
    <>
      <BackButton fallback="/preventive/pm" className="mb-2" />
      <PageHeader
        eyebrow={<span className="font-mono normal-case tracking-normal">{pm.code}</span>}
        title={pm.name}
        description={`${triggerText(pm, s.maps.meter)} · ${plan ? `${plan.code} ${plan.name}` : 'Job plan deleted'}`}
        actions={
          canManage ? (
            <>
              <Button disabled={reason !== null} title={reason ?? undefined} onClick={() => generate(pm, due.dueAt)}>
                <CalendarPlus />
                Generate work order
              </Button>
              <Button variant="outline" onClick={() => setEditing(true)}>
                <Pencil />
                Edit
              </Button>
              <ActionMenu
                title={pm.code}
                trigger={
                  <Button variant="outline" size="icon" aria-label="More actions">
                    <Ellipsis />
                  </Button>
                }
                items={[
                  {
                    key: 'active',
                    label: pm.active ? 'Pause schedule' : 'Resume schedule',
                    icon: pm.active ? <Pause /> : <Play />,
                    onSelect: () => setActive(pm, !pm.active),
                  },
                  'separator',
                  { key: 'delete', label: 'Delete schedule', icon: <Trash2 />, destructive: true, onSelect: () => setDeleting(true) },
                ]}
              />
            </>
          ) : undefined
        }
      />

      {(!pm.active || hints.length > 0) && (
        <div className="mb-4 space-y-3">
          {!pm.active && (
            <Banner
              tone="neutral"
              icon={<Pause />}
              title="This schedule is paused."
              action={
                canManage ? (
                  <Button size="sm" onClick={() => setActive(pm, true)}>
                    Resume
                  </Button>
                ) : undefined
              }
            >
              No work orders are generated until it is resumed.
            </Banner>
          )}
          {hints.map((h) => (
            <Banner
              key={h.action.id}
              tone="info"
              icon={<Microscope />}
              title={h.title}
              action={
                <>
                  <Button asChild size="sm" variant="outline">
                    <Link to={paths.rca(h.rca.id)}>Open {h.rca.code}</Link>
                  </Button>
                  {canManage && (
                    <Button size="sm" onClick={() => setEditing(true)}>
                      Edit trigger
                    </Button>
                  )}
                </>
              }
            >
              {h.action.text}, owned by {s.personName(h.action.ownerId)}, due {fmtDate(h.action.dueAt)}.
            </Banner>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-4">
          <Card>
            <CardHeader action={<PmStateBadge state={pm.active ? due.state : 'paused'} />}>
              <CardTitle>Next due</CardTitle>
              <CardDescription>
                {due.dueBy === 'meter' && meter && due.meterDueValue !== null
                  ? `Set by the ${METER_KIND_LABEL[meter.kind].toLowerCase()} meter reaching ${fmtNumber(due.meterDueValue)} ${meter.unit}`
                  : 'Set by the date interval'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="flex flex-wrap items-end gap-x-4 gap-y-1">
                <p className={cn('text-3xl font-bold leading-none tracking-tight tabular-nums', late && 'text-accent')}>{fmtDate(due.dueAt)}</p>
                <p className={cn('text-sm', late ? 'font-semibold text-accent' : 'text-muted')}>
                  {dueRelative(due.daysLeft)}
                  {left ? ` · ${left}` : ''}
                </p>
              </div>

              <TriggerProgress pm={pm} due={due} meter={meter} now={now} />

              {openWo ? (
                <Link to={paths.workOrder(openWo.id)} className="flex items-center gap-3 rounded-2xl bg-surface-2 p-3 transition-colors hover:bg-surface">
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold">
                      <span className="font-mono">{openWo.code}</span> is open
                    </span>
                    <span className="block truncate text-xs text-muted">
                      Due {fmtDate(openWo.dueAt)} ·{' '}
                      {openWo.assigneeIds.length ? openWo.assigneeIds.map((id) => s.personName(id)).join(', ') : 'not assigned yet'}
                    </span>
                  </span>
                  <WoStatusBadge status={openWo.status} waitingReason={openWo.waitingReason} />
                </Link>
              ) : (
                <p className="text-sm text-muted">
                  No work order is open.
                  {schedulerNote}
                </p>
              )}

              {pm.active && upcoming.length > 1 && (
                <div>
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted">Projected dates</p>
                  <div className="flex flex-wrap gap-1.5">
                    {upcoming.map((at) => (
                      <span key={at} className="rounded-full bg-surface px-2.5 py-1 text-xs font-medium tabular-nums">
                        {fmtDateShort(at)}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Work order history</CardTitle>
              <CardDescription>{history.length ? `${plural(history.length, 'work order')} generated from this schedule` : 'Nothing generated yet'}</CardDescription>
            </CardHeader>
            <DataTable
              {...historyTable}
              columns={historyColumns}
              rows={history}
              getRowKey={(w) => w.id}
              onRowClick={(w) => navigate(paths.workOrder(w.id))}
              pageSize={8}
              empty={
                <EmptyState
                  compact
                  icon={<ClipboardList />}
                  title="No work orders yet"
                  description={canManage ? 'Generate the first one when the schedule falls due.' : 'Work orders appear here once a planner generates them.'}
                  action={
                    canManage && reason === null ? (
                      <Button size="sm" onClick={() => generate(pm, due.dueAt)}>
                        <CalendarPlus />
                        Generate work order
                      </Button>
                    ) : undefined
                  }
                />
              }
            />
          </Card>
        </div>

        <div className="min-w-0 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Schedule</CardTitle>
              <CardDescription>
                Work orders generate automatically {pm.leadDays > 0 ? `${plural(pm.leadDays, 'day')} before each due date` : 'on each due date'}.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <KeyValue
                bare
                items={[
                  { label: 'Asset', value: <AssetLink assetId={pm.assetId} /> },
                  {
                    label: 'Job plan',
                    value: plan ? (
                      <Link to={paths.jobPlan(plan.id)} className="block hover:text-accent">
                        <span className="block font-mono text-xs">{plan.code}</span>
                        <span className="block">{plan.name}</span>
                        <span className="block text-xs text-muted">
                          {fmtDuration(plan.durationMin)} · {plural(plan.tasks.length, 'check')}
                        </span>
                      </Link>
                    ) : (
                      <span className="text-muted">Deleted</span>
                    ),
                  },
                  { label: 'Trigger', value: triggerText(pm, s.maps.meter) },
                  {
                    label: 'Meter',
                    hidden: !meter,
                    value: meter && (
                      <>
                        {fmtNumber(meter.value)} {meter.unit}
                        <span className="block text-xs text-muted">
                          +{fmtNumber(meter.dailyRate, meter.dailyRate < 10 ? 1 : 0)} {meter.unit} a day
                        </span>
                      </>
                    ),
                  },
                  {
                    label: 'Last done',
                    value: (
                      <>
                        {fmtDate(pm.lastDoneAt)}
                        {pm.lastDoneMeter !== null && meter && (
                          <span className="block text-xs text-muted">
                            at {fmtNumber(pm.lastDoneMeter)} {meter.unit}
                          </span>
                        )}
                      </>
                    ),
                  },
                  { label: 'Lead time', value: plural(pm.leadDays, 'day') },
                  { label: 'Team', value: s.maps.team.get(pm.teamId)?.name ?? 'No team' },
                  { label: 'Assignee', value: <PersonChip personId={pm.assigneeId} /> },
                  {
                    label: 'Active',
                    value: canManage ? (
                      <Switch size="sm" checked={pm.active} aria-label="Active" onCheckedChange={(active) => setActive(pm, active)} />
                    ) : pm.active ? (
                      'Yes'
                    ) : (
                      'Paused'
                    ),
                  },
                ]}
              />
            </CardContent>
          </Card>
          <ComplianceCard history={history} now={now} />
        </div>
      </div>

      <PmDialog open={editing} pm={pm} onClose={() => setEditing(false)} />
      <ConfirmDialog
        open={deleting}
        onOpenChange={setDeleting}
        destructive
        confirmLabel="Delete schedule"
        title={`Delete ${pm.code}?`}
        description={deleteEffect(pm, openWo).description}
        onConfirm={() => {
          remove(pm)
          navigate('/preventive/pm')
        }}
      />
    </>
  )
}

/** How far the schedule has run toward each limit. A combined trigger shows both and marks the one that sets the date. */
function TriggerProgress({ pm, due, meter, now }: { pm: PmSchedule; due: PmDue; meter: Meter | undefined; now: number }) {
  const t = pm.trigger
  const last = toMs(pm.lastDoneAt)
  const combined = t.kind === 'combined'
  return (
    <div className="space-y-4">
      {due.calendarDueAt !== null && (
        <Progress
          label="Days since last PM"
          value={Math.max(0, Math.floor((now - last) / DAY))}
          total={Math.round((due.calendarDueAt - last) / DAY)}
          unit="days"
          drives={combined && due.dueBy === 'calendar'}
        />
      )}
      {meter && t.kind !== 'calendar' && (
        <Progress
          label={`${METER_KIND_LABEL[meter.kind]} since last PM`}
          value={Math.max(0, meter.value - (pm.lastDoneMeter ?? meter.value))}
          total={t.kind === 'meter' ? t.every : t.meterEvery}
          unit={meter.unit}
          drives={combined && due.dueBy === 'meter'}
        />
      )}
    </div>
  )
}

function Progress({ label, value, total, unit, drives }: { label: string; value: number; total: number; unit: string; drives: boolean }) {
  const ratio = total > 0 ? value / total : 0
  return (
    <div>
      <div className="mb-1.5 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 text-sm">
        <span className="font-medium">
          {label}
          {drives && <span className="ml-2 text-xs font-normal text-muted">sets the due date</span>}
        </span>
        <span className="tabular-nums text-muted">
          {fmtNumber(value)} of {fmtNumber(total)} {unit}
        </span>
      </div>
      <ProgressBar value={ratio} tone={ratio >= 1 ? 'accent' : 'ink'} aria-label={label} />
    </div>
  )
}

function ComplianceCard({ history, now }: { history: WorkOrder[]; now: number }) {
  const c = pmCompliance(history, now - 365 * DAY, now, now)
  return (
    <Card>
      <CardHeader>
        <CardTitle>Compliance</CardTitle>
        <CardDescription>Work from this schedule due in the last 12 months</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {c.due ? (
          <>
            <div className="flex items-start gap-1 leading-none">
              <span className="text-4xl font-bold tracking-tight tabular-nums">{Math.round(c.ratio * 100)}</span>
              <span className="pt-1 text-sm font-semibold text-muted">% on time</span>
            </div>
            <SegmentBar
              segments={[
                { key: 'on_time', value: c.onTime, className: 'bg-success', label: 'On time' },
                { key: 'late', value: c.late, className: 'bg-warning', label: 'Late' },
                { key: 'missed', value: c.missed, className: 'bg-accent', label: 'Missed' },
              ]}
            />
            <dl className="grid grid-cols-3 gap-2 text-center">
              {[
                ['On time', c.onTime],
                ['Late', c.late],
                ['Missed', c.missed],
              ].map(([label, value]) => (
                <div key={label} className="rounded-2xl bg-surface-2 px-2 py-2.5">
                  <dt className="text-[11px] font-medium text-muted">{label}</dt>
                  <dd className="text-base font-extrabold tabular-nums">{value}</dd>
                </div>
              ))}
            </dl>
          </>
        ) : (
          <p className="text-sm text-muted">No work from this schedule fell due in the last 12 months.</p>
        )}
      </CardContent>
    </Card>
  )
}
