import {
  calibrationDaysLeft,
  calibrationState,
  fmtDate,
  plural,
  pmDue,
  toMs,
  triggerText,
} from '@cmms/fixtures'
import type { Asset } from '@cmms/types'
import { CALIBRATION_RESULT_LABEL } from '@cmms/types'
import { Badge, Button, IconTile, KeyValue } from '@cmms/ui'
import { CalendarClock, ChevronRight, Plus, UserRound, Users, Wallet } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { useAuth } from '../../auth/auth'
import { CalibrationBadge } from '../../components/badges'
import { PeopleStack, paths } from '../../components/links'
import { useScoped } from '../../state/scoped'
import { PmStateBadge, SideCard } from './ui'

/** PM plans on the asset with their next due date. */
export function PmSchedulesCard({ asset, now }: { asset: Asset; now: number }) {
  const { pmSchedules, maps } = useScoped()
  const { can } = useAuth()
  const plans = pmSchedules
    .filter((pm) => pm.assetId === asset.id)
    .map((pm) => ({ pm, due: pmDue(pm, maps.meter, now) }))
    .sort((a, b) => Number(b.pm.active) - Number(a.pm.active) || a.due.dueAt - b.due.dueAt)

  return (
    <SideCard
      title="PM schedules"
      action={
        <Button asChild variant="ghost" size="sm">
          <Link to="/preventive/pm">All PM</Link>
        </Button>
      }
    >
      {plans.length ? (
        <ul className="space-y-2">
          {plans.map(({ pm, due }) => (
            <li key={pm.id}>
              <Link
                to={paths.pm(pm.id)}
                className="flex items-center gap-3 rounded-2xl border border-border p-3 transition-colors hover:bg-surface-2"
              >
                <IconTile size="sm" tone={pm.active && due.state === 'overdue' ? 'danger' : 'default'}>
                  <CalendarClock />
                </IconTile>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold">{pm.name}</p>
                  <p className="truncate text-xs text-muted">{triggerText(pm, maps.meter)}</p>
                  <p className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs text-muted">
                    <PmStateBadge state={due.state} active={pm.active} />
                    {pm.active && (
                      <span>
                        Next {fmtDate(due.dueAt)}
                        {due.dueBy === 'meter' ? ' by meter' : ''}
                      </span>
                    )}
                  </p>
                </div>
                <ChevronRight aria-hidden="true" className="size-4 shrink-0 text-muted" />
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <div>
          <p className="text-sm text-muted">
            No preventive plan yet. Without one this asset only gets work when it breaks.
          </p>
          {can('pm.manage') && (
            <Button asChild variant="outline" size="sm" className="mt-3">
              <Link to="/preventive/pm?new=1">
                <Plus />
                Plan PM
              </Link>
            </Button>
          )}
        </div>
      )}
    </SideCard>
  )
}

function InfoRow({
  icon,
  title,
  subtitle,
  trailing,
}: {
  icon: ReactNode
  title: ReactNode
  subtitle: ReactNode
  trailing?: ReactNode
}) {
  return (
    <div className="flex items-center gap-3">
      <IconTile size="sm">{icon}</IconTile>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold">{title}</p>
        <p className="truncate text-xs text-muted">{subtitle}</p>
      </div>
      {trailing}
    </div>
  )
}

/** Team, supervisor and cost center behind the asset. */
export function ResponsibleCard({ asset }: { asset: Asset }) {
  const { maps, technicians } = useScoped()
  const team = maps.team.get(asset.teamId)
  const members = team ? technicians.filter((t) => t.technician?.teamId === team.id) : []
  const supervisor = team?.supervisorId ? maps.person.get(team.supervisorId) : undefined
  const costCenter = maps.costCenter.get(asset.costCenterId)

  return (
    <SideCard title="Responsible">
      <div className="space-y-4">
        <InfoRow
          icon={<Users />}
          title={team ? `${team.name} team` : 'No team assigned'}
          subtitle={members.length ? plural(members.length, 'technician') : 'No technicians on the team yet'}
          trailing={members.length > 0 && <PeopleStack personIds={members.map((m) => m.id)} size="xs" />}
        />
        <InfoRow
          icon={<UserRound />}
          title={supervisor?.name ?? 'No supervisor'}
          subtitle={supervisor ? `${supervisor.title} · ${supervisor.phone}` : 'Set one on the team'}
        />
        <InfoRow
          icon={<Wallet />}
          title={costCenter?.name ?? 'No cost center'}
          subtitle={costCenter ? `Cost center ${costCenter.code}` : 'Edit the asset to charge its costs'}
        />
      </div>
    </SideCard>
  )
}

/** Calibration plan and recent certificates, for instruments that carry one. */
export function CalibrationCard({ asset, now }: { asset: Asset; now: number }) {
  const { calibrations, maps } = useScoped()
  const plan = asset.calibration
  if (!plan) return null
  const days = calibrationDaysLeft(plan, now)
  const records = calibrations
    .filter((c) => c.target.kind === 'asset' && c.target.id === asset.id)
    .sort((a, b) => toMs(b.date) - toMs(a.date))
    .slice(0, 3)
  const vendor = plan.vendorId ? maps.vendor.get(plan.vendorId) : undefined

  return (
    <SideCard
      title="Calibration"
      action={
        <Button asChild variant="ghost" size="sm">
          <Link to="/preventive/calibration">Schedule</Link>
        </Button>
      }
    >
      <div className="flex flex-wrap items-center gap-2">
        <CalibrationBadge state={calibrationState(plan, now)} />
        <span className="text-xs text-muted">
          {days < 0 ? `Overdue by ${plural(-days, 'day')}` : `Due in ${plural(days, 'day')}`}
        </span>
      </div>
      <KeyValue
        bare
        className="mt-2"
        items={[
          { label: 'Next due', value: fmtDate(plan.due) },
          { label: 'Interval', value: `Every ${plural(plan.intervalMonths, 'month')}` },
          {
            label: 'Last done',
            value: plan.lastAt ? fmtDate(plan.lastAt) : <span className="text-muted">Never</span>,
          },
          { label: 'Vendor', value: vendor?.name ?? <span className="text-muted">In house</span> },
        ]}
      />
      {records.length > 0 && (
        <ul className="mt-3 space-y-2">
          {records.map((r) => (
            <li
              key={r.id}
              className="flex items-center justify-between gap-2 rounded-2xl bg-surface-2 px-3 py-2 text-xs"
            >
              <span className="min-w-0">
                <span className="block font-semibold">{fmtDate(r.date)}</span>
                <span className="block truncate font-mono text-muted">{r.certificateNo}</span>
              </span>
              <Badge variant={r.result === 'fail' ? 'danger' : 'success'}>
                {CALIBRATION_RESULT_LABEL[r.result]}
              </Badge>
            </li>
          ))}
        </ul>
      )}
    </SideCard>
  )
}
