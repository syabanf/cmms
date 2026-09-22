import type { Permission } from '@cmms/fixtures'
import type {
  ApprovalRule,
  Criticality,
  NotificationEvent,
  NotificationRule,
  Priority,
  Settings,
} from '@cmms/types'
import { CRITICALITIES, NOTIFICATION_EVENTS, PRIORITIES, ROLES } from '@cmms/types'

// ─── Roles and permissions ──────────────────────────────────────

export const PERMISSION_GROUPS = [
  'Requests',
  'Work orders',
  'Planning',
  'Assets',
  'Inventory',
  'Reliability',
  'Administration',
] as const
type PermissionGroup = (typeof PERMISSION_GROUPS)[number]

/** Matrix group and readable label for every permission. */
const PERMISSION_INFO: Record<Permission, { group: PermissionGroup; label: string }> = {
  'request.create': { group: 'Requests', label: 'Report problems' },
  'request.triage': { group: 'Requests', label: 'Triage requests' },
  'wo.create': { group: 'Work orders', label: 'Create work orders' },
  'wo.edit': { group: 'Work orders', label: 'Edit work orders' },
  'wo.assign': { group: 'Work orders', label: 'Assign technicians' },
  'wo.execute': { group: 'Work orders', label: 'Carry out work' },
  'wo.approve': { group: 'Work orders', label: 'Approve work orders' },
  'wo.verify': { group: 'Work orders', label: 'Verify completed work' },
  'wo.close': { group: 'Work orders', label: 'Close work orders' },
  'pm.manage': { group: 'Planning', label: 'Manage PM schedules' },
  'jobplan.manage': { group: 'Planning', label: 'Manage job plans' },
  'asset.manage': { group: 'Assets', label: 'Manage assets' },
  'calibration.record': { group: 'Assets', label: 'Record calibrations' },
  'inventory.issue': { group: 'Inventory', label: 'Issue and return parts' },
  'inventory.manage': { group: 'Inventory', label: 'Manage parts and stock' },
  'tool.manage': { group: 'Inventory', label: 'Manage tools' },
  'rca.manage': { group: 'Reliability', label: 'Run root cause analysis' },
  'people.manage': { group: 'Administration', label: 'Manage technicians' },
  'masterdata.manage': { group: 'Administration', label: 'Manage master data' },
  'settings.manage': { group: 'Administration', label: 'Change rules and notifications' },
}

const PERMISSIONS = Object.keys(PERMISSION_INFO) as Permission[]
export const PERMISSION_COUNT = PERMISSIONS.length
export const permissionLabel = (p: Permission) => PERMISSION_INFO[p].label
export const permissionsIn = (group: PermissionGroup) =>
  PERMISSIONS.filter((p) => PERMISSION_INFO[p].group === group)

// ─── Notifications ──────────────────────────────────────────────

/** When each event fires, in the terms of deriveNotifications. */
export const NOTIFICATION_EVENT_HINT: Record<NotificationEvent, string> = {
  pm_due_tomorrow: 'A PM schedule falls due tomorrow and has no work order yet.',
  pm_overdue: 'A PM work order or schedule is past its due date.',
  critical_wo_created: 'Someone raised a P1 work order in the last two days.',
  wo_sla_exceeded: 'A P1 or P2 work order passed its due time.',
  part_below_min: 'Available stock of a part fell to its minimum or below.',
  calibration_expiring: 'An instrument or tool calibration expires within 30 days.',
  warranty_expiring: 'An asset warranty ends within 60 days.',
  repeat_failure: 'The same failure mode hit one asset twice inside the repeat window.',
  approval_required: 'A work order waits for supervisor or manager approval.',
}

/** One rule per event in display order; events without a saved rule start switched off. */
export const ruleRows = (rules: readonly NotificationRule[]): NotificationRule[] =>
  NOTIFICATION_EVENTS.map(
    (event) =>
      rules.find((r) => r.event === event) ?? {
        event,
        channels: { in_app: false, email: false, whatsapp: false, push: false },
        roles: [],
      },
  )

/** Picked role keys in ROLES order, so equal selections compare equal. */
export const orderedRoles = (keys: readonly string[]) => ROLES.filter((r) => keys.includes(r))

// ─── Work rules ─────────────────────────────────────────────────

/** Work rules as typed in the form. Numbers stay strings until they validate. */
export interface RulesDraft {
  slaHours: Record<Priority, string>
  approvalByPriority: Record<Priority, ApprovalRule>
  managerApprovalAbove: string
  verifyCriticalities: Criticality[]
  repeatWindowDays: string
  wrenchTimePct: string
  weeklyHours: string
}

const byPriority = <T>(fn: (p: Priority) => T) =>
  Object.fromEntries(PRIORITIES.map((p) => [p, fn(p)])) as Record<Priority, T>

export function toRulesDraft(s: Settings): RulesDraft {
  return {
    slaHours: byPriority((p) => String(s.slaHours[p])),
    approvalByPriority: { ...s.approvalByPriority },
    managerApprovalAbove: String(s.managerApprovalAbove),
    verifyCriticalities: CRITICALITIES.filter((c) => s.verifyCriticalities.includes(c)),
    repeatWindowDays: String(s.repeatWindowDays),
    wrenchTimePct: String(Math.round(s.wrenchTime * 100)),
    weeklyHours: String(s.weeklyHours),
  }
}

type RulesField =
  `sla.${Priority}` | 'managerApprovalAbove' | 'repeatWindowDays' | 'wrenchTimePct' | 'weeklyHours'

const isWhole = (value: string, min: number, max: number) => {
  const n = Number(value)
  return value.trim() !== '' && Number.isInteger(n) && n >= min && n <= max
}

export function rulesErrors(d: RulesDraft): Partial<Record<RulesField, string>> {
  const errors: Partial<Record<RulesField, string>> = {}
  for (const p of PRIORITIES)
    if (!isWhole(d.slaHours[p], 1, 8760)) errors[`sla.${p}`] = 'Enter whole hours, 1 or more.'
  if (!isWhole(d.managerApprovalAbove, 0, Number.MAX_SAFE_INTEGER))
    errors.managerApprovalAbove = 'Enter an amount in rupiah, 0 or more.'
  if (!isWhole(d.repeatWindowDays, 1, 365)) errors.repeatWindowDays = 'Enter 1 to 365 days.'
  if (!isWhole(d.wrenchTimePct, 1, 100)) errors.wrenchTimePct = 'Enter 1 to 100 percent.'
  if (!isWhole(d.weeklyHours, 1, 80)) errors.weeklyHours = 'Enter 1 to 80 hours.'
  return errors
}

/** The settings patch a valid draft saves. */
export function rulesPatch(d: RulesDraft): Partial<Settings> {
  return {
    slaHours: byPriority((p) => Number(d.slaHours[p])),
    approvalByPriority: d.approvalByPriority,
    managerApprovalAbove: Number(d.managerApprovalAbove),
    verifyCriticalities: d.verifyCriticalities,
    repeatWindowDays: Number(d.repeatWindowDays),
    wrenchTime: Number(d.wrenchTimePct) / 100,
    weeklyHours: Number(d.weeklyHours),
  }
}
