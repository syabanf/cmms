import { fmtIdrShort, fmtMonth, fmtNumber, fmtPercent, plural } from '@cmms/fixtures'
import { WO_TYPE_LABEL, type WoType } from '@cmms/types'
import { BarList, type BarListItem, ColumnChart, EmptyState, StatCard } from '@cmms/ui'
import { Factory, Package, ReceiptText, Wallet } from 'lucide-react'
import type { ReactNode } from 'react'
import { useNavigate } from 'react-router'
import { paths } from '../../components/links'
import { type Scoped, useScoped } from '../../state/scoped'
import { ChartCard } from './ChartCard'
import { ReportSection } from './ReportSection'
import type { CostReport, MonthRow, Range } from './data'
import { type ReportTable, idrCell, percentCell } from './table'

const COST_PARTS = [
  { key: 'labor', label: 'Labor' },
  { key: 'parts', label: 'Spare parts' },
  { key: 'vendor', label: 'Vendor' },
  { key: 'misc', label: 'Other' },
] as const

const isWoType = (key: string): key is WoType => key in WO_TYPE_LABEL
const typeLabel = (key: string) => (isWoType(key) ? WO_TYPE_LABEL[key] : key)

function costTables(report: CostReport, monthly: MonthRow[], rangeLabel: string, maps: Scoped['maps']) {
  const { total } = report
  const kpis: ReportTable = {
    title: `Cost KPIs, ${rangeLabel}`,
    columns: ['Metric', 'Value', 'Detail'],
    rows: [
      ['Maintenance cost', idrCell(total.total), plural(report.workOrders, 'completed work order')],
      ...COST_PARTS.map(({ key, label }) => [`${label} cost`, idrCell(total[key]), `${fmtPercent(total.total ? total[key] / total.total : 0)} of the total`]),
      ['Cost per work order', idrCell(report.perWorkOrder), 'Total over completed work orders'],
      ['Cost per asset', idrCell(report.perAsset), `${plural(report.assets, 'asset')} with booked work`],
    ],
    phoneColumns: 2,
  }
  const trend: ReportTable = {
    title: 'Maintenance cost per month',
    columns: ['Month', 'Total', 'Labor', 'Spare parts', 'Vendor', 'Other'],
    rows: monthly.map((m) => [fmtMonth(m.period.from), idrCell(m.cost.total), ...COST_PARTS.map(({ key }) => idrCell(m.cost[key]))]),
    phoneColumns: 2,
  }
  const breakdown: ReportTable = {
    title: `Cost breakdown, ${rangeLabel}`,
    columns: ['Cost', 'Amount', 'Share'],
    rows: COST_PARTS.map(({ key, label }) => [label, idrCell(total[key]), percentCell(total.total ? total[key] / total.total : 0)]),
  }
  const assets: ReportTable = {
    title: `Top assets by cost, ${rangeLabel}`,
    columns: ['Asset', 'Cost', 'Work orders'],
    rows: report.byAsset.map((r) => [maps.asset.get(r.key)?.name ?? 'Removed asset', idrCell(r.cost), r.count]),
  }
  const parts: ReportTable = {
    title: `Spare parts used, ${rangeLabel}`,
    columns: ['Part', 'Quantity', 'Cost'],
    rows: report.parts.map((p) => {
      const part = maps.part.get(p.partId)
      return [part ? `${part.code} ${part.name}` : 'Removed part', `${fmtNumber(p.qty)} ${part?.unit ?? ''}`.trim(), idrCell(p.cost)]
    }),
  }
  const areas: ReportTable = {
    title: `Cost by area, ${rangeLabel}`,
    columns: ['Area', 'Cost', 'Work orders'],
    rows: report.byArea.map((r) => [maps.location.get(r.key)?.name ?? 'Unknown area', idrCell(r.cost), r.count]),
  }
  const types: ReportTable = {
    title: `Cost by work type, ${rangeLabel}`,
    columns: ['Work type', 'Cost', 'Work orders'],
    rows: report.byType.map((r) => [typeLabel(r.key), idrCell(r.cost), r.count]),
  }
  return { kpis, trend, breakdown, assets, parts, areas, types }
}

/** A BarList of costs, the largest one in accent, or an empty state. */
function CostList({ items, label, empty }: { items: Omit<BarListItem, 'emphasis' | 'display'>[]; label: string; empty: ReactNode }) {
  if (!items.length) return <>{empty}</>
  return <BarList ariaLabel={label} items={items.map((item, i) => ({ ...item, display: fmtIdrShort(item.value), emphasis: i === 0 }))} />
}

const noCost = <EmptyState compact icon={<Wallet />} title="No cost booked" description="Cost is booked when work is completed. Pick a longer period." />

export function CostSection({ report, monthly, range }: { report: CostReport; monthly: MonthRow[]; range: Range }) {
  const { maps } = useScoped()
  const navigate = useNavigate()
  const t = costTables(report, monthly, range.label, maps)
  const { total } = report
  const breakdown = COST_PARTS.map(({ key, label }) => ({ key, label, value: total[key] })).sort((a, b) => b.value - a.value)

  return (
    <ReportSection
      sectionKey="cost"
      title="Cost"
      question={`What does maintenance cost, and where does the money go? ${range.label}.`}
      tables={[t.kpis, t.trend, t.breakdown, t.assets, t.parts, t.areas, t.types]}
    >
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
        <StatCard
          label="Maintenance cost"
          value={fmtIdrShort(total.total)}
          hint={plural(report.workOrders, 'completed work order')}
          icon={<Wallet />}
          className="col-span-2 lg:col-span-1"
        />
        <StatCard label="Per work order" value={fmtIdrShort(report.perWorkOrder)} hint="Labor, parts, vendor and other" icon={<ReceiptText />} />
        <StatCard label="Per asset" value={fmtIdrShort(report.perAsset)} hint={`${plural(report.assets, 'asset')} with booked work`} icon={<Factory />} />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <ChartCard title="Monthly cost" description="Booked when work is completed. The current month runs to today." table={t.trend}>
          <ColumnChart
            ariaLabel="Maintenance cost per month"
            tone="muted"
            format={fmtIdrShort}
            data={monthly.map((m) => ({ label: m.period.label, value: Math.round(m.cost.total), highlight: m.current }))}
          />
        </ChartCard>
        <ChartCard title="Where the money goes" description="Labor from logged hours, parts issued or used, vendor and other costs." table={t.breakdown}>
          <CostList
            label="Cost by category"
            empty={noCost}
            items={total.total ? breakdown.map((b) => ({ key: b.key, label: b.label, value: b.value, hint: fmtPercent(b.value / total.total) })) : []}
          />
        </ChartCard>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ChartCard title="Top 10 assets by cost" description="Every completed work order on the asset counts, planned work included." table={t.assets}>
          <CostList
            label="Cost per asset"
            empty={noCost}
            items={report.byAsset.map((r) => ({
              key: r.key,
              label: maps.asset.get(r.key)?.name ?? 'Removed asset',
              value: r.cost,
              hint: plural(r.count, 'work order'),
              onClick: () => navigate(paths.asset(r.key)),
            }))}
          />
        </ChartCard>
        <ChartCard title="Spare parts used" description="Parts issued or used on completed work, costliest first." table={t.parts}>
          <CostList
            label="Cost per spare part"
            empty={<EmptyState compact icon={<Package />} title="No parts used" description="Parts show up here once they are issued to completed work." />}
            items={report.parts.map((p) => {
              const part = maps.part.get(p.partId)
              return {
                key: p.partId,
                label: part?.name ?? 'Removed part',
                value: p.cost,
                hint: `${fmtNumber(p.qty)} ${part?.unit ?? ''}`.trim(),
                onClick: () => navigate(paths.part(p.partId)),
              }
            })}
          />
        </ChartCard>
        <ChartCard title="Cost by area" description="Grouped by the area each asset stands in." table={t.areas}>
          <CostList
            label="Cost per area"
            empty={noCost}
            items={report.byArea.map((r) => ({ key: r.key, label: maps.location.get(r.key)?.name ?? 'Unknown area', value: r.cost, hint: plural(r.count, 'work order') }))}
          />
        </ChartCard>
        <ChartCard title="Cost by work type" description="Reactive work next to planned work." table={t.types}>
          <CostList
            label="Cost per work type"
            empty={noCost}
            items={report.byType.map((r) => ({ key: r.key, label: typeLabel(r.key), value: r.cost, hint: plural(r.count, 'work order') }))}
          />
        </ChartCard>
      </div>
    </ReportSection>
  )
}
