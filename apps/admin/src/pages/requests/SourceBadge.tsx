import type { RequestSource } from '@cmms/types'
import { REQUEST_SOURCE_LABEL } from '@cmms/types'
import { Badge, type BadgeProps } from '@cmms/ui'
import type { LucideIcon } from 'lucide-react'
import { ClipboardCheck, HardHat, UserRound } from 'lucide-react'

export const SOURCE_ICON: Record<RequestSource, LucideIcon> = {
  operator: UserRound,
  inspection: ClipboardCheck,
  technician: HardHat,
}

const SOURCE_VARIANT: Record<RequestSource, BadgeProps['variant']> = {
  operator: 'muted',
  inspection: 'info',
  technician: 'default',
}

export function SourceBadge({ source }: { source: RequestSource }) {
  const Icon = SOURCE_ICON[source]
  return (
    <Badge variant={SOURCE_VARIANT[source]}>
      <Icon aria-hidden="true" />
      {REQUEST_SOURCE_LABEL[source]}
    </Badge>
  )
}
