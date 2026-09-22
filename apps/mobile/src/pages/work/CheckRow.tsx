import { cn } from '@cmms/ui'
import { Check } from 'lucide-react'
import type { ReactNode } from 'react'

/** A full-width toggle row with a large tick box, sized for gloved fingers. */
export function CheckRow({
  checked,
  onToggle,
  label,
  hint,
  disabled = false,
}: {
  checked: boolean
  onToggle: () => void
  label: ReactNode
  hint?: ReactNode
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      disabled={disabled}
      onClick={onToggle}
      className="flex min-h-14 w-full items-center gap-3 rounded-2xl bg-surface-2 px-3.5 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 active:scale-[0.99] disabled:cursor-not-allowed"
    >
      <span
        className={cn(
          'flex size-7 shrink-0 items-center justify-center rounded-lg border-2 transition-colors [&_svg]:size-4',
          checked ? 'border-success bg-success text-white' : 'border-silver bg-card',
          disabled && !checked && 'opacity-60',
        )}
      >
        {checked && <Check aria-hidden="true" strokeWidth={3} />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold">{label}</span>
        {hint !== undefined && <span className="mt-0.5 block text-xs text-muted">{hint}</span>}
      </span>
    </button>
  )
}
