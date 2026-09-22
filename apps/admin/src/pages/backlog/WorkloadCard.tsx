import { fmtNumber, fmtPercent, plural } from '@cmms/fixtures'
import { Card, Kicker } from '@cmms/ui'
import { useScoped } from '../../state/scoped'

function describeWorkload(count: number, manHours: number, capacity: number, weeks: number | null): string {
  if (count === 0) return 'No open work in the backlog.'
  const load = `${plural(count, 'open work order')} ${count === 1 ? 'adds' : 'add'} up to ${fmtNumber(manHours, 1)} man-hours`
  if (weeks === null) return `${load}, and no technician is on duty this week.`
  const pace = `${load} against ${fmtNumber(capacity)} hands-on hours a week.`
  return weeks < 1
    ? `${pace} The team can clear it in about ${plural(Math.max(1, Math.round(weeks * 5)), 'working day')}.`
    : `${pace} New jobs queue behind ${fmtNumber(weeks, 1)} weeks of work.`
}

/** The backlog as workload: remaining man-hours against the hands-on hours the team has each week. */
export function WorkloadCard({
  count,
  manHours,
  capacity,
  onDuty,
  onLeave,
}: {
  count: number
  manHours: number
  capacity: number
  onDuty: number
  onLeave: number
}) {
  const { settings } = useScoped()
  const weeks = capacity > 0 ? manHours / capacity : null

  return (
    <Card variant="ink" className="flex flex-col justify-between gap-6 p-6">
      <div>
        <Kicker className="text-on-ink-muted">Weeks to clear the backlog</Kicker>
        {weeks === null ? (
          <p className="mt-2 text-2xl font-bold">No hands-on capacity</p>
        ) : (
          <p className="mt-2 flex items-start gap-1.5 leading-none">
            <span className="text-5xl font-bold tabular-nums tracking-tight">{fmtNumber(weeks, 1)}</span>
            <span className="pt-1.5 text-sm font-semibold text-on-ink-muted">weeks</span>
          </p>
        )}
        <p className="mt-3 max-w-lg text-sm text-on-ink-muted">{describeWorkload(count, manHours, capacity, weeks)}</p>
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <InkFigure label="Backlog" value={fmtNumber(manHours, 1)} unit="man-hours" hint="Estimates minus the time already logged" />
        <InkFigure
          label="Weekly capacity"
          value={fmtNumber(capacity)}
          unit="h"
          hint={`${plural(onDuty, 'technician')} × ${settings.weeklyHours} h × ${fmtPercent(settings.wrenchTime)} hands-on${onLeave ? `, ${onLeave} on leave` : ''}`}
        />
      </div>
    </Card>
  )
}

function InkFigure({ label, value, unit, hint }: { label: string; value: string; unit: string; hint: string }) {
  return (
    <div className="rounded-2xl bg-white/5 p-4">
      <p className="text-xs font-medium text-on-ink-muted">{label}</p>
      <p className="mt-2 flex items-start gap-1 leading-none">
        <span className="text-2xl font-bold tabular-nums tracking-tight">{value}</span>
        <span className="pt-0.5 text-xs font-semibold text-on-ink-muted">{unit}</span>
      </p>
      <p className="mt-2 text-[11px] text-on-ink-muted">{hint}</p>
    </div>
  )
}
