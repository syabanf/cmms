import { downtimeHours, fmtDate, fmtIdrShort, fmtNumber, isDone, isFailureWork, plural, subtreeIds, toMs, woCost } from '@cmms/fixtures'
import type { Rca, WorkOrder } from '@cmms/types'
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Combobox, EmptyState, toast } from '@cmms/ui'
import { Link2, X } from 'lucide-react'
import { useMemo } from 'react'
import { WoLink } from '../../components/links'
import { useScoped } from '../../state/scoped'
import type { RcaUpdate } from './lib'

const newestFirst = (a: WorkOrder, b: WorkOrder) => toMs(b.requestedAt) - toMs(a.requestedAt)

export function LinkedFailuresCard({ rca, editable, update, now }: { rca: Rca; editable: boolean; update: RcaUpdate; now: number }) {
  const s = useScoped()

  const linked = useMemo(
    () =>
      rca.woIds
        .map((id) => s.maps.workOrder.get(id))
        .filter((w): w is WorkOrder => w !== undefined)
        .sort(newestFirst),
    [rca.woIds, s.maps.workOrder],
  )

  // Completed corrective and emergency work on the asset or one of its components.
  const candidates = useMemo(() => {
    const assetIds = subtreeIds(s.assets, rca.assetId)
    return s.workOrders.filter((w) => assetIds.has(w.assetId) && isFailureWork(w) && isDone(w) && !rca.woIds.includes(w.id)).sort(newestFirst)
  }, [s.assets, s.workOrders, rca.assetId, rca.woIds])

  const costOf = (wo: WorkOrder) => woCost(wo, s.maps.person, now).total
  const modeOf = (wo: WorkOrder) => (wo.failure?.modeId ? s.maps.failureCode.get(wo.failure.modeId)?.name : undefined) ?? 'Failure mode not coded'
  const downtime = linked.reduce((sum, wo) => sum + downtimeHours(wo, now), 0)
  const cost = linked.reduce((sum, wo) => sum + costOf(wo), 0)

  const relink = (woId: string) => update((r) => (r.woIds.includes(woId) ? r : { ...r, woIds: [...r.woIds, woId] }))

  const link = (woId: string | null) => {
    const wo = woId ? s.maps.workOrder.get(woId) : undefined
    if (!wo) return
    relink(wo.id)
    toast(`${wo.code} linked`, { tone: 'success' })
  }

  const unlink = (wo: WorkOrder) => {
    update((r) => ({ ...r, woIds: r.woIds.filter((id) => id !== wo.id) }))
    toast(`${wo.code} unlinked`, { action: { label: 'Undo', onClick: () => relink(wo.id) } })
  }

  return (
    <Card>
      <CardHeader
        action={
          editable ? (
            <Combobox
              aria-label="Link a work order"
              variant="inline"
              className="border border-border bg-card"
              items={candidates}
              value={null}
              onChange={link}
              placeholder="Link work order"
              searchPlaceholder="Search code or title"
              emptyText="No other completed failure work on this asset"
              getKey={(wo) => wo.id}
              getLabel={(wo) => `${wo.code} · ${wo.title}`}
              getDescription={(wo) => `${fmtDate(wo.requestedAt)} · ${modeOf(wo)}`}
            />
          ) : undefined
        }
      >
        <CardTitle>Linked failures</CardTitle>
        <CardDescription>
          {linked.length
            ? `${plural(linked.length, 'failure')} · ${fmtNumber(downtime, 1)} h down · ${fmtIdrShort(cost)}`
            : 'The completed work orders this analysis explains.'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {linked.length ? (
          <ul className="space-y-2">
            {linked.map((wo) => (
              <li key={wo.id} className="flex items-start gap-3 rounded-2xl bg-surface-2 p-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <WoLink woId={wo.id} />
                    <span className="text-xs tabular-nums text-muted">{fmtDate(wo.requestedAt)}</span>
                  </div>
                  <p className="mt-0.5 truncate text-sm font-medium">{wo.title}</p>
                  <p className="mt-0.5 text-xs text-muted">
                    {modeOf(wo)}
                    {wo.downtime && ` · ${fmtNumber(downtimeHours(wo, now), 1)} h down`} · {fmtIdrShort(costOf(wo))}
                  </p>
                </div>
                {editable && (
                  <Button variant="ghost" size="icon-sm" aria-label={`Unlink ${wo.code}`} onClick={() => unlink(wo)}>
                    <X />
                  </Button>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            compact
            icon={<Link2 />}
            title="No failures linked"
            description={
              editable
                ? 'Use Link work order to add the corrective work this RCA explains. Its downtime and cost then count here.'
                : 'Nobody has linked a work order to this RCA yet.'
            }
          />
        )}
      </CardContent>
    </Card>
  )
}
