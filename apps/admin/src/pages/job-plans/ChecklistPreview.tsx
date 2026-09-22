import { limitText } from '@cmms/fixtures'
import type { ChecklistItem, CheckOutcome } from '@cmms/types'
import { cn } from '@cmms/ui'
import { Camera, PenLine } from 'lucide-react'
import { optionOutcome, warnText } from './lib'

const OUTCOME_DOT: Record<CheckOutcome, string> = { pass: 'bg-success', warning: 'bg-warning', fail: 'bg-accent' }

/** A still picture of the control the technician gets for this line on the work order. */
export function ChecklistPreview({ item }: { item: ChecklistItem }) {
  const label = item.label.trim()
  const help = item.help?.trim()
  return (
    <div className="min-w-0 rounded-2xl bg-card p-3 shadow-card">
      <p className="text-[10.5px] font-semibold uppercase tracking-wider text-muted">Technician sees</p>
      <p className="mt-1.5 break-words text-sm font-semibold leading-snug">
        {label || <span className="text-muted">Untitled check</span>}
        {item.required && (
          <span aria-hidden="true" className="ml-0.5 text-accent">
            *
          </span>
        )}
      </p>
      {help && <p className="mt-0.5 break-words text-xs text-muted">{help}</p>}
      <div className="mt-2.5">
        <Control item={item} />
      </div>
    </div>
  )
}

function Pills({ options }: { options: { label: string; outcome: CheckOutcome | null }[] }) {
  return (
    <span className="inline-flex max-w-full flex-wrap gap-1 rounded-2xl bg-surface p-1">
      {options.map((o, i) => (
        <span key={i} className="inline-flex h-7 min-w-0 items-center gap-1.5 rounded-full px-3 text-xs font-semibold text-body">
          {o.outcome && <span aria-hidden="true" className={cn('size-1.5 shrink-0 rounded-full', OUTCOME_DOT[o.outcome])} />}
          <span className="truncate">{o.label.trim() || 'Option'}</span>
        </span>
      ))}
    </span>
  )
}

function Control({ item }: { item: ChecklistItem }) {
  switch (item.type) {
    case 'check':
      return (
        <span className="inline-flex items-center gap-2 text-xs font-medium text-body">
          <span className="relative inline-flex h-5 w-9 rounded-full bg-silver/60">
            <span className="absolute left-0.5 top-0.5 size-4 rounded-full bg-white shadow-sm" />
          </span>
          Done
        </span>
      )
    case 'passfail':
      return (
        <Pills
          options={[
            { label: 'Pass', outcome: 'pass' },
            { label: 'Fail', outcome: 'fail' },
          ]}
        />
      )
    case 'choice': {
      const options = item.options ?? []
      if (!options.length) return <span className="text-xs text-muted">Add options to see them here.</span>
      return <Pills options={options.map((label, i) => ({ label, outcome: optionOutcome(i, options.length) }))} />
    }
    case 'measurement':
    case 'number': {
      const limit = limitText(item)
      const warn = warnText(item)
      const unit = item.unit?.trim()
      return (
        <div className="space-y-1.5">
          <span className="flex h-10 w-40 max-w-full items-center justify-between gap-2 rounded-2xl border border-border px-3 text-sm text-muted">
            Value
            {unit && <span className="truncate text-xs font-medium">{unit}</span>}
          </span>
          {limit || warn ? (
            <p className="text-xs text-muted">{[limit && `Limit ${limit}`, warn].filter(Boolean).join(' · ')}</p>
          ) : (
            item.type === 'measurement' && <p className="text-xs text-muted">No limits yet, so every reading passes.</p>
          )}
        </div>
      )
    }
    case 'text':
      return <span className="block h-16 rounded-2xl border border-border px-3 py-2 text-sm text-muted">Type the answer</span>
    case 'photo':
      return (
        <span className="flex size-20 flex-col items-center justify-center gap-1 rounded-2xl bg-surface text-[11px] font-semibold text-body">
          <Camera aria-hidden="true" className="size-5 text-muted" />
          Add photo
        </span>
      )
    case 'signature':
      return (
        <span className="flex h-16 items-center justify-center gap-2 rounded-2xl border border-dashed border-silver text-xs text-muted">
          <PenLine aria-hidden="true" className="size-4" />
          Sign here
        </span>
      )
  }
}
