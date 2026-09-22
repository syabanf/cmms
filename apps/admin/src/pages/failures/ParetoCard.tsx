import { type FailureEvent, fmtNumber, fmtPercent, pareto } from '@cmms/fixtures'
import { BarList, EmptyState, PillTabs } from '@cmms/ui'
import { ChartColumn } from 'lucide-react'
import { useMemo } from 'react'
import { ChartCard } from '../reports/ChartCard'
import { type ReportTable, percentCell } from '../reports/table'
import { PARETO_BY, type ParetoBy, paretoKey, vitalFew } from './lib'

const TOP = 10

export function ParetoCard({
  events,
  periodDays,
  by,
  onByChange,
  focus,
  onFocusChange,
  nameOf,
}: {
  events: FailureEvent[]
  periodDays: number
  by: ParetoBy
  onByChange: (by: ParetoBy) => void
  /** The key the failure records are filtered to, if any. */
  focus: string | null
  onFocusChange: (key: string | null) => void
  nameOf: (key: string) => string
}) {
  const option = PARETO_BY.find((o) => o.value === by) ?? PARETO_BY[0]
  const noun = option.label.toLowerCase()
  const rows = useMemo(() => pareto(events.map(paretoKey[by])), [events, by])
  const top = rows.slice(0, TOP)
  const uncoded = events.length - rows.reduce((sum, r) => sum + r.count, 0)
  const few = vitalFew(rows)

  const table: ReportTable = {
    title: `Failures by ${noun}, last ${periodDays} days`,
    columns: [option.label, 'Failures', 'Share', 'Cumulative'],
    rows: top.map((r) => [nameOf(r.key), r.count, percentCell(r.share), percentCell(r.cumulative)]),
    phoneColumns: 3,
  }

  const description = rows.length
    ? `${few} of ${rows.length} ${option.plural} ${few === 1 ? 'causes' : 'cause'} 80% of the failures.${
        uncoded ? ` ${uncoded} ${uncoded === 1 ? 'failure has' : 'failures have'} no ${noun} coded.` : ''
      }`
    : `No coded failures in the last ${periodDays} days.`

  return (
    <ChartCard title="Failure Pareto" description={description} table={table}>
      <PillTabs
        size="sm"
        className="mb-4"
        value={by}
        onValueChange={(value) => {
          const next = PARETO_BY.find((o) => o.value === value)
          if (next) onByChange(next.value)
        }}
        items={PARETO_BY.map(({ value, label }) => ({ value, label }))}
      />
      {top.length ? (
        <>
          <BarList
            ariaLabel={`Failures by ${noun}`}
            items={top.map((r, i) => ({
              key: r.key,
              label: nameOf(r.key),
              value: r.count,
              display: fmtNumber(r.count),
              hint: `${fmtPercent(r.share)} · ${fmtPercent(r.cumulative)} cumulative`,
              emphasis: focus === null ? i === 0 : r.key === focus,
              onClick: () => onFocusChange(r.key === focus ? null : r.key),
            }))}
          />
          <p className="mt-3 text-xs text-muted">
            {rows.length > TOP ? `Top ${TOP} of ${rows.length}. ` : ''}Select a bar to filter the failure records.
          </p>
        </>
      ) : (
        <EmptyState
          compact
          icon={<ChartColumn />}
          title={`No ${noun} coded yet`}
          description="Technicians code problem, mode, cause and remedy when they complete corrective work."
        />
      )}
    </ChartCard>
  )
}
