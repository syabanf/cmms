import { type BacklogRow, fmtNumber, fmtPercent } from '@cmms/fixtures'
import type { WaitingReason } from '@cmms/types'
import { WAITING_REASON_LABEL } from '@cmms/types'
import { BarList, Card, CardContent, CardDescription, CardHeader, CardTitle, EmptyState } from '@cmms/ui'
import { CirclePause } from 'lucide-react'
import { fmtAge, oldestWait } from './lib'

/** Open work by age bucket; the oldest bucket that holds work carries the accent. */
export function AgeCard({ buckets, total }: { buckets: { label: string; count: number }[]; total: number }) {
  const oldest = buckets.findLastIndex((b) => b.count > 0)
  return (
    <Card>
      <CardHeader>
        <CardTitle>Age of open work</CardTitle>
        <CardDescription>Time since each work order was requested.</CardDescription>
      </CardHeader>
      <CardContent>
        <BarList
          ariaLabel="Open work orders by age"
          items={buckets.map((b, i) => ({
            key: b.label,
            label: b.label,
            value: b.count,
            display: fmtNumber(b.count),
            hint: total ? fmtPercent(b.count / total) : undefined,
            emphasis: i === oldest,
          }))}
        />
      </CardContent>
    </Card>
  )
}

/** Why blocked work cannot move, most common reason first, with the longest wait per reason. */
export function WaitingCard({ rows, byReason }: { rows: readonly BacklogRow[]; byReason: Partial<Record<WaitingReason, number>> }) {
  const reasons = (Object.entries(byReason) as [WaitingReason, number][]).sort((a, b) => b[1] - a[1])
  return (
    <Card>
      <CardHeader>
        <CardTitle>Waiting reasons</CardTitle>
        <CardDescription>Work on hold, by what it waits for.</CardDescription>
      </CardHeader>
      <CardContent>
        {reasons.length ? (
          <BarList
            ariaLabel="Waiting work orders by reason"
            items={reasons.map(([reason, count], i) => ({
              key: reason,
              label: WAITING_REASON_LABEL[reason],
              value: count,
              display: fmtNumber(count),
              hint: `longest ${fmtAge(oldestWait(rows, reason))}`,
              emphasis: i === 0,
            }))}
          />
        ) : (
          <EmptyState
            compact
            icon={<CirclePause />}
            title="Nothing is waiting"
            description="Work on hold for parts, vendors or a production window shows up here with its reason."
          />
        )}
      </CardContent>
    </Card>
  )
}
