import { calibrationDaysLeft, calibrationState, isActive, toMs } from '@cmms/fixtures'
import type { Asset, CalibrationPlan, CalibrationRecord, CalibrationState, JobPlan, Tool, ToolStatus, WorkOrder } from '@cmms/types'

export type CalKind = 'asset' | 'tool'
export const CAL_KIND_LABEL: Record<CalKind, string> = { asset: 'Instrument', tool: 'Tool' }

type Planned = { id: string; code: string; name: string; plan: CalibrationPlan }

/**
 * An instrument asset or a tool that carries a calibration plan. A tool also says where it is,
 * since one at calibration comes back when its record is saved.
 */
export type CalTarget = (Planned & { kind: 'asset' }) | (Planned & { kind: 'tool'; status: ToolStatus })

export type CalRow = CalTarget & {
  /** Asset type name or tool category. */
  type: string
  state: CalibrationState
  daysLeft: number
  lastRecord: CalibrationRecord | undefined
  /** Calibration work order still open on an instrument. */
  openWo: WorkOrder | undefined
}

interface RowsInput {
  assets: readonly Asset[]
  tools: readonly Tool[]
  calibrations: readonly CalibrationRecord[]
  workOrders: readonly WorkOrder[]
  typeName: (typeId: string) => string
}

export const targetKey = (t: { kind: CalKind; id: string }) => `${t.kind}:${t.id}`

/** Every instrument and tool on the site with a calibration plan. Retired assets drop out. */
export function calibrationRows({ assets, tools, calibrations, workOrders, typeName }: RowsInput, now: number): CalRow[] {
  const latest = new Map<string, CalibrationRecord>()
  for (const r of calibrations) {
    const key = targetKey(r.target)
    const seen = latest.get(key)
    if (!seen || toMs(r.date) > toMs(seen.date)) latest.set(key, r)
  }
  const row = (target: CalTarget, type: string, openWo?: WorkOrder): CalRow => ({
    ...target,
    type,
    // A plan always has a state; null only comes back without one.
    state: calibrationState(target.plan, now)!,
    daysLeft: calibrationDaysLeft(target.plan, now),
    lastRecord: latest.get(targetKey(target)),
    openWo,
  })
  return [
    ...assets.flatMap((a) =>
      a.calibration && a.status !== 'retired'
        ? [
            row(
              { kind: 'asset', id: a.id, code: a.code, name: a.name, plan: a.calibration },
              typeName(a.typeId),
              workOrders.find((w) => w.assetId === a.id && w.type === 'calibration' && isActive(w)),
            ),
          ]
        : [],
    ),
    ...tools.flatMap((t) =>
      t.calibration ? [row({ kind: 'tool', id: t.id, code: t.code, name: t.name, plan: t.calibration, status: t.status }, t.category)] : [],
    ),
  ]
}

/** "74 d left", "Due today", "5 d overdue" */
export const daysLeftText = (days: number) => (days > 0 ? `${days} d left` : days === 0 ? 'Due today' : `${-days} d overdue`)

/** The active calibration job plan made for this asset type, else any active one. */
export function calibrationJobPlan(jobPlans: readonly JobPlan[], typeId: string): JobPlan | undefined {
  const plans = jobPlans.filter((j) => j.active && j.woType === 'calibration')
  return plans.find((j) => j.assetTypeIds.includes(typeId)) ?? plans[0]
}
