import { isTaskDone } from '@cmms/fixtures'
import { ChecklistCard } from '../ChecklistCard'
import { type StepProps, listNames } from '../flow'
import { ContinueButton, StepActions } from '../StepActions'

/** Every task in the job, recorded as the work goes. Required lines block the next step. */
export function ChecklistStep({ wo, nav, access }: StepProps) {
  const missing = wo.tasks.filter((t) => t.required && !isTaskDone(t))
  const blocked = !nav.next && missing.length > 0
  const hint = access.assigned && wo.status === 'waiting' ? 'Resume the work to record results.' : null
  return (
    <>
      <ChecklistCard wo={wo} editable={access.working} hint={hint} />
      <StepActions onBack={nav.back} note={blocked ? `Still needed: ${listNames(missing.map((t) => t.label))}` : null} blocked={blocked}>
        <ContinueButton onClick={nav.next} />
      </StepActions>
    </>
  )
}
