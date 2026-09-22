import { fmtIdrShort, fmtMonth, fmtNumber, fmtPercent, plural } from '@cmms/fixtures'
import { BarList, Button, EmptyState, LineChart, StatCard } from '@cmms/ui'
import { Activity, Clock, Factory, Repeat, Timer, TriangleAlert } from 'lucide-react'
import { Link, useNavigate } from 'react-router'
import { paths } from '../../components/links'
import { type Scoped, useScoped } from '../../state/scoped'
import { ChartCard } from './ChartCard'
import { ReportSection } from './ReportSection'
import type { MonthRow, Range, ReliabilityReport } from './data'
import { type Cell, type ReportTable, hoursCell, idrCell, measure, percentCell } from './table'

const TOP = 5

const wholeHours = (hours: number) => measure(Math.round(hours), `${fmtNumber(hours)} h`)
const optional = (hours: number | null, cell: (h: number) => Cell): Cell => (hours === null ? '-' : cell(hours))
/** 2 → "2", 2.5 → "2.5" */
const hourTicks = (value: number) => fmtNumber(value, Number.isInteger(value) ? 0 : 1)

function reliabilityTables(report: ReliabilityReport, monthly: MonthRow[], rangeLabel: string, maps: Scoped['maps'], windowDays: number) {
  const { fleet } = report
  const assetName = (id: string) => maps.asset.get(id)?.name ?? 'Removed asset'
  const kpis: ReportTable = {
    title: `Reliability KPIs, ${rangeLabel}`,
    columns: ['Metric', 'Value', 'Detail'],
    rows: [
      ['Failures', fleet.failures, 'Completed corrective and emergency work'],
      ['MTBF', optional(fleet.mtbfHours, wholeHours), 'Operating hours per failure'],
      ['MTTR', optional(fleet.mttrHours, hoursCell), 'Hands-on repair time per failure'],
      ['Downtime', hoursCell(fleet.downtimeHours), 'Production stopped by failures'],
      ['Repeat failures', report.repeats, `Same asset and failure mode within ${windowDays} days`],
      ['Repeat chains with an RCA', `${report.covered} of ${report.chains}`, 'An RCA on the same asset and failure mode'],
      ['RCA actions done', `${report.actionsDone} of ${report.actionsTotal}`, plural(report.openRcas, 'RCA') + ' open'],
    ],
    phoneColumns: 2,
  }
  const trend: ReportTable = {
    title: 'Reliability per month',
    columns: ['Month', 'Failures', 'MTBF', 'MTTR', 'Downtime'],
    rows: monthly.map((m) => [fmtMonth(m.period.from), m.failures, optional(m.mtbfHours, wholeHours), optional(m.mttrHours, hoursCell), hoursCell(m.downtimeHours)]),
    phoneColumns: 3,
  }
  const bad: ReportTable = {
    title: `Bad actors, ${rangeLabel}`,
    columns: ['Asset', 'Failures', 'Repeats', 'Downtime', 'Cost'],
    rows: report.bad.map((r) => [assetName(r.assetId), r.failures, r.repeats, hoursCell(r.downtimeHours), idrCell(r.cost)]),
    phoneColumns: 2,
  }
  const modes: ReportTable = {
    title: `Top failure modes, ${rangeLabel}`,
    columns: ['Failure mode', 'Failures', 'Share'],
    rows: report.modes.slice(0, TOP).map((m) => [maps.failureCode.get(m.key)?.name ?? 'Unknown code', m.count, percentCell(m.share)]),
  }
  return {
    kpis,
    trend,
    bad,
    modes,
    mtbf: { title: 'MTBF per month', columns: ['Month', 'MTBF', 'Failures'], rows: trend.rows.map((r) => [r[0]!, r[2]!, r[1]!]) } satisfies ReportTable,
    mttr: { title: 'MTTR per month', columns: ['Month', 'MTTR', 'Failures'], rows: trend.rows.map((r) => [r[0]!, r[3]!, r[1]!]) } satisfies ReportTable,
  }
}

export function ReliabilitySection({ report, monthly, range }: { report: ReliabilityReport; monthly: MonthRow[]; range: Range }) {
  const { maps, settings } = useScoped()
  const navigate = useNavigate()
  const tables = reliabilityTables(report, monthly, range.label, maps, settings.repeatWindowDays)
  const { fleet } = report
  const coded = report.modes.reduce((sum, m) => sum + m.count, 0)

  return (
    <ReportSection
      sectionKey="reliability"
      title="Reliability"
      question={`Which assets break, how often, and does it keep happening? ${range.label}.`}
      tables={[tables.kpis, tables.trend, tables.bad, tables.modes]}
    >
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard
          label="MTBF"
          value={fleet.mtbfHours === null ? 'None' : fmtNumber(fleet.mtbfHours)}
          unit="h"
          hint={`${plural(fleet.failures, 'failure')} in the period`}
          icon={<Activity />}
        />
        <StatCard
          label="MTTR"
          value={fleet.mttrHours === null ? 'None' : fmtNumber(fleet.mttrHours, 1)}
          unit="h"
          hint="Hands-on repair time per failure"
          icon={<Timer />}
        />
        <StatCard
          label="Downtime"
          value={fmtNumber(fleet.downtimeHours, 1)}
          unit="h"
          hint="Production stopped by failures"
          icon={<Clock />}
          tone={fleet.downtimeHours > 0 ? 'warning' : 'default'}
        />
        <StatCard
          label="Repeat failures"
          value={report.repeats}
          hint={report.chains ? `${report.covered} of ${plural(report.chains, 'repeat chain')} have an RCA` : 'Nothing failed twice the same way'}
          icon={<Repeat />}
          tone={report.repeats ? 'danger' : 'default'}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <ChartCard title="MTBF by month" description="Operating hours between failures across all assets. Higher is better." table={tables.mtbf}>
          <LineChart
            ariaLabel="MTBF by month, in hours"
            format={(value) => fmtNumber(value)}
            data={monthly.map((m) => ({ label: m.period.label, value: m.mtbfHours === null ? null : Math.round(m.mtbfHours) }))}
          />
        </ChartCard>
        <ChartCard title="MTTR by month" description="Hands-on hours to repair a failure. Lower is better." table={tables.mttr}>
          <LineChart
            ariaLabel="MTTR by month, in hours"
            format={hourTicks}
            data={monthly.map((m) => ({ label: m.period.label, value: m.mttrHours === null ? null : Math.round(m.mttrHours * 10) / 10 }))}
          />
        </ChartCard>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <ChartCard title="Bad actors" description="The assets with the most failures, with what their maintenance cost." table={tables.bad}>
          {report.bad.length ? (
            <BarList
              ariaLabel="Failures per asset"
              items={report.bad.map((r, i) => ({
                key: r.assetId,
                label: maps.asset.get(r.assetId)?.name ?? 'Removed asset',
                value: r.failures,
                display: plural(r.failures, 'failure'),
                hint: `${fmtIdrShort(r.cost)} · ${fmtNumber(r.downtimeHours, 1)} h down`,
                emphasis: i === 0,
                onClick: () => navigate(paths.asset(r.assetId)),
              }))}
            />
          ) : (
            <EmptyState compact icon={<Factory />} title="No failures in this period" description="Pick a longer period to compare assets." />
          )}
        </ChartCard>
        <ChartCard
          title="Top failure modes"
          description={coded ? `Share of ${plural(coded, 'coded failure')}.` : 'Failure modes coded on completed corrective work.'}
          table={tables.modes}
          action={
            <Button asChild variant="ghost" size="sm">
              <Link to="/reliability/failures">Failure analysis</Link>
            </Button>
          }
        >
          {report.modes.length ? (
            <BarList
              ariaLabel="Failures by failure mode"
              items={report.modes.slice(0, TOP).map((m, i) => ({
                key: m.key,
                label: maps.failureCode.get(m.key)?.name ?? 'Unknown code',
                value: m.count,
                hint: fmtPercent(m.share),
                emphasis: i === 0,
              }))}
            />
          ) : (
            <EmptyState
              compact
              icon={<TriangleAlert />}
              title="No coded failures"
              description="Technicians code the failure mode when they complete corrective work."
            />
          )}
        </ChartCard>
      </div>
    </ReportSection>
  )
}
