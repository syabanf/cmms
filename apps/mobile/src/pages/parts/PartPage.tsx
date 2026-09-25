import { fmtNumber, isActive, stockLevel } from '@cmms/fixtures'
import type { Part, PartLineStatus } from '@cmms/types'
import { PART_CATEGORY_LABEL } from '@cmms/types'
import { Badge, Card, EmptyState, cn } from '@cmms/ui'
import { ChevronRight, ClipboardList, Network, Package, Warehouse } from 'lucide-react'
import { useMemo } from 'react'
import { Link, useParams } from 'react-router'
import { PartStatusBadge } from '../../components/badges'
import { AssetIcon } from '../../components/icons'
import { Section } from '../../components/Section'
import { DetailHeader } from '../../layouts/DetailHeader'
import { paths } from '../../lib/paths'
import { byUrgency } from '../../lib/work'
import { useMobileScope, useNow } from '../../state/scope'
import { NotFound } from '../NotFoundPage'

/** Line states that tie stock to a work order. */
const HELD = new Set<PartLineStatus>(['reserved', 'issued'])

const rowClass = 'flex min-h-14 items-center gap-3 py-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40'

export function PartPage() {
  const { id = '' } = useParams()
  const { maps, isTechnician } = useMobileScope()
  const part = maps.part.get(id)
  const fallback = isTechnician ? paths.work() : paths.home
  if (!part) {
    return (
      <NotFound
        title="Spare part"
        heading="Part not found"
        description="It left the catalog, or the link is out of date."
        back={fallback}
        backLabel={isTechnician ? 'Back to my work' : 'Back home'}
      />
    )
  }
  return <PartView key={part.id} part={part} fallback={fallback} />
}

/** Stock at the site, the machines that list the part, and the work orders holding it. */
function PartView({ part, fallback }: { part: Part; fallback: string }) {
  const { site, warehouses, warehouseIds, stock, bom, workOrders, maps } = useMobileScope()
  const now = useNow()
  const level = useMemo(() => stockLevel(part.id, stock, warehouseIds), [part.id, stock, warehouseIds])
  const used = bom.flatMap((line) => {
    const asset = maps.asset.get(line.assetId)
    return line.partId === part.id && asset ? [{ line, asset }] : []
  })
  const held = useMemo(
    () =>
      workOrders
        .filter(isActive)
        .sort(byUrgency(now))
        .flatMap((wo) => wo.parts.filter((l) => l.partId === part.id && HELD.has(l.status)).map((line) => ({ wo, line }))),
    [workOrders, part.id, now],
  )
  const meta = [part.manufacturer, part.spec].filter(Boolean).join(' · ')

  return (
    <div className="space-y-6">
      <DetailHeader title={part.name} subtitle={`${part.code} · ${PART_CATEGORY_LABEL[part.category]}`} fallback={fallback} />

      <Card variant="ink" className="p-6">
        <div className="flex items-start justify-between gap-3">
          <span className="flex size-12 items-center justify-center rounded-2xl bg-white/10 [&_svg]:size-5">
            <Package aria-hidden="true" />
          </span>
          <Badge className="bg-white/10 text-white">{PART_CATEGORY_LABEL[part.category]}</Badge>
        </div>
        <p className="mt-5 font-mono text-sm text-on-ink-muted">{part.code}</p>
        <h2 className="mt-1 text-2xl font-bold leading-tight tracking-tight">{part.name}</h2>
        {meta && <p className="mt-1 text-sm text-on-ink-muted">{meta}</p>}
        {part.critical && (
          <div className="mt-3 flex flex-wrap gap-2">
            <Badge className="bg-white/10 text-white">Critical spare</Badge>
          </div>
        )}
        <div className="mt-5 flex items-end justify-between gap-3">
          <span>
            <span className={cn('block text-[32px] font-bold leading-none tabular-nums', level.available <= 0 && 'text-accent')}>
              {fmtNumber(level.available)}
            </span>
            <span className="mt-1.5 block text-xs text-on-ink-muted">
              {part.unit} available at {site.name}
            </span>
          </span>
          <span className="text-right text-xs tabular-nums text-on-ink-muted">
            {fmtNumber(level.onHand)} on hand
            <br />
            {fmtNumber(level.reserved)} reserved
          </span>
        </div>
      </Card>

      <Section title="Stock" count={level.items.length}>
        {level.items.length ? (
          <Card className="divide-y divide-border px-4 py-1">
            {level.items.map((item) => {
              const available = item.onHand - item.reserved
              return (
                <div key={item.id} className="py-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className="min-w-0 truncate text-sm font-semibold">
                      {warehouses.find((w) => w.id === item.warehouseId)?.name ?? 'Removed warehouse'}
                    </span>
                    <span className={cn('shrink-0 text-xs', item.bin ? 'font-semibold text-body' : 'text-muted')}>{item.bin || 'No bin'}</span>
                  </div>
                  <dl className="mt-2 grid grid-cols-3 gap-2">
                    <StockStat label="On hand" value={item.onHand} unit={part.unit} />
                    <StockStat label="Reserved" value={item.reserved} unit={part.unit} />
                    <StockStat label="Available" value={available} unit={part.unit} warn={available <= 0} />
                  </dl>
                </div>
              )
            })}
          </Card>
        ) : (
          <Card>
            <EmptyState
              compact
              icon={<Warehouse />}
              title={`Not stocked at ${site.name}`}
              description="The warehouse creates the stock record with the first receipt."
            />
          </Card>
        )}
      </Section>

      <Section title="Where used" count={used.length}>
        {used.length ? (
          <Card className="divide-y divide-border px-4 py-1">
            {used.map(({ line, asset }) => (
              <Link key={line.id} to={paths.asset(asset.code)} className={rowClass}>
                <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-surface text-body [&_svg]:size-4">
                  <AssetIcon icon={maps.assetType.get(asset.typeId)?.icon} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">{asset.name}</span>
                  <span className="block truncate text-xs text-muted">
                    <span className="font-mono">{asset.code}</span> · {line.component} · {fmtNumber(line.qty)} {part.unit} per machine
                  </span>
                </span>
                <ChevronRight aria-hidden="true" className="size-4 shrink-0 text-muted" />
              </Link>
            ))}
          </Card>
        ) : (
          <Card>
            <EmptyState
              compact
              icon={<Network />}
              title={`Not on any BOM at ${site.name}`}
              description="Planners list it on a machine's bill of material from the console."
            />
          </Card>
        )}
      </Section>

      <Section title="On open work orders" count={held.length}>
        {held.length ? (
          <Card className="divide-y divide-border px-4 py-1">
            {held.map(({ wo, line }) => (
              <Link key={`${wo.id}-${line.id}`} to={paths.workOrder(wo.id, 'parts')} className={rowClass}>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">{wo.title}</span>
                  <span className="block truncate text-xs text-muted">
                    <span className="font-mono">{wo.code}</span> · {maps.asset.get(wo.assetId)?.name ?? 'Removed asset'}
                  </span>
                </span>
                <span className="flex shrink-0 flex-col items-end gap-1">
                  <span className="text-sm font-bold tabular-nums">
                    {fmtNumber(line.qty)} {part.unit}
                  </span>
                  <PartStatusBadge status={line.status} />
                </span>
                <ChevronRight aria-hidden="true" className="size-4 shrink-0 text-muted" />
              </Link>
            ))}
          </Card>
        ) : (
          <Card>
            <EmptyState
              compact
              icon={<ClipboardList />}
              title="No open reservations"
              description="A work order shows here while it reserves or holds this part."
            />
          </Card>
        )}
      </Section>
    </div>
  )
}

function StockStat({ label, value, unit, warn = false }: { label: string; value: number; unit: string; warn?: boolean }) {
  return (
    <div className="rounded-xl bg-surface px-2 py-2.5 text-center">
      <dt className="text-[11px] font-medium text-muted">{label}</dt>
      <dd className={cn('mt-0.5 text-lg font-bold leading-none tabular-nums', warn && 'text-accent')}>
        {fmtNumber(value)} <span className="text-xs font-semibold text-muted">{unit}</span>
      </dd>
    </div>
  )
}
