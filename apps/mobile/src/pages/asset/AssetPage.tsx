import {
  HISTORY_KIND_LABEL,
  type HistoryKind,
  fmtAgo,
  fmtDate,
  fmtFileSize,
  fmtNumber,
  fmtWhen,
  historyItems,
  isActive,
  stockLevel,
  subtreeIds,
  toMs,
} from '@cmms/fixtures'
import type { Asset } from '@cmms/types'
import { DOCUMENT_TYPE_LABEL, METER_KIND_LABEL } from '@cmms/types'
import { Button, Card, EmptyState, KeyValue, cn, toast } from '@cmms/ui'
import type { LucideIcon } from 'lucide-react'
import {
  Activity,
  ChevronRight,
  ClipboardCheck,
  Coins,
  FileText,
  Gauge,
  MessageSquareWarning,
  Package,
  TriangleAlert,
  Wrench,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router'
import { AssetStatusBadge, CriticalityBadge, OutcomeBadge } from '../../components/badges'
import { AssetIcon } from '../../components/icons'
import { Section } from '../../components/Section'
import { WoCard } from '../../components/WoCard'
import { DetailHeader } from '../../layouts/DetailHeader'
import { paths } from '../../lib/paths'
import { byUrgency } from '../../lib/work'
import { useMobileScope, useNow } from '../../state/scope'
import { NotFound } from '../NotFoundPage'
import { MeterSheet } from './MeterSheet'

const HISTORY_ICON: Record<HistoryKind, LucideIcon> = {
  work_order: Wrench,
  failure: TriangleAlert,
  part: Package,
  measurement: Activity,
  cost: Coins,
  document: FileText,
  inspection: ClipboardCheck,
  calibration: Gauge,
}

// Meter readings and cost lines have their own place, so the short history skips them.
const HISTORY_KINDS = new Set<HistoryKind>(['work_order', 'failure', 'part', 'inspection', 'calibration', 'document'])
const HISTORY_COUNT = 5

export function AssetPage() {
  const { code = '' } = useParams()
  const { assets, site } = useMobileScope()
  const asset = assets.find((a) => a.code.toUpperCase() === code.toUpperCase())
  if (!asset) {
    return (
      <NotFound
        title="Asset"
        heading={`No asset ${code.toUpperCase()} at ${site.name}`}
        description="Check the code on the tag, or scan it again."
        back={paths.scan}
        backLabel="Scan again"
      />
    )
  }
  return <AssetView key={asset.id} asset={asset} />
}

function AssetView({ asset }: { asset: Asset }) {
  const {
    isTechnician,
    assets,
    workOrders,
    meters,
    meterReadings,
    documents,
    bom,
    stock,
    warehouseIds,
    calibrations,
    maps,
    locationPath,
  } = useMobileScope()
  const now = useNow()
  const [meterId, setMeterId] = useState<string | null>(null)
  const [meterOpen, setMeterOpen] = useState(false)

  // The machine and its components (motor, spindle, inverter) share one history.
  const family = useMemo(() => subtreeIds(assets, asset.id), [assets, asset.id])
  const openWork = useMemo(
    () => workOrders.filter((w) => family.has(w.assetId) && isActive(w) && w.status !== 'draft').sort(byUrgency(now)),
    [workOrders, family, now],
  )
  const history = useMemo(
    () =>
      historyItems(
        { workOrders, meters, meterReadings, documents, calibrations, parts: maps.part, failureCodes: maps.failureCode, people: maps.person },
        family,
        now,
      )
        .filter((h) => HISTORY_KINDS.has(h.kind))
        .slice(0, HISTORY_COUNT),
    [workOrders, meters, meterReadings, documents, calibrations, maps, family, now],
  )
  const docs = documents.filter((d) => d.assetId === asset.id)
  const bomLines = bom.filter((b) => b.assetId === asset.id)
  const assetMeters = meters.filter((m) => m.assetId === asset.id)
  const type = maps.assetType.get(asset.typeId)
  const parent = asset.parentId ? maps.asset.get(asset.parentId) : undefined
  const warranty = asset.warranty && toMs(asset.warranty.end) > now ? asset.warranty : null

  const recordMeter = (id: string) => {
    setMeterId(id)
    setMeterOpen(true)
  }

  return (
    <div className="space-y-6">
      <DetailHeader title={asset.name} subtitle={`${asset.code} · ${type?.name ?? 'Asset'}`} fallback={paths.scan} />

      <Card variant="ink" className="p-6">
        <div className="flex items-start justify-between gap-3">
          <span className="flex size-12 items-center justify-center rounded-2xl bg-white/10 [&_svg]:size-5">
            <AssetIcon icon={type?.icon} />
          </span>
          <AssetStatusBadge status={asset.status} />
        </div>
        <h2 className="mt-5 text-2xl font-bold leading-tight tracking-tight">{asset.name}</h2>
        <p className="mt-1 font-mono text-sm text-on-ink-muted">{asset.code}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <CriticalityBadge criticality={asset.criticality} />
        </div>
        <p className="mt-4 text-sm text-on-ink-muted">{locationPath(asset.locationId)}</p>
        {parent && (
          <Link to={paths.asset(parent.code)} className="mt-1 inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-white">
            Part of {parent.name}
            <ChevronRight aria-hidden="true" className="size-4" />
          </Link>
        )}
      </Card>

      <div className={cn('grid gap-2', isTechnician ? 'grid-cols-2' : 'grid-cols-1')}>
        <Button asChild size="lg">
          <Link to={paths.newRequest(asset.code)}>
            <MessageSquareWarning />
            Report problem
          </Link>
        </Button>
        {isTechnician && (
          <Button
            size="lg"
            variant="secondary"
            disabled={!assetMeters.length}
            onClick={() => assetMeters[0] && recordMeter(assetMeters[0].id)}
          >
            <Gauge />
            {assetMeters.length ? 'Meter reading' : 'No meter'}
          </Button>
        )}
      </div>

      <KeyValue
        items={[
          { label: 'Make', value: [asset.manufacturer, asset.model].filter(Boolean).join(' ') || 'Not recorded' },
          { label: 'Serial', value: <span className="font-mono text-xs">{asset.serialNumber || 'Not recorded'}</span> },
          { label: 'Installed', value: fmtDate(asset.installedAt) },
          { label: 'Team', value: maps.team.get(asset.teamId)?.name ?? 'No team' },
          {
            label: 'Warranty',
            hidden: !warranty,
            value: warranty && (
              <span className="font-semibold text-success">
                Active until {fmtDate(warranty.end)}
                {warranty.vendorId ? ` · ${maps.vendor.get(warranty.vendorId)?.name ?? ''}` : ''}
              </span>
            ),
          },
        ]}
      />

      <Section title="Open work" count={openWork.length}>
        {openWork.length ? (
          <div className="space-y-3">
            {openWork.map((wo) => (
              <WoCard key={wo.id} wo={wo} now={now} />
            ))}
          </div>
        ) : (
          <Card>
            <EmptyState
              compact
              icon={<Wrench />}
              title="No open work on this machine"
              description="If something is off, report it and a supervisor decides the next step."
              action={
                <Button asChild variant="outline" className="h-11">
                  <Link to={paths.newRequest(asset.code)}>Report problem</Link>
                </Button>
              }
            />
          </Card>
        )}
      </Section>

      <Section title="Recent history">
        {history.length ? (
          <Card className="divide-y divide-border px-4 py-1">
            {history.map((h) => {
              const Icon = HISTORY_ICON[h.kind]
              const body = (
                <>
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-surface text-body [&_svg]:size-4">
                    <Icon aria-hidden="true" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold leading-snug">{h.title}</span>
                    <span className="block truncate text-xs text-muted">
                      {HISTORY_KIND_LABEL[h.kind]} · {fmtWhen(h.at, now)}
                    </span>
                  </span>
                  <OutcomeBadge outcome={h.outcome} />
                </>
              )
              return h.woId ? (
                <Link key={h.id} to={paths.workOrder(h.woId)} className="flex min-h-14 items-center gap-3 py-3">
                  {body}
                </Link>
              ) : (
                <div key={h.id} className="flex min-h-14 items-center gap-3 py-3">
                  {body}
                </div>
              )
            })}
          </Card>
        ) : (
          <Card>
            <EmptyState compact title="No history yet" description="Completed work, part changes and inspections appear here." />
          </Card>
        )}
      </Section>

      {assetMeters.length > 0 && (
        <Section title="Meters">
          <Card className="divide-y divide-border px-4 py-1">
            {assetMeters.map((m) => (
              <div key={m.id} className="flex min-h-16 items-center gap-3 py-3">
                <span className="min-w-0 flex-1">
                  <span className="block text-xs font-medium text-muted">{METER_KIND_LABEL[m.kind]}</span>
                  <span className="flex items-start gap-1 leading-none">
                    <span className="text-xl font-bold tabular-nums">{fmtNumber(m.value)}</span>
                    <span className="pt-0.5 text-xs font-semibold text-muted">{m.unit}</span>
                  </span>
                  <span className="mt-1 block text-[11px] text-muted">Read {fmtAgo(m.updatedAt, now)}</span>
                </span>
                {isTechnician && (
                  <Button variant="soft" className="h-11" onClick={() => recordMeter(m.id)}>
                    Record
                  </Button>
                )}
              </div>
            ))}
          </Card>
        </Section>
      )}

      <Section title="Documents" count={docs.length}>
        {docs.length ? (
          <Card className="divide-y divide-border px-4 py-1">
            {docs.map((d) => (
              <button
                key={d.id}
                type="button"
                onClick={() => toast('Open this document on a desktop or tablet', { description: d.fileName })}
                className="flex min-h-14 w-full items-center gap-3 py-3 text-left"
              >
                <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-surface text-body [&_svg]:size-4">
                  <FileText aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">{d.name}</span>
                  <span className="block truncate text-xs text-muted">
                    {DOCUMENT_TYPE_LABEL[d.type]} · {fmtFileSize(d.sizeKb)}
                  </span>
                </span>
                <ChevronRight aria-hidden="true" className="size-4 shrink-0 text-muted" />
              </button>
            ))}
          </Card>
        ) : (
          <Card>
            <EmptyState compact icon={<FileText />} title="No documents" description="Manuals and drawings are added from the maintenance console." />
          </Card>
        )}
      </Section>

      <Section title="Spare parts BOM" count={bomLines.length}>
        {bomLines.length ? (
          <Card className="divide-y divide-border px-4 py-1">
            {bomLines.map((line) => {
              const part = maps.part.get(line.partId)
              const available = stockLevel(line.partId, stock, warehouseIds).available
              return (
                <div key={line.id} className="flex min-h-14 items-center gap-3 py-3">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{part?.name ?? 'Removed part'}</span>
                    <span className="block truncate text-xs text-muted">
                      <span className="font-mono">{part?.code}</span> · {line.component} · {line.qty} {part?.unit} per machine
                    </span>
                  </span>
                  <span className={cn('shrink-0 text-xs font-semibold tabular-nums', available > 0 ? 'text-success' : 'text-accent')}>
                    {available > 0 ? `${available} in stock` : 'Out of stock'}
                  </span>
                </div>
              )
            })}
          </Card>
        ) : (
          <Card>
            <EmptyState compact icon={<Package />} title="No BOM recorded" description="Parts for this machine can still be reserved from any work order." />
          </Card>
        )}
      </Section>

      {meterId && (
        <MeterSheet meters={assetMeters} meterId={meterId} assetCode={asset.code} open={meterOpen} onOpenChange={setMeterOpen} />
      )}
    </div>
  )
}
