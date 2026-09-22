import { fmtDateShort } from '@cmms/fixtures'
import type { Vendor } from '@cmms/types'
import { Badge, cn } from '@cmms/ui'
import { Star } from 'lucide-react'
import { contractDaysLeft, contractState } from './lib'

/** Five small stars, filled to the rounded rating, with the exact score beside them. */
export function Rating({ value, className }: { value: number; className?: string }) {
  const filled = Math.round(value)
  return (
    <span className={cn('inline-flex items-center gap-1.5', className)}>
      <span role="img" aria-label={`Rated ${value.toFixed(1)} of 5`} className="inline-flex gap-0.5">
        {[1, 2, 3, 4, 5].map((i) => (
          <Star key={i} aria-hidden="true" className={cn('size-3.5 fill-current', i <= filled ? 'text-accent' : 'text-silver')} />
        ))}
      </span>
      <span className="text-xs font-semibold tabular-nums">{value.toFixed(1)}</span>
    </span>
  )
}

/** Warning when the contract has ended or ends within 60 days. Renders nothing for a running contract unless asked. */
export function ContractBadge({ vendor, now, showActive = false }: { vendor: Vendor; now: number; showActive?: boolean }) {
  const state = contractState(vendor, now)
  if (state === 'ended') {
    return (
      <Badge variant="warning" dot>
        Contract ended
      </Badge>
    )
  }
  if (state === 'ending') {
    const days = contractDaysLeft(vendor, now)
    return (
      <Badge variant="warning" dot>
        Ends in {days} {days === 1 ? 'day' : 'days'}
      </Badge>
    )
  }
  if (state === 'upcoming') return <Badge variant="muted">Starts {fmtDateShort(vendor.contractStart)}</Badge>
  return showActive ? (
    <Badge variant="success" dot>
      Under contract
    </Badge>
  ) : null
}
