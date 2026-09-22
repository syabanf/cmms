import { Card } from '@cmms/ui'
import { Check } from 'lucide-react'
import type { ReactNode } from 'react'

/** The confirmation after a finished flow: ink card, green check tile, next steps. */
export function SuccessCard({ title, children, actions }: { title: string; children: ReactNode; actions: ReactNode }) {
  return (
    <Card variant="ink" className="p-6">
      <span className="flex size-12 items-center justify-center rounded-2xl bg-success text-white [&_svg]:size-6">
        <Check aria-hidden="true" strokeWidth={3} />
      </span>
      <h2 className="mt-5 text-xl font-bold leading-tight">{title}</h2>
      <div className="mt-2 space-y-1 text-sm text-on-ink-muted">{children}</div>
      <div className="mt-6 flex flex-col gap-2">{actions}</div>
    </Card>
  )
}
