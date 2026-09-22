import { type AppAction, locationPath, nowIso, nowMs, toMs } from '@cmms/fixtures'
import type { MaintenanceRequest } from '@cmms/types'
import { type ReactNode, createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { useAuth } from '../auth/auth'
import { useStore } from './store'

const byId = <T extends { id: string }>(list: readonly T[]) => new Map(list.map((x) => [x.id, x]))
const newestFirst = (a: MaintenanceRequest, b: MaintenanceRequest) => toMs(b.reportedAt) - toMs(a.reportedAt)

/**
 * The signed-in person's slice of the store: their site, their work and requests, lookups,
 * and a dispatch that stamps the user and the app clock on every action.
 */
function useScopeValue() {
  const { state, send } = useStore()
  const { user, site } = useAuth()
  if (!user || !site) throw new Error('MobileScopeProvider needs a signed-in user')
  const userId = user.id
  const dispatch = useCallback((action: AppAction) => send({ action, meta: { by: userId, at: nowIso() } }), [send, userId])

  return useMemo(() => {
    const siteId = site.id
    const inSite = <T extends { siteId: string }>(list: readonly T[]) => list.filter((x) => x.siteId === siteId)
    const teamId = user.technician?.teamId ?? null
    const isTechnician = user.role === 'technician' && teamId !== null
    const assets = inSite(state.assets)
    const assetIds = new Set(assets.map((a) => a.id))
    // A technician's area: every asset their team maintains.
    const areaAssetIds = new Set(assets.filter((a) => isTechnician && a.teamId === teamId).map((a) => a.id))
    const workOrders = inSite(state.workOrders)
    const requests = inSite(state.requests).sort(newestFirst)
    const warehouses = inSite(state.warehouses)
    const warehouseIds = warehouses.map((w) => w.id)
    const meters = state.meters.filter((m) => assetIds.has(m.assetId))
    const meterIds = new Set(meters.map((m) => m.id))
    const maps = {
      asset: byId(state.assets),
      person: byId(state.people),
      part: byId(state.parts),
      team: byId(state.teams),
      vendor: byId(state.vendors),
      assetType: byId(state.assetTypes),
      jobPlan: byId(state.jobPlans),
      tool: byId(state.tools),
      failureCode: byId(state.failureCodes),
      safetyItem: byId(state.safetyItems),
      skill: byId(state.skills),
      workOrder: byId(state.workOrders),
      request: byId(state.requests),
      meter: byId(state.meters),
      pm: byId(state.pmSchedules),
    }
    return {
      user,
      site,
      isTechnician,
      dispatch,
      settings: state.settings,
      assets,
      areaAssets: assets.filter((a) => areaAssetIds.has(a.id)),
      workOrders,
      myWork: workOrders.filter((w) => w.assigneeIds.includes(user.id)),
      myRequests: requests.filter((r) => r.reportedBy === user.id),
      /** Reports on the team's assets that still wait for a decision or are being watched. */
      areaRequests: requests.filter((r) => areaAssetIds.has(r.assetId) && (r.status === 'new' || r.status === 'monitor')),
      requests,
      myPmSchedules: inSite(state.pmSchedules).filter((p) => p.active && p.assigneeId === user.id),
      warehouses,
      warehouseIds,
      tools: inSite(state.tools),
      meters,
      meterReadings: state.meterReadings.filter((r) => meterIds.has(r.meterId)),
      documents: state.documents.filter((d) => assetIds.has(d.assetId)),
      bom: state.bom.filter((b) => assetIds.has(b.assetId)),
      stock: state.stock.filter((s) => warehouseIds.includes(s.warehouseId)),
      calibrations: state.calibrations.filter((c) => c.target.kind === 'asset' && assetIds.has(c.target.id)),
      parts: state.parts,
      failureCodes: state.failureCodes,
      maps,
      personName: (id: string | null | undefined) =>
        id === 'system' ? 'PM scheduler' : id ? (maps.person.get(id)?.name ?? 'Unknown') : 'Unassigned',
      locationPath: (locationId: string) => locationPath(state.locations, locationId),
    }
  }, [state, site, user, dispatch])
}

type MobileScope = ReturnType<typeof useScopeValue>

const ScopeContext = createContext<MobileScope | null>(null)

/** Builds the scope once per store change and shares it, so list cards do not rebuild every lookup. */
export function MobileScopeProvider({ children }: { children: ReactNode }) {
  const value = useScopeValue()
  return <ScopeContext.Provider value={value}>{children}</ScopeContext.Provider>
}

export function useMobileScope(): MobileScope {
  const ctx = useContext(ScopeContext)
  if (!ctx) throw new Error('useMobileScope must be used inside MobileScopeProvider')
  return ctx
}

/** Re-renders on an interval so timers and "x ago" labels move. */
export function useNow(intervalMs = 30_000) {
  const [now, setNow] = useState(nowMs)
  useEffect(() => {
    const id = window.setInterval(() => setNow(nowMs()), intervalMs)
    return () => window.clearInterval(id)
  }, [intervalMs])
  return now
}
