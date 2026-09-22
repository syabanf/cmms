import type { Role } from '@cmms/types'

export type Permission =
  | 'request.create'
  | 'request.triage'
  | 'wo.create'
  | 'wo.edit'
  | 'wo.assign'
  | 'wo.execute'
  | 'wo.approve'
  | 'wo.verify'
  | 'wo.close'
  | 'pm.manage'
  | 'jobplan.manage'
  | 'asset.manage'
  | 'inventory.issue'
  | 'inventory.manage'
  | 'tool.manage'
  | 'calibration.record'
  | 'rca.manage'
  | 'people.manage'
  | 'masterdata.manage'
  | 'settings.manage'

const EXECUTE: Permission[] = ['request.create', 'wo.execute']
const PLAN: Permission[] = [
  'request.create',
  'request.triage',
  'wo.create',
  'wo.edit',
  'wo.assign',
  'wo.close',
  'pm.manage',
  'jobplan.manage',
  'asset.manage',
  'calibration.record',
]

export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  manager: [...PLAN, 'wo.approve', 'wo.verify', 'rca.manage', 'people.manage', 'inventory.manage', 'tool.manage', 'masterdata.manage', 'settings.manage'],
  planner: [...PLAN, 'rca.manage', 'tool.manage'],
  supervisor: [...PLAN, 'wo.execute', 'wo.approve', 'wo.verify', 'rca.manage', 'people.manage'],
  technician: [...EXECUTE, 'calibration.record'],
  warehouse: ['request.create', 'inventory.issue', 'inventory.manage', 'tool.manage'],
  requester: ['request.create'],
  admin: [...PLAN, 'wo.approve', 'wo.verify', 'inventory.manage', 'tool.manage', 'people.manage', 'masterdata.manage', 'settings.manage', 'rca.manage'],
  viewer: [],
}

export const can = (role: Role, permission: Permission) => ROLE_PERMISSIONS[role].includes(permission)

/** One line per role for the roles and access screen. */
export const ROLE_SUMMARY: Record<Role, string> = {
  manager: 'Approves costly work, verifies critical closures, owns KPIs and settings.',
  planner: 'Builds job plans and PM schedules, assigns and schedules work, manages the backlog.',
  supervisor: 'Approves P2 work, verifies completion on critical assets, reviews failures.',
  technician: 'Executes assigned work, records measurements, parts, photos and failure codes.',
  warehouse: 'Issues and returns parts, adjusts stock and manages bins and tools.',
  requester: 'Reports problems and follows the status of their requests.',
  admin: 'Maintains master data, users, roles and notification rules.',
  viewer: 'Read-only access to dashboards, assets and history.',
}
