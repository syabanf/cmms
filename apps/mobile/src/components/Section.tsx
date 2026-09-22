import { cn } from '@cmms/ui'
import type { ReactNode } from 'react'

/** A titled block on a mobile screen: bold heading, optional count and action, then the content. */
export function Section({
  title,
  count,
  action,
  className,
  children,
}: {
  title: string
  count?: number
  action?: ReactNode
  className?: string
  children: ReactNode
}) {
  return (
    <section className={cn('space-y-3', className)}>
      <div className="flex min-h-8 items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-base font-bold">
          {title}
          {count !== undefined && (
            <span className="rounded-full bg-card px-2 py-0.5 text-xs font-bold tabular-nums text-body shadow-card">{count}</span>
          )}
        </h2>
        {action}
      </div>
      {children}
    </section>
  )
}
