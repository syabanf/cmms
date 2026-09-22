import type { Location } from '@cmms/types'

/** Ancestors from the plant down to the location itself. */
export function locationTrail(locations: readonly Location[], locationId: string): Location[] {
  const byId = new Map(locations.map((l) => [l.id, l]))
  const trail: Location[] = []
  let current = byId.get(locationId)
  while (current) {
    trail.unshift(current)
    current = current.parentId ? byId.get(current.parentId) : undefined
  }
  return trail
}

/** "Production › Finishing › Polishing Area" */
export const locationPath = (locations: readonly Location[], locationId: string) =>
  locationTrail(locations, locationId)
    .map((l) => l.name)
    .join(' › ')

/** The root id and every id below it in a parent-linked list (locations, assets). */
export function subtreeIds(items: readonly { id: string; parentId: string | null }[], rootId: string): Set<string> {
  const ids = new Set([rootId])
  let grew = true
  while (grew) {
    grew = false
    for (const item of items) {
      if (item.parentId && ids.has(item.parentId) && !ids.has(item.id)) {
        ids.add(item.id)
        grew = true
      }
    }
  }
  return ids
}

/** The area an asset sits in (or its plant when it hangs directly off one). */
export function areaOf(locations: readonly Location[], locationId: string): Location | undefined {
  const trail = locationTrail(locations, locationId)
  return trail.find((l) => l.kind === 'area') ?? trail[0]
}
