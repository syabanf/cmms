import { type TechnicianLoad, fmtNumber, fmtPercent, plural } from '@cmms/fixtures'
import { Avatar, Badge, Card, type Column, DataTable, EmptyState, ProgressBar, StatCard } from '@cmms/ui'
import { Gauge, HardHat, Hourglass, TriangleAlert, Users } from 'lucide-react'
import { useNavigate } from 'react-router'
import { paths } from '../../components/links'
import { useTableHistory } from '../../lib/history-state'
import { type Scoped, useScoped } from '../../state/scoped'
import { ReportSection } from './ReportSection'
import { OVERLOAD, type OperationalReport, type Range } from './data'
import { type ReportTable, hoursCell, percentCell } from './table'

const hours = (minutes: number) => minutes / 60

function resourceTables(load: TechnicianLoad[], operational: OperationalReport, rangeLabel: string, averageUtilization: number, maps: Scoped['maps']) {
  const kpis: ReportTable = {
    title: `Resource KPIs, ${rangeLabel}`,
    columns: ['Metric', 'Value', 'Detail'],
    rows: [
      ['Capacity per week', hoursCell(operational.capacity), 'Hands-on hours a week, people on leave left out'],
      ['Open work', hoursCell(operational.backlog.manHours), plural(operational.backlog.count, 'work order') + ' in the backlog'],
      ['Average utilization', percentCell(averageUtilization), 'Logged hours over paid hours'],
      ['Above 90% utilization', load.filter((l) => l.utilization > OVERLOAD).length, 'Technicians'],
    ],
    phoneColumns: 2,
  }
  const technicians: ReportTable = {
    title: `Technician load, ${rangeLabel}`,
    columns: ['Technician', 'Team', 'Hours logged', 'Jobs done', 'Open jobs', 'Open hours', 'Utilization'],
    rows: load.map((l) => [
      l.person.name,
      maps.team.get(l.person.technician?.teamId ?? '')?.name ?? '',
      hoursCell(hours(l.loggedMinutes)),
      l.jobsDone,
      l.openJobs,
      hoursCell(l.openManHours),
      percentCell(l.utilization),
    ]),
  }
  return { kpis, technicians }
}

export function ResourceSection({ load, operational, range }: { load: TechnicianLoad[]; operational: OperationalReport; range: Range }) {
  const { maps } = useScoped()
  const navigate = useNavigate()
  const table = useTableHistory('technicians')
  const present = load.filter((l) => l.person.technician?.availability !== 'leave')
  const averageUtilization = present.length ? present.reduce((sum, l) => sum + l.utilization, 0) / present.length : 0
  const overloaded = load.filter((l) => l.utilization > OVERLOAD).length
  const tables = resourceTables(load, operational, range.label, averageUtilization, maps)
  const teamName = (l: TechnicianLoad) => maps.team.get(l.person.technician?.teamId ?? '')?.name ?? 'No team'

  const columns: Column<TechnicianLoad>[] = [
    {
      id: 'person',
      header: 'Technician',
      cell: (l) => (
        <div className="flex min-w-0 items-center gap-3">
          <Avatar name={l.person.name} color={l.person.color} size="sm" />
          <div className="min-w-0">
            <p className="flex flex-wrap items-center gap-x-2 font-medium">
              {l.person.name}
              {l.person.technician?.availability === 'leave' && <Badge variant="muted">On leave</Badge>}
            </p>
            <p className="truncate text-xs text-muted">
              {teamName(l)}
              {l.clockedIn && ' · clocked in'}
            </p>
            <div className="mt-1.5 flex flex-wrap gap-1.5 text-[11px] text-muted sm:hidden">
              <span>{fmtNumber(hours(l.loggedMinutes), 1)} h logged</span>
              <span>{l.jobsDone} done</span>
              <span className={l.utilization > OVERLOAD ? 'font-semibold text-warning' : undefined}>{fmtPercent(l.utilization)} used</span>
            </div>
          </div>
        </div>
      ),
      sortValue: (l) => l.person.name,
    },
    {
      id: 'hours',
      header: 'Hours logged',
      align: 'right',
      cell: (l) => <span className="tabular-nums">{fmtNumber(hours(l.loggedMinutes), 1)} h</span>,
      sortValue: (l) => l.loggedMinutes,
      hideBelow: 'sm',
    },
    { id: 'done', header: 'Jobs done', align: 'right', cell: (l) => <span className="tabular-nums">{l.jobsDone}</span>, sortValue: (l) => l.jobsDone, hideBelow: 'sm' },
    {
      id: 'open',
      header: 'Open jobs',
      align: 'right',
      cell: (l) => (
        <div className="tabular-nums">
          {l.openJobs}
          <span className="block text-[11px] text-muted">{fmtNumber(l.openManHours, 1)} h left</span>
        </div>
      ),
      sortValue: (l) => l.openManHours,
      hideBelow: 'lg',
    },
    {
      id: 'utilization',
      header: 'Utilization',
      cell: (l) => (
        <div className="flex items-center gap-2">
          <ProgressBar
            value={l.utilization}
            tone={l.utilization > OVERLOAD ? 'warning' : 'ink'}
            className="w-24"
            aria-label={`${l.person.name} utilization`}
          />
          <span className="w-10 text-right text-xs tabular-nums">{fmtPercent(l.utilization)}</span>
        </div>
      ),
      sortValue: (l) => l.utilization,
      hideBelow: 'sm',
    },
  ]

  return (
    <ReportSection
      sectionKey="resource"
      title="Resource"
      question={`Is the maintenance team overloaded? ${range.label}.`}
      tables={[tables.kpis, tables.technicians]}
    >
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard
          label="Capacity"
          value={fmtNumber(operational.capacity)}
          unit="h a week"
          hint="Hands-on hours, leave left out"
          icon={<HardHat />}
        />
        <StatCard
          label="Open work"
          value={fmtNumber(operational.backlog.manHours)}
          unit="h"
          hint={`${plural(operational.backlog.count, 'work order')} in the backlog`}
          icon={<Hourglass />}
        />
        <StatCard label="Average utilization" value={fmtPercent(averageUtilization)} hint="Logged hours over paid hours" icon={<Gauge />} />
        <StatCard
          label="Above 90%"
          value={overloaded}
          hint={overloaded ? 'Technicians near their limit' : 'Nobody near their limit'}
          icon={<TriangleAlert />}
          tone={overloaded ? 'warning' : 'default'}
        />
      </div>

      <Card>
        <DataTable
          {...table}
          columns={columns}
          rows={load}
          getRowKey={(l) => l.person.id}
          onRowClick={(l) => navigate(paths.technician(l.person.id))}
          pageSize={0}
          empty={<EmptyState compact icon={<Users />} title="No technicians at this site" description="Add technicians under People to see their load here." />}
        />
      </Card>
    </ReportSection>
  )
}
