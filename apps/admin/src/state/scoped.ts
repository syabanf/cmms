import { type AppAction, locationPath, nowIso, nowMs } from '@cmms/fixtures'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from '../auth/auth'
import { useStore } from './store'

/** The store plus a dispatch that stamps the signed-in user and the app clock on every action. */
export function useAppState() {
  const { state, send } = useStore()
  const { user } = useAuth()
  const by = user?.id ?? 'system'
  const dispatch = useCallback((action: AppAction) => send({ action, meta: { by, at: nowIso() } }), [send, by])
  return { state, dispatch }
}

const byId = <T extends { id: string }>(list: readonly T[]) => new Map(list.map((x) => [x.id, x]))

/** Everything a page needs for the current site, memoised on the store state. */
export function useScoped() {
  const { state, dispatch } = useAppState()
  const { user, site } = useAuth()
  if (!user || !site) throw new Error('useScoped needs a signed-in user')
  const siteId = site.id

  return useMemo(() => {
    const inSite = <T extends { siteId: string }>(list: readonly T[]) => list.filter((x) => x.siteId === siteId)
    const assets = inSite(state.assets)
    const assetIds = new Set(assets.map((a) => a.id))
    const warehouses = inSite(state.warehouses)
    const warehouseIds = warehouses.map((w) => w.id)
    const tools = inSite(state.tools)
    const toolIds = new Set(tools.map((t) => t.id))
    const meters = state.meters.filter((m) => assetIds.has(m.assetId))
    const meterIds = new Set(meters.map((m) => m.id))
    const people = state.people.filter((p) => p.siteIds.includes(siteId))
    const maps = {
      asset: byId(state.assets),
      person: byId(state.people),
      part: byId(state.parts),
      vendor: byId(state.vendors),
      team: byId(state.teams),
      location: byId(state.locations),
      assetType: byId(state.assetTypes),
      jobPlan: byId(state.jobPlans),
      pm: byId(state.pmSchedules),
      tool: byId(state.tools),
      failureCode: byId(state.failureCodes),
      safetyItem: byId(state.safetyItems),
      skill: byId(state.skills),
      warehouse: byId(state.warehouses),
      costCenter: byId(state.costCenters),
      meter: byId(state.meters),
      request: byId(state.requests),
      workOrder: byId(state.workOrders),
      rca: byId(state.rcas),
    }
    return {
      user,
      site,
      siteId,
      state,
      dispatch,
      settings: state.settings,
      assets,
      assetIds,
      workOrders: inSite(state.workOrders),
      requests: inSite(state.requests),
      pmSchedules: inSite(state.pmSchedules),
      rcas: inSite(state.rcas),
      locations: inSite(state.locations),
      teams: inSite(state.teams),
      costCenters: inSite(state.costCenters),
      warehouses,
      warehouseIds,
      tools,
      people,
      technicians: people.filter((p) => p.technician),
      meters,
      meterReadings: state.meterReadings.filter((r) => meterIds.has(r.meterId)),
      documents: state.documents.filter((d) => assetIds.has(d.assetId)),
      bom: state.bom.filter((b) => assetIds.has(b.assetId)),
      warrantyClaims: state.warrantyClaims.filter((c) => assetIds.has(c.assetId)),
      stock: state.stock.filter((s) => warehouseIds.includes(s.warehouseId)),
      stockTxns: state.stockTxns.filter((t) => warehouseIds.includes(t.warehouseId)),
      toolMovements: state.toolMovements.filter((m) => toolIds.has(m.toolId)),
      calibrations: state.calibrations.filter((c) => (c.target.kind === 'asset' ? assetIds.has(c.target.id) : toolIds.has(c.target.id))),
      // master data shared by every site
      parts: state.parts,
      jobPlans: state.jobPlans,
      vendors: state.vendors,
      failureCodes: state.failureCodes,
      safetyItems: state.safetyItems,
      skills: state.skills,
      assetTypes: state.assetTypes,
      maps,
      personName: (id: string | null | undefined) =>
        id === 'system' ? 'PM scheduler' : id ? (maps.person.get(id)?.name ?? 'Unknown') : 'Unassigned',
      locationPath: (locationId: string) => locationPath(state.locations, locationId),
    }
  }, [state, siteId, site, user, dispatch])
}

export type Scoped = ReturnType<typeof useScoped>

/** Re-renders on an interval so timers and "x ago" labels move. */
export function useNow(intervalMs = 30_000) {
  const [now, setNow] = useState(nowMs)
  useEffect(() => {
    const id = window.setInterval(() => setNow(nowMs()), intervalMs)
    return () => window.clearInterval(id)
  }, [intervalMs])
  return now
}
