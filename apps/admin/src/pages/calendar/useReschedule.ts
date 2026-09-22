import { fmtDateShort, fmtDateTime, fmtTime, fmtWeekday, toIso, toMs } from '@cmms/fixtures'
import { toast } from '@cmms/ui'
import { useScoped } from '../../state/scoped'

/** Moves a work order's scheduled start. The confirmation toast carries an undo. */
export function useReschedule() {
  const { dispatch, maps } = useScoped()
  return (woId: string, at: number) => {
    const wo = maps.workOrder.get(woId)
    const scheduledAt = toIso(at)
    if (!wo || wo.scheduledAt === scheduledAt) return
    const before = wo.scheduledAt
    dispatch({ type: 'workOrders/schedule', id: wo.id, scheduledAt })
    toast(`Rescheduled to ${fmtWeekday(at)} ${fmtDateShort(at)}, ${fmtTime(at)}`, {
      tone: 'success',
      description: at > toMs(wo.dueAt) ? `${wo.code} now starts after its due date, ${fmtDateTime(wo.dueAt)}.` : `${wo.code} ${wo.title}`,
      action: { label: 'Undo', onClick: () => dispatch({ type: 'workOrders/schedule', id: wo.id, scheduledAt: before }) },
    })
  }
}
