import type { StockState } from '@cmms/fixtures'
import { Badge } from '@cmms/ui'
import { StockBadge } from '../../components/badges'

/** Stock state, or "Not stocked" when the site keeps no stock record for the part. */
export function PartStockBadge({ state }: { state: StockState | null }) {
  if (!state) return <Badge variant="muted">Not stocked</Badge>
  return <StockBadge state={state} />
}

export function CriticalBadge() {
  return (
    <Badge variant="ink" title="Held even when consumption is low">
      Critical spare
    </Badge>
  )
}
