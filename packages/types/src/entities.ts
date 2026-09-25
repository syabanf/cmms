import type {
  ApprovalLevel,
  ApprovalRule,
  ApprovalStatus,
  AssetCategory,
  AssetIconKey,
  AssetStatus,
  AttachmentKind,
  AttachmentStage,
  Availability,
  CalibrationResult,
  CapaKind,
  CheckOutcome,
  Criticality,
  DocumentType,
  ExecutionType,
  FailureCodeKind,
  FieldType,
  FishboneCategory,
  IntervalUnit,
  LocationKind,
  MeterKind,
  NotificationChannel,
  NotificationEvent,
  OperationalImpact,
  PartCategory,
  PartLineStatus,
  Priority,
  RcaStatus,
  RcaTrigger,
  RequestSource,
  RequestStatus,
  Role,
  SafetyKind,
  Severity,
  Shift,
  SkillLevel,
  StockTxnKind,
  ToolCondition,
  ToolMovementKind,
  ToolStatus,
  WaitingReason,
  WarrantyClaimStatus,
  WoEventKind,
  WoStatus,
  WoType,
} from './enums'

/** ISO 8601 timestamp with offset, e.g. 2026-09-22T08:12:00+07:00 */
export type IsoDate = string

// ─── Organization ───────────────────────────────────────────────

export interface Company {
  id: string
  name: string
}

export interface Site {
  id: string
  code: string
  name: string
  city: string
}

/** Plant, area or line inside a site. Assets hang off any location. */
export interface Location {
  id: string
  siteId: string
  parentId: string | null
  kind: LocationKind
  code: string
  name: string
}

export interface CostCenter {
  id: string
  siteId: string
  code: string
  name: string
}

export interface Team {
  id: string
  siteId: string
  name: string
  supervisorId: string | null
}

export interface Skill {
  id: string
  name: string
}

// ─── People ─────────────────────────────────────────────────────

export interface Certification {
  id: string
  name: string
  issuer: string
  issuedAt: IsoDate
  expiresAt: IsoDate | null
}

export interface TechnicianProfile {
  teamId: string
  shift: Shift
  hourlyCost: number
  /** skillId → level */
  skills: Record<string, SkillLevel>
  certifications: Certification[]
  /** Work permits the person may sign for, e.g. LOTO, hot work. */
  authorizations: string[]
  availability: Availability
}

export interface Person {
  id: string
  name: string
  title: string
  role: Role
  email: string
  phone: string
  /** Avatar background, any CSS colour. */
  color: string
  siteIds: string[]
  technician: TechnicianProfile | null
}

export interface Vendor {
  id: string
  name: string
  serviceTypes: string[]
  pic: string
  phone: string
  email: string
  contractNo: string
  contractStart: IsoDate
  contractEnd: IsoDate
  slaHours: number
  hourlyRate: number
  /** 1 to 5 */
  rating: number
}

// ─── Assets ─────────────────────────────────────────────────────

export interface AssetType {
  id: string
  name: string
  category: AssetCategory
  icon: AssetIconKey
  /** Starting criticality scores for a new asset of this type; null when the type sets none. */
  defaultScores: CriticalityScores | null
}

/** Each factor scores 1 (low) to 5 (high). Redundancy scores high when no backup exists. */
export interface CriticalityScores {
  production: number
  safety: number
  quality: number
  replacementCost: number
  redundancy: number
}

export interface Warranty {
  vendorId: string | null
  start: IsoDate
  end: IsoDate
  terms: string
}

/** Shared by instruments (assets) and tools that need periodic calibration. */
export interface CalibrationPlan {
  intervalMonths: number
  lastAt: IsoDate | null
  due: IsoDate
  vendorId: string | null
}

export interface AssetSpec {
  label: string
  value: string
}

export interface Asset {
  id: string
  code: string
  name: string
  siteId: string
  locationId: string
  /** Set for components that belong to a machine. */
  parentId: string | null
  typeId: string
  manufacturer: string
  model: string
  serialNumber: string
  installedAt: IsoDate
  criticality: Criticality
  scores: CriticalityScores
  costCenterId: string
  teamId: string
  status: AssetStatus
  warranty: Warranty | null
  calibration: CalibrationPlan | null
  specs: AssetSpec[]
  notes: string
}

export interface Meter {
  id: string
  assetId: string
  kind: MeterKind
  unit: string
  value: number
  /** Average increase per day, used to project meter-based PM. */
  dailyRate: number
  updatedAt: IsoDate
}

export interface MeterReading {
  id: string
  meterId: string
  value: number
  at: IsoDate
  by: string
}

export interface AssetDocument {
  id: string
  assetId: string
  type: DocumentType
  name: string
  fileName: string
  sizeKb: number
  uploadedAt: IsoDate
  uploadedBy: string
}

export interface BomLine {
  id: string
  assetId: string
  partId: string
  qty: number
  /** Sub-assembly the part belongs to, e.g. "Motor". */
  component: string
}

export interface WarrantyClaim {
  id: string
  assetId: string
  vendorId: string | null
  woId: string | null
  date: IsoDate
  status: WarrantyClaimStatus
  description: string
  amount: number
}

// ─── Master data ────────────────────────────────────────────────

export interface FailureCode {
  id: string
  kind: FailureCodeKind
  code: string
  name: string
}

export interface SafetyItem {
  id: string
  kind: SafetyKind
  name: string
}

export interface SafetyRequirement {
  loto: boolean
  /** Isolation points to lock and tag (safety items of kind loto). */
  lotoIds: string[]
  /** Permits the technician must hold (safety items of kind permit). */
  permitIds: string[]
  ppeIds: string[]
  hazardIds: string[]
  notes: string
}

// ─── Job plans & PM ─────────────────────────────────────────────

/** One checklist line. Measurement fields carry limits; values outside min/max fail, outside warn* warn. */
export interface ChecklistItem {
  id: string
  label: string
  type: FieldType
  required: boolean
  unit?: string
  min?: number | null
  max?: number | null
  warnMin?: number | null
  warnMax?: number | null
  options?: string[]
  help?: string
}

export interface JobPlanPart {
  partId: string
  qty: number
}

export interface JobPlan {
  id: string
  code: string
  name: string
  description: string
  woType: WoType
  assetTypeIds: string[]
  durationMin: number
  skillId: string
  skillLevel: 1 | 2 | 3
  personnel: number
  /** Tool categories, e.g. "Torque wrench". Instances get assigned on the work order. */
  toolCategories: string[]
  parts: JobPlanPart[]
  safety: SafetyRequirement
  tasks: ChecklistItem[]
  acceptance: string
  sop: string
  revision: number
  updatedAt: IsoDate
  active: boolean
}

export type PmTrigger =
  | { kind: 'calendar'; every: number; unit: IntervalUnit }
  | { kind: 'meter'; meterId: string; every: number }
  | { kind: 'combined'; every: number; unit: IntervalUnit; meterId: string; meterEvery: number }

export interface PmSchedule {
  id: string
  code: string
  name: string
  siteId: string
  assetId: string
  jobPlanId: string
  trigger: PmTrigger
  lastDoneAt: IsoDate
  /** Meter value when the last PM was done; null for calendar-only triggers. */
  lastDoneMeter: number | null
  /** Generate the work order this many days before it falls due. */
  leadDays: number
  teamId: string
  assigneeId: string | null
  active: boolean
}

// ─── Requests & work orders ─────────────────────────────────────

export interface Attachment {
  id: string
  kind: AttachmentKind
  name: string
  /** Object URL for files added in this session; null for seeded placeholders. */
  url: string | null
  /** Before or after the work; null for documents and photos taken during it. */
  stage: AttachmentStage | null
  at: IsoDate
  by: string
}

/** One triage decision on a request, oldest first. */
export interface RequestEvent {
  id: string
  at: IsoDate
  by: string
  /** The status the decision moved the request to. */
  status: RequestStatus
  note: string
}

export interface MaintenanceRequest {
  id: string
  code: string
  siteId: string
  assetId: string
  title: string
  description: string
  severity: Severity
  impact: OperationalImpact
  status: RequestStatus
  source: RequestSource
  reportedBy: string
  reportedAt: IsoDate
  attachments: Attachment[]
  woId: string | null
  duplicateOfId: string | null
  /** Work order whose checklist raised the request; inspections set the source to inspection. */
  inspectionWoId: string | null
  /** The latest decision, kept for quick reads; `events` holds all of them. */
  triageNote: string
  triagedBy: string | null
  triagedAt: IsoDate | null
  events: RequestEvent[]
}

export interface TaskResult {
  value: boolean | number | string | null
  outcome: CheckOutcome | null
  at: IsoDate
  by: string
  note: string
  photos: string[]
}

export interface WoTask extends ChecklistItem {
  result: TaskResult | null
}

export interface LaborEntry {
  id: string
  personId: string
  start: IsoDate
  /** null while the clock is running */
  end: IsoDate | null
}

export interface WoPartLine {
  id: string
  partId: string
  warehouseId: string
  qty: number
  status: PartLineStatus
  unitCost: number
}

export interface FailureReport {
  problemId: string | null
  modeId: string | null
  causeId: string | null
  remedyId: string | null
  note: string
}

export interface Approval {
  level: ApprovalLevel
  status: ApprovalStatus
  /** The rule that asked for approval, in plain words. */
  reason: string
  decidedBy: string | null
  decidedAt: IsoDate | null
  note: string
}

export interface Verification {
  by: string
  at: IsoDate
  note: string
}

export interface WoEvent {
  id: string
  at: IsoDate
  by: string | null
  kind: WoEventKind
  text: string
}

export interface WoSafety extends SafetyRequirement {
  confirmedBy: string | null
  confirmedAt: IsoDate | null
}

export interface WorkOrder {
  id: string
  code: string
  siteId: string
  assetId: string
  title: string
  description: string
  type: WoType
  priority: Priority
  status: WoStatus
  waitingReason: WaitingReason | null
  requestId: string | null
  pmScheduleId: string | null
  jobPlanId: string | null
  teamId: string
  assigneeIds: string[]
  requestedBy: string
  requestedAt: IsoDate
  scheduledAt: IsoDate | null
  dueAt: IsoDate
  startedAt: IsoDate | null
  completedAt: IsoDate | null
  closedAt: IsoDate | null
  estimatedMin: number
  execution: ExecutionType
  vendorId: string | null
  /** Production stopped while the work was open. */
  downtime: boolean
  safety: WoSafety
  tasks: WoTask[]
  labor: LaborEntry[]
  parts: WoPartLine[]
  requiredTools: string[]
  toolIds: string[]
  failure: FailureReport | null
  vendorCost: number
  miscCost: number
  approval: Approval | null
  verification: Verification | null
  attachments: Attachment[]
  events: WoEvent[]
  /** Technician sign-off, as a data URL. */
  signature: string | null
  completionNote: string
}

// ─── Inventory & tools ──────────────────────────────────────────

export interface Warehouse {
  id: string
  siteId: string
  code: string
  name: string
}

export interface Part {
  id: string
  code: string
  name: string
  category: PartCategory
  unit: string
  unitCost: number
  min: number
  max: number
  reorderQty: number
  leadTimeDays: number
  vendorId: string | null
  manufacturer: string
  spec: string
  /** Critical spares are held even when consumption is low. */
  critical: boolean
}

/** Stock of one part in one warehouse. */
export interface StockItem {
  id: string
  partId: string
  warehouseId: string
  bin: string
  onHand: number
  reserved: number
}

export interface StockTxn {
  id: string
  partId: string
  warehouseId: string
  kind: StockTxnKind
  /** Signed quantity: positive adds to stock, negative removes. */
  qty: number
  /** On-hand balance after the transaction. */
  balance: number
  at: IsoDate
  by: string
  woId: string | null
  ref: string
  note: string
}

export interface Tool {
  id: string
  code: string
  name: string
  category: string
  siteId: string
  location: string
  serialNumber: string
  status: ToolStatus
  condition: ToolCondition
  calibration: CalibrationPlan | null
  holderId: string | null
  woId: string | null
}

/** One check-out or return of a tool. The tool's own status shows where it is right now. */
export interface ToolMovement {
  id: string
  toolId: string
  kind: ToolMovementKind
  at: IsoDate
  by: string
  holderId: string | null
  woId: string | null
  /** Condition noted on return; null on check-out. */
  condition: ToolCondition | null
  note: string
}

export interface CalibrationRecord {
  id: string
  target: { kind: 'asset' | 'tool'; id: string }
  date: IsoDate
  vendorId: string | null
  performedBy: string
  certificateNo: string
  result: CalibrationResult
  nextDue: IsoDate
  notes: string
}

// ─── Reliability ────────────────────────────────────────────────

export interface CapaAction {
  id: string
  kind: CapaKind
  text: string
  ownerId: string
  dueAt: IsoDate
  status: 'open' | 'done'
  doneAt: IsoDate | null
}

export interface Rca {
  id: string
  code: string
  siteId: string
  title: string
  assetId: string
  modeId: string | null
  trigger: RcaTrigger
  status: RcaStatus
  ownerId: string
  createdAt: IsoDate
  dueAt: IsoDate
  closedAt: IsoDate | null
  woIds: string[]
  problem: string
  whys: string[]
  rootCause: string
  fishbone: Record<FishboneCategory, string[]>
  actions: CapaAction[]
}

// ─── Settings ───────────────────────────────────────────────────

export interface NotificationRule {
  event: NotificationEvent
  channels: Record<NotificationChannel, boolean>
  roles: Role[]
}

export interface Settings {
  slaHours: Record<Priority, number>
  approvalByPriority: Record<Priority, ApprovalRule>
  /** Estimated cost above this needs manager approval. */
  managerApprovalAbove: number
  /** Completed work on assets of these classes needs supervisor verification. */
  verifyCriticalities: Criticality[]
  repeatWindowDays: number
  /** Share of paid hours spent on hands-on work, 0 to 1. */
  wrenchTime: number
  weeklyHours: number
  notificationRules: NotificationRule[]
}
