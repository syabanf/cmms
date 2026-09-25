import { stockLevel } from '@cmms/fixtures'
import type { Part, WorkOrder } from '@cmms/types'
import { PART_CATEGORY_LABEL } from '@cmms/types'
import { Button, Input, Kicker, Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, cn, toast } from '@cmms/ui'
import { Check, ChevronRight, Minus, Plus, Search } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { paths } from '../../lib/paths'
import { useMobileScope } from '../../state/scope'

export function AddPartSheet({ wo, open, onOpenChange }: { wo: WorkOrder; open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="flex max-h-[85dvh] flex-col overflow-hidden">
        <AddPartForm wo={wo} onDone={() => onOpenChange(false)} />
      </SheetContent>
    </Sheet>
  )
}

const MAX_QTY = 99

function AddPartForm({ wo, onDone }: { wo: WorkOrder; onDone: () => void }) {
  const { parts, bom, stock, warehouses, maps, dispatch } = useMobileScope()
  const warehouse = warehouses[0]
  const [query, setQuery] = useState('')
  const [partId, setPartId] = useState<string | null>(null)
  const [qty, setQty] = useState(1)

  const tokens = query.trim().toLowerCase().split(/\s+/).filter(Boolean)
  const matches = (p: Part) =>
    tokens.every((t) => [p.code, p.name, p.spec, p.manufacturer, PART_CATEGORY_LABEL[p.category]].join(' ').toLowerCase().includes(t))
  const bomLines = bom.filter((b) => b.assetId === wo.assetId)
  const bomPartIds = new Set(bomLines.map((b) => b.partId))
  const suggested = bomLines.flatMap((line) => {
    const part = maps.part.get(line.partId)
    return part && matches(part) ? [{ line, part }] : []
  })
  const others = parts.filter((p) => !bomPartIds.has(p.id) && matches(p))
  const available = (id: string) => (warehouse ? Math.max(0, stockLevel(id, stock, [warehouse.id]).available) : 0)
  const picked = partId ? maps.part.get(partId) : undefined
  const pickedAvailable = picked ? available(picked.id) : 0

  const pick = (part: Part, suggestedQty: number) => {
    setPartId(part.id)
    setQty(suggestedQty)
  }

  const add = () => {
    if (!picked || !warehouse) return
    dispatch({ type: 'workOrders/addPart', id: wo.id, partId: picked.id, qty, warehouseId: warehouse.id })
    toast(`Reserved ${qty} ${picked.unit} ${picked.code}`, { tone: 'success', description: `Pick it up at ${warehouse.name}.` })
    onDone()
  }

  return (
    <>
      <SheetHeader className="pb-2">
        <SheetTitle>Add a spare part</SheetTitle>
        <SheetDescription>
          Reserved at {warehouse?.name ?? 'the site warehouse'}. Parts from this machine's BOM come first.
        </SheetDescription>
      </SheetHeader>
      <div className="px-5 pb-2">
        <Input
          variant="soft"
          leftIcon={<Search />}
          aria-label="Search parts"
          placeholder="Search code, name or spec"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-2">
        {suggested.length > 0 && (
          <>
            <Kicker className="px-2 pb-1 pt-2">From the machine BOM</Kicker>
            {suggested.map(({ line, part }) => (
              <PartRow
                key={line.id}
                part={part}
                hint={`${line.component} · ${line.qty} ${part.unit} per machine`}
                available={available(part.id)}
                selected={partId === part.id}
                onPick={() => pick(part, line.qty)}
                onOpen={onDone}
              />
            ))}
          </>
        )}
        {others.length > 0 && (
          <>
            <Kicker className="px-2 pb-1 pt-3">All parts</Kicker>
            {others.map((part) => (
              <PartRow
                key={part.id}
                part={part}
                hint={PART_CATEGORY_LABEL[part.category]}
                available={available(part.id)}
                selected={partId === part.id}
                onPick={() => pick(part, 1)}
                onOpen={onDone}
              />
            ))}
          </>
        )}
        {!suggested.length && !others.length && (
          <p className="px-3 py-8 text-center text-sm text-muted">No parts match "{query.trim()}"</p>
        )}
      </div>
      {picked && (
        <div className="border-t border-border px-5 pt-4">
          <div className="flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{picked.name}</p>
              <p className="text-xs text-muted">
                {pickedAvailable} {picked.unit} available
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <Button variant="soft" size="icon-lg" aria-label="Fewer" disabled={qty <= 1} onClick={() => setQty(qty - 1)}>
                <Minus />
              </Button>
              <span className="w-10 text-center text-lg font-bold tabular-nums" aria-live="polite">
                {qty}
              </span>
              <Button variant="soft" size="icon-lg" aria-label="More" disabled={qty >= MAX_QTY} onClick={() => setQty(qty + 1)}>
                <Plus />
              </Button>
            </div>
          </div>
          {qty > pickedAvailable && (
            <p className="mt-2 text-xs font-medium text-warning">
              Only {pickedAvailable} in stock. The warehouse sees the shortage and orders the rest.
            </p>
          )}
          <Button size="lg" className="mt-3 w-full" disabled={!warehouse} onClick={add}>
            Reserve {qty} {picked.unit}
          </Button>
        </div>
      )}
    </>
  )
}

/** A pickable part, with a chevron that leaves the sheet for the part's own page. */
function PartRow({
  part,
  hint,
  available,
  selected,
  onPick,
  onOpen,
}: {
  part: Part
  hint: string
  available: number
  selected: boolean
  onPick: () => void
  onOpen: () => void
}) {
  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        aria-pressed={selected}
        onClick={onPick}
        className={cn(
          'flex min-h-14 min-w-0 flex-1 items-center gap-3 rounded-2xl px-3 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40',
          selected ? 'bg-surface' : 'hover:bg-surface',
        )}
      >
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold">{part.name}</span>
          <span className="block truncate text-xs text-muted">
            <span className="font-mono">{part.code}</span> · {hint}
          </span>
        </span>
        <span className={cn('shrink-0 text-xs font-semibold tabular-nums', available > 0 ? 'text-body' : 'text-accent')}>
          {available > 0 ? `${available} in stock` : 'Out of stock'}
        </span>
        {selected && <Check aria-hidden="true" className="size-4 shrink-0 text-accent" />}
      </button>
      <Link
        to={paths.part(part.id)}
        aria-label={`${part.name} details`}
        onClick={onOpen}
        className="flex size-11 shrink-0 items-center justify-center rounded-full text-muted transition-colors hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
      >
        <ChevronRight aria-hidden="true" className="size-4" />
      </Link>
    </div>
  )
}
