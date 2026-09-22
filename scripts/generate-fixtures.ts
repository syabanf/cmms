// Seeded, deterministic fixture generator. Writes JSON into packages/fixtures/data.
// Run with: pnpm gen:fixtures
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { MaintenanceRequest, MeterReading, StockItem, StockTxn, WorkOrder } from '../packages/types/src/index.ts'
import { ACTIVE_WO_STATUSES } from '../packages/types/src/index.ts'
import { worstOutcome } from '../packages/fixtures/src/checklist.ts'
import { DAY, HOUR, MINUTE, addDays, startOfDay, startOfWeek, toIso } from '../packages/fixtures/src/dates.ts'
import { assets, bom, documents, meters } from './seed/assets.ts'
import { NOW, buildMr, buildWo } from './seed/build.ts'
import { buildRcas, currentRequests, currentWork, scriptedHistory, scriptedRequests, warrantyClaims } from './seed/current.ts'
import {
  type Generated,
  HISTORY_START,
  SUPERVISOR,
  generateCalibrations,
  generateFailures,
  generateImprovements,
  generatePmHistory,
} from './seed/history.ts'
import {
  STOCK_TARGET,
  assetTypes,
  company,
  costCenters,
  failureCodes,
  locations,
  parts,
  people,
  safetyItems,
  settings,
  sites,
  skills,
  teams,
  vendors,
  warehouses,
} from './seed/master.ts'
import { jobPlans, pmSchedules } from './seed/plans.ts'
import { rng } from './seed/rng.ts'
import { tools } from './seed/tools.ts'

const out: Generated = { wos: [], mrs: [], calibrations: [] }
generatePmHistory(out)
generateFailures(out)
generateImprovements(out)
generateCalibrations(out)
out.wos.push(...scriptedHistory, ...currentWork)
out.mrs.push(...scriptedRequests, ...currentRequests)

const failureKeysBy = (assetCode: string, modeCode: string) =>
  out.wos.filter((w) => w.asset === assetCode && w.failure?.mode === modeCode && w.status === 'closed').map((w) => w.key)
const rcas = buildRcas(failureKeysBy)

let workOrders: WorkOrder[] = out.wos.map(buildWo)

// Inspections that warned or failed raise a request that a supervisor put on watch.
const inspectionRefs = new Set(out.mrs.map((m) => m.inspectionWo).filter(Boolean))
for (const wo of workOrders) {
  if (wo.type !== 'inspection' || wo.status !== 'closed' || inspectionRefs.has(wo.id)) continue
  const worst = worstOutcome(wo.tasks)
  if (worst !== 'warning' && worst !== 'fail') continue
  const flagged = wo.tasks.filter((t) => t.result?.outcome === worst)
  const done = Date.parse(wo.completedAt!)
  const asset = assets.find((a) => a.id === wo.assetId)!
  out.mrs.push({
    key: `mr-insp-${wo.id}`,
    asset: asset.code,
    title: `Inspection ${worst}: ${flagged.map((t) => `${t.label.toLowerCase()} ${t.result?.value ?? ''}${t.unit ? ` ${t.unit}` : ''}`).join(', ')}`,
    severity: worst === 'fail' ? 'high' : 'medium',
    status: 'monitor',
    source: 'inspection',
    reportedBy: wo.assigneeIds[0]!,
    reportedAt: done + 2 * MINUTE,
    inspectionWo: wo.id,
    triageNote: 'Recheck at the next inspection.',
    triagedBy: SUPERVISOR[wo.teamId],
    triagedAt: done + HOUR,
  })
}

let requests: MaintenanceRequest[] = out.mrs.map(buildMr)

// ─── Codes ──────────────────────────────────────────────────────

const pad = (n: number, len: number) => String(n).padStart(len, '0')

workOrders.sort((a, b) => a.requestedAt.localeCompare(b.requestedAt) || a.id.localeCompare(b.id))
const woAnchor = workOrders.findIndex((w) => w.id === 'pol03-today')
const woId = new Map<string, string>()
workOrders = workOrders.map((w, i) => {
  const seq = 2819 - woAnchor + i
  const id = `wo-${pad(seq, 6)}`
  woId.set(w.id, id)
  return { ...w, id, code: `WO-${w.requestedAt.slice(0, 4)}-${pad(seq, 6)}` }
})

requests.sort((a, b) => a.reportedAt.localeCompare(b.reportedAt) || a.id.localeCompare(b.id))
const mrAnchor = requests.findIndex((r) => r.id === 'mr-pol03-today')
const mrId = new Map<string, string>()
const mrCode = new Map<string, string>()
requests = requests.map((r, i) => {
  const seq = 283 - mrAnchor + i
  const id = `mr-${pad(seq, 6)}`
  mrId.set(r.id, id)
  mrCode.set(r.id, `MR-${pad(seq, 6)}`)
  return { ...r, id, code: `MR-${pad(seq, 6)}` }
})

const mapWo = (key: string | null) => {
  if (key === null) return null
  const id = woId.get(key)
  if (!id) throw new Error(`Unknown work order key ${key}`)
  return id
}
const mapMr = (key: string | null) => {
  if (key === null) return null
  const id = mrId.get(key)
  if (!id) throw new Error(`Unknown request key ${key}`)
  return id
}

requests = requests.map((r) => ({
  ...r,
  woId: mapWo(r.woId),
  inspectionWoId: mapWo(r.inspectionWoId),
  duplicateOfId: mapMr(r.duplicateOfId),
}))
workOrders = workOrders.map((w) => ({
  ...w,
  requestId: mapMr(w.requestId),
  events: w.events.map((e) => ({ ...e, text: e.text.replace(/\{mr:([^}]+)\}/g, (_, k: string) => mrCode.get(k) ?? k) })),
}))
for (const rca of rcas) rca.woIds = rca.woIds.map((k) => mapWo(k)!)
const claims = warrantyClaims.map((c) => ({ ...c, woId: mapWo(c.woId) }))

// ─── Live state derived from open work ──────────────────────────

const active = workOrders.filter((w) => ACTIVE_WO_STATUSES.includes(w.status))
const liveAssets = assets.map((a) =>
  active.some((w) => w.assetId === a.id && w.downtime) ? { ...a, status: 'down' as const } : a,
)
const liveTools = tools.map((tool) => {
  const wo = active.find((w) => w.status === 'in_progress' && w.toolIds.includes(tool.id))
  return wo ? { ...tool, status: 'in_use' as const, holderId: wo.assigneeIds[0] ?? null, woId: wo.id } : tool
})

// ─── Stock ledger ───────────────────────────────────────────────

const partById = new Map(parts.map((p) => [p.id, p]))
type Draft = Omit<StockTxn, 'id' | 'balance'>
const drafts = new Map<string, Draft[]>()
const keyOf = (wh: string, partId: string) => `${wh}|${partId}`
const addDraft = (d: Draft) => {
  const k = keyOf(d.warehouseId, d.partId)
  drafts.set(k, [...(drafts.get(k) ?? []), d])
}

for (const wo of workOrders) {
  for (const line of wo.parts) {
    if (line.status === 'reserved') continue
    const issuedAt = Date.parse(wo.startedAt ?? wo.requestedAt) + 5 * MINUTE
    addDraft({ partId: line.partId, warehouseId: line.warehouseId, kind: 'issue', qty: -line.qty, at: toIso(issuedAt), by: 'per-sari', woId: wo.id, ref: wo.code, note: '' })
    if (line.status === 'returned') {
      addDraft({ partId: line.partId, warehouseId: line.warehouseId, kind: 'return', qty: line.qty, at: wo.completedAt ?? toIso(issuedAt + HOUR), by: wo.assigneeIds[0] ?? 'per-sari', woId: wo.id, ref: wo.code, note: 'Not used' })
    }
  }
}
const adjust = (code: string, wh: string, qty: number, date: string, note: string) =>
  addDraft({ partId: `part-${code.toLowerCase()}`, warehouseId: wh, kind: 'adjust', qty, at: `${date}T16:00:00+07:00`, by: 'per-sari', woId: null, ref: 'Cycle count', note })
adjust('GRS-EP2', 'wh-bdg-a', -1, '2026-06-30', 'Half-used tubes written off')
adjust('FUS-10A', 'wh-bdg-a', 2, '2026-03-31', 'Found in the electrical cabinet')
adjust('OIL-HYD-46', 'wh-bdg-a', -6, '2026-06-30', 'Drum residue')

let poSeq = 310
const stock: StockItem[] = []
const stockTxns: StockTxn[] = []
const BIN_BY_CATEGORY: Record<string, string> = {
  bearing: 'Rack 03',
  seal: 'Rack 04',
  belt: 'Rack 05',
  hydraulic: 'Rack 06',
  filter: 'Rack 07',
  mechanical: 'Rack 08',
  electrical: 'Rack 09',
  sensor: 'Rack 11',
  pneumatic: 'Rack 12',
  lubricant: 'Oil store',
}
const binCount = new Map<string, number>()
const binFor = (category: string, wh: string) => {
  const base = BIN_BY_CATEGORY[category] ?? 'Rack 10'
  const k = `${wh}|${base}`
  const n = binCount.get(k) ?? 0
  binCount.set(k, n + 1)
  return base === 'Oil store' ? base : `${base}-${String.fromCharCode(65 + (n % 4))}`
}

const combos = new Set<string>()
for (const [wh, targets] of Object.entries(STOCK_TARGET)) for (const code of Object.keys(targets)) combos.add(keyOf(wh, `part-${code.toLowerCase()}`))
for (const k of drafts.keys()) combos.add(k)

for (const combo of [...combos].sort()) {
  const [wh, partIdValue] = combo.split('|') as [string, string]
  const part = partById.get(partIdValue)!
  const code = part.code
  const target = STOCK_TARGET[wh]?.[code] ?? 0
  const moves = [...(drafts.get(combo) ?? [])].sort((a, b) => a.at.localeCompare(b.at))
  // Walk back from today's balance; insert receipts wherever stock would have exceeded max.
  const withReceipts: Draft[] = []
  let balance = target
  for (let i = moves.length - 1; i >= 0; i--) {
    const m = moves[i]!
    withReceipts.unshift(m)
    balance -= m.qty
    while (balance > Math.max(part.max, target)) {
      const qty = Math.max(part.reorderQty, 1)
      const at = Date.parse(m.at) - rng.int(1, 4) * DAY - rng.int(1, 6) * HOUR
      withReceipts.unshift({ partId: part.id, warehouseId: wh, kind: 'receive', qty, at: toIso(at), by: 'per-sari', woId: null, ref: `PO-2026-${pad(++poSeq, 4)}`, note: '' })
      balance -= qty
    }
  }
  const opening = Math.max(balance, 0)
  const ordered = withReceipts.sort((a, b) => a.at.localeCompare(b.at))
  const all: Draft[] = [
    { partId: part.id, warehouseId: wh, kind: 'adjust', qty: opening, at: toIso(HISTORY_START), by: 'per-sari', woId: null, ref: 'Stock take', note: 'Opening balance' },
    ...ordered,
  ]
  if (balance < 0) {
    all.splice(1, 0, { partId: part.id, warehouseId: wh, kind: 'receive', qty: -balance, at: toIso(HISTORY_START + HOUR), by: 'per-sari', woId: null, ref: `PO-2025-${pad(++poSeq, 4)}`, note: '' })
  }
  let running = 0
  all.forEach((d, i) => {
    running += d.qty
    stockTxns.push({ ...d, id: `txn-${wh.slice(3)}-${code.toLowerCase()}-${pad(i + 1, 3)}`, balance: running })
  })
  const reserved = active
    .flatMap((w) => w.parts)
    .filter((l) => l.warehouseId === wh && l.partId === part.id && l.status === 'reserved')
    .reduce((s, l) => s + l.qty, 0)
  stock.push({ id: `stk-${wh.slice(3)}-${code.toLowerCase()}`, partId: part.id, warehouseId: wh, bin: binFor(part.category, wh), onHand: running, reserved })
}
stockTxns.sort((a, b) => a.at.localeCompare(b.at) || a.id.localeCompare(b.id))

// ─── Meter readings ─────────────────────────────────────────────

const readerFor = (assetId: string) => {
  const asset = assets.find((a) => a.id === assetId)!
  if (asset.siteId === 'site-ckr') return 'per-galih'
  return asset.teamId === 'team-bdg-utl' ? 'per-taufik' : asset.teamId === 'team-bdg-elec' ? 'per-eko' : 'per-andi'
}
const meterReadings: MeterReading[] = []
for (const m of meters) {
  const today = Date.parse(m.updatedAt)
  let value = m.value
  meterReadings.push({ id: `rd-${m.id.slice(4)}-00`, meterId: m.id, value, at: m.updatedAt, by: readerFor(m.assetId) })
  let at = startOfWeek(today) + 7 * HOUR
  if (at >= today) at = addDays(at, -7)
  for (let w = 1; w <= 12; w++) {
    const days = (today - at) / DAY
    value = Math.max(0, Math.round((m.value - m.dailyRate * days * rng.float(0.94, 1.04)) * 10) / 10)
    meterReadings.push({ id: `rd-${m.id.slice(4)}-${pad(w, 2)}`, meterId: m.id, value: m.unit === 'h' ? Math.round(value) : Math.round(value), at: toIso(at), by: readerFor(m.assetId) })
    at = addDays(at, -7)
  }
}
meterReadings.sort((a, b) => a.at.localeCompare(b.at))

// ─── Write ──────────────────────────────────────────────────────

const here = dirname(fileURLToPath(import.meta.url))
const dataDir = join(here, '../packages/fixtures/data')
mkdirSync(dataDir, { recursive: true })
const files: Record<string, unknown> = {
  company,
  sites,
  locations,
  'cost-centers': costCenters,
  teams,
  skills,
  people,
  vendors,
  'asset-types': assetTypes,
  assets: liveAssets,
  meters,
  'meter-readings': meterReadings,
  documents,
  bom,
  'warranty-claims': claims,
  'failure-codes': failureCodes,
  'safety-items': safetyItems,
  'job-plans': jobPlans,
  'pm-schedules': pmSchedules,
  requests,
  'work-orders': workOrders,
  warehouses,
  parts,
  stock,
  'stock-txns': stockTxns,
  tools: liveTools,
  calibrations: out.calibrations.sort((a, b) => a.date.localeCompare(b.date)),
  rcas,
  settings,
}
let total = 0
for (const [name, value] of Object.entries(files)) {
  const json = JSON.stringify(value)
  total += json.length
  writeFileSync(join(dataDir, `${name}.json`), json)
}

const byStatus = workOrders.reduce<Record<string, number>>((acc, w) => ({ ...acc, [w.status]: (acc[w.status] ?? 0) + 1 }), {})
console.log(`work orders ${workOrders.length}`, byStatus)
console.log(`requests ${requests.length}, stock txns ${stockTxns.length}, meter readings ${meterReadings.length}, calibrations ${out.calibrations.length}`)
console.log(`anchor ${workOrders.find((w) => w.id === woId.get('pol03-today'))?.code} / ${mrCode.get('mr-pol03-today')}`)
console.log(`negative stock rows: ${stockTxns.filter((t) => t.balance < 0).length}`)
console.log(`people ${people.length}, assets ${assets.length}, parts ${parts.length}, tools ${tools.length}, job plans ${jobPlans.length}, pm ${pmSchedules.length}`)
console.log(`JSON total ${(total / 1024).toFixed(0)} KB, today ${toIso(startOfDay(NOW))}`)
