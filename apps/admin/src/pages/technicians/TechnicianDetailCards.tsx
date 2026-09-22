import {
  fmtDateShort,
  fmtDuration,
  fmtNumber,
  fmtTime,
  fmtWeekday,
  fmtWhen,
  isOverdue,
  laborEntryMinutes,
} from '@cmms/fixtures'
import type { WorkOrder } from '@cmms/types'
import {
  Badge,
  BarStrip,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  type Column,
  DataTable,
  EmptyState,
  cn,
} from '@cmms/ui'
import { ClipboardList, Timer } from 'lucide-react'
import { Link, useNavigate } from 'react-router'
import { PriorityBadge, WoStatusBadge } from '../../components/badges'
import { WoLink, paths } from '../../components/links'
import { useScoped } from '../../state/scoped'
import type { LaborRow } from './lib'

/** Due time, in accent once it has passed. The phone line spells out "Due" because it has no column header. */
function DueText({ wo, now, spelled = false }: { wo: WorkOrder; now: number; spelled?: boolean }) {
  const overdue = isOverdue(wo, now)
  return (
    <span
      className={cn(
        'whitespace-nowrap',
        spelled && 'text-xs text-muted',
        overdue && 'font-semibold text-accent',
      )}
    >
      {spelled && (overdue ? 'Overdue, due ' : 'Due ')}
      {fmtWhen(wo.dueAt, now)}
    </span>
  )
}

/** Active work assigned to the technician, most urgent first. */
export function WorkCard({ firstName, work, now }: { firstName: string; work: WorkOrder[]; now: number }) {
  const { maps } = useScoped()
  const navigate = useNavigate()
  const overdue = work.filter((w) => isOverdue(w, now)).length

  const columns: Column<WorkOrder>[] = [
    {
      id: 'wo',
      header: 'Work order',
      cell: (w) => {
        const asset = maps.asset.get(w.assetId)
        return (
          <div className="min-w-0">
            <WoLink woId={w.id} />
            <p className="mt-0.5 font-medium">{w.title}</p>
            {asset && (
              <p className="text-xs text-muted">
                <span className="font-mono">{asset.code}</span> · {asset.name}
              </p>
            )}
            <div className="mt-1.5 gap-1.5 sm:hidden flex flex-wrap items-center">
              <PriorityBadge priority={w.priority} />
              <WoStatusBadge status={w.status} waitingReason={w.waitingReason} />
              <DueText wo={w} now={now} spelled />
            </div>
          </div>
        )
      },
    },
    {
      id: 'priority',
      header: 'Priority',
      hideBelow: 'sm',
      cell: (w) => <PriorityBadge priority={w.priority} />,
    },
    {
      id: 'status',
      header: 'Status',
      hideBelow: 'sm',
      cell: (w) => <WoStatusBadge status={w.status} waitingReason={w.waitingReason} />,
    },
    {
      id: 'due',
      header: 'Due',
      hideBelow: 'sm',
      align: 'right',
      cell: (w) => <DueText wo={w} now={now} />,
    },
  ]

  return (
    <Card>
      <CardHeader>
        <CardTitle>Current and upcoming work</CardTitle>
        <CardDescription>
          {work.length
            ? `${work.length} open${overdue ? `, ${overdue} overdue` : ''}. Most urgent first.`
            : 'Assigned work shows here, most urgent first.'}
        </CardDescription>
      </CardHeader>
      <DataTable
        columns={columns}
        rows={work}
        getRowKey={(w) => w.id}
        onRowClick={(w) => navigate(paths.workOrder(w.id))}
        pageSize={6}
        empty={
          <EmptyState
            compact
            icon={<ClipboardList />}
            title="No open work"
            description={`Assign ${firstName} from a work order or from the backlog.`}
            action={
              <Button asChild variant="outline" size="sm">
                <Link to="/work/backlog">Open backlog</Link>
              </Button>
            }
          />
        }
      />
    </Card>
  )
}

const entryDay = (row: LaborRow) => `${fmtWeekday(row.entry.start)} ${fmtDateShort(row.entry.start)}`
const entryTimes = (row: LaborRow) =>
  `${fmtTime(row.entry.start)} → ${row.entry.end ? fmtTime(row.entry.end) : 'now'}`

/** Hours per day and the labor entries behind them. */
export function LaborCard({
  firstName,
  rows,
  daily,
  now,
}: {
  firstName: string
  rows: LaborRow[]
  daily: { label: string; value: number }[]
  now: number
}) {
  const totalHours = daily.reduce((sum, d) => sum + d.value, 0)
  const workedDays = daily.filter((d) => d.value > 0).length

  const columns: Column<LaborRow>[] = [
    {
      id: 'wo',
      header: 'Work order',
      cell: (row) => (
        <div className="min-w-0">
          <WoLink woId={row.wo.id} />
          <p className="mt-0.5 font-medium">{row.wo.title}</p>
          <p className="mt-1 gap-x-1.5 text-xs sm:hidden flex flex-wrap items-center text-muted">
            {entryDay(row)} · {entryTimes(row)} · {fmtDuration(laborEntryMinutes(row.entry, now))}
          </p>
        </div>
      ),
    },
    {
      id: 'when',
      header: 'When',
      hideBelow: 'sm',
      cell: (row) => (
        <div className="whitespace-nowrap">
          <p>{entryDay(row)}</p>
          <p className="text-xs text-muted">{entryTimes(row)}</p>
        </div>
      ),
    },
    {
      id: 'duration',
      header: 'Duration',
      hideBelow: 'sm',
      align: 'right',
      cell: (row) =>
        row.entry.end ? (
          <span className="whitespace-nowrap tabular-nums">
            {fmtDuration(laborEntryMinutes(row.entry, now))}
          </span>
        ) : (
          <Badge variant="info">
            <span aria-hidden="true" className="size-1.5 animate-pulse rounded-full bg-current" />
            {fmtDuration(laborEntryMinutes(row.entry, now))}
          </Badge>
        ),
    },
  ]

  return (
    <Card>
      <CardHeader>
        <CardTitle>Labor, last {daily.length} days</CardTitle>
        <CardDescription>
          {totalHours > 0
            ? `${fmtNumber(totalHours, 1)} h logged on ${workedDays} of ${daily.length} days.`
            : `${firstName} has not logged labor in this window.`}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <BarStrip
          data={daily}
          height={72}
          format={(v) => `${v.toFixed(1)} h`}
          ariaLabel={`Hours logged per day, last ${daily.length} days`}
        />
        <div className="mt-2 flex justify-between text-[11px] text-muted">
          <span>{daily[0]?.label}</span>
          <span>Today</span>
        </div>
      </CardContent>
      <DataTable
        columns={columns}
        rows={rows}
        getRowKey={(row) => row.entry.id}
        pageSize={8}
        empty={
          <EmptyState
            compact
            icon={<Timer />}
            title={`No labor in the last ${daily.length} days`}
            description="Technicians clock in on a work order in the mobile app. Planners can add missed time on the work order page."
          />
        }
      />
    </Card>
  )
}
