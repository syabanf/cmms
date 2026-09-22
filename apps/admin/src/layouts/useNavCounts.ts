import { stockLevel, stockState } from '@cmms/fixtures'
import { useMemo } from 'react'
import { useScoped } from '../state/scoped'
import type { BadgeKey } from './nav'

/** Counts behind the navigation badges. */
export function useNavCounts(): Record<BadgeKey, number> {
  const { requests, workOrders, parts, stock, warehouseIds } = useScoped()
  return useMemo(
    () => ({
      newRequests: requests.filter((r) => r.status === 'new').length,
      approvals: workOrders.filter((w) => w.approval?.status === 'pending').length,
      reorder: parts.filter((p) => {
        const level = stockLevel(p.id, stock, warehouseIds)
        const state = stockState(p, level)
        return level.items.length > 0 && (state === 'reorder' || state === 'shortage')
      }).length,
    }),
    [requests, workOrders, parts, stock, warehouseIds],
  )
}
