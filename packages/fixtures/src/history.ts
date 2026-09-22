import type {
  AssetDocument,
  CalibrationRecord,
  CheckOutcome,
  FailureCode,
  Meter,
  MeterReading,
  Part,
  Person,
  WorkOrder,
} from '@cmms/types'
import { CALIBRATION_RESULT_LABEL, DOCUMENT_TYPE_LABEL, METER_KIND_LABEL, WO_TYPE_LABEL } from '@cmms/types'
import { worstOutcome } from './checklist'
import { nowMs } from './clock'
import { toMs } from './dates'
import { fmtNumber } from './format'
import { isDone, isFailureWork, woCost } from './wo'

export type HistoryKind = 'work_order' | 'failure' | 'part' | 'measurement' | 'cost' | 'document' | 'inspection' | 'calibration'

export const HISTORY_KIND_LABEL: Record<HistoryKind, string> = {
  work_order: 'Work order',
  failure: 'Failure',
  part: 'Part change',
  measurement: 'Measurement',
  cost: 'Cost',
  document: 'Document',
  inspection: 'Inspection',
  calibration: 'Calibration',
}

export const HISTORY_KINDS: HistoryKind[] = ['work_order', 'failure', 'part', 'measurement', 'cost', 'document', 'inspection', 'calibration']

export interface HistoryItem {
  id: string
  kind: HistoryKind
  at: number
  assetId: string
  title: string
  detail: string
  woId: string | null
  amount: number | null
  outcome: CheckOutcome | null
}

export interface HistoryInput {
  workOrders: readonly WorkOrder[]
  meters: readonly Meter[]
  meterReadings: readonly MeterReading[]
  documents: readonly AssetDocument[]
  calibrations: readonly CalibrationRecord[]
  parts: ReadonlyMap<string, Part>
  failureCodes: ReadonlyMap<string, FailureCode>
  people: ReadonlyMap<string, Person>
}

/** Everything that happened to the given assets, newest first. Pass null to include every asset. */
export function historyItems(input: HistoryInput, assetIds: ReadonlySet<string> | null, now = nowMs()): HistoryItem[] {
  const keep = (assetId: string) => !assetIds || assetIds.has(assetId)
  const items: HistoryItem[] = []
  const name = (id: string) => input.people.get(id)?.name ?? 'Unknown'
  const code = (id: string | null) => (id ? (input.failureCodes.get(id)?.name ?? '') : '')

  for (const wo of input.workOrders) {
    if (!keep(wo.assetId) || !isDone(wo) || !wo.completedAt) continue
    const at = toMs(wo.completedAt)
    const cost = woCost(wo, input.people, now).total
    const who = wo.assigneeIds.map(name).join(', ') || 'Unassigned'
    // Calibration results come from calibration records below, so calibration work shows as work.
    const kind: HistoryKind = wo.type === 'inspection' ? 'inspection' : 'work_order'
    items.push({
      id: `wo-${wo.id}`,
      kind,
      at,
      assetId: wo.assetId,
      title: `${WO_TYPE_LABEL[wo.type]}: ${wo.title}`,
      detail: `${wo.code} · ${who}`,
      woId: wo.id,
      amount: cost,
      outcome: kind === 'inspection' ? worstOutcome(wo.tasks) : null,
    })
    if (cost > 0) {
      items.push({ id: `cost-${wo.id}`, kind: 'cost', at, assetId: wo.assetId, title: wo.title, detail: wo.code, woId: wo.id, amount: cost, outcome: null })
    }
    if (isFailureWork(wo) && wo.failure?.modeId) {
      items.push({
        id: `fail-${wo.id}`,
        kind: 'failure',
        at: toMs(wo.requestedAt),
        assetId: wo.assetId,
        title: code(wo.failure.modeId),
        detail: [code(wo.failure.problemId), code(wo.failure.causeId), code(wo.failure.remedyId)].filter(Boolean).join(' → '),
        woId: wo.id,
        amount: null,
        outcome: null,
      })
    }
    for (const line of wo.parts) {
      if (line.status !== 'consumed') continue
      const part = input.parts.get(line.partId)
      items.push({
        id: `part-${wo.id}-${line.id}`,
        kind: 'part',
        at,
        assetId: wo.assetId,
        title: `${fmtNumber(line.qty)} ${part?.unit ?? ''} ${part?.name ?? 'Part'}`,
        detail: `${part?.code ?? ''} · ${wo.code}`,
        woId: wo.id,
        amount: line.qty * line.unitCost,
        outcome: null,
      })
    }
  }

  const meterById = new Map(input.meters.map((m) => [m.id, m]))
  for (const r of input.meterReadings) {
    const meter = meterById.get(r.meterId)
    if (!meter || !keep(meter.assetId)) continue
    items.push({
      id: `rd-${r.id}`,
      kind: 'measurement',
      at: toMs(r.at),
      assetId: meter.assetId,
      title: `${METER_KIND_LABEL[meter.kind]} ${fmtNumber(r.value)} ${meter.unit}`,
      detail: `Read by ${name(r.by)}`,
      woId: null,
      amount: null,
      outcome: null,
    })
  }

  for (const d of input.documents) {
    if (!keep(d.assetId)) continue
    items.push({
      id: `doc-${d.id}`,
      kind: 'document',
      at: toMs(d.uploadedAt),
      assetId: d.assetId,
      title: d.name,
      detail: `${DOCUMENT_TYPE_LABEL[d.type]} · uploaded by ${name(d.uploadedBy)}`,
      woId: null,
      amount: null,
      outcome: null,
    })
  }

  for (const c of input.calibrations) {
    if (c.target.kind !== 'asset' || !keep(c.target.id)) continue
    items.push({
      id: `cal-${c.id}`,
      kind: 'calibration',
      at: toMs(c.date),
      assetId: c.target.id,
      title: `Calibration ${CALIBRATION_RESULT_LABEL[c.result].toLowerCase()}`,
      detail: `${c.certificateNo} · ${c.performedBy}`,
      woId: null,
      amount: null,
      outcome: c.result === 'fail' ? 'fail' : 'pass',
    })
  }

  return items.sort((a, b) => b.at - a.at)
}
