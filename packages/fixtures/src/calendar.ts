import type { Asset, Meter, PmSchedule, Priority, Tool, WoStatus, WoType, WorkOrder } from '@cmms/types'
import { nowMs } from './clock'
import { toMs } from './dates'
import { openPmWorkOrder, pmDue, projectPm } from './pm'
import { isOverdue, plannedAt } from './wo'

export type CalendarItemKind = 'work_order' | 'pm_forecast' | 'calibration'

export interface CalendarItem {
  id: string
  kind: CalendarItemKind
  at: number
  title: string
  assetId: string
  woId: string | null
  pmId: string | null
  toolId: string | null
  woType: WoType
  status: WoStatus | null
  priority: Priority | null
  assigneeIds: string[]
  durationMin: number
  overdue: boolean
}

export interface CalendarInput {
  workOrders: readonly WorkOrder[]
  pmSchedules: readonly PmSchedule[]
  meters: ReadonlyMap<string, Meter>
  assets: readonly Asset[]
  tools: readonly Tool[]
  jobPlanDuration: (jobPlanId: string) => number
  pmTitle: (pm: PmSchedule) => string
}

/** Work orders on their planned date, projected PM occurrences and calibration due dates in [from, to). */
export function calendarItems(input: CalendarInput, from: number, to: number, now = nowMs()): CalendarItem[] {
  const items: CalendarItem[] = []
  for (const wo of input.workOrders) {
    if (wo.status === 'cancelled') continue
    const at = toMs(plannedAt(wo))
    if (at < from || at >= to) continue
    items.push({
      id: wo.id,
      kind: 'work_order',
      at,
      title: wo.title,
      assetId: wo.assetId,
      woId: wo.id,
      pmId: wo.pmScheduleId,
      toolId: null,
      woType: wo.type,
      status: wo.status,
      priority: wo.priority,
      assigneeIds: wo.assigneeIds,
      durationMin: wo.estimatedMin,
      overdue: isOverdue(wo, now),
    })
  }
  for (const pm of input.pmSchedules) {
    if (!pm.active) continue
    // An open PM work order covers the next occurrence, which may fall before `from`.
    const covered = openPmWorkOrder(pm, input.workOrders) ? pmDue(pm, input.meters, now).dueAt : null
    projectPm(pm, input.meters, from, to, now).forEach((at, i) => {
      if (at === covered) return
      items.push({
        id: `pmf-${pm.id}-${i}`,
        kind: 'pm_forecast',
        at,
        title: input.pmTitle(pm),
        assetId: pm.assetId,
        woId: null,
        pmId: pm.id,
        toolId: null,
        woType: 'preventive',
        status: null,
        priority: 'P3',
        assigneeIds: pm.assigneeId ? [pm.assigneeId] : [],
        durationMin: input.jobPlanDuration(pm.jobPlanId),
        overdue: at < now,
      })
    })
  }
  for (const asset of input.assets) {
    if (!asset.calibration) continue
    const at = toMs(asset.calibration.due)
    if (at < from || at >= to) continue
    items.push({
      id: `cal-${asset.id}`,
      kind: 'calibration',
      at,
      title: `${asset.name} calibration due`,
      assetId: asset.id,
      woId: null,
      pmId: null,
      toolId: null,
      woType: 'calibration',
      status: null,
      priority: null,
      assigneeIds: [],
      durationMin: 60,
      overdue: at < now,
    })
  }
  for (const tool of input.tools) {
    if (!tool.calibration) continue
    const at = toMs(tool.calibration.due)
    if (at < from || at >= to) continue
    items.push({
      id: `cal-${tool.id}`,
      kind: 'calibration',
      at,
      title: `${tool.name} calibration due`,
      assetId: '',
      woId: null,
      pmId: null,
      toolId: tool.id,
      woType: 'calibration',
      status: null,
      priority: null,
      assigneeIds: [],
      durationMin: 30,
      overdue: at < now,
    })
  }
  return items.sort((a, b) => a.at - b.at)
}
