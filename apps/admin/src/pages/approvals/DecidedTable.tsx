import { fmtDateShort, fmtDateTime, toMs } from '@cmms/fixtures'
import { type Column, DataTable, EmptyState } from '@cmms/ui'
import { History } from 'lucide-react'
import { useNavigate } from 'react-router'
import { ApprovalBadge } from '../../components/badges'
import { PersonChip, paths } from '../../components/links'
import { useTableHistory } from '../../lib/history-state'
import { useScoped } from '../../state/scoped'
import { LEVEL_SHORT, type WithApproval } from './lib'

const decidedMs = (wo: WithApproval) => (wo.approval.decidedAt ? toMs(wo.approval.decidedAt) : 0)

/** Past decisions, newest first. Below `sm` the decision rides in the first cell, below `xl` the note does. */
export function DecidedTable({ rows }: { rows: WithApproval[] }) {
  const navigate = useNavigate()
  const table = useTableHistory()
  const { personName } = useScoped()

  const columns: Column<WithApproval>[] = [
    {
      id: 'wo',
      header: 'Work order',
      cell: (wo) => (
        <div className="min-w-0 max-w-[16rem] xl:max-w-[14rem]">
          <p className="truncate font-semibold">{wo.title}</p>
          <p className="font-mono text-[11px] text-muted">{wo.code}</p>
          {wo.approval.note && <p className="mt-1 truncate text-xs text-muted xl:hidden">Note: {wo.approval.note}</p>}
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5 sm:hidden">
            <ApprovalBadge status={wo.approval.status} />
            <span className="text-[11px] text-muted">
              {personName(wo.approval.decidedBy)}
              {wo.approval.decidedAt && ` · ${fmtDateShort(wo.approval.decidedAt)}`}
            </span>
          </div>
        </div>
      ),
      sortValue: (wo) => wo.code,
    },
    {
      id: 'level',
      header: 'Level',
      cell: (wo) => <span className="whitespace-nowrap">{LEVEL_SHORT[wo.approval.level]}</span>,
      sortValue: (wo) => wo.approval.level,
      hideBelow: 'lg',
    },
    {
      id: 'decision',
      header: 'Decision',
      cell: (wo) => <ApprovalBadge status={wo.approval.status} />,
      sortValue: (wo) => wo.approval.status,
      hideBelow: 'sm',
    },
    {
      id: 'decided',
      header: 'Decided',
      cell: (wo) => (
        <div className="min-w-0">
          <PersonChip personId={wo.approval.decidedBy} />
          {wo.approval.decidedAt && <p className="mt-0.5 whitespace-nowrap text-[11px] text-muted">{fmtDateTime(wo.approval.decidedAt)}</p>}
        </div>
      ),
      sortValue: decidedMs,
      hideBelow: 'sm',
    },
    {
      id: 'note',
      header: 'Note',
      cell: (wo) =>
        wo.approval.note ? (
          <p className="max-w-[14rem] truncate text-sm" title={wo.approval.note}>
            {wo.approval.note}
          </p>
        ) : (
          <span className="text-xs text-muted">No note</span>
        ),
      hideBelow: 'xl',
    },
  ]

  return (
    <DataTable
      columns={columns}
      rows={rows}
      getRowKey={(wo) => wo.id}
      onRowClick={(wo) => navigate(paths.workOrder(wo.id))}
      initialSort={{ id: 'decided', desc: true }}
      pageSize={10}
      {...table}
      empty={<EmptyState icon={<History />} title="No decisions yet" description="Approve or reject a pending work order above. It moves here with your note." />}
    />
  )
}
