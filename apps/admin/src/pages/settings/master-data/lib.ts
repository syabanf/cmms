import { plural } from '@cmms/fixtures'
import type { Location, LocationKind } from '@cmms/types'

/** Occurrences per key; empty keys are skipped. */
export function tally(keys: Iterable<string | null | undefined>): Map<string, number> {
  const counts = new Map<string, number>()
  for (const key of keys) if (key) counts.set(key, (counts.get(key) ?? 0) + 1)
  return counts
}


/** The references that block a delete, as phrases: `[[12, 'work order'], [0, 'RCA']]` gives ["12 work orders"]. */
export const usageOf = (counts: [count: number, noun: string][]) =>
  counts.filter(([n]) => n > 0).map(([n, noun]) => plural(n, noun))

const norm = (value: string) => value.trim().toLowerCase()

/** True when another record already uses this value, ignoring case and spaces at the ends. */
export const isTaken = (value: string, others: readonly string[]) =>
  others.some((o) => norm(o) === norm(value))

export const matches = (terms: string[], ...fields: (string | undefined)[]) => {
  const text = fields.join(' ').toLowerCase()
  return terms.every((t) => text.includes(t))
}

export const searchTerms = (query: string) => query.trim().toLowerCase().split(/\s+/).filter(Boolean)

// ─── Locations ──────────────────────────────────────────────────

const CHILD_KIND: Record<LocationKind, LocationKind | null> = { plant: 'area', area: 'line', line: null }

export const PARENT_KIND: Record<LocationKind, LocationKind | null> = {
  plant: null,
  area: 'plant',
  line: 'area',
}

/** A location's kind follows its parent: plants sit at the top, areas in plants, lines in areas. */
export const kindUnder = (parent: Location | undefined): LocationKind =>
  parent ? (CHILD_KIND[parent.kind] ?? 'line') : 'plant'

export const canHoldChildren = (kind: LocationKind) => CHILD_KIND[kind] !== null
