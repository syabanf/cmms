import { useMobileScope } from '../../../state/scope'
import { type StepProps, listNames, pendingParts } from '../flow'
import { PartsCard } from '../PartsCard'
import { ContinueButton, StepActions } from '../StepActions'
import { ToolsCard } from '../ToolsCard'

/** Settle every reserved part as used or returned, and check tools in and out. */
export function PartsStep({ wo, nav, access }: StepProps) {
  const { maps } = useMobileScope()
  const pending = pendingParts(wo).map((l) => maps.part.get(l.partId)?.code ?? 'part')
  const blocked = !nav.next && pending.length > 0
  return (
    <>
      <PartsCard wo={wo} editable={access.editable} />
      <ToolsCard wo={wo} editable={access.editable} />
      <StepActions onBack={nav.back} note={blocked ? `Mark as used or returned: ${listNames(pending)}` : null} blocked={blocked}>
        <ContinueButton onClick={nav.next} />
      </StepActions>
    </>
  )
}
