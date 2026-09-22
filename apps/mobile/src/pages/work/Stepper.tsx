import { cn } from '@cmms/ui'
import { Check, Minus } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { STEPS, type StepId, type StepStatus } from './flow'

type PillState = 'current' | 'done' | 'open' | 'locked' | 'skipped'

const PILL: Record<PillState, string> = {
  current: 'bg-ink text-on-ink shadow-card',
  done: 'bg-card text-foreground shadow-card',
  open: 'bg-card text-body shadow-card',
  locked: 'bg-surface-2 text-muted',
  skipped: 'bg-surface-2 text-muted',
}

const TILE: Record<PillState, string> = {
  current: 'bg-white/15 text-white',
  done: 'bg-success text-white',
  open: 'bg-surface text-body',
  locked: 'bg-surface text-muted',
  skipped: 'bg-surface text-muted',
}

/** Pill stepper. Done and open steps can be tapped; later steps stay locked until the earlier ones are done. */
export function Stepper({
  status,
  current,
  onPick,
}: {
  status: Record<StepId, StepStatus>
  current: StepId
  onPick: (step: StepId) => void
}) {
  const listRef = useRef<HTMLOListElement>(null)

  // Keep the current pill in view without scrolling the page itself.
  useEffect(() => {
    const list = listRef.current
    const active = list?.querySelector<HTMLElement>('[aria-current="step"]')
    if (!list || !active) return
    const offset = active.getBoundingClientRect().left - list.getBoundingClientRect().left
    list.scrollBy({ left: offset - (list.clientWidth - active.offsetWidth) / 2, behavior: 'smooth' })
  }, [current])

  let number = 0
  return (
    <nav aria-label="Work order steps" className="relative">
      <ol ref={listRef} className="-mx-5 gap-2 px-5 pb-1 pr-12 no-scrollbar flex overflow-x-auto">
        {STEPS.map((step) => {
          const s = status[step.id]
          if (!s.skipped) number += 1
          const state: PillState =
            step.id === current
              ? 'current'
              : s.skipped
                ? 'skipped'
                : s.done
                  ? 'done'
                  : s.reachable
                    ? 'open'
                    : 'locked'
          const tappable = state === 'done' || state === 'open'
          return (
            <li key={step.id} className="shrink-0">
              <button
                type="button"
                disabled={!tappable && state !== 'current'}
                aria-current={state === 'current' ? 'step' : undefined}
                aria-label={`${step.label}${state === 'done' ? ', done' : state === 'skipped' ? ', not needed' : state === 'locked' ? ', locked' : ''}`}
                onClick={() => tappable && onPick(step.id)}
                className={cn(
                  'h-11 gap-2 pl-1.5 pr-4 text-sm font-semibold flex items-center rounded-full transition-colors focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:outline-none disabled:cursor-not-allowed',
                  tappable && 'active:scale-[0.98]',
                  PILL[state],
                )}
              >
                <span
                  className={cn(
                    'size-8 text-xs font-bold [&_svg]:size-4 flex items-center justify-center rounded-full tabular-nums',
                    TILE[state],
                  )}
                >
                  {state === 'done' ? (
                    <Check aria-hidden="true" strokeWidth={3} />
                  ) : state === 'skipped' ? (
                    <Minus aria-hidden="true" />
                  ) : (
                    number
                  )}
                </span>
                <span className="whitespace-nowrap">
                  {step.label}
                  {state === 'skipped' && <span className="font-medium"> · Not needed</span>}
                </span>
              </button>
            </li>
          )
        })}
      </ol>
      <span
        aria-hidden="true"
        className="-right-5 inset-y-0 w-12 pointer-events-none absolute bg-linear-to-l from-surface via-surface/90 to-transparent"
      />
    </nav>
  )
}
