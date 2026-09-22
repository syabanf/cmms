import { fmtIdr, fmtIdrShort, fmtNumber, plural } from '@cmms/fixtures'
import type { PartCategory } from '@cmms/types'
import { PART_CATEGORY_LABEL } from '@cmms/types'
import {
  Badge,
  Button,
  Card,
  Chip,
  ChipRow,
  type Column,
  DataTable,
  EmptyState,
  Input,
  PageHeader,
  StatCard,
  UnderlineTabs,
  cn,
  toast,
} from '@cmms/ui'
import { Boxes, CircleAlert, PackageSearch, Plus, Search, ShoppingCart, TriangleAlert, Wallet } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import { useAuth } from '../../auth/auth'
import { paths } from '../../components/links'
import { useHistoryState, useTableHistory } from '../../lib/history-state'
import { usePersistentState } from '../../lib/storage'
import { useScoped } from '../../state/scoped'
import { CriticalBadge, PartStockBadge } from './badges'
import { type PartRow, PART_CATEGORIES, STATE_RANK, needsReorder, partRow } from './lib'
import { PartDialog } from './PartDialog'

type Tab = 'all' | 'reorder' | 'critical'

/** Bins that hold the part in the site's warehouses. */
const binsOf = ({ level }: PartRow) => [...new Set(level.items.map((i) => i.bin).filter(Boolean))].join(', ')

const matchesQuery = ({ part }: PartRow, q: string) =>
  !q || [part.code, part.name, part.spec, part.manufacturer, PART_CATEGORY_LABEL[part.category]].some((field) => field.toLowerCase().includes(q))

export function PartsPage() {
  const { parts, stock, warehouseIds, site } = useScoped()
  const { can } = useAuth()
  const navigate = useNavigate()
  const canManage = can('inventory.manage')
  const [storedTab, setTab] = usePersistentState<Tab>('cmms.admin.parts.tab', 'all')
  const tab: Tab = storedTab === 'reorder' || storedTab === 'critical' ? storedTab : 'all'
  const [category, setCategory] = useHistoryState<PartCategory | null>('category', null)
  const [query, setQuery] = useHistoryState('query', '')
  const table = useTableHistory()
  const [creating, setCreating] = useState(false)

  const rows = useMemo(() => parts.map((part) => partRow(part, stock, warehouseIds)), [parts, stock, warehouseIds])
  const byTab = useMemo<Record<Tab, PartRow[]>>(
    () => ({
      all: rows,
      reorder: rows.filter((r) => needsReorder(r.state)),
      critical: rows.filter((r) => r.part.critical),
    }),
    [rows],
  )

  const q = query.trim().toLowerCase()
  const searched = byTab[tab].filter((r) => matchesQuery(r, q))
  const visible = category ? searched.filter((r) => r.part.category === category) : searched

  const stockValue = rows.reduce((sum, r) => sum + r.value, 0)
  const belowMin = rows.filter((r) => r.state === 'reorder').length
  const shortages = rows.filter((r) => r.state === 'shortage').length

  const columns: Column<PartRow>[] = [
    {
      id: 'code',
      header: 'Code',
      cell: (r) => (
        <div className="whitespace-nowrap">
          <span className="block font-mono text-xs font-medium">{r.part.code}</span>
          <span className="block text-xs text-muted">{binsOf(r) || 'No bin'}</span>
        </div>
      ),
      sortValue: (r) => r.part.code,
      hideBelow: 'md',
    },
    {
      id: 'name',
      header: 'Part',
      cell: (r) => (
        <div className="max-w-60">
          <span className="block font-mono text-[11px] text-muted md:hidden">{r.part.code}</span>
          <p className="flex items-center gap-2">
            <span className="min-w-0 truncate font-medium">{r.part.name}</span>
            {r.part.critical && <CriticalBadge />}
          </p>
          <p className="truncate text-xs text-muted">{r.part.spec || r.part.manufacturer}</p>
          <div className="mt-1.5 flex flex-wrap gap-1.5 sm:hidden">
            <PartStockBadge state={r.state} />
            <Badge variant="outline">
              {fmtNumber(r.level.available)} {r.part.unit} available
            </Badge>
            {binsOf(r) && <Badge variant="muted">{binsOf(r)}</Badge>}
          </div>
        </div>
      ),
      sortValue: (r) => r.part.name,
    },
    {
      id: 'category',
      header: 'Category',
      cell: (r) => <span className="whitespace-nowrap">{PART_CATEGORY_LABEL[r.part.category]}</span>,
      sortValue: (r) => PART_CATEGORY_LABEL[r.part.category],
      hideBelow: 'xl',
    },
    {
      id: 'available',
      header: 'Available',
      align: 'right',
      cell: (r) => (
        <div className="whitespace-nowrap tabular-nums">
          <span className={cn('font-semibold', r.level.available < 0 && 'text-accent')}>{fmtNumber(r.level.available)}</span>{' '}
          <span className="text-xs text-muted">{r.part.unit}</span>
          <span className="block text-xs text-muted">
            {fmtNumber(r.level.onHand)} on hand · {fmtNumber(r.level.reserved)} reserved
          </span>
        </div>
      ),
      sortValue: (r) => r.level.available,
      hideBelow: 'sm',
    },
    {
      id: 'minMax',
      header: 'Min / max',
      align: 'right',
      cell: (r) => (
        <span className="whitespace-nowrap tabular-nums text-body">
          {fmtNumber(r.part.min)} / {fmtNumber(r.part.max)}
        </span>
      ),
      hideBelow: 'lg',
    },
    {
      id: 'cost',
      header: 'Unit cost',
      align: 'right',
      cell: (r) => <span className="whitespace-nowrap tabular-nums">{fmtIdr(r.part.unitCost)}</span>,
      sortValue: (r) => r.part.unitCost,
      hideBelow: 'lg',
    },
    {
      id: 'state',
      header: 'Status',
      cell: (r) => <PartStockBadge state={r.state} />,
      sortValue: (r) => (r.state ? STATE_RANK[r.state] : 9),
      hideBelow: 'sm',
    },
  ]

  const clearFilters = () => {
    setQuery('')
    setCategory(null)
  }
  const filterMiss = q ? `No parts match "${query.trim()}"` : category ? `No ${PART_CATEGORY_LABEL[category].toLowerCase()} parts in this view` : null
  const empty = filterMiss ? (
      <EmptyState
        compact
        icon={<PackageSearch />}
        title={filterMiss}
        description="Try another part number, name or category."
        action={
          <Button variant="outline" size="sm" onClick={clearFilters}>
            Clear filters
          </Button>
        }
      />
    ) : tab === 'reorder' ? (
      <EmptyState compact icon={<Boxes />} title="Nothing to reorder" description={`Every part sits above its minimum at ${site.name}.`} />
    ) : tab === 'critical' ? (
      <EmptyState
        compact
        icon={<Boxes />}
        title="No critical spares"
        description="Mark a part as a critical spare to hold it even when it is rarely used."
        action={
          canManage ? (
            <Button variant="outline" size="sm" onClick={() => setCreating(true)}>
              <Plus />
              New part
            </Button>
          ) : undefined
        }
      />
    ) : (
      <EmptyState
        compact
        icon={<Boxes />}
        title="The catalog is empty"
        description="Add the spare parts your machines use, with their minimum and maximum stock."
        action={
          canManage ? (
            <Button size="sm" onClick={() => setCreating(true)}>
              <Plus />
              New part
            </Button>
          ) : undefined
        }
      />
    )

  return (
    <>
      <PageHeader
        title="Spare parts"
        description={`Catalog, stock levels and reorder points for ${site.name}.`}
        actions={
          <>
            <Input
              variant="pill"
              className="w-full sm:w-72"
              leftIcon={<Search />}
              value={query}
              placeholder="Search part number or name"
              aria-label="Search parts"
              onChange={(e) => setQuery(e.target.value)}
            />
            {canManage && (
              <Button onClick={() => setCreating(true)}>
                <Plus />
                New part
              </Button>
            )}
          </>
        }
      />

      <div className="no-scrollbar mb-4 flex snap-x snap-mandatory gap-3 overflow-x-auto pb-1 [&>*]:min-w-[72%] [&>*]:snap-start sm:grid sm:grid-cols-2 sm:gap-4 sm:overflow-visible sm:pb-0 sm:[&>*]:min-w-0 xl:grid-cols-4">
        <StatCard label="Parts in catalog" value={fmtNumber(parts.length)} hint={plural(byTab.critical.length, 'critical spare')} icon={<Boxes />} />
        <StatCard label="Stock value" value={fmtIdrShort(stockValue)} hint={`On hand at ${site.name}`} icon={<Wallet />} tone="ink" />
        <StatCard
          label="Below minimum"
          value={fmtNumber(belowMin)}
          hint="At or under the reorder point"
          icon={<TriangleAlert />}
          tone="warning"
          onClick={() => setTab('reorder')}
        />
        <StatCard
          label="Shortages"
          value={fmtNumber(shortages)}
          hint="More reserved than on hand"
          icon={<CircleAlert />}
          tone="danger"
          onClick={() => setTab('reorder')}
        />
      </div>

      <Card>
        <div className="flex flex-wrap items-center gap-3 px-5 pt-3">
          <UnderlineTabs
            className="min-w-0 flex-1"
            value={tab}
            onValueChange={(value) => setTab(value as Tab)}
            items={[
              { value: 'all', label: 'All', count: byTab.all.length },
              { value: 'reorder', label: 'Reorder', count: byTab.reorder.length },
              { value: 'critical', label: 'Critical spares', count: byTab.critical.length },
            ]}
          />
          {tab === 'reorder' && (
            <Button variant="secondary" size="sm" disabled={byTab.reorder.length === 0} onClick={() => navigate(paths.purchaseList)}>
              <ShoppingCart />
              Purchase list
            </Button>
          )}
        </div>
        <ChipRow className="px-5 pt-4" aria-label="Filter by category">
          <Chip variant="filter" active={category === null} count={searched.length} onClick={() => setCategory(null)}>
            All categories
          </Chip>
          {PART_CATEGORIES.map((c) => {
            const count = searched.filter((r) => r.part.category === c).length
            if (!count && category !== c) return null
            return (
              <Chip key={c} variant="filter" active={category === c} count={count} onClick={() => setCategory(category === c ? null : c)}>
                {PART_CATEGORY_LABEL[c]}
              </Chip>
            )
          })}
        </ChipRow>
        <DataTable
          className="mt-2"
          columns={columns}
          rows={visible}
          getRowKey={(r) => r.part.id}
          onRowClick={(r) => navigate(paths.part(r.part.id))}
          initialSort={{ id: 'code' }}
          pageSize={15}
          resetPageKey={`${tab}|${category}|${q}`}
          {...table}
          empty={empty}
        />
      </Card>

      <PartDialog
        open={creating}
        onOpenChange={setCreating}
        editing={null}
        onSaved={(part) => {
          toast(`${part.code} added to the catalog`, { tone: 'success', description: 'Receive stock to give it a bin and an on-hand count.' })
          navigate(paths.part(part.id))
        }}
      />
    </>
  )
}
