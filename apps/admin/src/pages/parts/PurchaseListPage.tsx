import { fmtDate, fmtIdr, fmtNumber, nowMs, plural } from '@cmms/fixtures'
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, EmptyState, PageHeader, cn, toast } from '@cmms/ui'
import { ClipboardCopy, PackageCheck } from 'lucide-react'
import { type ReactNode, useMemo } from 'react'
import { Link } from 'react-router'
import { BackButton } from '../../components/BackButton'
import { paths } from '../../components/links'
import { useScoped } from '../../state/scoped'
import { partRow, purchaseList, purchaseListText } from './lib'

function Figure({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className={cn('w-24 shrink-0', className)}>
      <p className="text-[11px] font-medium text-muted">{label}</p>
      <p className="whitespace-nowrap font-semibold tabular-nums">{children}</p>
    </div>
  )
}

export function PurchaseListPage() {
  const { parts, stock, warehouseIds, maps, site } = useScoped()
  const groups = useMemo(() => purchaseList(parts.map((p) => partRow(p, stock, warehouseIds))), [parts, stock, warehouseIds])
  const lines = groups.flatMap((g) => g.lines)
  const total = groups.reduce((sum, g) => sum + g.total, 0)
  const longestLead = Math.max(0, ...lines.map((l) => l.part.leadTimeDays))
  const vendorName = (id: string | null) => (id ? (maps.vendor.get(id)?.name ?? 'Removed vendor') : 'No vendor set')

  const copy = async () => {
    const text = purchaseListText(groups, `Purchase list, ${site.name}, ${fmtDate(nowMs())}`, vendorName)
    try {
      await navigator.clipboard.writeText(text)
      toast('Purchase list copied', { tone: 'success', description: `${plural(lines.length, 'line')}, ${fmtIdr(total)}. Paste it into the purchase request.` })
    } catch {
      toast('Could not copy the list', { tone: 'danger', description: 'Allow clipboard access in the browser and try again.' })
    }
  }

  return (
    <>
      <BackButton fallback="/inventory/parts" className="mb-3" />
      <PageHeader
        title="Purchase list"
        description={`Parts at or below minimum at ${site.name}. Each quantity refills the part to its maximum, never less than its reorder quantity.`}
        actions={
          lines.length > 0 ? (
            <Button onClick={copy}>
              <ClipboardCopy />
              Copy list
            </Button>
          ) : undefined
        }
      />

      {groups.length === 0 ? (
        <Card>
          <EmptyState
            icon={<PackageCheck />}
            title="Nothing to order"
            description="Every part sits above its minimum. A part lands here when an issue or a reservation takes it to its reorder point."
            action={
              <Button asChild variant="outline">
                <Link to="/inventory/parts">Back to spare parts</Link>
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="space-y-4">
          <Card className="flex flex-wrap gap-x-10 gap-y-4 p-5">
            <Figure label="Parts to order" className="w-auto">
              <span className="text-2xl font-bold tracking-tight">{fmtNumber(lines.length)}</span>
            </Figure>
            <Figure label="Vendors" className="w-auto">
              <span className="text-2xl font-bold tracking-tight">{fmtNumber(groups.length)}</span>
            </Figure>
            <Figure label="Order value" className="w-auto">
              <span className="text-2xl font-bold tracking-tight">{fmtIdr(total)}</span>
            </Figure>
            <Figure label="Longest lead time" className="w-auto">
              <span className="text-2xl font-bold tracking-tight">{longestLead}</span> <span className="text-sm font-semibold text-muted">days</span>
            </Figure>
          </Card>

          {groups.map((group) => {
            const vendor = group.vendorId ? maps.vendor.get(group.vendorId) : undefined
            return (
              <Card key={group.vendorId ?? 'none'}>
                <CardHeader action={<span className="text-base font-bold tabular-nums">{fmtIdr(group.total)}</span>}>
                  <CardTitle>
                    {vendor ? (
                      <Link to={paths.vendor(vendor.id)} className="hover:text-accent">
                        {vendor.name}
                      </Link>
                    ) : (
                      vendorName(group.vendorId)
                    )}
                  </CardTitle>
                  <CardDescription>
                    {vendor ? [vendor.pic, vendor.phone, vendor.email].filter(Boolean).join(' · ') : 'Set a vendor on these parts so the order has somewhere to go.'}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="divide-y divide-border">
                    {group.lines.map(({ part, available, qty, value }) => (
                      <li key={part.id} className="flex flex-wrap items-center gap-x-6 gap-y-2 py-3 text-sm">
                        <Link to={paths.part(part.id)} className="min-w-48 flex-1 hover:text-accent">
                          <span className="block font-mono text-xs font-medium">{part.code}</span>
                          <span className="block truncate font-medium">{part.name}</span>
                          <span className="block text-xs text-muted">
                            {fmtNumber(available)} available, min {fmtNumber(part.min)}, max {fmtNumber(part.max)}
                          </span>
                        </Link>
                        <Figure label="Order">
                          {fmtNumber(qty)} <span className="text-xs font-normal text-muted">{part.unit}</span>
                        </Figure>
                        <Figure label="Unit cost" className="w-28">
                          {fmtIdr(part.unitCost)}
                        </Figure>
                        <Figure label="Lead time" className="w-20">
                          {part.leadTimeDays} days
                        </Figure>
                        <Figure label="Line value" className="w-32 text-right">
                          {fmtIdr(value)}
                        </Figure>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </>
  )
}
