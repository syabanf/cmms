import type {
  Asset,
  FailureCode,
  Meter,
  NotificationEvent,
  Part,
  PmSchedule,
  StockItem,
  Tool,
  WorkOrder,
} from '@cmms/types'
import { nowMs } from './clock'
import { DAY, HOUR, toMs } from './dates'
import { fmtDate } from './format'
import { calibrationState, stockLevel, stockState } from './inventory'
import { openPmWorkOrder, pmDue } from './pm'
import { failureEvents, repeatFailures } from './reliability'
import { isActive, isOverdue } from './wo'

export type NotificationTargetKind = 'wo' | 'pm' | 'part' | 'asset' | 'tool' | 'repeat'

export interface NotificationItem {
  /** Stable id so read state survives re-derivation. */
  id: string
  event: NotificationEvent
  title: string
  body: string
  at: number
  severity: 'info' | 'warning' | 'danger'
  target: { kind: NotificationTargetKind; id: string }
}

export interface NotificationInput {
  workOrders: readonly WorkOrder[]
  pmSchedules: readonly PmSchedule[]
  meters: ReadonlyMap<string, Meter>
  assets: readonly Asset[]
  tools: readonly Tool[]
  parts: readonly Part[]
  stock: readonly StockItem[]
  warehouseIds: readonly string[]
  failureCodes: ReadonlyMap<string, FailureCode>
  repeatWindowDays: number
}

/** Notifications derived from the current state of one site, newest first. */
export function deriveNotifications(input: NotificationInput, now = nowMs()): NotificationItem[] {
  const out: NotificationItem[] = []
  const assetById = new Map(input.assets.map((a) => [a.id, a]))
  const assetName = (id: string) => assetById.get(id)?.name ?? 'Asset'

  for (const wo of input.workOrders) {
    if (!isActive(wo)) continue
    const requested = toMs(wo.requestedAt)
    if (wo.priority === 'P1' && now - requested < 2 * DAY) {
      out.push({
        id: `critical:${wo.id}`,
        event: 'critical_wo_created',
        title: `P1 ${wo.code} on ${assetName(wo.assetId)}`,
        body: wo.title,
        at: requested,
        severity: 'danger',
        target: { kind: 'wo', id: wo.id },
      })
    }
    if (isOverdue(wo, now) && (wo.priority === 'P1' || wo.priority === 'P2')) {
      out.push({
        id: `sla:${wo.id}`,
        event: 'wo_sla_exceeded',
        title: `SLA exceeded on ${wo.code}`,
        body: `${wo.title}. Due ${fmtDate(wo.dueAt)}.`,
        at: toMs(wo.dueAt),
        severity: 'danger',
        target: { kind: 'wo', id: wo.id },
      })
    }
    if (wo.pmScheduleId && isOverdue(wo, now)) {
      out.push({
        id: `pm-overdue:${wo.id}`,
        event: 'pm_overdue',
        title: `PM overdue: ${assetName(wo.assetId)}`,
        body: `${wo.code} ${wo.title} was due ${fmtDate(wo.dueAt)}.`,
        at: toMs(wo.dueAt),
        severity: 'warning',
        target: { kind: 'wo', id: wo.id },
      })
    }
    if (wo.approval?.status === 'pending') {
      out.push({
        id: `approval:${wo.id}`,
        event: 'approval_required',
        title: `Approval needed for ${wo.code}`,
        body: wo.approval.reason,
        at: requested,
        severity: 'warning',
        target: { kind: 'wo', id: wo.id },
      })
    }
  }

  for (const pm of input.pmSchedules) {
    if (!pm.active || openPmWorkOrder(pm, input.workOrders)) continue
    const due = pmDue(pm, input.meters, now)
    if (due.daysLeft === 1) {
      out.push({
        id: `pm-tomorrow:${pm.id}`,
        event: 'pm_due_tomorrow',
        title: `PM due tomorrow: ${assetName(pm.assetId)}`,
        body: `${pm.code} ${pm.name}`,
        at: now - HOUR,
        severity: 'info',
        target: { kind: 'pm', id: pm.id },
      })
    } else if (due.daysLeft < 0) {
      out.push({
        id: `pm-late:${pm.id}`,
        event: 'pm_overdue',
        title: `PM overdue: ${assetName(pm.assetId)}`,
        body: `${pm.code} has no work order yet.`,
        at: due.dueAt,
        severity: 'warning',
        target: { kind: 'pm', id: pm.id },
      })
    }
  }

  for (const part of input.parts) {
    const level = stockLevel(part.id, input.stock, input.warehouseIds)
    if (!level.items.length) continue
    const state = stockState(part, level)
    if (state !== 'reorder' && state !== 'shortage') continue
    out.push({
      id: `stock:${part.id}:${level.onHand}`,
      event: 'part_below_min',
      title: `${part.name} ${state === 'shortage' ? 'short' : 'below minimum'}`,
      body: `${level.onHand} on hand, ${level.reserved} reserved, minimum ${part.min}.`,
      at: now - 2 * HOUR,
      severity: state === 'shortage' ? 'danger' : 'warning',
      target: { kind: 'part', id: part.id },
    })
  }

  const calibratable: { id: string; name: string; plan: Asset['calibration']; kind: 'asset' | 'tool' }[] = [
    ...input.assets.map((a) => ({ id: a.id, name: a.name, plan: a.calibration, kind: 'asset' as const })),
    ...input.tools.map((t) => ({ id: t.id, name: t.name, plan: t.calibration, kind: 'tool' as const })),
  ]
  for (const c of calibratable) {
    const state = calibrationState(c.plan, now)
    if (!c.plan || (state !== 'expiring' && state !== 'expired')) continue
    out.push({
      id: `cal:${c.id}:${c.plan.due}`,
      event: 'calibration_expiring',
      title: `${c.name} calibration ${state === 'expired' ? 'expired' : 'expiring'}`,
      body: `${state === 'expired' ? 'Expired' : 'Due'} ${fmtDate(c.plan.due)}.`,
      at: state === 'expired' ? toMs(c.plan.due) : now - 3 * HOUR,
      severity: state === 'expired' ? 'danger' : 'warning',
      target: { kind: c.kind, id: c.id },
    })
  }

  for (const asset of input.assets) {
    if (!asset.warranty) continue
    const end = toMs(asset.warranty.end)
    if (end < now || end - now > 60 * DAY) continue
    out.push({
      id: `warranty:${asset.id}`,
      event: 'warranty_expiring',
      title: `Warranty ending on ${asset.name}`,
      body: `Coverage ends ${fmtDate(asset.warranty.end)}. Raise open claims before then.`,
      at: now - 4 * HOUR,
      severity: 'info',
      target: { kind: 'asset', id: asset.id },
    })
  }

  const groups = repeatFailures(failureEvents(input.workOrders), input.repeatWindowDays)
  for (const g of groups) {
    if (now - g.lastAt > 30 * DAY) continue
    out.push({
      id: `repeat:${g.key}:${g.events.length}`,
      event: 'repeat_failure',
      title: `Repeat failure on ${assetName(g.assetId)}`,
      body: `${input.failureCodes.get(g.modeId)?.name ?? 'Same failure'} ${g.events.length} times since ${fmtDate(g.firstAt)}.`,
      at: g.lastAt,
      severity: 'danger',
      target: { kind: 'asset', id: g.assetId },
    })
  }

  return out.sort((a, b) => b.at - a.at)
}
