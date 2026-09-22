import { Button, cn } from '@cmms/ui'
import { ArrowRight, ChevronLeft } from 'lucide-react'
import type { ReactNode } from 'react'
import { StickyBar } from '../../components/StickyBar'

/** The wizard's bottom row: outline Back, then the step's primary action. A blocking note names what is missing. */
export function StepActions({
  onBack,
  note,
  blocked = false,
  children,
}: {
  onBack: (() => void) | null
  note?: string | null
  blocked?: boolean
  children?: ReactNode
}) {
  return (
    <StickyBar note={note && <span className={blocked ? 'text-accent' : 'text-muted'}>{note}</span>}>
      {onBack && (
        <Button variant="outline" size="lg" className={cn(children ? 'shrink-0 px-4' : 'flex-1')} onClick={onBack}>
          <ChevronLeft />
          Back
        </Button>
      )}
      {children}
    </StickyBar>
  )
}

/** Disabled while the next step is locked. */
export function ContinueButton({ onClick }: { onClick: (() => void) | null }) {
  return (
    <Button size="lg" className="flex-1" disabled={!onClick} onClick={onClick ?? undefined}>
      Continue
      <ArrowRight />
    </Button>
  )
}
