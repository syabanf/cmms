import type { PmDue, PmState } from '@cmms/fixtures'
import { DAY, UNSTARTED_WO_STATUSES, fmtNumber, startOfDay, toMs } from '@cmms/fixtures'
import type { CapaAction, Meter, PmSchedule, Rca, WorkOrder } from '@cmms/types'
import { WO_STATUS_LABEL } from '@cmms/types'

export const PM_STATES: PmState[] = ['overdue', 'due', 'due_soon', 'scheduled']

export const PM_STATE_LABEL: Record<PmState, string> = {
  overdue: 'Overdue',
  due: 'Due today',
  due_soon: 'Due soon',
  scheduled: 'Scheduled',
}

/** Number inputs hold NaN while empty, so validation can flag them. */
export const readNumber = (value: string) => (value === '' ? Number.NaN : Number(value))
export const inputNumber = (n: number) => (Number.isFinite(n) ? n : '')

/** "in 5 d", "Due today", "3 d overdue" */
export function dueRelative(daysLeft: number): string {
  if (daysLeft === 0) return 'Due today'
  return daysLeft > 0 ? `in ${daysLeft} d` : `${-daysLeft} d overdue`
}

/** "288 h left" or "40 h past", for triggers that follow a meter. */
export function meterLeftText(due: PmDue, meter: Meter | undefined): string | null {
  if (due.meterRemaining === null || !meter) return null
  const amount = `${fmtNumber(Math.abs(due.meterRemaining))} ${meter.unit}`
  return due.meterRemaining >= 0 ? `${amount} left` : `${amount} past`
}

export const triggerMeterId = (pm: PmSchedule) => (pm.trigger.kind === 'calendar' ? null : pm.trigger.meterId)

/** Statuses the store cancels along with a deleted schedule; started work keeps running. */

/** Copy for the delete confirmation and its toast: what happens to the schedule's open work order. */
export function deleteEffect(pm: PmSchedule, openWo: WorkOrder | undefined): { description: string; toast: string | undefined } {
  if (!openWo) {
    return { description: `${pm.name} generates no new work. Work orders it created keep their history.`, toast: undefined }
  }
  if (UNSTARTED_WO_STATUSES.includes(openWo.status)) {
    return {
      description: `${openWo.code} has not started, so it is cancelled with the schedule. Finished work orders keep their history.`,
      toast: `${openWo.code} cancelled.`,
    }
  }
  return {
    description: `${openWo.code} is ${WO_STATUS_LABEL[openWo.status].toLowerCase()} and keeps running. ${pm.name} generates no new work.`,
    toast: `${openWo.code} keeps running.`,
  }
}

export interface CapaHint {
  rca: Rca
  action: CapaAction
  pm: PmSchedule
  /** "RCA-2026-004 recommends changing PM-0003 to every 400 runtime hours" */
  title: string
}

const PM_CODE = /\bPM-\d+\b/g

/** Open CAPA actions that name a PM schedule by its code. */
export function capaHints(rcas: readonly Rca[], pms: readonly PmSchedule[]): CapaHint[] {
  const byCode = new Map(pms.map((p) => [p.code, p]))
  const hints: CapaHint[] = []
  for (const rca of rcas) {
    for (const action of rca.actions) {
      if (action.status !== 'open') continue
      for (const code of new Set(action.text.match(PM_CODE) ?? [])) {
        const pm = byCode.get(code)
        if (!pm) continue
        // The proposed setting follows the last " to ": "... from every 30 days to every 400 runtime hours".
        const cut = action.text.lastIndexOf(' to ')
        const title =
          cut >= 0 ? `${rca.code} recommends changing ${code} to ${action.text.slice(cut + 4)}` : `${rca.code} has an open action on ${code}`
        hints.push({ rca, action, pm, title })
      }
    }
  }
  return hints
}

export type PmResult = 'on_time' | 'late' | 'overdue' | 'open' | 'cancelled'

export const PM_RESULT_LABEL: Record<PmResult, string> = {
  on_time: 'On time',
  late: 'Late',
  overdue: 'Overdue',
  open: 'Open',
  cancelled: 'Cancelled',
}

/** Same rule as pmCompliance: done by the end of the due day counts as on time. */
export function pmResult(wo: WorkOrder, now: number): PmResult {
  if (wo.status === 'cancelled') return 'cancelled'
  const deadline = startOfDay(toMs(wo.dueAt)) + DAY
  if (wo.completedAt) return toMs(wo.completedAt) <= deadline ? 'on_time' : 'late'
  return toMs(wo.dueAt) < now ? 'overdue' : 'open'
}
