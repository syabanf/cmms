import { fmtIdr, fmtIdrShort, fmtNumber, newId, stockLevel, stockState } from '@cmms/fixtures'
import type { Asset, BomLine } from '@cmms/types'
import { PART_CATEGORY_LABEL } from '@cmms/types'
import { Button, Combobox, ConfirmDialog, EmptyState, FormField, Input, cn, toast } from '@cmms/ui'
import { Package, Plus, Trash2 } from 'lucide-react'
import { type FormEvent, Fragment, useMemo, useState } from 'react'
import { Link } from 'react-router'
import { useAuth } from '../../auth/auth'
import { StockBadge } from '../../components/badges'
import { paths } from '../../components/links'
import { PartPicker } from '../../components/pickers'
import { useScoped } from '../../state/scoped'
import { byCode } from './lib'
import { SectionTitle } from './ui'

/** Bill of materials grouped by sub-assembly, with live stock across the site's warehouses. */
export function BomTab({ asset }: { asset: Asset }) {
  const { bom, assets, maps, stock, warehouseIds, dispatch } = useScoped()
  const { can } = useAuth()
  const canManage = can('asset.manage')
  const [removing, setRemoving] = useState<BomLine | null>(null)

  const lines = useMemo(() => bom.filter((b) => b.assetId === asset.id), [bom, asset.id])
  const groups = useMemo(() => {
    const byComponent = new Map<string, BomLine[]>()
    for (const line of lines)
      byComponent.set(line.component, [...(byComponent.get(line.component) ?? []), line])
    return [...byComponent.entries()]
  }, [lines])
  const childLists = useMemo(
    () => assets.filter((a) => a.parentId === asset.id && bom.some((b) => b.assetId === a.id)).sort(byCode),
    [assets, bom, asset.id],
  )
  const lineCost = (line: BomLine) => line.qty * (maps.part.get(line.partId)?.unitCost ?? 0)
  const setCost = lines.reduce((sum, line) => sum + lineCost(line), 0)
  const removingPart = removing ? maps.part.get(removing.partId) : undefined

  return (
    <div className="space-y-6">
      {groups.length ? (
        <>
          <p className="text-sm text-muted">
            {lines.length} {lines.length === 1 ? 'line' : 'lines'} across {groups.length}{' '}
            {groups.length === 1 ? 'component' : 'components'}. A full set costs{' '}
            <span className="font-semibold text-foreground">{fmtIdrShort(setCost)}</span>.
          </p>
          {groups.map(([component, rows]) => (
            <section key={component}>
              <SectionTitle
                count={rows.length}
                action={
                  <span className="text-xs text-muted">
                    {fmtIdr(rows.reduce((s, l) => s + lineCost(l), 0))}
                  </span>
                }
              >
                {component}
              </SectionTitle>
              <ul className="divide-y divide-border rounded-2xl bg-surface-2 px-3">
                {rows.map((line) => {
                  const part = maps.part.get(line.partId)
                  if (!part) return null
                  const level = stockLevel(part.id, stock, warehouseIds)
                  return (
                    <li key={line.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3">
                      <div className="min-w-0 flex-1 basis-52">
                        <Link
                          to={paths.part(part.id)}
                          className="font-mono text-xs font-medium hover:text-accent hover:underline"
                        >
                          {part.code}
                        </Link>
                        <p className="truncate text-sm font-medium">{part.name}</p>
                        <p className="truncate text-xs text-muted">
                          {PART_CATEGORY_LABEL[part.category]} · {fmtIdr(part.unitCost)} per {part.unit}
                        </p>
                      </div>
                      <p className="w-20 text-sm">
                        <span className="font-semibold tabular-nums">×{fmtNumber(line.qty)}</span>{' '}
                        <span className="text-muted">{part.unit}</span>
                      </p>
                      <div className="flex w-44 flex-col items-start gap-1">
                        <span
                          className={cn(
                            'text-xs tabular-nums',
                            level.available < line.qty ? 'font-semibold text-accent' : 'text-muted',
                          )}
                        >
                          {fmtNumber(level.available)} {part.unit} available
                        </span>
                        <StockBadge state={stockState(part, level)} />
                      </div>
                      {canManage && (
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          className="text-accent"
                          aria-label={`Remove ${part.code} from ${component}`}
                          onClick={() => setRemoving(line)}
                        >
                          <Trash2 />
                        </Button>
                      )}
                    </li>
                  )
                })}
              </ul>
            </section>
          ))}
        </>
      ) : (
        <EmptyState
          compact
          icon={<Package />}
          title="No parts list yet"
          description={
            canManage
              ? 'List the spares this asset needs, grouped by component, so planners can reserve them on work orders. Add the first part below.'
              : 'A planner can list the spares this asset needs so they can be reserved on work orders.'
          }
        />
      )}

      {childLists.length > 0 && (
        <p className="text-xs text-muted">
          Components keep their own parts lists:{' '}
          {childLists.map((c, i) => (
            <Fragment key={c.id}>
              {i > 0 && ', '}
              <Link
                to={`${paths.asset(c.id)}?tab=bom`}
                className="font-mono font-medium text-foreground hover:text-accent"
              >
                {c.code}
              </Link>
            </Fragment>
          ))}
          .
        </p>
      )}

      {canManage && <AddBomLine asset={asset} lines={lines} />}

      <ConfirmDialog
        open={removing !== null}
        onOpenChange={(open) => !open && setRemoving(null)}
        title={`Remove ${removingPart?.code ?? 'this part'} from ${removing?.component ?? 'the BOM'}?`}
        description="Work orders that already reserved it keep their lines. The part only leaves this asset's parts list."
        confirmLabel="Remove line"
        destructive
        onConfirm={() => {
          if (!removing) return
          dispatch({ type: 'bom/remove', id: removing.id })
          toast(`${removingPart?.code ?? 'Part'} removed from ${removing.component}`, { tone: 'success' })
          setRemoving(null)
        }}
      />
    </div>
  )
}

function AddBomLine({ asset, lines }: { asset: Asset; lines: BomLine[] }) {
  const { maps, dispatch } = useScoped()
  const [partId, setPartId] = useState<string | null>(null)
  const [qty, setQty] = useState(1)
  const [component, setComponent] = useState<string | null>(() => lines[0]?.component ?? null)
  const [tried, setTried] = useState(false)
  const names = [...new Set([...lines.map((l) => l.component), ...(component ? [component] : [])])]

  const submit = (e: FormEvent) => {
    e.preventDefault()
    setTried(true)
    const part = partId ? maps.part.get(partId) : undefined
    if (!part || !component || qty < 1) return
    const existing = lines.find((l) => l.partId === part.id && l.component === component)
    if (existing) {
      dispatch({ type: 'bom/upsert', item: { ...existing, qty: existing.qty + qty } })
      toast(`${part.code} on ${component} raised to ${existing.qty + qty} ${part.unit}`, { tone: 'success' })
    } else {
      dispatch({
        type: 'bom/upsert',
        item: { id: newId('bom'), assetId: asset.id, partId: part.id, qty, component },
      })
      toast(`${part.code} added to ${component}`, { tone: 'success', description: part.name })
    }
    setPartId(null)
    setQty(1)
    setTried(false)
  }

  return (
    <form onSubmit={submit} className="rounded-2xl border border-dashed border-border p-4">
      <p className="mb-3 text-sm font-semibold">Add a part to the BOM</p>
      <div className="grid grid-cols-1 items-start gap-3 lg:grid-cols-[minmax(0,1.4fr)_6rem_minmax(0,1fr)] xl:grid-cols-1 2xl:grid-cols-[minmax(0,1.4fr)_6rem_minmax(0,1fr)]">
        <FormField label="Part" htmlFor="bom-part" error={tried && !partId ? 'Choose a part.' : undefined}>
          <PartPicker id="bom-part" value={partId} invalid={tried && !partId} onChange={setPartId} />
        </FormField>
        <FormField label="Qty" htmlFor="bom-qty">
          <Input
            id="bom-qty"
            type="number"
            min={1}
            value={qty}
            onChange={(e) => setQty(Math.max(1, Math.round(Number(e.target.value) || 1)))}
          />
        </FormField>
        <FormField
          label="Component"
          htmlFor="bom-component"
          error={tried && !component ? 'Name the component, for example Motor.' : undefined}
        >
          <Combobox
            id="bom-component"
            items={names}
            value={component}
            invalid={tried && !component}
            placeholder="For example Motor"
            searchPlaceholder="Search or type a new component"
            emptyText="Type a name to add it"
            getKey={(n) => n}
            getLabel={(n) => n}
            createLabel={(q) => `Use "${q}"`}
            onCreate={(q) => setComponent(q.trim())}
            onChange={setComponent}
          />
        </FormField>
      </div>
      <div className="mt-3 flex justify-end">
        <Button type="submit">
          <Plus />
          Add to BOM
        </Button>
      </div>
    </form>
  )
}
