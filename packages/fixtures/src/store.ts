import type {
  Asset,
  AssetDocument,
  AssetStatus,
  AssetType,
  Attachment,
  BomLine,
  CalibrationRecord,
  Company,
  CostCenter,
  FailureCode,
  FailureReport,
  IsoDate,
  JobPlan,
  LaborEntry,
  Location,
  MaintenanceRequest,
  Meter,
  MeterReading,
  Part,
  Person,
  PmSchedule,
  Rca,
  RequestEvent,
  SafetyItem,
  Settings,
  Site,
  Skill,
  SkillLevel,
  StockItem,
  StockTxn,
  StockTxnKind,
  Team,
  TaskResult,
  Tool,
  ToolCondition,
  ToolMovement,
  ToolMovementKind,
  ToolStatus,
  Vendor,
  WaitingReason,
  Warehouse,
  WarrantyClaim,
  WoEvent,
  WoEventKind,
  WoPartLine,
  WoStatus,
  WoTask,
  WoType,
  WorkOrder,
} from '@cmms/types'
import { ACTIVE_WO_STATUSES, CHECK_OUTCOME_LABEL, WAITING_REASON_LABEL } from '@cmms/types'
import { evaluateItem, worstOutcome } from './checklist'
import { DAY, toMs } from './dates'
import { newId } from './ids'
import { nextMrCode, nextWoCode, workOrderFromPm } from './factories'
import { subtreeIds } from './org'
import { openPmWorkOrder, pmDue } from './pm'
import { approvalFor } from './wo'

export interface AppState {
  company: Company
  sites: Site[]
  locations: Location[]
  costCenters: CostCenter[]
  teams: Team[]
  skills: Skill[]
  people: Person[]
  vendors: Vendor[]
  assetTypes: AssetType[]
  assets: Asset[]
  meters: Meter[]
  meterReadings: MeterReading[]
  documents: AssetDocument[]
  bom: BomLine[]
  warrantyClaims: WarrantyClaim[]
  failureCodes: FailureCode[]
  safetyItems: SafetyItem[]
  jobPlans: JobPlan[]
  pmSchedules: PmSchedule[]
  requests: MaintenanceRequest[]
  workOrders: WorkOrder[]
  warehouses: Warehouse[]
  parts: Part[]
  stock: StockItem[]
  stockTxns: StockTxn[]
  tools: Tool[]
  toolMovements: ToolMovement[]
  calibrations: CalibrationRecord[]
  rcas: Rca[]
  settings: Settings
}

/** Who did it and when. The app provider stamps this on every dispatch. */
export interface ActionMeta {
  by: string
  at: IsoDate
}

type Upsert<K extends string, T> = { type: `${K}/upsert`; item: T } | { type: `${K}/remove`; id: string }

export type WoPatch = Partial<
  Pick<
    WorkOrder,
    | 'title'
    | 'description'
    | 'type'
    | 'priority'
    | 'assetId'
    | 'teamId'
    | 'dueAt'
    | 'scheduledAt'
    | 'estimatedMin'
    | 'execution'
    | 'vendorId'
    | 'vendorCost'
    | 'miscCost'
    | 'downtime'
    | 'requiredTools'
    | 'safety'
    | 'completionNote'
  >
>

export type AppAction =
  | Upsert<'locations', Location>
  | Upsert<'costCenters', CostCenter>
  | Upsert<'teams', Team>
  | Upsert<'skills', Skill>
  | Upsert<'assetTypes', AssetType>
  | Upsert<'failureCodes', FailureCode>
  | Upsert<'safetyItems', SafetyItem>
  | Upsert<'warehouses', Warehouse>
  | Upsert<'vendors', Vendor>
  | Upsert<'people', Person>
  | Upsert<'assets', Asset>
  | Upsert<'documents', AssetDocument>
  | Upsert<'bom', BomLine>
  | Upsert<'meters', Meter>
  | Upsert<'jobPlans', JobPlan>
  | Upsert<'pm', PmSchedule>
  | Upsert<'parts', Part>
  | Upsert<'tools', Tool>
  | Upsert<'rca', Rca>
  | { type: 'warrantyClaims/upsert'; item: WarrantyClaim }
  | { type: 'warrantyClaims/remove'; id: string }
  | { type: 'people/setSkill'; id: string; skillId: string; level: SkillLevel }
  | { type: 'settings/update'; patch: Partial<Settings> }
  | { type: 'assets/setStatus'; id: string; status: AssetStatus }
  | { type: 'meters/record'; meterId: string; value: number }
  | { type: 'requests/create'; item: MaintenanceRequest }
  | { type: 'requests/triage'; id: string; status: 'new' | 'monitor' | 'rejected' | 'duplicate'; note: string; duplicateOfId?: string | null }
  | { type: 'requests/convert'; id: string; workOrder: WorkOrder }
  | { type: 'workOrders/create'; item: WorkOrder }
  | { type: 'workOrders/update'; id: string; patch: WoPatch }
  | { type: 'workOrders/assign'; id: string; assigneeIds: string[]; teamId?: string }
  | { type: 'workOrders/schedule'; id: string; scheduledAt: IsoDate | null }
  | { type: 'workOrders/decide'; id: string; decision: 'approved' | 'rejected'; note: string }
  | { type: 'workOrders/confirmSafety'; id: string }
  | { type: 'workOrders/start'; id: string }
  | { type: 'workOrders/wait'; id: string; reason: WaitingReason; note: string }
  | { type: 'workOrders/resume'; id: string }
  | { type: 'workOrders/complete'; id: string; note: string; signature?: string | null }
  | { type: 'workOrders/verify'; id: string; note: string }
  | { type: 'workOrders/close'; id: string }
  | { type: 'workOrders/reopen'; id: string; note: string }
  | { type: 'workOrders/cancel'; id: string; note: string }
  | { type: 'workOrders/clock'; id: string; personId: string; running: boolean }
  | { type: 'workOrders/addLabor'; id: string; entry: LaborEntry }
  | { type: 'workOrders/removeLabor'; id: string; entryId: string }
  | { type: 'workOrders/recordTask'; id: string; taskId: string; value: TaskResult['value']; note?: string; photos?: string[] }
  | { type: 'workOrders/addTask'; id: string; task: WoTask }
  | { type: 'workOrders/removeTask'; id: string; taskId: string }
  | { type: 'workOrders/addPart'; id: string; partId: string; qty: number; warehouseId: string }
  | { type: 'workOrders/partStatus'; id: string; lineId: string; status: 'issued' | 'consumed' | 'returned' }
  | { type: 'workOrders/removePart'; id: string; lineId: string }
  /** `holderId` names who takes the tool; without it the acting technician or the first assignee does. */
  | { type: 'workOrders/assignTool'; id: string; toolId: string; holderId?: string }
  | { type: 'workOrders/releaseTool'; id: string; toolId: string }
  | { type: 'workOrders/setFailure'; id: string; failure: FailureReport }
  | { type: 'workOrders/comment'; id: string; text: string }
  | { type: 'workOrders/attach'; id: string; attachment: Attachment }
  | { type: 'pm/generate'; id: string; workOrder: WorkOrder }
  /** Generates a work order for every active schedule whose lead time has started. Run by the app clock. */
  | { type: 'pm/autoGenerate' }
  | { type: 'stock/move'; partId: string; warehouseId: string; kind: StockTxnKind; qty: number; ref: string; note: string }
  | { type: 'stock/setBin'; id: string; bin: string }
  | { type: 'tools/checkout'; id: string; holderId: string; woId: string | null }
  | { type: 'tools/checkin'; id: string; condition: ToolCondition; note?: string }
  | { type: 'tools/setStatus'; id: string; status: ToolStatus }
  | { type: 'calibrations/record'; item: CalibrationRecord }

export interface Envelope {
  action: AppAction
  meta: ActionMeta
}

// ─── Helpers ────────────────────────────────────────────────────

export function upsert<T extends { id: string }>(list: readonly T[], item: T): T[] {
  return list.some((x) => x.id === item.id) ? list.map((x) => (x.id === item.id ? item : x)) : [...list, item]
}
const without = <T extends { id: string }>(list: readonly T[], id: string) => list.filter((x) => x.id !== id)

const event = (meta: ActionMeta, kind: WoEventKind, text: string): WoEvent => ({
  id: newId('ev'),
  at: meta.at,
  by: meta.by,
  kind,
  text,
})

function patchWo(state: AppState, id: string, fn: (wo: WorkOrder) => WorkOrder): AppState {
  return { ...state, workOrders: state.workOrders.map((w) => (w.id === id ? fn(w) : w)) }
}

const log = (wo: WorkOrder, e: WoEvent): WorkOrder => ({ ...wo, events: [...wo.events, e] })

const partLabel = (state: AppState, partId: string, qty: number) => {
  const p = state.parts.find((x) => x.id === partId)
  return p ? `${qty} ${p.unit} ${p.code}` : `${qty} part`
}
const personName = (state: AppState, id: string) => state.people.find((p) => p.id === id)?.name ?? 'Unknown'

const requestEvent = (meta: ActionMeta, status: RequestEvent['status'], note: string): RequestEvent => ({ id: newId('re'), at: meta.at, by: meta.by, status, note })

function stockItem(state: AppState, partId: string, warehouseId: string): [AppState, StockItem] {
  const found = state.stock.find((s) => s.partId === partId && s.warehouseId === warehouseId)
  if (found) return [state, found]
  const item: StockItem = { id: newId('stk'), partId, warehouseId, bin: '', onHand: 0, reserved: 0 }
  return [{ ...state, stock: [...state.stock, item] }, item]
}

function changeReserved(state: AppState, partId: string, warehouseId: string, delta: number): AppState {
  const [s, item] = stockItem(state, partId, warehouseId)
  return { ...s, stock: s.stock.map((x) => (x.id === item.id ? { ...x, reserved: Math.max(0, x.reserved + delta) } : x)) }
}

function moveStock(
  state: AppState,
  meta: ActionMeta,
  m: { partId: string; warehouseId: string; kind: StockTxnKind; qty: number; woId: string | null; ref: string; note: string },
): AppState {
  const [s, item] = stockItem(state, m.partId, m.warehouseId)
  const onHand = item.onHand + m.qty
  const txn: StockTxn = { id: newId('txn'), ...m, balance: onHand, at: meta.at, by: meta.by }
  return {
    ...s,
    stock: s.stock.map((x) => (x.id === item.id ? { ...x, onHand } : x)),
    stockTxns: [...s.stockTxns, txn],
  }
}

function stopClocks(wo: WorkOrder, at: IsoDate): WorkOrder {
  return { ...wo, labor: wo.labor.map((e) => (e.end === null ? { ...e, end: at } : e)) }
}

function clockIn(wo: WorkOrder, personId: string, at: IsoDate): WorkOrder {
  if (wo.labor.some((e) => e.personId === personId && e.end === null)) return wo
  return { ...wo, labor: [...wo.labor, { id: newId('lab'), personId, start: at, end: null }] }
}

const isTechOn = (state: AppState, wo: WorkOrder, personId: string) =>
  wo.assigneeIds.includes(personId) && !!state.people.find((p) => p.id === personId)?.technician

/** One line in the tool movement log. Check-outs carry the new holder, returns the previous one. */
const movement = (meta: ActionMeta, tool: Tool, kind: ToolMovementKind, patch: Partial<ToolMovement> = {}): ToolMovement => ({
  id: newId('tm'),
  toolId: tool.id,
  kind,
  at: meta.at,
  by: meta.by,
  holderId: tool.holderId,
  woId: tool.woId,
  condition: null,
  note: '',
  ...patch,
})

const logMovements = (state: AppState, moves: ToolMovement[]): AppState =>
  moves.length ? { ...state, toolMovements: [...state.toolMovements, ...moves] } : state

/** Release every tool held by a work order and log the returns. */
function releaseTools(state: AppState, wo: WorkOrder, meta: ActionMeta): AppState {
  if (!wo.toolIds.length) return state
  const held = state.tools.filter((t) => wo.toolIds.includes(t.id) && t.woId === wo.id)
  return logMovements(
    { ...state, tools: state.tools.map((t) => (held.includes(t) ? { ...t, status: 'available', holderId: null, woId: null } : t)) },
    held.map((t) => movement(meta, t, 'checkin', { note: 'Released with the work order' })),
  )
}

/** Work that nobody started yet; deleting its PM schedule cancels it. */
export const UNSTARTED_WO_STATUSES: readonly WoStatus[] = ['draft', 'open', 'assigned']

function cancelWorkOrder(state: AppState, wo: WorkOrder, meta: ActionMeta, note: string): AppState {
  const [s, released] = releaseReservations(releaseTools(state, wo, meta), wo)
  const next = log(
    { ...stopClocks(released, meta.at), status: 'cancelled', waitingReason: null, toolIds: [] },
    event(meta, 'status', `Cancelled${note ? `: ${note}` : ''}`),
  )
  const after = patchWo(s, wo.id, () => next)
  return wo.downtime ? refreshAssetStatus(after, wo.assetId) : after
}

/** Drop reservations that were never issued. */
function releaseReservations(state: AppState, wo: WorkOrder): [AppState, WorkOrder] {
  let s = state
  for (const line of wo.parts) if (line.status === 'reserved') s = changeReserved(s, line.partId, line.warehouseId, -line.qty)
  return [s, { ...wo, parts: wo.parts.filter((l) => l.status !== 'reserved') }]
}

/** An asset stays down while any open downtime work order remains on it. */
function refreshAssetStatus(state: AppState, assetId: string): AppState {
  const down = state.workOrders.some((w) => w.assetId === assetId && w.downtime && ACTIVE_WO_STATUSES.includes(w.status))
  return {
    ...state,
    assets: state.assets.map((a) => {
      if (a.id !== assetId || a.status === 'retired' || a.status === 'standby') return a
      return { ...a, status: down ? 'down' : 'operational' }
    }),
  }
}

/** Shared by create, convert and PM generation: code, approval routing, reservations, first event. */
function addWorkOrder(state: AppState, input: WorkOrder, meta: ActionMeta, createdText: string): AppState {
  const rule = approvalFor(input, state.settings)
  let wo: WorkOrder = {
    ...input,
    code: input.code || nextWoCode(state.workOrders, input.requestedAt),
    status: rule ? 'draft' : input.assigneeIds.length ? 'assigned' : 'open',
    approval: rule ? { level: rule.level, status: 'pending', reason: rule.reason, decidedBy: null, decidedAt: null, note: '' } : null,
    events: [...input.events, event(meta, 'created', createdText)],
  }
  if (rule) wo = log(wo, { ...event(meta, 'approval', `${rule.level === 'manager' ? 'Manager' : 'Supervisor'} approval requested. ${rule.reason}`), by: null })
  if (wo.assigneeIds.length) wo = log(wo, event(meta, 'assigned', `Assigned to ${wo.assigneeIds.map((p) => personName(state, p)).join(', ')}`))
  let s: AppState = { ...state, workOrders: [...state.workOrders, wo] }
  for (const line of wo.parts) if (line.status === 'reserved') s = changeReserved(s, line.partId, line.warehouseId, line.qty)
  return wo.downtime ? refreshAssetStatus(s, wo.assetId) : s
}

const FOLLOW_UP_TITLE: Record<WoType, string> = {
  inspection: 'Inspection',
  preventive: 'PM check',
  calibration: 'Calibration check',
  corrective: 'Post-repair check',
  emergency: 'Post-repair check',
  improvement: 'Post-work check',
}

/** A warning or failed checklist line raises a request, so the finding gets triaged instead of buried in the job. */
function checklistFollowUp(state: AppState, wo: WorkOrder, meta: ActionMeta): AppState {
  const worst = worstOutcome(wo.tasks)
  if (worst !== 'warning' && worst !== 'fail') return state
  if (state.requests.some((r) => r.inspectionWoId === wo.id)) return state
  const flagged = wo.tasks.filter((t) => t.result?.outcome === worst)
  const code = nextMrCode(state.requests)
  const request: MaintenanceRequest = {
    id: newId('mr'),
    code,
    siteId: wo.siteId,
    assetId: wo.assetId,
    title: `${FOLLOW_UP_TITLE[wo.type]} ${CHECK_OUTCOME_LABEL[worst].toLowerCase()}: ${flagged
      .map((t) => `${t.label.toLowerCase()} ${t.result?.value ?? ''}${t.unit ? ` ${t.unit}` : ''}`)
      .join(', ')}`,
    description: `Raised automatically from ${wo.code}.`,
    severity: worst === 'fail' ? 'high' : 'medium',
    impact: 'none',
    status: 'new',
    source: wo.type === 'inspection' ? 'inspection' : 'technician',
    reportedBy: meta.by,
    reportedAt: meta.at,
    attachments: [],
    woId: null,
    duplicateOfId: null,
    inspectionWoId: wo.id,
    triageNote: '',
    triagedBy: null,
    triagedAt: null,
    events: [],
  }
  return patchWo({ ...state, requests: [...state.requests, request] }, wo.id, (w) => log(w, event(meta, 'comment', `Raised ${code} from the checklist result`)))
}

function completePm(state: AppState, wo: WorkOrder): AppState {
  if (!wo.pmScheduleId || !wo.completedAt) return state
  return {
    ...state,
    pmSchedules: state.pmSchedules.map((pm) => {
      if (pm.id !== wo.pmScheduleId) return pm
      const meterId = pm.trigger.kind === 'calendar' ? null : pm.trigger.meterId
      const meter = meterId ? state.meters.find((m) => m.id === meterId) : undefined
      return { ...pm, lastDoneAt: wo.completedAt!, lastDoneMeter: meter ? meter.value : pm.lastDoneMeter }
    }),
  }
}

// ─── Reducer ────────────────────────────────────────────────────

export function reduce(state: AppState, { action, meta }: Envelope): AppState {
  switch (action.type) {
    // master data
    case 'locations/upsert':
      return { ...state, locations: upsert(state.locations, action.item) }
    case 'locations/remove': {
      const drop = subtreeIds(state.locations, action.id)
      return { ...state, locations: state.locations.filter((l) => !drop.has(l.id)) }
    }
    case 'costCenters/upsert':
      return { ...state, costCenters: upsert(state.costCenters, action.item) }
    case 'costCenters/remove':
      return { ...state, costCenters: without(state.costCenters, action.id) }
    case 'teams/upsert':
      return { ...state, teams: upsert(state.teams, action.item) }
    case 'teams/remove':
      return { ...state, teams: without(state.teams, action.id) }
    case 'skills/upsert':
      return { ...state, skills: upsert(state.skills, action.item) }
    case 'skills/remove':
      return {
        ...state,
        skills: without(state.skills, action.id),
        people: state.people.map((p) => {
          if (!p.technician || !(action.id in p.technician.skills)) return p
          const { [action.id]: _removed, ...skills } = p.technician.skills
          return { ...p, technician: { ...p.technician, skills } }
        }),
      }
    case 'assetTypes/upsert':
      return { ...state, assetTypes: upsert(state.assetTypes, action.item) }
    case 'assetTypes/remove':
      return { ...state, assetTypes: without(state.assetTypes, action.id) }
    case 'failureCodes/upsert':
      return { ...state, failureCodes: upsert(state.failureCodes, action.item) }
    case 'failureCodes/remove':
      return { ...state, failureCodes: without(state.failureCodes, action.id) }
    case 'safetyItems/upsert':
      return { ...state, safetyItems: upsert(state.safetyItems, action.item) }
    case 'safetyItems/remove':
      return { ...state, safetyItems: without(state.safetyItems, action.id) }
    case 'warehouses/upsert':
      return { ...state, warehouses: upsert(state.warehouses, action.item) }
    case 'warehouses/remove':
      return { ...state, warehouses: without(state.warehouses, action.id), stock: state.stock.filter((s) => s.warehouseId !== action.id) }
    case 'vendors/upsert':
      return { ...state, vendors: upsert(state.vendors, action.item) }
    case 'vendors/remove':
      return {
        ...state,
        vendors: without(state.vendors, action.id),
        parts: state.parts.map((p) => (p.vendorId === action.id ? { ...p, vendorId: null } : p)),
      }
    case 'people/upsert':
      return { ...state, people: upsert(state.people, action.item) }
    case 'people/remove':
      return {
        ...state,
        people: without(state.people, action.id),
        teams: state.teams.map((t) => (t.supervisorId === action.id ? { ...t, supervisorId: null } : t)),
        workOrders: state.workOrders.map((w) =>
          ACTIVE_WO_STATUSES.includes(w.status) && w.assigneeIds.includes(action.id)
            ? { ...w, assigneeIds: w.assigneeIds.filter((p) => p !== action.id) }
            : w,
        ),
      }
    case 'people/setSkill':
      return {
        ...state,
        people: state.people.map((p) =>
          p.id === action.id && p.technician
            ? { ...p, technician: { ...p.technician, skills: { ...p.technician.skills, [action.skillId]: action.level } } }
            : p,
        ),
      }
    case 'settings/update':
      return { ...state, settings: { ...state.settings, ...action.patch } }

    // assets
    case 'assets/upsert':
      return { ...state, assets: upsert(state.assets, action.item) }
    case 'assets/remove': {
      const asset = state.assets.find((a) => a.id === action.id)
      const meterIds = new Set(state.meters.filter((m) => m.assetId === action.id).map((m) => m.id))
      return {
        ...state,
        assets: state.assets
          .filter((a) => a.id !== action.id)
          .map((a) => (a.parentId === action.id ? { ...a, parentId: asset?.parentId ?? null } : a)),
        meters: state.meters.filter((m) => !meterIds.has(m.id)),
        meterReadings: state.meterReadings.filter((r) => !meterIds.has(r.meterId)),
        documents: state.documents.filter((d) => d.assetId !== action.id),
        bom: state.bom.filter((b) => b.assetId !== action.id),
        pmSchedules: state.pmSchedules.filter((p) => p.assetId !== action.id),
      }
    }
    case 'assets/setStatus':
      return { ...state, assets: state.assets.map((a) => (a.id === action.id ? { ...a, status: action.status } : a)) }
    case 'documents/upsert':
      return { ...state, documents: upsert(state.documents, action.item) }
    case 'documents/remove':
      return { ...state, documents: without(state.documents, action.id) }
    case 'bom/upsert':
      return { ...state, bom: upsert(state.bom, action.item) }
    case 'bom/remove':
      return { ...state, bom: without(state.bom, action.id) }
    case 'meters/upsert':
      return { ...state, meters: upsert(state.meters, action.item) }
    case 'meters/remove':
      return {
        ...state,
        meters: without(state.meters, action.id),
        meterReadings: state.meterReadings.filter((r) => r.meterId !== action.id),
      }
    case 'meters/record':
      return {
        ...state,
        meters: state.meters.map((m) => (m.id === action.meterId ? { ...m, value: action.value, updatedAt: meta.at } : m)),
        meterReadings: [...state.meterReadings, { id: newId('rd'), meterId: action.meterId, value: action.value, at: meta.at, by: meta.by }],
      }
    case 'warrantyClaims/upsert':
      return { ...state, warrantyClaims: upsert(state.warrantyClaims, action.item) }
    case 'warrantyClaims/remove':
      return { ...state, warrantyClaims: without(state.warrantyClaims, action.id) }

    // requests
    case 'requests/create':
      return {
        ...state,
        requests: [...state.requests, { ...action.item, code: action.item.code || nextMrCode(state.requests) }],
      }
    case 'requests/triage':
      return {
        ...state,
        requests: state.requests.map((r) =>
          r.id === action.id
            ? {
                ...r,
                status: action.status,
                triageNote: action.note,
                duplicateOfId: action.status === 'duplicate' ? (action.duplicateOfId ?? null) : null,
                triagedBy: meta.by,
                triagedAt: meta.at,
                events: [...r.events, requestEvent(meta, action.status, action.note)],
              }
            : r,
        ),
      }
    case 'requests/convert': {
      const request = state.requests.find((r) => r.id === action.id)
      const s = addWorkOrder(state, action.workOrder, meta, `Created from ${request?.code ?? 'request'}`)
      return {
        ...s,
        requests: s.requests.map((r) =>
          r.id === action.id
            ? {
                ...r,
                status: 'converted',
                woId: action.workOrder.id,
                triageNote: '',
                triagedBy: meta.by,
                triagedAt: meta.at,
                events: [...r.events, requestEvent(meta, 'converted', '')],
              }
            : r,
        ),
      }
    }

    // work orders
    case 'workOrders/create':
      return addWorkOrder(state, action.item, meta, 'Work order created')
    case 'pm/generate': {
      const pm = state.pmSchedules.find((p) => p.id === action.id)
      return addWorkOrder(state, action.workOrder, meta, `Generated from ${pm?.code ?? 'PM schedule'}`)
    }
    case 'pm/autoGenerate': {
      const now = toMs(meta.at)
      const meters = new Map(state.meters.map((m) => [m.id, m]))
      const parts = new Map(state.parts.map((p) => [p.id, p]))
      let s = state
      for (const pm of state.pmSchedules) {
        if (!pm.active || openPmWorkOrder(pm, s.workOrders)) continue
        const due = pmDue(pm, meters, now)
        if (due.dueAt - pm.leadDays * DAY > now) continue
        const plan = s.jobPlans.find((p) => p.id === pm.jobPlanId)
        const asset = s.assets.find((a) => a.id === pm.assetId)
        const warehouse = s.warehouses.find((w) => w.siteId === pm.siteId)
        if (!plan || !asset || !warehouse) continue
        const wo = workOrderFromPm(pm, plan, asset, parts, warehouse.id, due.dueAt, s.settings, meta.by, meta.at)
        s = addWorkOrder(s, wo, meta, `Generated from ${pm.code}, ${pm.leadDays} days before it falls due`)
      }
      return s
    }
    case 'workOrders/update': {
      const before = state.workOrders.find((w) => w.id === action.id)
      const s = patchWo(state, action.id, (w) => log({ ...w, ...action.patch }, event(meta, 'edit', 'Details updated')))
      return before && (action.patch.downtime !== undefined || action.patch.assetId) ? refreshAssetStatus(refreshAssetStatus(s, before.assetId), action.patch.assetId ?? before.assetId) : s
    }
    case 'workOrders/assign':
      return patchWo(state, action.id, (w) => {
        const status = w.status === 'open' || w.status === 'assigned' ? (action.assigneeIds.length ? 'assigned' : 'open') : w.status
        const names = action.assigneeIds.map((p) => personName(state, p)).join(', ')
        return log(
          { ...w, assigneeIds: action.assigneeIds, teamId: action.teamId ?? w.teamId, status },
          event(meta, 'assigned', names ? `Assigned to ${names}` : 'Unassigned'),
        )
      })
    case 'workOrders/schedule':
      return patchWo(state, action.id, (w) =>
        log({ ...w, scheduledAt: action.scheduledAt }, event(meta, 'scheduled', action.scheduledAt ? 'Rescheduled' : 'Schedule cleared')),
      )
    case 'workOrders/decide': {
      const wo = state.workOrders.find((w) => w.id === action.id)
      if (!wo?.approval) return state
      if (action.decision === 'approved') {
        return patchWo(state, action.id, (w) =>
          log(
            {
              ...w,
              status: w.assigneeIds.length ? 'assigned' : 'open',
              approval: { ...w.approval!, status: 'approved', decidedBy: meta.by, decidedAt: meta.at, note: action.note },
            },
            event(meta, 'approval', `Approved${action.note ? `: ${action.note}` : ''}`),
          ),
        )
      }
      const [s, released] = releaseReservations(state, wo)
      return patchWo(s, action.id, () =>
        log(
          {
            ...released,
            status: 'cancelled',
            approval: { ...wo.approval!, status: 'rejected', decidedBy: meta.by, decidedAt: meta.at, note: action.note },
          },
          event(meta, 'approval', `Rejected${action.note ? `: ${action.note}` : ''}`),
        ),
      )
    }
    case 'workOrders/confirmSafety':
      return patchWo(state, action.id, (w) =>
        log(
          { ...w, safety: { ...w.safety, confirmedBy: meta.by, confirmedAt: meta.at } },
          event(meta, 'safety', w.safety.loto ? 'Safety confirmed: LOTO applied, PPE checked' : 'Safety confirmed: PPE checked'),
        ),
      )
    case 'workOrders/start': {
      const wo = state.workOrders.find((w) => w.id === action.id)
      if (!wo) return state
      const s = patchWo(state, action.id, (w) => {
        let next: WorkOrder = { ...w, status: 'in_progress', waitingReason: null, startedAt: w.startedAt ?? meta.at }
        if (isTechOn(state, w, meta.by)) next = clockIn(next, meta.by, meta.at)
        return log(next, event(meta, 'status', 'Work started'))
      })
      return wo.downtime ? refreshAssetStatus(s, wo.assetId) : s
    }
    case 'workOrders/wait':
      return patchWo(state, action.id, (w) =>
        log(
          { ...stopClocks(w, meta.at), status: 'waiting', waitingReason: action.reason },
          event(meta, 'status', `Waiting: ${WAITING_REASON_LABEL[action.reason]}${action.note ? `. ${action.note}` : ''}`),
        ),
      )
    case 'workOrders/resume':
      return patchWo(state, action.id, (w) => {
        let next: WorkOrder = { ...w, status: 'in_progress', waitingReason: null }
        if (isTechOn(state, w, meta.by)) next = clockIn(next, meta.by, meta.at)
        return log(next, event(meta, 'status', 'Work resumed'))
      })
    case 'workOrders/complete': {
      const wo = state.workOrders.find((w) => w.id === action.id)
      if (!wo) return state
      let [s, next] = releaseReservations(releaseTools(state, wo, meta), wo)
      next = stopClocks(next, meta.at)
      next = {
        ...next,
        status: 'completed',
        waitingReason: null,
        completedAt: meta.at,
        completionNote: action.note,
        signature: action.signature ?? next.signature,
        toolIds: [],
        parts: next.parts.map((l) => (l.status === 'issued' ? { ...l, status: 'consumed' } : l)),
      }
      next = log(next, event(meta, 'status', action.note ? `Marked complete: ${action.note}` : 'Marked complete'))
      s = patchWo(s, action.id, () => next)
      s = completePm(s, next)
      s = checklistFollowUp(s, next, meta)
      return wo.downtime ? refreshAssetStatus(s, wo.assetId) : s
    }
    case 'workOrders/verify':
      return patchWo(state, action.id, (w) =>
        log(
          { ...w, status: 'verified', verification: { by: meta.by, at: meta.at, note: action.note } },
          event(meta, 'status', `Verified${action.note ? `: ${action.note}` : ''}`),
        ),
      )
    case 'workOrders/close':
      return patchWo(state, action.id, (w) => log({ ...w, status: 'closed', closedAt: meta.at }, event(meta, 'status', 'Closed')))
    case 'workOrders/reopen':
      return patchWo(state, action.id, (w) =>
        log(
          { ...w, status: 'in_progress', completedAt: null, closedAt: null, verification: null },
          event(meta, 'status', `Reopened${action.note ? `: ${action.note}` : ''}`),
        ),
      )
    case 'workOrders/cancel': {
      const wo = state.workOrders.find((w) => w.id === action.id)
      return wo ? cancelWorkOrder(state, wo, meta, action.note) : state
    }
    case 'workOrders/clock':
      return patchWo(state, action.id, (w) => {
        const name = personName(state, action.personId)
        if (action.running) return log(clockIn(w, action.personId, meta.at), event(meta, 'labor', `${name} clocked in`))
        return log(
          { ...w, labor: w.labor.map((e) => (e.personId === action.personId && e.end === null ? { ...e, end: meta.at } : e)) },
          event(meta, 'labor', `${name} clocked out`),
        )
      })
    case 'workOrders/addLabor':
      return patchWo(state, action.id, (w) =>
        log({ ...w, labor: [...w.labor, action.entry] }, event(meta, 'labor', `Labor added for ${personName(state, action.entry.personId)}`)),
      )
    case 'workOrders/removeLabor':
      return patchWo(state, action.id, (w) => ({ ...w, labor: w.labor.filter((e) => e.id !== action.entryId) }))
    case 'workOrders/recordTask':
      return patchWo(state, action.id, (w) => {
        let flagged: string | null = null
        const tasks = w.tasks.map((t) => {
          if (t.id !== action.taskId) return t
          const outcome = evaluateItem(t, action.value)
          if (outcome === 'warning' || outcome === 'fail') {
            flagged = `${CHECK_OUTCOME_LABEL[outcome]}: ${t.label} ${action.value ?? ''}${t.unit ? ` ${t.unit}` : ''}`
          }
          const cleared = action.value === null || action.value === ''
          return {
            ...t,
            result: cleared
              ? null
              : { value: action.value, outcome, at: meta.at, by: meta.by, note: action.note ?? t.result?.note ?? '', photos: action.photos ?? t.result?.photos ?? [] },
          }
        })
        const next = { ...w, tasks }
        return flagged ? log(next, event(meta, 'task', flagged)) : next
      })
    case 'workOrders/addTask':
      return patchWo(state, action.id, (w) => ({ ...w, tasks: [...w.tasks, action.task] }))
    case 'workOrders/removeTask':
      return patchWo(state, action.id, (w) => ({ ...w, tasks: w.tasks.filter((t) => t.id !== action.taskId) }))
    case 'workOrders/addPart': {
      const part = state.parts.find((p) => p.id === action.partId)
      const line: WoPartLine = {
        id: newId('pl'),
        partId: action.partId,
        warehouseId: action.warehouseId,
        qty: action.qty,
        status: 'reserved',
        unitCost: part?.unitCost ?? 0,
      }
      const s = changeReserved(state, action.partId, action.warehouseId, action.qty)
      return patchWo(s, action.id, (w) => log({ ...w, parts: [...w.parts, line] }, event(meta, 'part', `Reserved ${partLabel(state, action.partId, action.qty)}`)))
    }
    case 'workOrders/partStatus': {
      const wo = state.workOrders.find((w) => w.id === action.id)
      const line = wo?.parts.find((l) => l.id === action.lineId)
      if (!wo || !line || line.status === action.status) return state
      let s = state
      const label = partLabel(state, line.partId, line.qty)
      const texts: string[] = []
      const moving = { partId: line.partId, warehouseId: line.warehouseId, woId: wo.id, ref: wo.code, note: '' }
      if (line.status === 'reserved' && (action.status === 'issued' || action.status === 'consumed')) {
        s = changeReserved(s, line.partId, line.warehouseId, -line.qty)
        s = moveStock(s, meta, { ...moving, kind: 'issue', qty: -line.qty })
        texts.push(`Issued ${label}`)
      }
      if (action.status === 'consumed') texts.push(`Used ${label}`)
      if (action.status === 'returned') {
        if (line.status === 'reserved') s = changeReserved(s, line.partId, line.warehouseId, -line.qty)
        else s = moveStock(s, meta, { ...moving, kind: 'return', qty: line.qty, note: 'Not used' })
        texts.push(`Returned ${label}`)
      }
      return patchWo(s, action.id, (w) => {
        let next: WorkOrder = { ...w, parts: w.parts.map((l) => (l.id === action.lineId ? { ...l, status: action.status } : l)) }
        for (const t of texts) next = log(next, event(meta, 'part', t))
        return next
      })
    }
    case 'workOrders/removePart': {
      const wo = state.workOrders.find((w) => w.id === action.id)
      const line = wo?.parts.find((l) => l.id === action.lineId)
      if (!wo || !line) return state
      let s = state
      if (line.status === 'reserved') s = changeReserved(s, line.partId, line.warehouseId, -line.qty)
      if (line.status === 'issued') s = moveStock(s, meta, { partId: line.partId, warehouseId: line.warehouseId, kind: 'return', qty: line.qty, woId: wo.id, ref: wo.code, note: 'Removed from work order' })
      return patchWo(s, action.id, (w) =>
        log({ ...w, parts: w.parts.filter((l) => l.id !== action.lineId) }, event(meta, 'part', `Removed ${partLabel(state, line.partId, line.qty)}`)),
      )
    }
    case 'workOrders/assignTool': {
      const wo = state.workOrders.find((w) => w.id === action.id)
      const tool = state.tools.find((t) => t.id === action.toolId)
      if (!wo || !tool || wo.toolIds.includes(tool.id)) return state
      const holder = action.holderId ?? (isTechOn(state, wo, meta.by) ? meta.by : (wo.assigneeIds[0] ?? meta.by))
      const s = logMovements(
        { ...state, tools: state.tools.map((t) => (t.id === tool.id ? { ...t, status: 'in_use', holderId: holder, woId: wo.id } : t)) },
        [movement(meta, tool, 'checkout', { holderId: holder, woId: wo.id })],
      )
      return patchWo(s, action.id, (w) => log({ ...w, toolIds: [...w.toolIds, tool.id] }, event(meta, 'tool', `Checked out ${tool.code} ${tool.name}`)))
    }
    case 'workOrders/releaseTool': {
      const tool = state.tools.find((t) => t.id === action.toolId && t.woId === action.id)
      if (!tool) return state
      const s = logMovements(
        { ...state, tools: state.tools.map((t) => (t.id === tool.id ? { ...t, status: 'available', holderId: null, woId: null } : t)) },
        [movement(meta, tool, 'checkin')],
      )
      return patchWo(s, action.id, (w) => log({ ...w, toolIds: w.toolIds.filter((id) => id !== tool.id) }, event(meta, 'tool', `Returned ${tool.code}`)))
    }
    case 'workOrders/setFailure': {
      const mode = state.failureCodes.find((f) => f.id === action.failure.modeId)?.name
      const cause = state.failureCodes.find((f) => f.id === action.failure.causeId)?.name
      return patchWo(state, action.id, (w) =>
        log(
          { ...w, failure: action.failure },
          event(meta, 'failure', mode ? `Failure coded: ${mode}${cause ? ` / ${cause}` : ''}` : 'Failure report updated'),
        ),
      )
    }
    case 'workOrders/comment':
      return patchWo(state, action.id, (w) => log(w, event(meta, 'comment', action.text)))
    case 'workOrders/attach':
      return patchWo(state, action.id, (w) =>
        log({ ...w, attachments: [...w.attachments, action.attachment] }, event(meta, 'attachment', `Added ${action.attachment.name}`)),
      )

    // PM & job plans
    case 'pm/upsert':
      return { ...state, pmSchedules: upsert(state.pmSchedules, action.item) }
    case 'pm/remove': {
      // Generated work nobody started goes with the schedule; work in progress keeps running.
      let s: AppState = { ...state, pmSchedules: without(state.pmSchedules, action.id) }
      for (const wo of state.workOrders) {
        if (wo.pmScheduleId === action.id && UNSTARTED_WO_STATUSES.includes(wo.status)) s = cancelWorkOrder(s, wo, meta, 'PM schedule deleted')
      }
      return s
    }
    case 'jobPlans/upsert':
      return { ...state, jobPlans: upsert(state.jobPlans, action.item) }
    case 'jobPlans/remove':
      return { ...state, jobPlans: without(state.jobPlans, action.id) }

    // inventory
    case 'parts/upsert':
      return { ...state, parts: upsert(state.parts, action.item) }
    case 'parts/remove':
      return {
        ...state,
        parts: without(state.parts, action.id),
        stock: state.stock.filter((s) => s.partId !== action.id),
        bom: state.bom.filter((b) => b.partId !== action.id),
        jobPlans: state.jobPlans.map((j) => ({ ...j, parts: j.parts.filter((p) => p.partId !== action.id) })),
      }
    case 'stock/move':
      return moveStock(state, meta, { partId: action.partId, warehouseId: action.warehouseId, kind: action.kind, qty: action.qty, woId: null, ref: action.ref, note: action.note })
    case 'stock/setBin':
      return { ...state, stock: state.stock.map((s) => (s.id === action.id ? { ...s, bin: action.bin } : s)) }

    // tools & calibration
    case 'tools/upsert':
      return { ...state, tools: upsert(state.tools, action.item) }
    case 'tools/remove':
      return { ...state, tools: without(state.tools, action.id) }
    case 'tools/checkout': {
      const tool = state.tools.find((t) => t.id === action.id)
      if (!tool) return state
      return logMovements(
        { ...state, tools: state.tools.map((t) => (t.id === tool.id ? { ...t, status: 'in_use', holderId: action.holderId, woId: action.woId } : t)) },
        [movement(meta, tool, 'checkout', { holderId: action.holderId, woId: action.woId })],
      )
    }
    case 'tools/checkin': {
      const tool = state.tools.find((t) => t.id === action.id)
      if (!tool) return state
      return logMovements(
        {
          ...state,
          tools: state.tools.map((t) =>
            t.id === tool.id ? { ...t, status: action.condition === 'poor' ? 'maintenance' : 'available', condition: action.condition, holderId: null, woId: null } : t,
          ),
          workOrders: state.workOrders.map((w) =>
            w.toolIds.includes(tool.id)
              ? log({ ...w, toolIds: w.toolIds.filter((id) => id !== tool.id) }, event(meta, 'tool', `Returned ${tool.code}`))
              : w,
          ),
        },
        [movement(meta, tool, 'checkin', { condition: action.condition, note: action.note ?? '' })],
      )
    }
    case 'tools/setStatus':
      return { ...state, tools: state.tools.map((t) => (t.id === action.id ? { ...t, status: action.status } : t)) }
    case 'calibrations/record': {
      const r = action.item
      const plan = (p: Asset['calibration']) => (p ? { ...p, lastAt: r.date, due: r.nextDue, vendorId: r.vendorId ?? p.vendorId } : p)
      return {
        ...state,
        calibrations: [...state.calibrations, r],
        assets: r.target.kind === 'asset' ? state.assets.map((a) => (a.id === r.target.id ? { ...a, calibration: plan(a.calibration) } : a)) : state.assets,
        tools:
          r.target.kind === 'tool'
            ? state.tools.map((t) =>
                t.id === r.target.id
                  ? { ...t, calibration: plan(t.calibration), status: r.result === 'fail' ? 'maintenance' : t.status === 'calibration' ? 'available' : t.status }
                  : t,
              )
            : state.tools,
      }
    }

    // reliability
    case 'rca/upsert':
      return { ...state, rcas: upsert(state.rcas, action.item) }
    case 'rca/remove':
      return { ...state, rcas: without(state.rcas, action.id) }
  }
}
