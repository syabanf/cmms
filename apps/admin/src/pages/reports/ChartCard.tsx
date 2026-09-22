import { Card, CardContent, CardDescription, CardTitle, EmptyState, SegmentedControl, cn } from '@cmms/ui'
import type { ReactNode } from 'react'
import { useHistoryState } from '../../lib/history-state'
import { type ReportTable, cellText, isNumeric } from './table'

const VIEWS = [
  { value: 'chart', label: 'Chart' },
  { value: 'table', label: 'Table' },
]

/** A chart card with its table twin: the Table toggle shows the same numbers as rows. */
export function ChartCard({
  title,
  description,
  table,
  action,
  className,
  children,
}: {
  title: string
  description?: ReactNode
  table: ReportTable
  /** Controls placed before the Chart / Table toggle. */
  action?: ReactNode
  className?: string
  children: ReactNode
}) {
  const [view, setView] = useHistoryState<'chart' | 'table'>(`view:${title}`, 'chart')
  return (
    <Card className={cn('flex min-w-0 flex-col', className)}>
      <div className="flex flex-wrap items-start justify-between gap-2 p-5">
        <div className="flex min-w-[min(100%,16rem)] flex-1 basis-0 flex-col gap-1">
          <CardTitle>{title}</CardTitle>
          {description !== undefined && <CardDescription>{description}</CardDescription>}
        </div>
        <div className="flex max-w-full flex-wrap items-center gap-2">
          {action}
          <SegmentedControl
            size="sm"
            aria-label={`${title}: chart or table`}
            value={view}
            onChange={(next) => setView(next === 'table' ? 'table' : 'chart')}
            options={VIEWS}
          />
        </div>
      </div>
      <CardContent className="flex-1">{view === 'chart' ? children : <TableView table={table} />}</CardContent>
    </Card>
  )
}

function TableView({ table }: { table: ReportTable }) {
  if (!table.rows.length) return <EmptyState compact title="No rows" description="Nothing was recorded in this period." />
  const numeric = table.columns.map((_, i) => table.rows.some((row) => isNumeric(row[i])))
  const phoneHidden = (i: number) => table.phoneColumns !== undefined && i >= table.phoneColumns && 'hidden sm:table-cell'
  return (
    <table className="w-full text-sm">
      <caption className="sr-only">{table.title}</caption>
      <thead>
        <tr className="border-b border-border">
          {table.columns.map((column, i) => (
            <th
              key={column}
              scope="col"
              className={cn(
                'h-9 px-2 text-xs font-semibold uppercase tracking-wide text-muted first:pl-0 last:pr-0',
                numeric[i] ? 'text-right' : 'text-left',
                phoneHidden(i),
              )}
            >
              {column}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {table.rows.map((row, r) => (
          <tr key={r} className="border-b border-border last:border-b-0">
            {row.map((cell, i) => (
              <td
                key={i}
                className={cn('px-2 py-2 first:pl-0 last:pr-0', numeric[i] ? 'whitespace-nowrap text-right tabular-nums' : 'text-left', phoneHidden(i))}
              >
                {cellText(cell)}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  )
}
