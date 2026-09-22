import { fmtAgo, fmtDate, subtreeIds } from '@cmms/fixtures'
import type { Asset, AssetStatus, Criticality } from '@cmms/types'
import { ASSET_CATEGORY_LABEL, ASSET_STATUS_LABEL, CRITICALITIES, CRITICALITY_LABEL } from '@cmms/types'
import {
  Badge,
  Button,
  Card,
  Chip,
  ChipRow,
  Combobox,
  type Column,
  DataTable,
  EmptyState,
  IconTile,
  cn,
} from '@cmms/ui'
import { Factory, Plus, ShieldCheck, X } from 'lucide-react'
import { useMemo } from 'react'
import { useNavigate } from 'react-router'
import { AssetStatusBadge, CriticalityBadge } from '../../components/badges'
import { AssetIcon } from '../../components/icons'
import { paths } from '../../components/links'
import { useTableHistory } from '../../lib/history-state'
import { useScoped } from '../../state/scoped'
import {
  ASSET_STATUSES,
  NO_FILTERS,
  type RegistryFilters,
  assetSearchFields,
  hasFilters,
  matchesQuery,
  underWarranty,
  workByAsset,
} from './lib'

/** Status column sorts breakdowns first. */
const STATUS_RANK: Record<AssetStatus, number> = { down: 0, operational: 1, standby: 2, retired: 3 }

export function AssetRegistry({
  query,
  filters,
  onFiltersChange,
  now,
  onReset,
  onAdd,
}: {
  query: string
  filters: RegistryFilters
  onFiltersChange: (filters: RegistryFilters) => void
  now: number
  /** Clears the search and every filter. */
  onReset: () => void
  onAdd?: () => void
}) {
  const { assets, assetTypes, locations, workOrders, maps, locationPath } = useScoped()
  const navigate = useNavigate()
  const table = useTableHistory()
  const work = useMemo(() => workByAsset(workOrders), [workOrders])
  const set = (patch: Partial<RegistryFilters>) => onFiltersChange({ ...filters, ...patch })
  const filtered = hasFilters(filters) || query.trim() !== ''

  const rows = useMemo(() => {
    const inLocation = filters.locationId ? subtreeIds(locations, filters.locationId) : null
    return assets.filter(
      (a) =>
        (!filters.status || a.status === filters.status) &&
        (!filters.classes.length || filters.classes.includes(a.criticality)) &&
        (!filters.typeId || a.typeId === filters.typeId) &&
        (!inLocation || inLocation.has(a.locationId)) &&
        (!filters.underWarranty || underWarranty(a, now)) &&
        matchesQuery(
          query,
          assetSearchFields(a, maps.assetType.get(a.typeId)?.name ?? '', locationPath(a.locationId)),
        ),
    )
  }, [assets, filters, query, locations, maps, locationPath, now])

  const statusCount = (status: AssetStatus) => assets.filter((a) => a.status === status).length
  const classCount = (c: Criticality) => assets.filter((a) => a.criticality === c).length
  const toggleClass = (c: Criticality) =>
    set({
      classes: filters.classes.includes(c) ? filters.classes.filter((x) => x !== c) : [...filters.classes, c],
    })

  const columns: Column<Asset>[] = [
    {
      id: 'asset',
      header: 'Asset',
      sortValue: (a) => a.code,
      cell: (a) => {
        const parent = a.parentId ? maps.asset.get(a.parentId) : undefined
        const open = work.get(a.id)?.open ?? 0
        return (
          <div className="flex min-w-0 items-center gap-3">
            <IconTile size="sm" tone={a.status === 'down' ? 'danger' : 'default'} className="hidden sm:flex">
              <AssetIcon icon={maps.assetType.get(a.typeId)?.icon} />
            </IconTile>
            <div className="max-w-[15rem] min-w-0 sm:max-w-[16rem]">
              <p className="truncate font-medium">{a.name}</p>
              <p className="truncate font-mono text-[11px] text-muted">
                {a.code}
                {parent ? ` · in ${parent.code}` : ''}
              </p>
              <div className="mt-1.5 flex flex-wrap gap-1.5 sm:hidden">
                <AssetStatusBadge status={a.status} />
                <CriticalityBadge criticality={a.criticality} />
                {open > 0 && <Badge variant="info">{open} open</Badge>}
              </div>
            </div>
          </div>
        )
      },
    },
    {
      id: 'location',
      header: 'Location',
      hideBelow: 'xl',
      sortValue: (a) => locationPath(a.locationId),
      cell: (a) => {
        const path = locationPath(a.locationId)
        return (
          <span className="block max-w-[13rem] truncate text-body" title={path}>
            {path}
          </span>
        )
      },
    },
    {
      id: 'type',
      header: 'Type',
      // The icon tile in the first cell shows the type until the screen has room for the name.
      className: 'hidden 2xl:table-cell',
      headerClassName: 'hidden 2xl:table-cell',
      sortValue: (a) => maps.assetType.get(a.typeId)?.name ?? '',
      cell: (a) => (
        <span className="block max-w-[11rem] truncate text-body">
          {maps.assetType.get(a.typeId)?.name ?? 'Unknown type'}
        </span>
      ),
    },
    {
      id: 'criticality',
      header: 'Class',
      hideBelow: 'sm',
      sortValue: (a) => a.criticality,
      cell: (a) => <CriticalityBadge criticality={a.criticality} />,
    },
    {
      id: 'status',
      header: 'Status',
      hideBelow: 'sm',
      sortValue: (a) => STATUS_RANK[a.status],
      cell: (a) => <AssetStatusBadge status={a.status} />,
    },
    {
      id: 'open',
      header: 'Open WOs',
      align: 'right',
      hideBelow: 'md',
      sortValue: (a) => work.get(a.id)?.open ?? 0,
      cell: (a) => {
        const open = work.get(a.id)?.open ?? 0
        return <span className={cn('tabular-nums', open ? 'font-semibold' : 'text-muted')}>{open}</span>
      },
    },
    {
      id: 'last',
      header: 'Last maintenance',
      hideBelow: 'lg',
      sortValue: (a) => work.get(a.id)?.lastDoneAt ?? null,
      cell: (a) => {
        const at = work.get(a.id)?.lastDoneAt
        if (!at) return <span className="text-muted">None yet</span>
        return (
          <span className="whitespace-nowrap">
            {fmtDate(at)}
            <span className="block text-xs text-muted">{fmtAgo(at, now)}</span>
          </span>
        )
      },
    },
  ]

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <ChipRow className="max-w-full">
          <Chip
            variant="filter"
            active={!filters.status}
            count={assets.length}
            onClick={() => set({ status: null })}
          >
            All
          </Chip>
          {ASSET_STATUSES.map((status) => (
            <Chip
              key={status}
              variant="filter"
              active={filters.status === status}
              count={statusCount(status)}
              onClick={() => set({ status: filters.status === status ? null : status })}
            >
              {ASSET_STATUS_LABEL[status]}
            </Chip>
          ))}
        </ChipRow>
        <ChipRow className="max-w-full">
          {CRITICALITIES.map((c) => (
            <Chip
              key={c}
              variant="filter"
              active={filters.classes.includes(c)}
              count={classCount(c)}
              title={`Criticality ${c}: ${CRITICALITY_LABEL[c]}`}
              onClick={() => toggleClass(c)}
            >
              Class {c}
            </Chip>
          ))}
          <Chip
            variant="filter"
            icon={<ShieldCheck />}
            active={filters.underWarranty}
            onClick={() => set({ underWarranty: !filters.underWarranty })}
          >
            Under warranty
          </Chip>
        </ChipRow>
        <div className="flex max-w-full min-w-0 items-center gap-1 rounded-full bg-card p-1 shadow-card">
          <Combobox
            variant="inline"
            aria-label="Asset type"
            items={assetTypes}
            value={filters.typeId}
            clearable
            placeholder="All types"
            searchPlaceholder="Search asset types"
            className="max-w-[12rem]"
            getKey={(t) => t.id}
            getLabel={(t) => t.name}
            getDescription={(t) => ASSET_CATEGORY_LABEL[t.category]}
            onChange={(typeId) => set({ typeId })}
          />
          <Combobox
            variant="inline"
            aria-label="Location"
            items={locations}
            value={filters.locationId}
            clearable
            placeholder="All locations"
            searchPlaceholder="Search plants, areas, lines"
            className="max-w-[12rem]"
            getKey={(l) => l.id}
            getLabel={(l) => l.name}
            getDescription={(l) => locationPath(l.id)}
            getKeywords={(l) => [l.code]}
            onChange={(locationId) => set({ locationId })}
          />
        </div>
        {hasFilters(filters) && (
          <Button variant="ghost" size="sm" onClick={() => onFiltersChange(NO_FILTERS)}>
            <X />
            Clear filters
          </Button>
        )}
      </div>

      <Card>
        <DataTable
          columns={columns}
          rows={rows}
          getRowKey={(a) => a.id}
          onRowClick={(a) => navigate(paths.asset(a.id))}
          initialSort={{ id: 'asset' }}
          resetPageKey={`${query}|${JSON.stringify(filters)}`}
          {...table}
          rowClassName={(a) => (a.status === 'retired' ? 'text-muted' : undefined)}
          empty={
            <EmptyState
              icon={<Factory />}
              title={filtered ? 'No assets match this view' : 'No assets registered yet'}
              description={
                filtered
                  ? 'Clear the search or filters. If the machine is missing from the register, add it.'
                  : 'Add the first machine to start its passport, history and parts list.'
              }
              action={
                <div className="flex flex-wrap justify-center gap-2">
                  {filtered && (
                    <Button variant="outline" onClick={onReset}>
                      {query.trim() ? 'Clear search and filters' : 'Clear filters'}
                    </Button>
                  )}
                  {onAdd && (
                    <Button onClick={onAdd}>
                      <Plus />
                      Add asset
                    </Button>
                  )}
                </div>
              }
            />
          }
        />
      </Card>
    </div>
  )
}
