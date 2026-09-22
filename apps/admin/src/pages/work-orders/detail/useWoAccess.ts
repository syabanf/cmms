import { needsVerification } from '@cmms/fixtures'
import type { WorkOrder } from '@cmms/types'
import { useAuth } from '../../../auth/auth'
import { useScoped } from '../../../state/scoped'

/** What the signed-in user may do on this work order. */
export function useWoAccess(wo: WorkOrder) {
  const { can } = useAuth()
  const { user, maps, settings } = useScoped()
  const done = ['completed', 'verified', 'closed', 'cancelled'].includes(wo.status)
  const approvalLevelOk = wo.approval?.level !== 'manager' || user.role === 'manager' || user.role === 'admin'
  return {
    /** Record checklist results, labor, parts use, photos and failure codes. */
    execute: !done && (can('wo.execute') || can('wo.edit')),
    edit: !done && can('wo.edit'),
    assign: !done && can('wo.assign'),
    approve: wo.approval?.status === 'pending' && can('wo.approve') && approvalLevelOk,
    verify: can('wo.verify'),
    close: can('wo.close'),
    issue: can('inventory.issue'),
    verificationNeeded: needsVerification(maps.asset.get(wo.assetId), settings),
  }
}

export type WoAccess = ReturnType<typeof useWoAccess>
