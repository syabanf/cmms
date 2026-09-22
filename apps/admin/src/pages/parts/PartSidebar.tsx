import { type StockLevel, type StockState, fmtIdr, fmtNumber, nowMs, reorderSuggestion } from '@cmms/fixtures'
import type { Part } from '@cmms/types'
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, EmptyState, KeyValue, ProgressBar, cn } from '@cmms/ui'
import { Building2, Network } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { AssetLink, paths } from '../../components/links'
import { useScoped } from '../../state/scoped'
import { ContractBadge } from '../vendors/badges'
import { telHref } from '../vendors/lib'
import { needsReorder } from './lib'

export function StockLevelCard({ part, level, state }: { part: Part; level: StockLevel; state: StockState | null }) {
  const max = Math.max(part.max, 1)
  const minPct = Math.min(100, (part.min / max) * 100)
  const suggestion = needsReorder(state) ? reorderSuggestion(part, level) : 0
  const tone = state === 'shortage' ? 'accent' : state === 'reorder' ? 'warning' : 'ink'

  return (
    <Card>
      <CardHeader>
        <CardTitle>Stock level</CardTitle>
        <CardDescription>Available stock against the minimum and maximum.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-start gap-1.5 leading-none">
          <span className={cn('text-4xl font-bold tracking-tight tabular-nums', level.available < 0 && 'text-accent')}>{fmtNumber(level.available)}</span>
          <span className="pt-1 text-sm font-semibold text-muted">{part.unit} available</span>
        </div>
        <div className="relative mt-5">
          <ProgressBar value={Math.max(0, level.available) / max} tone={tone} size="md" aria-label={`${fmtNumber(level.available)} of ${fmtNumber(part.max)} available`} />
          <span aria-hidden="true" className="absolute top-1/2 h-4 w-0.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-ink" style={{ left: `${minPct}%` }} />
        </div>
        <div className="relative mt-2 h-4 text-xs text-muted">
          {minPct <= 70 ? (
            <>
              <span className="absolute -translate-x-1/2 whitespace-nowrap font-medium text-body" style={{ left: `${Math.max(minPct, 8)}%` }}>
                Min {fmtNumber(part.min)}
              </span>
              <span className="absolute right-0">Max {fmtNumber(part.max)}</span>
            </>
          ) : (
            <span className="absolute right-0">
              <span className="font-medium text-body">Min {fmtNumber(part.min)}</span> · Max {fmtNumber(part.max)}
            </span>
          )}
        </div>
        <KeyValue
          bare
          className="mt-3"
          items={[
            { label: 'On hand', value: `${fmtNumber(level.onHand)} ${part.unit}` },
            { label: 'Reserved', value: `${fmtNumber(level.reserved)} ${part.unit}` },
            { label: 'Reorder qty', value: `${fmtNumber(part.reorderQty)} ${part.unit}` },
            { label: 'Lead time', value: `${part.leadTimeDays} days` },
          ]}
        />
        {suggestion > 0 && (
          <div className="mt-3 rounded-2xl bg-surface-2 p-3 text-sm">
            <p className="font-semibold">
              Order {fmtNumber(suggestion)} {part.unit}, {fmtIdr(suggestion * part.unitCost)}
            </p>
            <p className="mt-0.5 text-xs text-muted">Refills to the maximum. Delivery takes about {part.leadTimeDays} days.</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export function VendorCard({ part, canManage, onEdit }: { part: Part; canManage: boolean; onEdit: () => void }) {
  const { maps } = useScoped()
  const vendor = part.vendorId ? maps.vendor.get(part.vendorId) : undefined
  return (
    <Card>
      <CardHeader action={vendor ? <ContractBadge vendor={vendor} now={nowMs()} /> : undefined}>
        <CardTitle>Vendor</CardTitle>
      </CardHeader>
      {vendor ? (
        <CardContent>
          <Link to={paths.vendor(vendor.id)} className="font-semibold hover:text-accent">
            {vendor.name}
          </Link>
          <p className="text-xs text-muted">{vendor.serviceTypes.join(', ')}</p>
          <KeyValue
            bare
            className="mt-2"
            items={[
              { label: 'PIC', value: vendor.pic || 'Not set' },
              {
                label: 'Phone',
                value: vendor.phone ? (
                  <a href={telHref(vendor.phone)} className="hover:text-accent">
                    {vendor.phone}
                  </a>
                ) : (
                  'Not set'
                ),
              },
              { label: 'Lead time', value: `${part.leadTimeDays} days` },
              { label: 'Unit cost', value: fmtIdr(part.unitCost) },
            ]}
          />
        </CardContent>
      ) : (
        <EmptyState
          compact
          icon={<Building2 />}
          title="No vendor set"
          description="Name the usual supplier so the purchase list can group this part."
          action={
            canManage ? (
              <Button size="sm" variant="outline" onClick={onEdit}>
                Edit part
              </Button>
            ) : undefined
          }
        />
      )}
    </Card>
  )
}

const BOM_PREVIEW = 5

export function WhereUsedCard({ part }: { part: Part }) {
  const { bom, jobPlans } = useScoped()
  const [showAll, setShowAll] = useState(false)
  const lines = bom.filter((b) => b.partId === part.id)
  const plans = jobPlans.filter((j) => j.parts.some((p) => p.partId === part.id))
  const shown = showAll ? lines : lines.slice(0, BOM_PREVIEW)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Where used</CardTitle>
        <CardDescription>Asset bills of material and job plans that call for this part.</CardDescription>
      </CardHeader>
      {lines.length === 0 && plans.length === 0 ? (
        <EmptyState compact icon={<Network />} title="Not on any BOM or job plan" description="Add it to an asset's bill of material so planners find it when that machine fails." />
      ) : (
        <CardContent className="space-y-4">
          {lines.length > 0 && (
            <section>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted">Assets · {lines.length}</p>
              <ul className="space-y-2">
                {shown.map((b) => (
                  <li key={b.id} className="flex items-center justify-between gap-3 rounded-2xl bg-surface-2 p-2.5">
                    <AssetLink assetId={b.assetId} showIcon className="min-w-0 text-sm" />
                    <span className="shrink-0 text-right text-xs text-muted">
                      {b.component}
                      <span className="block font-semibold text-foreground tabular-nums">
                        {fmtNumber(b.qty)} {part.unit}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
              {lines.length > BOM_PREVIEW && (
                <Button variant="ghost" size="sm" className="mt-2" onClick={() => setShowAll(!showAll)}>
                  {showAll ? 'Show fewer' : `Show all ${lines.length}`}
                </Button>
              )}
            </section>
          )}
          {plans.length > 0 && (
            <section>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted">Job plans · {plans.length}</p>
              <ul className="space-y-2">
                {plans.map((plan) => (
                  <li key={plan.id}>
                    <Link to={paths.jobPlan(plan.id)} className="flex items-center justify-between gap-3 rounded-2xl bg-surface-2 p-2.5 text-sm transition-colors hover:bg-surface">
                      <span className="min-w-0">
                        <span className="block font-mono text-[11px] text-muted">{plan.code}</span>
                        <span className="block truncate font-medium">{plan.name}</span>
                      </span>
                      <span className="shrink-0 text-xs font-semibold tabular-nums">
                        {fmtNumber(plan.parts.find((p) => p.partId === part.id)?.qty ?? 0)} {part.unit}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </CardContent>
      )}
    </Card>
  )
}
