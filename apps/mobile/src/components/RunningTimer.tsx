import { toMs } from '@cmms/fixtures'
import type { IsoDate } from '@cmms/types'
import { cn } from '@cmms/ui'
import { fmtTimer } from '../lib/time'
import { useNow } from '../state/scope'

/** A clock that ticks every second from `since`. Kept small so only it re-renders. */
export function RunningTimer({ since, className }: { since: IsoDate; className?: string }) {
  const now = useNow(1000)
  return (
    <span role="timer" className={cn('tabular-nums', className)}>
      {fmtTimer(now - toMs(since))}
    </span>
  )
}
