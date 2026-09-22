// Domain unions and their display labels. Label maps live beside the union they describe.

export type Criticality = 'A' | 'B' | 'C' | 'D'
export const CRITICALITY_LABEL: Record<Criticality, string> = {
  A: 'Critical',
  B: 'High',
  C: 'Medium',
  D: 'Low',
}
export const CRITICALITIES: Criticality[] = ['A', 'B', 'C', 'D']

export type AssetCategory = 'production' | 'utility' | 'facility' | 'instrument'
export const ASSET_CATEGORY_LABEL: Record<AssetCategory, string> = {
  production: 'Production',
  utility: 'Utility',
  facility: 'Facility',
  instrument: 'Instrument',
}

export type AssetStatus = 'operational' | 'down' | 'standby' | 'retired'
export const ASSET_STATUS_LABEL: Record<AssetStatus, string> = {
  operational: 'Operational',
  down: 'Down',
  standby: 'Standby',
  retired: 'Retired',
}

/** Icon key for an asset type; apps map it to a lucide icon. */
export type AssetIconKey =
  | 'polisher'
  | 'lathe'
  | 'mill'
  | 'press'
  | 'molding'
  | 'oven'
  | 'booth'
  | 'conveyor'
  | 'robot'
  | 'tester'
  | 'packer'
  | 'forklift'
  | 'compressor'
  | 'dryer'
  | 'panel'
  | 'genset'
  | 'chiller'
  | 'tower'
  | 'pump'
  | 'motor'
  | 'spindle'
  | 'inverter'
  | 'plc'
  | 'gauge'
  | 'thermometer'
  | 'scale'
  | 'sensor'

export type LocationKind = 'plant' | 'area' | 'line'
export const LOCATION_KIND_LABEL: Record<LocationKind, string> = {
  plant: 'Plant',
  area: 'Area',
  line: 'Line',
}

export type WoType = 'corrective' | 'preventive' | 'inspection' | 'emergency' | 'improvement' | 'calibration'
export const WO_TYPE_LABEL: Record<WoType, string> = {
  corrective: 'Corrective',
  preventive: 'Preventive',
  inspection: 'Inspection',
  emergency: 'Emergency',
  improvement: 'Improvement',
  calibration: 'Calibration',
}
export const WO_TYPES: WoType[] = ['corrective', 'preventive', 'inspection', 'emergency', 'improvement', 'calibration']
/** Planned work, as opposed to reactive work (corrective, emergency). */
export const PLANNED_WO_TYPES: WoType[] = ['preventive', 'inspection', 'calibration', 'improvement']
/** Work types that record a failure and count toward MTBF / MTTR. */
export const FAILURE_WO_TYPES: WoType[] = ['corrective', 'emergency']

export type WoStatus =
  | 'draft'
  | 'open'
  | 'assigned'
  | 'in_progress'
  | 'waiting'
  | 'completed'
  | 'verified'
  | 'closed'
  | 'cancelled'
export const WO_STATUS_LABEL: Record<WoStatus, string> = {
  draft: 'Draft',
  open: 'Open',
  assigned: 'Assigned',
  in_progress: 'In progress',
  waiting: 'Waiting',
  completed: 'Completed',
  verified: 'Verified',
  closed: 'Closed',
  cancelled: 'Cancelled',
}
/** The happy path, in order. Cancelled sits outside the flow. */
export const WO_STATUS_FLOW: WoStatus[] = [
  'draft',
  'open',
  'assigned',
  'in_progress',
  'waiting',
  'completed',
  'verified',
  'closed',
]
/** Work that still needs hands on it: the backlog. */
export const ACTIVE_WO_STATUSES: WoStatus[] = ['draft', 'open', 'assigned', 'in_progress', 'waiting']
/** Work done by the technician and waiting for supervisor sign-off. */
export const REVIEW_WO_STATUSES: WoStatus[] = ['completed', 'verified']
export const DONE_WO_STATUSES: WoStatus[] = ['completed', 'verified', 'closed']

export type WaitingReason =
  | 'spare_part'
  | 'vendor'
  | 'production'
  | 'approval'
  | 'tool'
  | 'material'
  | 'external_service'
export const WAITING_REASON_LABEL: Record<WaitingReason, string> = {
  spare_part: 'Spare part',
  vendor: 'Vendor',
  production: 'Production window',
  approval: 'Approval',
  tool: 'Tool',
  material: 'Material',
  external_service: 'External service',
}
export const WAITING_REASONS: WaitingReason[] = [
  'spare_part',
  'vendor',
  'production',
  'approval',
  'tool',
  'material',
  'external_service',
]

export type Priority = 'P1' | 'P2' | 'P3' | 'P4'
export const PRIORITY_LABEL: Record<Priority, string> = {
  P1: 'Emergency',
  P2: 'High',
  P3: 'Normal',
  P4: 'Low',
}
export const PRIORITY_HINT: Record<Priority, string> = {
  P1: 'Safety impact or production stopped',
  P2: 'Production affected or breakdown likely',
  P3: 'Repair needed, little production impact',
  P4: 'Cosmetic or minor improvement',
}
export const PRIORITIES: Priority[] = ['P1', 'P2', 'P3', 'P4']

export type Severity = 'low' | 'medium' | 'high' | 'critical'
export const SEVERITY_LABEL: Record<Severity, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  critical: 'Critical',
}
export const SEVERITIES: Severity[] = ['low', 'medium', 'high', 'critical']

export type OperationalImpact = 'none' | 'reduced' | 'stopped'
export const IMPACT_LABEL: Record<OperationalImpact, string> = {
  none: 'No impact',
  reduced: 'Output reduced',
  stopped: 'Production stopped',
}

export type RequestStatus = 'new' | 'monitor' | 'converted' | 'rejected' | 'duplicate'
export const REQUEST_STATUS_LABEL: Record<RequestStatus, string> = {
  new: 'New',
  monitor: 'Monitoring',
  converted: 'Converted',
  rejected: 'Rejected',
  duplicate: 'Duplicate',
}

export type RequestSource = 'operator' | 'inspection' | 'technician'
export const REQUEST_SOURCE_LABEL: Record<RequestSource, string> = {
  operator: 'Operator',
  inspection: 'Inspection',
  technician: 'Technician',
}

export type ExecutionType = 'internal' | 'vendor' | 'mixed'
export const EXECUTION_LABEL: Record<ExecutionType, string> = {
  internal: 'Internal',
  vendor: 'External vendor',
  mixed: 'Mixed',
}

export type FieldType = 'check' | 'number' | 'text' | 'passfail' | 'choice' | 'measurement' | 'photo' | 'signature'
export const FIELD_TYPE_LABEL: Record<FieldType, string> = {
  check: 'Boolean',
  number: 'Number',
  text: 'Text',
  passfail: 'Pass / Fail',
  choice: 'Multiple choice',
  measurement: 'Measurement',
  photo: 'Photo',
  signature: 'Signature',
}
export const FIELD_TYPES: FieldType[] = [
  'check',
  'number',
  'text',
  'passfail',
  'choice',
  'measurement',
  'photo',
  'signature',
]

export type CheckOutcome = 'pass' | 'warning' | 'fail'
export const CHECK_OUTCOME_LABEL: Record<CheckOutcome, string> = {
  pass: 'Pass',
  warning: 'Warning',
  fail: 'Fail',
}

export type IntervalUnit = 'day' | 'week' | 'month' | 'year'
export const INTERVAL_UNIT_LABEL: Record<IntervalUnit, string> = {
  day: 'days',
  week: 'weeks',
  month: 'months',
  year: 'years',
}

export type MeterKind = 'runtime' | 'cycle' | 'distance' | 'energy'
export const METER_KIND_LABEL: Record<MeterKind, string> = {
  runtime: 'Runtime',
  cycle: 'Cycles',
  distance: 'Distance',
  energy: 'Energy',
}

export type PmTriggerKind = 'calendar' | 'meter' | 'combined'
export const PM_TRIGGER_LABEL: Record<PmTriggerKind, string> = {
  calendar: 'Calendar',
  meter: 'Meter',
  combined: 'Whichever first',
}

export type PartCategory =
  | 'bearing'
  | 'seal'
  | 'belt'
  | 'filter'
  | 'electrical'
  | 'lubricant'
  | 'pneumatic'
  | 'hydraulic'
  | 'sensor'
  | 'mechanical'
export const PART_CATEGORY_LABEL: Record<PartCategory, string> = {
  bearing: 'Bearing',
  seal: 'Seal',
  belt: 'Belt & chain',
  filter: 'Filter',
  electrical: 'Electrical',
  lubricant: 'Lubricant',
  pneumatic: 'Pneumatic',
  hydraulic: 'Hydraulic',
  sensor: 'Sensor',
  mechanical: 'Mechanical',
}

export type PartLineStatus = 'reserved' | 'issued' | 'consumed' | 'returned'
export const PART_LINE_STATUS_LABEL: Record<PartLineStatus, string> = {
  reserved: 'Reserved',
  issued: 'Issued',
  consumed: 'Consumed',
  returned: 'Returned',
}

export type StockTxnKind = 'receive' | 'issue' | 'return' | 'adjust'
export const STOCK_TXN_LABEL: Record<StockTxnKind, string> = {
  receive: 'Received',
  issue: 'Issued',
  return: 'Returned',
  adjust: 'Adjusted',
}

export type ToolStatus = 'available' | 'in_use' | 'maintenance' | 'lost'
export const TOOL_STATUS_LABEL: Record<ToolStatus, string> = {
  available: 'Available',
  in_use: 'In use',
  maintenance: 'In repair',
  lost: 'Missing',
}

export type ToolCondition = 'good' | 'fair' | 'poor'
export const TOOL_CONDITION_LABEL: Record<ToolCondition, string> = {
  good: 'Good',
  fair: 'Fair',
  poor: 'Poor',
}

/** Derived from a calibration plan and the current date. */
export type CalibrationState = 'valid' | 'expiring' | 'expired'
export const CALIBRATION_STATE_LABEL: Record<CalibrationState, string> = {
  valid: 'Valid',
  expiring: 'Expiring',
  expired: 'Expired',
}

export type CalibrationResult = 'pass' | 'adjusted' | 'fail'
export const CALIBRATION_RESULT_LABEL: Record<CalibrationResult, string> = {
  pass: 'Pass',
  adjusted: 'Pass after adjustment',
  fail: 'Fail',
}

export type SkillLevel = 0 | 1 | 2 | 3
export const SKILL_LEVEL_LABEL: Record<SkillLevel, string> = {
  0: 'None',
  1: 'L1 Basic',
  2: 'L2 Independent',
  3: 'L3 Expert',
}

export type Shift = 'A' | 'B' | 'C' | 'N'
export const SHIFT_LABEL: Record<Shift, string> = {
  A: 'Shift A · 07:00-15:00',
  B: 'Shift B · 15:00-23:00',
  C: 'Shift C · 23:00-07:00',
  N: 'Non-shift · 08:00-17:00',
}

export type Availability = 'on_shift' | 'off_shift' | 'leave'
export const AVAILABILITY_LABEL: Record<Availability, string> = {
  on_shift: 'On shift',
  off_shift: 'Off shift',
  leave: 'On leave',
}

export type Role =
  | 'manager'
  | 'planner'
  | 'supervisor'
  | 'technician'
  | 'warehouse'
  | 'requester'
  | 'admin'
  | 'viewer'
export const ROLE_LABEL: Record<Role, string> = {
  manager: 'Maintenance Manager',
  planner: 'Planner',
  supervisor: 'Supervisor',
  technician: 'Technician',
  warehouse: 'Warehouse',
  requester: 'Requester',
  admin: 'Administrator',
  viewer: 'Viewer',
}
export const ROLES: Role[] = [
  'manager',
  'planner',
  'supervisor',
  'technician',
  'warehouse',
  'requester',
  'admin',
  'viewer',
]

export type RcaStatus = 'open' | 'analysis' | 'actions' | 'closed'
export const RCA_STATUS_LABEL: Record<RcaStatus, string> = {
  open: 'Open',
  analysis: 'Analysis',
  actions: 'Actions running',
  closed: 'Closed',
}
export const RCA_STATUS_FLOW: RcaStatus[] = ['open', 'analysis', 'actions', 'closed']

export type RcaTrigger = 'repeat' | 'critical' | 'high_cost' | 'safety' | 'chronic'
export const RCA_TRIGGER_LABEL: Record<RcaTrigger, string> = {
  repeat: 'Repeat failure',
  critical: 'Critical failure',
  high_cost: 'High-cost failure',
  safety: 'Safety failure',
  chronic: 'Chronic issue',
}

export type CapaKind = 'corrective' | 'preventive'
export const CAPA_KIND_LABEL: Record<CapaKind, string> = {
  corrective: 'Corrective action',
  preventive: 'Preventive action',
}

export type FishboneCategory = 'man' | 'machine' | 'method' | 'material' | 'measurement' | 'environment'
export const FISHBONE_LABEL: Record<FishboneCategory, string> = {
  man: 'Man',
  machine: 'Machine',
  method: 'Method',
  material: 'Material',
  measurement: 'Measurement',
  environment: 'Environment',
}
export const FISHBONE_CATEGORIES: FishboneCategory[] = [
  'man',
  'machine',
  'method',
  'material',
  'measurement',
  'environment',
]

export type FailureCodeKind = 'problem' | 'mode' | 'cause' | 'remedy'
export const FAILURE_CODE_KIND_LABEL: Record<FailureCodeKind, string> = {
  problem: 'Problem',
  mode: 'Failure mode',
  cause: 'Cause',
  remedy: 'Remedy',
}
export const FAILURE_CODE_KINDS: FailureCodeKind[] = ['problem', 'mode', 'cause', 'remedy']

export type SafetyKind = 'hazard' | 'ppe'
export const SAFETY_KIND_LABEL: Record<SafetyKind, string> = {
  hazard: 'Hazard',
  ppe: 'PPE',
}

export type DocumentType =
  | 'manual'
  | 'drawing'
  | 'electrical'
  | 'pneumatic'
  | 'datasheet'
  | 'sop'
  | 'plc_backup'
  | 'photo'
  | 'video'
  | 'warranty'
  | 'certificate'
  | 'inspection_sheet'
  | 'vendor_report'
  | 'service_report'
export const DOCUMENT_TYPE_LABEL: Record<DocumentType, string> = {
  manual: 'Manual',
  drawing: 'Drawing',
  electrical: 'Electrical diagram',
  pneumatic: 'Pneumatic diagram',
  datasheet: 'Datasheet',
  sop: 'SOP',
  plc_backup: 'PLC backup',
  photo: 'Photo',
  video: 'Video',
  warranty: 'Warranty document',
  certificate: 'Certificate',
  inspection_sheet: 'Inspection sheet',
  vendor_report: 'Vendor report',
  service_report: 'Service report',
}

export type AttachmentKind = 'photo' | 'video' | 'document'

export type WarrantyClaimStatus = 'submitted' | 'approved' | 'rejected'
export const WARRANTY_CLAIM_STATUS_LABEL: Record<WarrantyClaimStatus, string> = {
  submitted: 'Submitted',
  approved: 'Approved',
  rejected: 'Rejected',
}

export type ApprovalLevel = 'supervisor' | 'manager'
export const APPROVAL_LEVEL_LABEL: Record<ApprovalLevel, string> = {
  supervisor: 'Supervisor approval',
  manager: 'Manager approval',
}
export type ApprovalStatus = 'pending' | 'approved' | 'rejected'
export const APPROVAL_STATUS_LABEL: Record<ApprovalStatus, string> = {
  pending: 'Pending',
  approved: 'Approved',
  rejected: 'Rejected',
}
/** How a priority is handled when a work order is submitted. */
export type ApprovalRule = 'auto' | ApprovalLevel

export type NotificationEvent =
  | 'pm_due_tomorrow'
  | 'pm_overdue'
  | 'critical_wo_created'
  | 'wo_sla_exceeded'
  | 'part_below_min'
  | 'calibration_expiring'
  | 'warranty_expiring'
  | 'repeat_failure'
  | 'approval_required'
export const NOTIFICATION_EVENT_LABEL: Record<NotificationEvent, string> = {
  pm_due_tomorrow: 'PM due tomorrow',
  pm_overdue: 'PM overdue',
  critical_wo_created: 'Critical work order created',
  wo_sla_exceeded: 'Work order SLA exceeded',
  part_below_min: 'Spare part below minimum',
  calibration_expiring: 'Calibration expiring',
  warranty_expiring: 'Warranty expiring',
  repeat_failure: 'Repeat failure detected',
  approval_required: 'Approval required',
}
export const NOTIFICATION_EVENTS: NotificationEvent[] = [
  'pm_due_tomorrow',
  'pm_overdue',
  'critical_wo_created',
  'wo_sla_exceeded',
  'part_below_min',
  'calibration_expiring',
  'warranty_expiring',
  'repeat_failure',
  'approval_required',
]

export type NotificationChannel = 'in_app' | 'email' | 'whatsapp' | 'push'
export const NOTIFICATION_CHANNEL_LABEL: Record<NotificationChannel, string> = {
  in_app: 'In-app',
  email: 'Email',
  whatsapp: 'WhatsApp',
  push: 'Push',
}
export const NOTIFICATION_CHANNELS: NotificationChannel[] = ['in_app', 'email', 'whatsapp', 'push']

export type WoEventKind =
  | 'created'
  | 'status'
  | 'assigned'
  | 'scheduled'
  | 'labor'
  | 'part'
  | 'tool'
  | 'task'
  | 'failure'
  | 'comment'
  | 'approval'
  | 'attachment'
  | 'safety'
  | 'edit'
