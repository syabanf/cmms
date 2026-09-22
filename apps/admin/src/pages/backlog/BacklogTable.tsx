import { type BacklogRow, fmtAgo, fmtDateShort, fmtNumber, toMs } from '@cmms/fixtures'
import { WAITING_REASON_LABEL, WO_STATUS_FLOW } from '@cmms/types'
import { type Column, DataTable, cn } from '@cmms/ui'
import type { ReactNode } from 'react'
import { useNavigate } from 'react-router'
import { CriticalityBadge, PriorityBadge, WoStatusBadge } from '../../components/badges'
import { AssetLink, PeopleStack, paths } from '../../components/links'
import { useTableHistory } from '../../lib/history-state'
import { useScoped } from '../../state/scoped'
import { AGED_DAYS, fmtAge, lateBy } from './lib'

/**
 * Columns appear as the width allows. Below `lg` the first cell carries a compact status line;
 * below `sm` it also carries the priority and age.
 */
export function BacklogTable({ rows, now, empty, resetKey }: { rows: BacklogRow[]; now: number; empty: ReactNode; resetKey: string }) {
  const navigate = useNavigate()
  const table = useTableHistory()
  const { maps } = useScoped()
  const aged = (r: BacklogRow) => r.ageDays > AGED_DAYS

  const columns: Column<BacklogRow>[] = [
    {
      id: 'wo',
      header: 'Work order',
      cell: (r) => (
        <div className="min-w-0 max-w-[16rem] xl:max-w-[13rem]">
          <p className="truncate font-semibold">{r.wo.title}</p>
          <p className="font-mono text-[11px] text-muted">{r.wo.code}</p>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5 lg:hidden">
            <span className="sm:hidden">
              <PriorityBadge priority={r.wo.priority} />
            </span>
            <WoStatusBadge status={r.wo.status} waitingReason={r.wo.waitingReason} />
            <span className={cn('text-[11px] tabular-nums sm:hidden', aged(r) ? 'font-semibold text-accent' : 'text-muted')}>
              {fmtAge(r.ageDays)} old
              {r.overdue && ` · ${lateBy(r.wo.dueAt, now)}`}
            </span>
          </div>
        </div>
      ),
      sortValue: (r) => r.wo.code,
    },
    {
      id: 'asset',
      header: 'Asset',
      cell: (r) => {
        const asset = maps.asset.get(r.wo.assetId)
        return (
          <div className="flex items-center gap-2">
            <div className="min-w-0 max-w-[10rem]">
              <AssetLink assetId={r.wo.assetId} />
            </div>
            {asset && <CriticalityBadge criticality={asset.criticality} />}
          </div>
        )
      },
      sortValue: (r) => maps.asset.get(r.wo.assetId)?.code ?? '',
      hideBelow: 'xl',
    },
    {
      id: 'age',
      header: 'Age',
      align: 'right',
      cell: (r) => <span className={cn('whitespace-nowrap tabular-nums', aged(r) && 'font-bold text-accent')}>{fmtAge(r.ageDays)}</span>,
      sortValue: (r) => r.ageDays,
      hideBelow: 'sm',
    },
    {
      id: 'priority',
      header: 'Priority',
      cell: (r) => <PriorityBadge priority={r.wo.priority} />,
      sortValue: (r) => r.wo.priority,
      hideBelow: 'sm',
    },
    {
      id: 'hours',
      header: <span title="Remaining man-hours">Hours</span>,
      align: 'right',
      cell: (r) => <span className="whitespace-nowrap tabular-nums">{fmtNumber(r.manHours, 1)} h</span>,
      sortValue: (r) => r.manHours,
      hideBelow: 'lg',
    },
    {
      id: 'status',
      header: 'Status',
      cell: (r) => (
        <div className="whitespace-nowrap">
          <WoStatusBadge status={r.wo.status} />
          {r.wo.status === 'waiting' && r.wo.waitingReason && <p className="mt-1 text-[11px] text-muted">{WAITING_REASON_LABEL[r.wo.waitingReason]}</p>}
          {r.wo.approval?.status === 'pending' && <p className="mt-1 text-[11px] text-muted">Awaiting approval</p>}
        </div>
      ),
      sortValue: (r) => WO_STATUS_FLOW.indexOf(r.wo.status),
      hideBelow: 'lg',
    },
    {
      id: 'people',
      header: 'Assigned',
      cell: (r) => <PeopleStack personIds={r.wo.assigneeIds} size="xs" />,
      className: 'hidden 2xl:table-cell',
      headerClassName: 'hidden 2xl:table-cell',
    },
    {
      id: 'due',
      header: 'Due',
      cell: (r) => (
        <div className="whitespace-nowrap">
          <p className={cn('text-sm tabular-nums', r.overdue && 'font-semibold text-accent')}>{fmtDateShort(r.wo.dueAt)}</p>
          <p className={cn('text-[11px]', r.overdue ? 'text-accent' : 'text-muted')}>{r.overdue ? lateBy(r.wo.dueAt, now) : fmtAgo(r.wo.dueAt, now)}</p>
        </div>
      ),
      sortValue: (r) => toMs(r.wo.dueAt),
      hideBelow: 'sm',
    },
  ]

  return (
    <DataTable
      columns={columns}
      rows={rows}
      getRowKey={(r) => r.wo.id}
      onRowClick={(r) => navigate(paths.workOrder(r.wo.id))}
      resetPageKey={resetKey}
      {...table}
      empty={empty}
    />
  )
}
