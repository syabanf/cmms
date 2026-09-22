import { cn } from '@cmms/ui'
import { ChevronLeft } from 'lucide-react'
import type { ReactNode } from 'react'
import { useNavigate } from 'react-router'

/** True when the router has an earlier entry from this app session to go back to. */
const cameFromInsideApp = () => ((window.history.state as { idx?: number } | null)?.idx ?? 0) > 0

/**
 * Round white back button. Goes back in history when the user came from inside the app,
 * otherwise opens the parent list route (a shared link, a scan, a reload).
 */
export function BackButton({ fallback }: { fallback: string }) {
  const navigate = useNavigate()
  return (
    <button
      type="button"
      aria-label="Back"
      onClick={() => (cameFromInsideApp() ? navigate(-1) : navigate(fallback, { replace: true }))}
      className="flex size-11 shrink-0 items-center justify-center rounded-full bg-card shadow-card transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 active:scale-95"
    >
      <ChevronLeft aria-hidden="true" className="size-5" />
    </button>
  )
}

/** Detail screen header: back button, title and a muted context line. */
export function DetailHeader({
  title,
  subtitle,
  fallback,
  mono = false,
}: {
  title: string
  subtitle?: ReactNode
  fallback: string
  mono?: boolean
}) {
  return (
    <header className="flex items-center gap-3 pt-3">
      <BackButton fallback={fallback} />
      <div className="min-w-0 flex-1">
        <h1 className={cn('truncate text-lg font-bold leading-tight', mono && 'font-mono text-base')}>{title}</h1>
        {subtitle !== undefined && <p className="truncate text-xs text-muted">{subtitle}</p>}
      </div>
    </header>
  )
}
