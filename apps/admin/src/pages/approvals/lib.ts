import { fmtIdr, fmtIdrShort } from '@cmms/fixtures'
import type { Approval, ApprovalLevel, ApprovalRule, Part, Person, Role, Settings, Team, Vendor, WorkOrder } from '@cmms/types'
import { PRIORITIES } from '@cmms/types'

export type WithApproval = WorkOrder & { approval: Approval }

/** Short level names for table cells. */
export const LEVEL_SHORT: Record<ApprovalLevel, string> = { supervisor: 'Supervisor', manager: 'Manager' }

export const hasApproval = (wo: WorkOrder): wo is WithApproval => wo.approval !== null

/** "A", "A or B", "A, B or C" */
export function joinList(items: readonly string[], word: 'and' | 'or'): string {
  if (items.length < 2) return items.join('')
  return `${items.slice(0, -1).join(', ')} ${word} ${items[items.length - 1]}`
}

/** The approval settings in plain words, one line per rule. */
export function approvalRules(settings: Settings): string[] {
  const phrase = (rule: ApprovalRule, one: string, many: string) => {
    const priorities = PRIORITIES.filter((p) => settings.approvalByPriority[p] === rule)
    return priorities.length ? `${joinList(priorities, 'and')} ${priorities.length === 1 ? one : many}` : null
  }
  const verify = settings.verifyCriticalities
  return [
    phrase('auto', 'starts without approval', 'start without approval'),
    phrase('supervisor', 'needs supervisor approval', 'need supervisor approval'),
    phrase('manager', 'needs manager approval', 'need manager approval'),
    `Estimates above ${fmtIdrShort(settings.managerApprovalAbove)} need manager approval, whatever the priority`,
    verify.length ? `Completed work on class ${joinList(verify, 'and')} assets needs supervisor verification` : null,
  ].filter((line) => line !== null)
}

interface CostLine {
  key: string
  label: string
  detail?: string
  amount: number
}

/** The lines behind `estimatedCost`: planned parts, the vendor quote and other cost. */
export function costLines(wo: WorkOrder, parts: ReadonlyMap<string, Part>, vendors: ReadonlyMap<string, Vendor>): CostLine[] {
  const lines: CostLine[] = wo.parts
    .filter((l) => l.status !== 'returned')
    .map((l) => {
      const part = parts.get(l.partId)
      return {
        key: l.id,
        label: part?.name ?? 'Removed part',
        detail: `${part ? `${part.code} · ` : ''}${l.qty} ${part?.unit ?? 'pcs'} × ${fmtIdr(l.unitCost)}`,
        amount: l.qty * l.unitCost,
      }
    })
  if (wo.vendorCost) lines.push({ key: 'vendor', label: 'Vendor estimate', detail: wo.vendorId ? vendors.get(wo.vendorId)?.name : undefined, amount: wo.vendorCost })
  if (wo.miscCost) lines.push({ key: 'misc', label: 'Other cost', amount: wo.miscCost })
  return lines
}

/** Supervisors approve supervisor-level work, managers (and admins) approve both levels. */
export const mayDecide = (level: ApprovalLevel, role: Role, canApprove: boolean) =>
  canApprove && (level !== 'manager' || role === 'manager' || role === 'admin')

/** Who to ask: the team's supervisor or a manager, or only managers for manager approvals. */
export function approversFor(wo: WorkOrder, level: ApprovalLevel, people: readonly Person[], teams: ReadonlyMap<string, Team>): Person[] {
  const managers = people.filter((p) => p.role === 'manager')
  if (level === 'manager') return managers
  const supervisorId = teams.get(wo.teamId)?.supervisorId
  return [...people.filter((p) => p.role === 'supervisor' && (!supervisorId || p.id === supervisorId)), ...managers]
}
