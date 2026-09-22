import { fmtMonth, fmtNumber, fmtPercent } from '@cmms/fixtures'
import { ColumnChart, StatCard } from '@cmms/ui'
import { AlarmClock, CalendarCheck, CalendarClock, ClipboardCheck, Hourglass, ListChecks, Siren, Wrench } from 'lucide-react'
import { ChartCard } from './ChartCard'
import { ReportSection } from './ReportSection'
import type { MonthRow, OperationalReport, Range } from './data'
import { type ReportTable, measure, percentCell } from './table'

function operationalTables(report: OperationalReport, monthly: MonthRow[], rangeLabel: string) {
  const { pm, schedule, completion, backlog, shares } = report
  const kpis: ReportTable = {
    title: `Operational KPIs, ${rangeLabel}`,
    columns: ['Metric', 'Value', 'Detail'],
    rows: [
      ['PM compliance', percentCell(pm.ratio), `${pm.onTime} of ${pm.due} PM work orders done by their due day`],
      ['Schedule compliance', percentCell(schedule.ratio), `${schedule.kept} of ${schedule.scheduled} scheduled jobs done on the day`],
      ['Work order completion', percentCell(completion.ratio), `${completion.completed} completed, ${completion.created} created`],
      ['Overdue now', report.overdue, 'Open work past its due date'],
      ['Backlog', measure(Math.round(backlog.weeks * 10) / 10, `${fmtNumber(backlog.weeks, 1)} weeks`), `${fmtNumber(backlog.manHours)} man-hours open`],
      ['Planned work', percentCell(shares.plannedShare), `${shares.planned} of ${shares.total} work orders`],
      ['Emergency work', percentCell(shares.emergencyShare), `${shares.emergency} work orders`],
      ['Corrective work', percentCell(shares.correctiveShare), `${shares.corrective} work orders`],
    ],
    phoneColumns: 2,
  }
  const created: ReportTable = {
    title: 'Work orders created per month',
    columns: ['Month', 'Created', 'Planned', 'Corrective', 'Emergency'],
    rows: monthly.map((m) => [fmtMonth(m.period.from), m.created, m.planned, m.corrective, m.emergency]),
    phoneColumns: 2,
  }
  const planned: ReportTable = {
    title: 'Planned share per month',
    columns: ['Month', 'Planned share', 'Planned', 'Created'],
    rows: monthly.map((m) => [fmtMonth(m.period.from), percentCell(m.plannedShare), m.planned, m.created]),
    phoneColumns: 2,
  }
  return { kpis, created, planned }
}

export function OperationalSection({ report, monthly, range }: { report: OperationalReport; monthly: MonthRow[]; range: Range }) {
  const { pm, schedule, completion, backlog, capacity, shares } = report
  const yearCreated = monthly.reduce((sum, m) => sum + m.created, 0)
  const yearPlanned = monthly.reduce((sum, m) => sum + m.planned, 0)
  const yearShare = yearCreated ? yearPlanned / yearCreated : 0

  const tables = operationalTables(report, monthly, range.label)

  return (
    <ReportSection
      sectionKey="operational"
      title="Operational"
      question={`Is maintenance planned and done on time? ${range.label}.`}
      tables={[tables.kpis, tables.created, tables.planned]}
    >
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard
          label="PM compliance"
          value={fmtPercent(pm.ratio)}
          hint={pm.due ? `${pm.onTime} of ${pm.due} done by their due day` : 'No PM fell due'}
          icon={<CalendarCheck />}
          tone="ink"
        />
        <StatCard
          label="Schedule compliance"
          value={fmtPercent(schedule.ratio)}
          hint={`${schedule.kept} of ${schedule.scheduled} done on the scheduled day`}
          icon={<CalendarClock />}
        />
        <StatCard
          label="Completion rate"
          value={fmtPercent(completion.ratio)}
          hint={`${completion.completed} completed, ${completion.created} created`}
          icon={<ClipboardCheck />}
        />
        <StatCard
          label="Overdue now"
          value={report.overdue}
          hint="Open work past its due date"
          icon={<AlarmClock />}
          tone={report.overdue ? 'danger' : 'default'}
        />
        <StatCard
          label="Backlog"
          value={fmtNumber(backlog.weeks, 1)}
          unit="weeks"
          hint={`${fmtNumber(backlog.manHours)} man-hours at ${fmtNumber(capacity)} h a week`}
          icon={<Hourglass />}
        />
        <StatCard label="Planned" value={fmtPercent(shares.plannedShare)} hint={`${shares.planned} of ${shares.total} work orders`} icon={<ListChecks />} />
        <StatCard label="Emergency" value={fmtPercent(shares.emergencyShare)} hint={`${shares.emergency} work orders`} icon={<Siren />} />
        <StatCard label="Corrective" value={fmtPercent(shares.correctiveShare)} hint={`${shares.corrective} work orders`} icon={<Wrench />} />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <ChartCard title="Work orders created" description="Per month, cancelled work left out. The current month runs to today." table={tables.created}>
          <ColumnChart
            ariaLabel="Work orders created per month"
            tone="muted"
            data={monthly.map((m) => ({ label: m.period.label, value: m.created, highlight: m.current }))}
          />
        </ChartCard>
        <ChartCard
          title="Planned work share"
          description={`Preventive, inspection, calibration and improvement work as a share of all work. 12-month average ${fmtPercent(yearShare)}.`}
          table={tables.planned}
        >
          <ColumnChart
            ariaLabel="Planned work share per month"
            tone="muted"
            format={(value) => `${fmtNumber(value)}%`}
            data={monthly.map((m) => ({ label: m.period.label, value: Math.round(m.plannedShare * 100), highlight: m.current }))}
          />
        </ChartCard>
      </div>
    </ReportSection>
  )
}
