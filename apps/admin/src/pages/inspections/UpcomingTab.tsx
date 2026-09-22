import { type PmDue, fmtDate, fmtWhen, isActive, isOverdue, openPmWorkOrder, pmDue, toMs, triggerText } from '@cmms/fixtures'
import type { PmSchedule, WorkOrder } from '@cmms/types'
import { Button, Card, CardDescription, CardHeader, CardTitle, type Column, DataTable, EmptyState, cn } from '@cmms/ui'
import { CalendarClock, ClipboardPlus } from 'lucide-react'
import { useMemo } from 'react'
import { Link, useNavigate } from 'react-router'
import { useAuth } from '../../auth/auth'
import { WoStatusBadge } from '../../components/badges'
import { useCreate } from '../../components/create'
import { AssetLink, PeopleStack, PersonChip, WoLink, paths } from '../../components/links'
import { useTableHistory } from '../../lib/history-state'
import { useScoped } from '../../state/scoped'
import { routeName } from './lib'

interface ForecastRow {
  pm: PmSchedule
  due: PmDue
}

export function UpcomingTab({ now }: { now: number }) {
  const { workOrders, pmSchedules, maps, personName } = useScoped()
  const { can } = useAuth()
  const create = useCreate()
  const navigate = useNavigate()
  const openTable = useTableHistory('upcoming.open')
  const forecastTable = useTableHistory('upcoming.forecast')

  const open = useMemo(
    () => workOrders.filter((w) => w.type === 'inspection' && isActive(w)).sort((a, b) => toMs(a.dueAt) - toMs(b.dueAt)),
    [workOrders],
  )
  // Routes whose next work order has not been generated yet.
  const forecast = useMemo<ForecastRow[]>(
    () =>
      pmSchedules
        .filter((pm) => pm.active && maps.jobPlan.get(pm.jobPlanId)?.woType === 'inspection' && !openPmWorkOrder(pm, workOrders))
        .map((pm) => ({ pm, due: pmDue(pm, maps.meter, now) }))
        .sort((a, b) => a.due.dueAt - b.due.dueAt),
    [pmSchedules, workOrders, maps.jobPlan, maps.meter, now],
  )

  const openColumns: Column<WorkOrder>[] = [
    {
      id: 'due',
      header: 'Due',
      cell: (wo) => {
        const late = isOverdue(wo, now)
        return (
          <div className="min-w-0">
            <p className={cn('whitespace-nowrap font-medium tabular-nums', late && 'text-accent')}>{fmtWhen(wo.dueAt, now)}</p>
            {late && <p className="text-[11px] font-semibold text-accent">Overdue</p>}
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5 sm:hidden">
              <span className="text-xs font-medium">{maps.asset.get(wo.assetId)?.code}</span>
              <WoStatusBadge status={wo.status} waitingReason={wo.waitingReason} />
              <span className="text-xs text-muted">{wo.assigneeIds.map(personName).join(', ') || 'Unassigned'}</span>
            </div>
          </div>
        )
      },
      sortValue: (wo) => toMs(wo.dueAt),
    },
    { id: 'asset', header: 'Asset', cell: (wo) => <AssetLink assetId={wo.assetId} />, sortValue: (wo) => maps.asset.get(wo.assetId)?.code ?? '', hideBelow: 'sm' },
    {
      id: 'route',
      header: 'Route',
      cell: (wo) => (
        <div className="min-w-0">
          <p className="truncate">{routeName(maps.jobPlan, wo.jobPlanId, wo.title)}</p>
          <WoLink woId={wo.id} className="text-[11px] text-muted" />
        </div>
      ),
      hideBelow: 'lg',
    },
    { id: 'assignee', header: 'Assignee', cell: (wo) => <PeopleStack personIds={wo.assigneeIds} size="xs" />, hideBelow: 'md' },
    { id: 'status', header: 'Status', cell: (wo) => <WoStatusBadge status={wo.status} waitingReason={wo.waitingReason} />, sortValue: (wo) => wo.status, hideBelow: 'sm' },
  ]

  const forecastColumns: Column<ForecastRow>[] = [
    {
      id: 'next',
      header: 'Next due',
      cell: ({ pm, due }) => (
        <div className="min-w-0">
          <p className={cn('whitespace-nowrap font-medium tabular-nums', due.state === 'overdue' && 'text-accent')}>{fmtDate(due.dueAt)}</p>
          <p className="text-[11px] text-muted">{triggerText(pm, maps.meter)}</p>
          <p className="mt-1.5 text-xs font-medium sm:hidden">{maps.asset.get(pm.assetId)?.code}</p>
        </div>
      ),
      sortValue: ({ due }) => due.dueAt,
    },
    { id: 'asset', header: 'Asset', cell: ({ pm }) => <AssetLink assetId={pm.assetId} />, hideBelow: 'sm' },
    {
      id: 'route',
      header: 'Route',
      cell: ({ pm }) => (
        <div className="min-w-0">
          <p className="truncate">{routeName(maps.jobPlan, pm.jobPlanId, pm.name)}</p>
          <p className="font-mono text-[11px] text-muted">{pm.code}</p>
        </div>
      ),
      hideBelow: 'md',
    },
    { id: 'assignee', header: 'Assignee', cell: ({ pm }) => <PersonChip personId={pm.assigneeId} />, hideBelow: 'lg' },
  ]

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Open inspection work</CardTitle>
          <CardDescription>Inspection work orders waiting for a technician, soonest due first.</CardDescription>
        </CardHeader>
        <DataTable
          {...openTable}
          columns={openColumns}
          rows={open}
          getRowKey={(wo) => wo.id}
          onRowClick={(wo) => navigate(paths.workOrder(wo.id))}
          initialSort={{ id: 'due' }}
          empty={
            <EmptyState
              compact
              icon={<CalendarClock />}
              title="No inspection work open"
              description="PM schedules generate inspection work orders a day before each route falls due."
              action={
                can('wo.create') ? (
                  <Button variant="outline" size="sm" onClick={() => create.workOrder({ type: 'inspection' })}>
                    <ClipboardPlus />
                    New inspection
                  </Button>
                ) : (
                  <Button asChild variant="outline" size="sm">
                    <Link to="/preventive/pm">Open PM schedules</Link>
                  </Button>
                )
              }
            />
          }
        />
      </Card>

      {forecast.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Next routes from PM schedules</CardTitle>
            <CardDescription>The schedule creates the work order ahead of the due date.</CardDescription>
          </CardHeader>
          <DataTable
            {...forecastTable}
            columns={forecastColumns}
            rows={forecast}
            getRowKey={({ pm }) => pm.id}
            onRowClick={({ pm }) => navigate(paths.pm(pm.id))}
            initialSort={{ id: 'next' }}
          />
        </Card>
      )}
    </div>
  )
}
