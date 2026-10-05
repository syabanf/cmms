import type { Asset, Location } from '@cmms/types'

// Metres. A slot holds one machine; rows stack front to back inside an area.
const SLOT = 4.6
const ROW_DEPTH = 3
const ROW_GAP = 6
const ZONE_PAD = 2.5
const ZONE_MIN_WIDTH = 12
const ZONE_GAP = 1.2
const HALL_PAD = 1.5
const HALL_GAP = 5

interface PlantRow {
  id: string
  name: string
  x: number
  z: number
  length: number
}

interface PlantZone {
  id: string
  name: string
  x: number
  z: number
  width: number
  depth: number
  rows: PlantRow[]
}

interface PlantHall {
  id: string
  name: string
  x: number
  z: number
  width: number
  depth: number
  zones: PlantZone[]
}

interface PlacedMachine {
  assetId: string
  x: number
  z: number
}

/** Halls sit side by side along x with their fronts on one line; the site is centred on the origin. */
export interface PlantLayout {
  halls: PlantHall[]
  machines: PlacedMachine[]
  width: number
  depth: number
}

interface DraftRow {
  id: string
  name: string
  machines: Asset[]
}

interface DraftZone {
  id: string
  name: string
  rows: DraftRow[]
}

const byCode = <T extends { code: string }>(a: T, b: T) =>
  a.code.localeCompare(b.code, undefined, { numeric: true })

function groupBy<T>(items: readonly T[], key: (item: T) => string): Map<string, T[]> {
  const groups = new Map<string, T[]>()
  for (const item of items) {
    const k = key(item)
    groups.set(k, [...(groups.get(k) ?? []), item])
  }
  return groups
}

/** One row per line. An area without lines, or with machines of its own, gets a row named after itself. */
function rowsOf(area: Location, lines: Location[], machinesAt: Map<string, Asset[]>): DraftRow[] {
  const rows = lines.map((line) => ({
    id: line.id,
    name: line.name,
    machines: machinesAt.get(line.id) ?? [],
  }))
  const own = machinesAt.get(area.id) ?? []
  if (own.length > 0 || rows.length === 0) rows.push({ id: area.id, name: area.name, machines: own })
  return rows
}

/**
 * Builds the plant from the location tree: one hall per plant location, one zone per area and one row per
 * line, with machines spaced along their row in code order. Machines whose location sits outside that tree
 * go into a last hall, so none goes missing.
 */
export function buildLayout(locations: readonly Location[], machines: readonly Asset[]): PlantLayout {
  const childrenOf = groupBy(locations, (l) => l.parentId ?? '')
  const machinesAt = groupBy([...machines].sort(byCode), (a) => a.locationId)
  const kids = (id: string, kind: Location['kind']) =>
    (childrenOf.get(id) ?? []).filter((l) => l.kind === kind).sort(byCode)

  const drafts = locations
    .filter((l) => l.kind === 'plant' && !l.parentId)
    .sort(byCode)
    .map((plant) => ({
      id: plant.id,
      name: plant.name,
      zones: kids(plant.id, 'area').map((area): DraftZone => ({
        id: area.id,
        name: area.name,
        rows: rowsOf(area, kids(area.id, 'line'), machinesAt),
      })),
    }))
    .filter((hall) => hall.zones.length > 0)

  const placedIds = new Set(
    drafts.flatMap((h) => h.zones.flatMap((z) => z.rows.flatMap((r) => r.machines.map((m) => m.id)))),
  )
  const unplaced = machines.filter((m) => !placedIds.has(m.id)).sort(byCode)
  if (unplaced.length > 0) {
    const row = { id: 'unplaced', name: 'Location not set', machines: unplaced }
    drafts.push({
      id: 'unplaced',
      name: 'Location not set',
      zones: [{ id: 'unplaced', name: 'Location not set', rows: [row] }],
    })
  }

  const halls: PlantHall[] = []
  const placed: PlacedMachine[] = []
  let cursor = 0
  let maxDepth = 0

  for (const draft of drafts) {
    const sized = draft.zones.map((zone) => {
      const slots = Math.max(1, ...zone.rows.map((r) => r.machines.length))
      return {
        zone,
        width: Math.max(ZONE_MIN_WIDTH, slots * SLOT + 2 * ZONE_PAD),
        depth: 2 * ZONE_PAD + ROW_DEPTH + (zone.rows.length - 1) * ROW_GAP,
      }
    })
    const hallDepth = 2 * HALL_PAD + Math.max(...sized.map((s) => s.depth))
    let zoneLeft = cursor + HALL_PAD
    const zones = sized.map(({ zone, width, depth }): PlantZone => {
      const front = -HALL_PAD
      const rows = zone.rows.map((row, i): PlantRow => {
        const z = front - ZONE_PAD - ROW_DEPTH / 2 - i * ROW_GAP
        row.machines.forEach((m, j) =>
          placed.push({ assetId: m.id, x: zoneLeft + ZONE_PAD + SLOT / 2 + j * SLOT, z }),
        )
        const length = Math.max(1, row.machines.length) * SLOT
        return { id: row.id, name: row.name, x: zoneLeft + ZONE_PAD + length / 2, z, length }
      })
      const placedZone = {
        id: zone.id,
        name: zone.name,
        x: zoneLeft + width / 2,
        z: front - depth / 2,
        width,
        depth,
        rows,
      }
      zoneLeft += width + ZONE_GAP
      return placedZone
    })
    const hallWidth = zoneLeft - ZONE_GAP + HALL_PAD - cursor
    halls.push({
      id: draft.id,
      name: draft.name,
      x: cursor + hallWidth / 2,
      z: -hallDepth / 2,
      width: hallWidth,
      depth: hallDepth,
      zones,
    })
    cursor += hallWidth + HALL_GAP
    maxDepth = Math.max(maxDepth, hallDepth)
  }

  const width = Math.max(0, cursor - HALL_GAP)
  const dx = -width / 2
  const dz = maxDepth / 2
  const shift = <T extends { x: number; z: number }>(p: T): T => ({ ...p, x: p.x + dx, z: p.z + dz })

  return {
    halls: halls.map((hall) => ({
      ...shift(hall),
      zones: hall.zones.map((zone) => ({ ...shift(zone), rows: zone.rows.map(shift) })),
    })),
    machines: placed.map(shift),
    width,
    depth: maxDepth,
  }
}
