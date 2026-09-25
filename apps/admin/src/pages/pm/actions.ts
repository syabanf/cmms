import { approvalFor, fmtDate, nextWoCode, nowIso, openPmWorkOrder, workOrderFromPm } from '@cmms/fixtures'
import type { PmSchedule } from '@cmms/types'
import { toast } from '@cmms/ui'
import { useNavigate } from 'react-router'
import { paths } from '../../components/links'
import { useScoped } from '../../state/scoped'
import { deleteEffect } from './lib'

/** PM schedule actions shared by the list, the detail page and the calendar forecast. */
export function usePmActions() {
  const { state, workOrders, maps, warehouseIds, settings, user, dispatch, personName } = useScoped()
  const navigate = useNavigate()

  /** Why a work order can't be generated right now, or null when it can. */
  const blockReason = (pm: PmSchedule): string | null => {
    if (!pm.active) return 'The schedule is paused'
    const open = openPmWorkOrder(pm, workOrders)
    if (open) return `${open.code} is still open`
    if (!maps.jobPlan.has(pm.jobPlanId)) return 'Its job plan was deleted'
    if (!maps.asset.has(pm.assetId)) return 'Its asset was removed'
    return null
  }

  const generate = (pm: PmSchedule, dueAt: number) => {
    const plan = maps.jobPlan.get(pm.jobPlanId)
    const asset = maps.asset.get(pm.assetId)
    if (!plan || !asset || blockReason(pm)) return
    const at = nowIso()
    const wo = {
      ...workOrderFromPm(pm, plan, asset, maps.part, warehouseIds[0] ?? '', dueAt, settings, user.id, at),
      // Codes run on one sequence across sites, so the next one comes from the whole store.
      code: nextWoCode(state.workOrders, at),
    }
    dispatch({ type: 'pm/generate', id: pm.id, workOrder: wo })
    const approval = approvalFor(wo, settings)
    const people = wo.assigneeIds.map((id) => personName(id)).join(', ')
    toast(`${wo.code} generated from ${pm.code}`, {
      tone: 'success',
      description: approval
        ? `Waiting for ${approval.level} approval. ${approval.reason}`
        : `Due ${fmtDate(wo.dueAt)}, ${people ? `assigned to ${people}` : 'not assigned yet'}.`,
      action: { label: 'Open', onClick: () => navigate(paths.workOrder(wo.id)) },
    })
  }

  const setActive = (pm: PmSchedule, active: boolean) => {
    dispatch({ type: 'pm/upsert', item: { ...pm, active } })
    toast(active ? `${pm.code} resumed` : `${pm.code} paused`, {
      tone: 'success',
      description: active ? 'It generates work again when due.' : 'No work orders are generated until you resume it.',
    })
  }

  const remove = (pm: PmSchedule) => {
    const effect = deleteEffect(pm, openPmWorkOrder(pm, workOrders))
    dispatch({ type: 'pm/remove', id: pm.id })
    toast(`${pm.code} deleted`, { tone: 'success', description: effect.toast })
  }

  return { blockReason, generate, setActive, remove }
}
