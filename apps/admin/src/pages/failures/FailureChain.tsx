import type { FailureReport } from '@cmms/types'
import { Fragment } from 'react'
import { useScoped } from '../../state/scoped'

/** Problem → failure mode → cause → remedy, with the mode in bold. Uncoded steps drop out. */
export function FailureChain({ failure }: { failure: FailureReport | null }) {
  const { maps } = useScoped()
  const name = (id: string | null) => (id ? maps.failureCode.get(id)?.name : undefined)
  const steps = failure
    ? [
        { key: 'problem', text: name(failure.problemId), strong: false },
        { key: 'mode', text: name(failure.modeId), strong: true },
        { key: 'cause', text: name(failure.causeId), strong: false },
        { key: 'remedy', text: name(failure.remedyId), strong: false },
      ].filter((step) => step.text)
    : []
  if (!steps.length) return <span className="text-sm text-muted">Not coded</span>
  return (
    <p className="max-w-[15rem] text-sm leading-relaxed text-body xl:max-w-[26rem]">
      {steps.map((step, i) => (
        <Fragment key={step.key}>
          {i > 0 && <span className="px-1 text-silver">→</span>}
          <span className={step.strong ? 'font-semibold text-foreground' : undefined}>{step.text}</span>
        </Fragment>
      ))}
    </p>
  )
}
