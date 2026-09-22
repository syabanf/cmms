import type { WoPartLine, WorkOrder } from '@cmms/types'
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, EmptyState, cn, toast } from '@cmms/ui'
import { Package, Plus } from 'lucide-react'
import { useState } from 'react'
import { PartStatusBadge } from '../../components/badges'
import { useMobileScope } from '../../state/scope'
import { AddPartSheet } from './AddPartSheet'

export function PartsCard({ wo, editable }: { wo: WorkOrder; editable: boolean }) {
  const { maps, stock, dispatch } = useMobileScope()
  const [adding, setAdding] = useState(false)
  const open = wo.parts.filter((l) => l.status === 'reserved' || l.status === 'issued').length

  const move = (line: WoPartLine, status: 'consumed' | 'returned') => {
    const part = maps.part.get(line.partId)
    dispatch({ type: 'workOrders/partStatus', id: wo.id, lineId: line.id, status })
    const label = `${line.qty} ${part?.unit ?? ''} ${part?.code ?? 'part'}`
    toast(status === 'consumed' ? `Used ${label}` : `Returned ${label}`, {
      tone: 'success',
      description: status === 'consumed' ? 'Stock and the work order cost are updated.' : 'It goes back to the warehouse.',
    })
  }

  const addButton = (
    <Button variant="soft" className="h-11" onClick={() => setAdding(true)}>
      <Plus />
      Add part
    </Button>
  )

  return (
    <Card>
      <CardHeader action={editable && wo.parts.length > 0 ? addButton : undefined}>
        <CardTitle>Spare parts</CardTitle>
        <CardDescription>{wo.parts.length ? `${open} waiting to be used or returned` : 'Nothing reserved for this job'}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {wo.parts.map((line) => {
          const part = maps.part.get(line.partId)
          const item = stock.find((s) => s.partId === line.partId && s.warehouseId === line.warehouseId)
          // Stock not promised to other jobs decides whether this reservation can be picked up.
          const free = item ? item.onHand - (item.reserved - line.qty) : 0
          const short = line.status === 'reserved' && free < line.qty
          const pending = line.status === 'reserved' || line.status === 'issued'
          return (
            <div key={line.id} className="rounded-2xl bg-surface-2 p-3.5">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-semibold leading-snug">{part?.name ?? 'Removed part'}</p>
                  <p className="mt-0.5 truncate text-[11px] text-muted">
                    <span className="font-mono">{part?.code}</span>
                    {line.status === 'reserved' ? (
                      <span className={cn('font-semibold', short ? 'text-accent' : 'text-success')}>
                        {short ? ` · Short, ${Math.max(0, free)} free` : ` · Ready at ${item?.bin || 'the warehouse'}`}
                      </span>
                    ) : (
                      item?.bin && ` · ${item.bin}`
                    )}
                  </p>
                </div>
                <PartStatusBadge status={line.status} />
              </div>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm font-bold tabular-nums">
                  {line.qty} {part?.unit}
                </span>
                {editable && pending && (
                  <div className="flex gap-2">
                    <Button variant="outline" className="h-11" onClick={() => move(line, 'returned')}>
                      Return
                    </Button>
                    <Button variant="secondary" className="h-11" onClick={() => move(line, 'consumed')}>
                      Use
                    </Button>
                  </div>
                )}
              </div>
            </div>
          )
        })}
        {!wo.parts.length && (
          <EmptyState
            compact
            icon={<Package />}
            title="No parts on this job"
            description={editable ? 'Reserve a part and pick it up at the warehouse.' : 'Parts show here once someone reserves them.'}
            action={editable ? addButton : undefined}
          />
        )}
      </CardContent>
      {editable && <AddPartSheet wo={wo} open={adding} onOpenChange={setAdding} />}
    </Card>
  )
}
