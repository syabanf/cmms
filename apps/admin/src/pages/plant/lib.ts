import { failureEvents, fmtAgo, fmtTime, isActive, isOverdue, rootId, urgency } from '@cmms/fixtures'
import type { Asset, WorkOrder } from '@cmms/types'
import { WO_STATUS_LABEL } from '@cmms/types'
import type { Tone } from '@cmms/ui'

export type MachineState = 'down' | 'working' | 'waiting' | 'standby' | 'running'

export const MACHINE_STATE_LABEL: Record<MachineState, string> = {
  down: 'Down',
  working: 'Work in progress',
  waiting: 'Waiting',
  standby: 'Standby',
  running: 'Running',
}

export interface MachineInfo {
  asset: Asset
  state: MachineState
  /** Active work on the machine or any of its components, most urgent first. */
  work: WorkOrder[]
  /** People with a running clock on that work. */
  crew: string[]
  lastFailureAt: number | null
}

export type PlantTab = 'attention' | 'work' | 'people'

export interface PlantListRow {
  key: string
  assetId: string
  woId: string | null
  title: string
  detail: string
  tone: Tone
}

const runningClocks = (wo: WorkOrder) => wo.labor.filter((e) => e.end === null)

function stateOf(asset: Asset, work: WorkOrder[]): MachineState {
  if (asset.status === 'down') return 'down'
  if (asset.status === 'standby') return 'standby'
  if (work.some((w) => w.status === 'in_progress')) return 'working'
  if (work.some((w) => w.status === 'waiting')) return 'waiting'
  return 'running'
}

export function machineInfos(
  machines: readonly Asset[],
  workOrders: readonly WorkOrder[],
  assets: ReadonlyMap<string, Asset>,
  now: number,
): Map<string, MachineInfo> {
  const workOn = new Map<string, WorkOrder[]>()
  for (const wo of workOrders) {
    if (!isActive(wo)) continue
    const id = rootId(wo.assetId, assets)
    workOn.set(id, [...(workOn.get(id) ?? []), wo])
  }
  const lastFailure = new Map<string, number>()
  for (const event of failureEvents(workOrders)) {
    const id = rootId(event.assetId, assets)
    lastFailure.set(id, Math.max(lastFailure.get(id) ?? 0, event.at))
  }
  return new Map(
    machines.map((asset) => {
      const work = (workOn.get(asset.id) ?? []).sort((a, b) => urgency(a, now) - urgency(b, now))
      const crew = [...new Set(work.flatMap((wo) => runningClocks(wo).map((e) => e.personId)))]
      return [
        asset.id,
        { asset, state: stateOf(asset, work), work, crew, lastFailureAt: lastFailure.get(asset.id) ?? null },
      ]
    }),
  )
}

export interface PlantStats {
  machines: number
  running: number
  down: number
  standby: number
  activeWork: number
  inProgress: number
  waiting: number
  crew: number
  jobs: number
}

export function plantStats(infos: readonly MachineInfo[], workOrders: readonly WorkOrder[]): PlantStats {
  const active = workOrders.filter(isActive)
  const clocked = active.filter((wo) => runningClocks(wo).length > 0)
  return {
    machines: infos.length,
    running: infos.filter((i) => i.asset.status === 'operational').length,
    down: infos.filter((i) => i.state === 'down').length,
    standby: infos.filter((i) => i.state === 'standby').length,
    activeWork: active.length,
    inProgress: active.filter((w) => w.status === 'in_progress').length,
    waiting: active.filter((w) => w.status === 'waiting').length,
    crew: new Set(clocked.flatMap((wo) => runningClocks(wo).map((e) => e.personId))).size,
    jobs: clocked.length,
  }
}

/** How long past due a date is, as "3w late". */
export const lateBy = (dueAt: string, now: number) => `${fmtAgo(dueAt, now).replace(' ago', '')} late`

/** Machines that are down or carry P1 or overdue work: down first, then by their most urgent order. */
export function attentionRows(infos: readonly MachineInfo[], now: number): PlantListRow[] {
  const ranked: { rank: number; row: PlantListRow }[] = []
  for (const info of infos) {
    const down = info.state === 'down'
    const urgent = info.work.find((w) => w.priority === 'P1')
    const overdue = info.work.find((w) => isOverdue(w, now))
    if (!down && !urgent && !overdue) continue
    const reasons = [
      down ? 'Down' : null,
      urgent ? `P1 ${urgent.code}` : null,
      overdue
        ? overdue === urgent
          ? lateBy(overdue.dueAt, now)
          : `${overdue.code} ${lateBy(overdue.dueAt, now)}`
        : null,
    ]
    const lead = urgent ?? overdue ?? info.work[0]
    ranked.push({
      rank: (down ? 0 : 1e14) + (lead ? urgency(lead, now) : 0),
      row: {
        key: info.asset.id,
        assetId: info.asset.id,
        woId: lead?.id ?? null,
        title: `${info.asset.code} · ${info.asset.name}`,
        detail: reasons.filter(Boolean).join(' · '),
        tone: down ? 'danger' : 'warning',
      },
    })
  }
  return ranked.sort((a, b) => a.rank - b.rank).map((r) => r.row)
}

const WORK_TONE: Partial<Record<WorkOrder['status'], Tone>> = { in_progress: 'info', waiting: 'warning' }

/** Active work orders, most urgent first. */
export function workRows(
  workOrders: readonly WorkOrder[],
  assets: ReadonlyMap<string, Asset>,
  now: number,
): PlantListRow[] {
  return workOrders
    .filter(isActive)
    .sort((a, b) => urgency(a, now) - urgency(b, now))
    .map((wo) => {
      const machineId = rootId(wo.assetId, assets)
      return {
        key: wo.id,
        assetId: machineId,
        woId: wo.id,
        title: wo.title,
        detail: [
          wo.code,
          assets.get(machineId)?.code,
          isOverdue(wo, now) ? lateBy(wo.dueAt, now) : WO_STATUS_LABEL[wo.status],
        ]
          .filter(Boolean)
          .join(' · '),
        tone: wo.priority === 'P1' ? 'danger' : (WORK_TONE[wo.status] ?? 'default'),
      }
    })
}

/** One row per running clock: who is working, on which order and machine, since when. */
export function peopleRows(
  workOrders: readonly WorkOrder[],
  assets: ReadonlyMap<string, Asset>,
  personName: (id: string) => string,
): PlantListRow[] {
  return workOrders
    .filter(isActive)
    .flatMap((wo) =>
      runningClocks(wo).map((entry) => {
        const machineId = rootId(wo.assetId, assets)
        return {
          key: `${wo.id}-${entry.personId}`,
          assetId: machineId,
          woId: wo.id,
          title: personName(entry.personId),
          detail: `${wo.code} · ${assets.get(machineId)?.code ?? 'Removed asset'} · since ${fmtTime(entry.start)}`,
          tone: 'info' as const,
        }
      }),
    )
    .sort((a, b) => a.title.localeCompare(b.title))
}
