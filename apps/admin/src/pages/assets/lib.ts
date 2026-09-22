import { DAY, dayKey, isActive, isDone, plural, toMs, type PmState } from '@cmms/fixtures'
import type {
  Asset,
  AssetStatus,
  Company,
  Criticality,
  CriticalityScores,
  Location,
  LocationKind,
  Site,
  Warranty,
  WorkOrder,
} from '@cmms/types'

export const ASSET_STATUSES: AssetStatus[] = ['operational', 'down', 'standby', 'retired']

// ─── Criticality ────────────────────────────────────────────────

export const SCORE_FACTORS: { key: keyof CriticalityScores; label: string; hint: string }[] = [
  { key: 'production', label: 'Production impact', hint: 'Output lost while it is stopped' },
  { key: 'safety', label: 'Safety impact', hint: 'Harm to people or the plant when it fails' },
  { key: 'quality', label: 'Quality impact', hint: 'Scrap or rework when it drifts' },
  { key: 'replacementCost', label: 'Replacement cost', hint: 'Price and lead time of a replacement' },
  { key: 'redundancy', label: 'Redundancy', hint: 'Scores high when there is no backup' },
]

export const CLASS_RULE = 'Class A from 18 points, B from 14, C from 10, D below 10.'

// ─── Search and filters ─────────────────────────────────────────

/** Text an asset is found by: identity, make, type and location. */
export const assetSearchFields = (asset: Asset, typeName: string, path: string) => [
  asset.code,
  asset.name,
  asset.serialNumber,
  asset.model,
  asset.manufacturer,
  typeName,
  path,
]

/** Every whitespace-separated token of the query appears somewhere in the fields. */
export function matchesQuery(query: string, fields: readonly string[]): boolean {
  const tokens = query.trim().toLowerCase().split(/\s+/).filter(Boolean)
  if (!tokens.length) return true
  const haystack = fields.join(' ').toLowerCase()
  return tokens.every((token) => haystack.includes(token))
}

export interface RegistryFilters {
  status: AssetStatus | null
  classes: Criticality[]
  typeId: string | null
  locationId: string | null
  underWarranty: boolean
}

export const NO_FILTERS: RegistryFilters = {
  status: null,
  classes: [],
  typeId: null,
  locationId: null,
  underWarranty: false,
}

export const hasFilters = (f: RegistryFilters) =>
  f.status !== null || f.classes.length > 0 || f.typeId !== null || f.locationId !== null || f.underWarranty

// ─── Work per asset ─────────────────────────────────────────────

interface AssetWork {
  open: number
  lastDoneAt: number | null
}

/** Open work order count and last completed maintenance for each asset. */
export function workByAsset(workOrders: readonly WorkOrder[]): Map<string, AssetWork> {
  const out = new Map<string, AssetWork>()
  for (const wo of workOrders) {
    const row = out.get(wo.assetId) ?? { open: 0, lastDoneAt: null }
    if (isActive(wo)) row.open++
    if (isDone(wo) && wo.completedAt) row.lastDoneAt = Math.max(row.lastDoneAt ?? 0, toMs(wo.completedAt))
    out.set(wo.assetId, row)
  }
  return out
}

// ─── Warranty ───────────────────────────────────────────────────

/** Matches the warranty notification window. */
const WARRANTY_WARNING_DAYS = 60

export type WarrantyState = 'active' | 'expiring' | 'expired'

export const WARRANTY_STATE_LABEL: Record<WarrantyState, string> = {
  active: 'Active',
  expiring: 'Ending soon',
  expired: 'Expired',
}

export function warrantyStatus(
  warranty: Warranty | null,
  now: number,
): { state: WarrantyState; daysLeft: number } | null {
  if (!warranty) return null
  const daysLeft = Math.ceil((toMs(warranty.end) - now) / DAY)
  const state: WarrantyState =
    daysLeft < 0 ? 'expired' : daysLeft <= WARRANTY_WARNING_DAYS ? 'expiring' : 'active'
  return { state, daysLeft }
}

export const underWarranty = (asset: Asset, now: number) => {
  const w = warrantyStatus(asset.warranty, now)
  return !!w && w.state !== 'expired'
}

// ─── Misc labels ────────────────────────────────────────────────

export const PM_STATE_LABEL: Record<PmState, string> = {
  scheduled: 'Scheduled',
  due_soon: 'Due soon',
  due: 'Due today',
  overdue: 'Overdue',
}

/** "2 years 3 months in service", "5 months in service", "Installed this month" */
export function serviceAge(installedAt: string, now: number): string {
  const months = Math.floor((now - toMs(installedAt)) / (30.44 * DAY))
  if (months < 1) return 'Installed this month'
  const years = Math.floor(months / 12)
  const rest = months % 12
  const text = [years ? plural(years, 'year') : '', rest ? plural(rest, 'month') : '']
    .filter(Boolean)
    .join(' ')
  return `${text} in service`
}

export const byCode = (a: Asset, b: Asset) => a.code.localeCompare(b.code, undefined, { numeric: true })

/** Newest first in, day buckets out, keeping the order. */
export function groupByDay<T extends { at: number }>(
  items: readonly T[],
): { key: string; at: number; items: T[] }[] {
  const groups: { key: string; at: number; items: T[] }[] = []
  for (const item of items) {
    const key = dayKey(item.at)
    const last = groups[groups.length - 1]
    if (last?.key === key) last.items.push(item)
    else groups.push({ key, at: item.at, items: [item] })
  }
  return groups
}

// ─── Hierarchy ──────────────────────────────────────────────────

export type HierarchyKind = 'company' | 'site' | LocationKind | 'machine' | 'component' | 'unplaced'

export const HIERARCHY_KIND_LABEL: Record<HierarchyKind, string> = {
  company: 'Company',
  site: 'Site',
  plant: 'Plant',
  area: 'Area',
  line: 'Line',
  machine: 'Machine',
  component: 'Component',
  unplaced: 'No location',
}

export interface HierarchyNode {
  id: string
  kind: HierarchyKind
  name: string
  code: string
  asset: Asset | null
  children: HierarchyNode[]
  /** Assets in this subtree, the node itself included. */
  assetCount: number
  downCount: number
}

type Draft = Omit<HierarchyNode, 'assetCount' | 'downCount'>

function withCounts(node: Draft): HierarchyNode {
  return {
    ...node,
    assetCount: (node.asset ? 1 : 0) + node.children.reduce((sum, c) => sum + c.assetCount, 0),
    downCount:
      (node.asset?.status === 'down' ? 1 : 0) + node.children.reduce((sum, c) => sum + c.downCount, 0),
  }
}

const isNode = (node: HierarchyNode | null): node is HierarchyNode => node !== null

/**
 * Company › Site › Plant › Area › Line › Machine › Component. Machines hang off their location,
 * components off their parent asset. With `keep`, only those assets and their ancestors remain.
 */
export function buildHierarchy(
  company: Company,
  site: Site,
  locations: readonly Location[],
  assets: readonly Asset[],
  keep: ReadonlySet<string> | null,
): HierarchyNode {
  const assetIds = new Set(assets.map((a) => a.id))
  const locationIds = new Set(locations.map((l) => l.id))
  const childAssets = new Map<string, Asset[]>()
  const placed = new Map<string, Asset[]>()
  const unplaced: Asset[] = []
  for (const asset of [...assets].sort(byCode)) {
    if (asset.parentId && assetIds.has(asset.parentId)) {
      childAssets.set(asset.parentId, [...(childAssets.get(asset.parentId) ?? []), asset])
    } else if (locationIds.has(asset.locationId)) {
      placed.set(asset.locationId, [...(placed.get(asset.locationId) ?? []), asset])
    } else {
      unplaced.push(asset)
    }
  }
  const childLocations = new Map<string | null, Location[]>()
  for (const l of locations) childLocations.set(l.parentId, [...(childLocations.get(l.parentId) ?? []), l])

  const assetNode = (asset: Asset): HierarchyNode | null => {
    const children = (childAssets.get(asset.id) ?? []).map(assetNode).filter(isNode)
    if (keep && !keep.has(asset.id) && !children.length) return null
    const kind = asset.parentId && assetIds.has(asset.parentId) ? 'component' : 'machine'
    return withCounts({ id: asset.id, kind, name: asset.name, code: asset.code, asset, children })
  }

  const locationNode = (location: Location): HierarchyNode | null => {
    const children = [
      ...(childLocations.get(location.id) ?? []).map(locationNode),
      ...(placed.get(location.id) ?? []).map(assetNode),
    ].filter(isNode)
    if (keep && !children.length) return null
    return withCounts({
      id: location.id,
      kind: location.kind,
      name: location.name,
      code: location.code,
      asset: null,
      children,
    })
  }

  const plants = (childLocations.get(null) ?? []).map(locationNode).filter(isNode)
  const loose = unplaced.map(assetNode).filter(isNode)
  if (loose.length) {
    plants.push(
      withCounts({
        id: 'unplaced',
        kind: 'unplaced',
        name: 'Assets without a location',
        code: '',
        asset: null,
        children: loose,
      }),
    )
  }
  const siteNode = withCounts({
    id: site.id,
    kind: 'site',
    name: site.name,
    code: site.code,
    asset: null,
    children: plants,
  })
  return withCounts({
    id: company.id,
    kind: 'company',
    name: company.name,
    code: '',
    asset: null,
    children: [siteNode],
  })
}

/** Rows in display order, descending only into open branches. */
export function visibleRows(
  root: HierarchyNode,
  isOpen: (id: string) => boolean,
): { node: HierarchyNode; depth: number }[] {
  const rows: { node: HierarchyNode; depth: number }[] = []
  const walk = (node: HierarchyNode, depth: number) => {
    rows.push({ node, depth })
    if (node.children.length && isOpen(node.id)) for (const child of node.children) walk(child, depth + 1)
  }
  walk(root, 0)
  return rows
}

/** Ids of every node that has children. */
export function branchIds(root: HierarchyNode): string[] {
  const ids: string[] = []
  const walk = (node: HierarchyNode) => {
    if (!node.children.length) return
    ids.push(node.id)
    node.children.forEach(walk)
  }
  walk(root)
  return ids
}
