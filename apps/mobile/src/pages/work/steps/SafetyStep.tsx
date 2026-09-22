import { isClockedIn } from '@cmms/fixtures'
import { Button, toast } from '@cmms/ui'
import { ShieldCheck } from 'lucide-react'
import { type ReactNode, useState } from 'react'
import { useMobileScope } from '../../../state/scope'
import type { StepProps } from '../flow'
import { SafetyCard, safetyRows } from '../SafetyCard'
import { ContinueButton, StepActions } from '../StepActions'

/** LOTO, permits, PPE and hazards. Confirming also starts the order and the technician's clock. */
export function SafetyStep({ wo, nav, access }: StepProps) {
  const { user, maps, dispatch } = useMobileScope()
  const rows = safetyRows(wo, maps.safetyItem, access.assigned ? (user.technician?.authorizations ?? []) : null)
  const [ticked, setTicked] = useState<ReadonlySet<string>>(() => new Set())
  const canConfirm = access.editable && !wo.safety.confirmedBy
  const done = rows.filter((r) => ticked.has(r.id)).length
  const notStarted = wo.status === 'open' || wo.status === 'assigned'

  const toggle = (id: string) =>
    setTicked((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const confirm = () => {
    dispatch({ type: 'workOrders/confirmSafety', id: wo.id })
    // Starting clocks the technician in; on work someone else started, clock in directly.
    if (notStarted) dispatch({ type: 'workOrders/start', id: wo.id })
    else if (!isClockedIn(wo, user.id)) dispatch({ type: 'workOrders/clock', id: wo.id, personId: user.id, running: true })
    toast(notStarted ? 'Safety confirmed, work started' : 'Safety confirmed', { tone: 'success', description: 'Your clock is running.' })
    nav.go('checklist')
  }

  let primary: ReactNode = <ContinueButton onClick={nav.next} />
  let note: string | null = nav.next ? null : 'The checklist opens once safety is confirmed and the work starts.'
  if (canConfirm) {
    const paused = wo.status === 'waiting'
    primary = (
      <Button size="lg" className="flex-1" disabled={paused || done < rows.length} onClick={confirm}>
        <ShieldCheck />
        {notStarted ? 'Confirm and start' : 'Confirm safety'}
      </Button>
    )
    note = paused ? 'Resume the work first, from the Job step or the menu.' : `${done} of ${rows.length} confirmed`
  }

  return (
    <>
      <SafetyCard wo={wo} rows={rows} ticked={canConfirm ? ticked : null} onToggle={toggle} />
      <StepActions onBack={nav.back} note={note}>
        {primary}
      </StepActions>
    </>
  )
}
