import type { ReactNode } from 'react'

/** Primary actions pinned above the home indicator on detail screens. Pair with bottom padding on the page. */
export function StickyBar({ note, children }: { note?: ReactNode; children: ReactNode }) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-30 mx-auto w-full max-w-md">
      <div aria-hidden="true" className="pointer-events-none h-6 bg-linear-to-t from-surface to-transparent" />
      <div className="bg-surface px-5 pb-[max(env(safe-area-inset-bottom),1rem)] pt-1">
        {note && (
          <p role="status" className="mb-2 text-center text-xs font-medium">
            {note}
          </p>
        )}
        <div className="flex gap-2">{children}</div>
      </div>
    </div>
  )
}
