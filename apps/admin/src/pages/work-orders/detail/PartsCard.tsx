import { fmtIdr, fmtIdrShort, stockLevel } from '@cmms/fixtures'
import type { PartLineStatus, WoPartLine, WorkOrder } from '@cmms/types'
import { PART_LINE_STATUS_LABEL } from '@cmms/types'
import {
  ActionMenu,
  Badge,
  type BadgeProps,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  EmptyState,
  FormField,
  Input,
  toast,
} from '@cmms/ui'
import { Ellipsis, Package, PackageCheck, PackageMinus, PackageOpen, Plus, Trash } from 'lucide-react'
import { type FormEvent, useMemo, useState } from 'react'
import { Link } from 'react-router'
import { paths } from '../../../components/links'
import { PartPicker } from '../../../components/pickers'
import { useScoped } from '../../../state/scoped'
import type { WoAccess } from './useWoAccess'

const LINE_VARIANT: Record<PartLineStatus, NonNullable<BadgeProps['variant']>> = {
  reserved: 'outline',
  issued: 'info',
  consumed: 'success',
  returned: 'muted',
}

export function PartsCard({ wo, access }: { wo: WorkOrder; access: WoAccess }) {
  const { dispatch, maps, bom, stock, warehouseIds } = useScoped()
  const [adding, setAdding] = useState<{ partId: string | null; qty: number } | null>(null)
  const active = !['completed', 'verified', 'closed', 'cancelled'].includes(wo.status)
  const used = wo.parts.filter((l) => l.status === 'issued' || l.status === 'consumed').reduce((s, l) => s + l.qty * l.unitCost, 0)
  const planned = wo.parts.filter((l) => l.status === 'reserved').reduce((s, l) => s + l.qty * l.unitCost, 0)

  const suggestions = useMemo(
    () => bom.filter((b) => b.assetId === wo.assetId && !wo.parts.some((l) => l.partId === b.partId)).slice(0, 4),
    [bom, wo.assetId, wo.parts],
  )

  const move = (line: WoPartLine, status: 'issued' | 'consumed' | 'returned') => {
    dispatch({ type: 'workOrders/partStatus', id: wo.id, lineId: line.id, status })
    const part = maps.part.get(line.partId)
    toast(`${PART_LINE_STATUS_LABEL[status]} ${line.qty} ${part?.unit ?? ''} ${part?.code ?? ''}`, { tone: 'success' })
  }

  return (
    <Card>
      <CardHeader
        action={
          access.execute &&
          active && (
            <Button variant="outline" size="sm" onClick={() => setAdding({ partId: null, qty: 1 })}>
              <Plus />
              Add part
            </Button>
          )
        }
      >
        <CardTitle>Spare parts</CardTitle>
        <p className="text-sm text-muted">
          {fmtIdrShort(used)} used{planned ? ` · ${fmtIdrShort(planned)} reserved` : ''}
        </p>
      </CardHeader>
      <CardContent className="space-y-2">
        {wo.parts.length === 0 ? (
          <EmptyState compact icon={<Package />} title="No parts on this job" description="Reserve parts so the warehouse can pick them before the work starts." />
        ) : (
          wo.parts.map((line) => {
            const part = maps.part.get(line.partId)
            const level = stockLevel(line.partId, stock, [line.warehouseId])
            const short = line.status === 'reserved' && level.onHand < level.reserved
            const bin = level.items[0]?.bin
            const items = [
              line.status === 'reserved' &&
                access.issue && { key: 'issue', label: 'Issue from warehouse', icon: <PackageOpen />, onSelect: () => move(line, 'issued') },
              (line.status === 'reserved' || line.status === 'issued') &&
                access.execute && { key: 'use', label: 'Mark as used', icon: <PackageCheck />, onSelect: () => move(line, 'consumed') },
              (line.status === 'issued' || line.status === 'consumed') &&
                access.execute && { key: 'return', label: 'Return to stock', icon: <PackageMinus />, onSelect: () => move(line, 'returned') },
              (line.status === 'reserved' || line.status === 'issued') &&
                access.execute && {
                  key: 'remove',
                  label: line.status === 'reserved' ? 'Remove reservation' : 'Remove and return',
                  icon: <Trash />,
                  destructive: true,
                  onSelect: () => dispatch({ type: 'workOrders/removePart', id: wo.id, lineId: line.id }),
                },
            ].filter((x) => !!x)
            return (
              <div key={line.id} className="flex flex-wrap items-center gap-3 rounded-2xl bg-surface-2 p-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-card text-body shadow-card">
                  <Package className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <Link to={paths.part(line.partId)} className="block truncate text-sm font-semibold hover:text-accent">
                    {part?.name ?? 'Removed part'}
                  </Link>
                  <p className="truncate text-xs text-muted">
                    <span className="font-mono">{part?.code}</span> · {fmtIdr(line.unitCost)} each
                    {bin ? ` · ${bin}` : ''}
                    {line.status === 'reserved' && ` · ${level.available} available`}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {short && <Badge variant="danger">Short</Badge>}
                  <Badge variant={LINE_VARIANT[line.status]}>{PART_LINE_STATUS_LABEL[line.status]}</Badge>
                  <span className="w-16 text-right text-sm font-bold tabular-nums">
                    {line.qty} {part?.unit}
                  </span>
                  {items.length > 0 ? (
                    <ActionMenu
                      title={part?.name}
                      trigger={
                        <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${part?.name}`}>
                          <Ellipsis />
                        </Button>
                      }
                      items={items}
                    />
                  ) : (
                    <span className="size-8" />
                  )}
                </div>
              </div>
            )
          })
        )}
        {access.execute && active && suggestions.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 pt-2">
            <span className="text-xs font-medium text-muted">From the asset BOM</span>
            {suggestions.map((b) => (
              <Button
                key={b.id}
                variant="outline"
                size="sm"
                onClick={() => setAdding({ partId: b.partId, qty: b.qty })}
                title={`${b.component}: ${maps.part.get(b.partId)?.name}`}
              >
                <Plus />
                {maps.part.get(b.partId)?.code} ×{b.qty}
              </Button>
            ))}
          </div>
        )}
      </CardContent>
      {adding && (
        <AddPartDialog
          initial={adding}
          onClose={() => setAdding(null)}
          onAdd={(partId, qty) => {
            dispatch({ type: 'workOrders/addPart', id: wo.id, partId, qty, warehouseId: warehouseIds[0] ?? '' })
            toast(`Reserved ${qty} ${maps.part.get(partId)?.unit ?? ''} ${maps.part.get(partId)?.code ?? ''}`, { tone: 'success' })
          }}
        />
      )}
    </Card>
  )
}

function AddPartDialog({ initial, onClose, onAdd }: { initial: { partId: string | null; qty: number }; onClose: () => void; onAdd: (partId: string, qty: number) => void }) {
  const { maps, stock, warehouseIds } = useScoped()
  const [partId, setPartId] = useState(initial.partId)
  const [qty, setQty] = useState(initial.qty)
  const part = partId ? maps.part.get(partId) : undefined
  const level = partId ? stockLevel(partId, stock, warehouseIds) : null

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!partId || qty <= 0) return
    onAdd(partId, qty)
    onClose()
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <form onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>Reserve a part</DialogTitle>
            <DialogDescription>The warehouse sees it on the pick list. Stock drops when the part is issued.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-[minmax(0,1fr)_8rem]">
            <FormField label="Part" htmlFor="add-part">
              <PartPicker id="add-part" value={partId} onChange={setPartId} />
            </FormField>
            <FormField label={`Quantity${part ? ` (${part.unit})` : ''}`} htmlFor="add-qty">
              <Input id="add-qty" type="number" min={1} step={1} value={qty} onChange={(e) => setQty(Math.max(0, Number(e.target.value) || 0))} />
            </FormField>
          </div>
          {part && level && (
            <p className={level.available < qty ? 'mt-3 text-sm font-medium text-accent' : 'mt-3 text-sm text-muted'}>
              {level.available} {part.unit} available of {level.onHand} on hand
              {level.available < qty ? '. The reservation will show as short until stock arrives.' : '.'}
            </p>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={!partId || qty <= 0}>
              Reserve part
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
