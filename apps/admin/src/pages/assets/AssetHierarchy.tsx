import { plural } from '@cmms/fixtures'
import type { AssetStatus } from '@cmms/types'
import { ASSET_STATUS_LABEL } from '@cmms/types'
import {
  Badge,
  Button,
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
  EmptyState,
  IconTile,
  StatusDot,
  type Tone,
  cn,
} from '@cmms/ui'
import {
  Building2,
  ChevronRight,
  ChevronsDownUp,
  ChevronsUpDown,
  Factory,
  LayoutGrid,
  MapPinOff,
  Rows3,
  SearchX,
  Warehouse,
} from 'lucide-react'
import { type CSSProperties, type ReactNode, useMemo } from 'react'
import { Link } from 'react-router'
import { CriticalityBadge } from '../../components/badges'
import { AssetIcon } from '../../components/icons'
import { paths } from '../../components/links'
import { useHistoryState } from '../../lib/history-state'
import { useScoped } from '../../state/scoped'
import {
  HIERARCHY_KIND_LABEL,
  type HierarchyKind,
  type HierarchyNode,
  assetSearchFields,
  branchIds,
  buildHierarchy,
  matchesQuery,
  visibleRows,
} from './lib'

const STATUS_TONE: Record<AssetStatus, Tone> = {
  operational: 'success',
  down: 'danger',
  standby: 'default',
  retired: 'default',
}

const KIND_ICON: Partial<Record<HierarchyKind, ReactNode>> = {
  company: <Building2 />,
  site: <Factory />,
  plant: <Warehouse />,
  area: <LayoutGrid />,
  line: <Rows3 />,
  unplaced: <MapPinOff />,
}

/** Company › Site › Plant › Area › Line › Machine › Component, opened to line level by default. */
export function AssetHierarchy({ query }: { query: string }) {
  const { state, site, locations, assets, maps, locationPath } = useScoped()
  const searching = query.trim() !== ''

  const keep = useMemo(() => {
    if (!searching) return null
    const hits = assets.filter((a) =>
      matchesQuery(
        query,
        assetSearchFields(a, maps.assetType.get(a.typeId)?.name ?? '', locationPath(a.locationId)),
      ),
    )
    return new Set(hits.map((a) => a.id))
  }, [assets, maps, locationPath, query, searching])

  const root = useMemo(
    () => buildHierarchy(state.company, site, locations, assets, keep),
    [state.company, site, locations, assets, keep],
  )
  const [open, setOpen] = useHistoryState<ReadonlySet<string>>(
    'hierarchy',
    () =>
      new Set([state.company.id, site.id, ...locations.filter((l) => l.kind !== 'line').map((l) => l.id)]),
  )

  const rows = visibleRows(root, (id) => searching || open.has(id))
  const toggle = (id: string) =>
    setOpen((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  return (
    <Card>
      <CardHeader
        action={
          searching ? (
            <Badge variant="muted">{plural(keep?.size ?? 0, 'match', 'matches')}</Badge>
          ) : (
            <div className="flex flex-wrap gap-1">
              <Button variant="ghost" size="sm" onClick={() => setOpen(new Set(branchIds(root)))}>
                <ChevronsUpDown />
                Expand all
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setOpen(new Set([state.company.id, site.id]))}>
                <ChevronsDownUp />
                Collapse all
              </Button>
            </div>
          )
        }
      >
        <CardTitle>Asset hierarchy</CardTitle>
        <CardDescription>Company › Site › Plant › Area › Line › Machine › Component</CardDescription>
      </CardHeader>
      <div className="px-2 pb-3 sm:px-3">
        {searching && !keep?.size ? (
          <EmptyState
            compact
            icon={<SearchX />}
            title={`No assets match "${query.trim()}"`}
            description="Search by code, name, serial number, model, type or location."
          />
        ) : (
          <ul className="space-y-0.5">
            {rows.map(({ node, depth }) => (
              <HierarchyRow
                key={node.id}
                node={node}
                depth={depth}
                expanded={searching || open.has(node.id)}
                onToggle={searching ? undefined : () => toggle(node.id)}
              />
            ))}
          </ul>
        )}
      </div>
    </Card>
  )
}

function HierarchyRow({
  node,
  depth,
  expanded,
  onToggle,
}: {
  node: HierarchyNode
  depth: number
  expanded: boolean
  /** Absent while searching: every branch stays open. */
  onToggle?: () => void
}) {
  const { maps } = useScoped()
  const asset = node.asset
  const branch = node.children.length > 0

  return (
    <li
      style={{ '--depth': depth } as CSSProperties}
      className="flex min-w-0 items-center gap-2 rounded-2xl py-1.5 pr-2 pl-[calc(var(--depth)*0.75rem+0.25rem)] transition-colors hover:bg-surface-2 md:pl-[calc(var(--depth)*1.5rem+0.25rem)]"
    >
      {branch && onToggle ? (
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={expanded}
          aria-label={`${expanded ? 'Collapse' : 'Expand'} ${node.name}`}
          className="flex size-7 shrink-0 items-center justify-center rounded-full text-muted transition-colors hover:bg-black/5 hover:text-foreground focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:outline-none"
        >
          <ChevronRight className={cn('size-4 transition-transform', expanded && 'rotate-90')} />
        </button>
      ) : (
        <span aria-hidden="true" className="flex size-7 shrink-0 items-center justify-center text-silver">
          {branch && <ChevronRight className="size-4 rotate-90" />}
        </span>
      )}

      <IconTile
        size="sm"
        tone={node.kind === 'company' ? 'ink' : asset?.status === 'down' ? 'danger' : 'default'}
      >
        {asset ? <AssetIcon icon={maps.assetType.get(asset.typeId)?.icon} /> : KIND_ICON[node.kind]}
      </IconTile>

      <div className="min-w-0 flex-1">
        {asset ? (
          <Link
            to={paths.asset(asset.id)}
            className="block truncate text-sm font-medium transition-colors hover:text-accent"
          >
            {node.name}
          </Link>
        ) : (
          <p className="truncate text-sm font-semibold">{node.name}</p>
        )}
        <p className="truncate text-xs text-muted">
          {asset ? <span className="font-mono">{node.code}</span> : node.code}
          {node.code ? ' · ' : ''}
          {HIERARCHY_KIND_LABEL[node.kind]}
        </p>
      </div>

      {asset ? (
        <div className="flex shrink-0 items-center gap-2">
          {branch && (
            <span className="hidden text-xs text-muted sm:inline">
              {node.children.length} {node.children.length === 1 ? 'component' : 'components'}
            </span>
          )}
          <span
            className="inline-flex items-center gap-1.5 text-xs font-medium"
            title={ASSET_STATUS_LABEL[asset.status]}
          >
            <StatusDot tone={STATUS_TONE[asset.status]} pulse={asset.status === 'down'} />
            <span className="hidden sm:inline">{ASSET_STATUS_LABEL[asset.status]}</span>
          </span>
          <CriticalityBadge criticality={asset.criticality} />
        </div>
      ) : (
        <div className="flex shrink-0 items-center gap-2">
          {node.downCount > 0 && (
            <Badge variant="danger" dot>
              {node.downCount} down
            </Badge>
          )}
          <span className="text-xs text-muted tabular-nums">
            {node.assetCount}
            <span className="hidden sm:inline"> {node.assetCount === 1 ? 'asset' : 'assets'}</span>
          </span>
        </div>
      )}
    </li>
  )
}
