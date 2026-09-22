import { fmtNumber, isActive, listOf, plural, toMs } from '@cmms/fixtures'
import type { PartLineStatus } from '@cmms/types'
import { PART_CATEGORY_LABEL } from '@cmms/types'
import { ActionMenu, Button, Card, ConfirmDialog, EmptyState, PageHeader, toast } from '@cmms/ui'
import { ClipboardCheck, Ellipsis, PackageMinus, PackagePlus, PackageX, Pencil, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { useAuth } from '../../auth/auth'
import { BackButton } from '../../components/BackButton'
import { useScoped } from '../../state/scoped'
import { type MoveKind, StockMoveDialog } from '../stock/StockMoveDialog'
import { CriticalBadge, PartStockBadge } from './badges'
import { ConsumptionCard, LedgerCard, WarehouseStockCard, type WoLine, WorkOrderLinesCard } from './PartDetailCards'
import { PartDialog } from './PartDialog'
import { StockLevelCard, VendorCard, WhereUsedCard } from './PartSidebar'
import { partRow } from './lib'

/** Line states that tie stock to a work order. */
const HELD = new Set<PartLineStatus>(['reserved', 'issued'])

/** "A", "A and B", "A, B and C" */

export function PartDetailPage() {
  const { id = '' } = useParams()
  const { maps, stock, stockTxns, warehouseIds, workOrders, state, dispatch } = useScoped()
  const { can } = useAuth()
  const navigate = useNavigate()
  const canManage = can('inventory.manage')
  const canIssue = can('inventory.issue')
  const [move, setMove] = useState<MoveKind | null>(null)
  const [editing, setEditing] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const part = maps.part.get(id)
  const row = useMemo(() => (part ? partRow(part, stock, warehouseIds) : null), [part, stock, warehouseIds])
  const txns = useMemo(() => stockTxns.filter((t) => t.partId === id).sort((a, b) => toMs(b.at) - toMs(a.at)), [stockTxns, id])
  const lines = useMemo<WoLine[]>(
    () => workOrders.filter(isActive).flatMap((wo) => wo.parts.filter((l) => l.partId === id && HELD.has(l.status)).map((line) => ({ wo, line }))),
    [workOrders, id],
  )
  // Parts are shared by every site, so deletion checks work orders everywhere.
  const holders = useMemo(
    () => state.workOrders.filter((w) => isActive(w) && w.parts.some((l) => l.partId === id && HELD.has(l.status))),
    [state.workOrders, id],
  )

  if (!part || !row) {
    return (
      <Card>
        <EmptyState
          icon={<PackageX />}
          title="Part not found"
          description="It may have been deleted, or the link points to a part that never existed."
          action={
            <Button asChild variant="outline">
              <Link to="/inventory/parts">Back to spare parts</Link>
            </Button>
          }
        />
      </Card>
    )
  }

  const bomLines = state.bom.filter((b) => b.partId === part.id).length
  const planCount = state.jobPlans.filter((j) => j.parts.some((p) => p.partId === part.id)).length
  const onHandEverywhere = state.stock.filter((s) => s.partId === part.id).reduce((sum, s) => sum + s.onHand, 0)
  const removal = [
    onHandEverywhere > 0 && `its stock records (${fmtNumber(onHandEverywhere)} ${part.unit} on hand)`,
    bomLines > 0 && plural(bomLines, 'BOM line'),
    planCount > 0 && `${plural(planCount, 'job plan')} that list it`,
  ].filter((x): x is string => !!x)
  const deleteDescription = holders.length
    ? `${listOf(holders.map((w) => w.code))} still ${holders.length === 1 ? 'reserves or holds' : 'reserve or hold'} this part. Issue, return or remove it on ${holders.length === 1 ? 'that work order' : 'those work orders'} first.`
    : `${part.code} leaves the catalog for every site${removal.length ? `, together with ${listOf(removal)}` : ''}. Past movements stay in the ledger.`

  const meta = [PART_CATEGORY_LABEL[part.category], part.manufacturer, part.spec].filter(Boolean).join(' · ')

  return (
    <>
      <BackButton fallback="/inventory/parts" className="mb-3" />

      <PageHeader
        eyebrow={<span className="font-mono normal-case tracking-normal">{part.code}</span>}
        title={
          <span className="inline-flex flex-wrap items-center gap-x-3 gap-y-1.5">
            {part.name}
            <PartStockBadge state={row.state} />
            {part.critical && <CriticalBadge />}
          </span>
        }
        description={meta}
        actions={
          <>
            {canManage && (
              <Button onClick={() => setMove('receive')}>
                <PackagePlus />
                Receive
              </Button>
            )}
            {canManage && (
              <Button variant="outline" onClick={() => setMove('adjust')}>
                <ClipboardCheck />
                Adjust count
              </Button>
            )}
            {canIssue && (
              <Button variant="outline" disabled={row.level.onHand <= 0} onClick={() => setMove('issue')}>
                <PackageMinus />
                Issue without work order
              </Button>
            )}
            {canManage && (
              <ActionMenu
                title={part.code}
                trigger={
                  <Button variant="outline" size="icon" aria-label="More actions">
                    <Ellipsis />
                  </Button>
                }
                items={[
                  { key: 'edit', label: 'Edit part', icon: <Pencil />, onSelect: () => setEditing(true) },
                  'separator',
                  { key: 'delete', label: 'Delete part', icon: <Trash2 />, destructive: true, onSelect: () => setDeleting(true) },
                ]}
              />
            )}
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-4">
          <WarehouseStockCard part={part} items={row.level.items} canManage={canManage} onReceive={() => setMove('receive')} />
          <WorkOrderLinesCard part={part} lines={lines} stock={row.level.items} canIssue={canIssue} />
          <ConsumptionCard part={part} txns={txns} />
          <LedgerCard txns={txns} />
        </div>
        <div className="grid grid-cols-1 content-start gap-4 md:grid-cols-2 xl:grid-cols-1">
          <StockLevelCard part={part} level={row.level} state={row.state} />
          <VendorCard part={part} canManage={canManage} onEdit={() => setEditing(true)} />
          <WhereUsedCard part={part} />
        </div>
      </div>

      <StockMoveDialog kind={move ?? 'receive'} open={move !== null} onOpenChange={(open) => {
          if (!open) setMove(null)
        }} partId={part.id} lockPart />
      <PartDialog open={editing} onOpenChange={setEditing} editing={part} onSaved={(saved) => toast(`${saved.code} updated`, { tone: 'success' })} />
      <ConfirmDialog
        open={deleting}
        onOpenChange={setDeleting}
        title={holders.length ? `${part.code} is in use` : `Delete ${part.code}?`}
        description={deleteDescription}
        confirmLabel="Delete part"
        destructive
        confirmDisabled={holders.length > 0}
        onConfirm={() => {
          dispatch({ type: 'parts/remove', id: part.id })
          toast(`${part.code} deleted`, { tone: 'success', description: part.name })
          navigate('/inventory/parts', { replace: true })
        }}
      />
    </>
  )
}
