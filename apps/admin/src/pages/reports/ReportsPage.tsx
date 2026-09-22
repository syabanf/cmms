import { PageHeader, PillTabs } from '@cmms/ui'
import { useMemo } from 'react'
import { useHistoryState } from '../../lib/history-state'
import { useNow, useScoped } from '../../state/scoped'
import { AtAGlance } from './AtAGlance'
import { CostSection } from './CostSection'
import { OperationalSection } from './OperationalSection'
import { ReliabilitySection } from './ReliabilitySection'
import { ResourceSection } from './ResourceSection'
import {
  REPORT_PERIODS,
  type ReportPeriod,
  costReport,
  isReportPeriod,
  monthlyReport,
  operationalReport,
  periodRange,
  reliabilityReport,
  technicianRows,
} from './data'

export function ReportsPage() {
  const s = useScoped()
  const now = useNow(60_000)
  const [period, setPeriod] = useHistoryState<ReportPeriod>('period', 'quarter')

  const range = useMemo(() => periodRange(period, now), [period, now])
  const monthly = useMemo(() => monthlyReport(s, now), [s, now])
  const operational = useMemo(() => operationalReport(s, range, now), [s, range, now])
  const reliability = useMemo(() => reliabilityReport(s, range, now), [s, range, now])
  const cost = useMemo(() => costReport(s, range, now), [s, range, now])
  const load = useMemo(() => technicianRows(s, range, now), [s, range, now])

  return (
    <>
      <PageHeader
        title="Reports"
        description={`Answers to the questions a maintenance review asks, from the records at ${s.site.name}.`}
        actions={
          <PillTabs
            value={period}
            onValueChange={(value) => {
              if (isReportPeriod(value)) setPeriod(value)
            }}
            items={REPORT_PERIODS.map(({ value, label }) => ({ value, label }))}
          />
        }
      />
      <div className="space-y-8">
        <AtAGlance operational={operational} reliability={reliability} cost={cost} load={load} range={range} />
        <OperationalSection report={operational} monthly={monthly} range={range} />
        <ReliabilitySection report={reliability} monthly={monthly} range={range} />
        <CostSection report={cost} monthly={monthly} range={range} />
        <ResourceSection load={load} operational={operational} range={range} />
      </div>
    </>
  )
}
