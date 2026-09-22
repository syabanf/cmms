import { Avatar } from '@cmms/ui'
import { useState } from 'react'
import { useMobileScope } from '../state/scope'
import { ProfileSheet } from './ProfileSheet'

/** Tab screen header: muted context line, big title ending in the accent period, avatar for the profile. */
export function ScreenHeader({ greeting, title }: { greeting: string; title: string }) {
  const { user } = useMobileScope()
  const [profileOpen, setProfileOpen] = useState(false)
  return (
    <header className="flex items-center justify-between gap-3 pt-3">
      <div className="min-w-0">
        <p className="truncate text-sm text-muted">{greeting}</p>
        <h1 className="mt-0.5 text-[28px] font-bold leading-tight tracking-tight">
          {title}
          <span className="text-accent">.</span>
        </h1>
      </div>
      <button
        type="button"
        aria-label="Your profile"
        onClick={() => setProfileOpen(true)}
        className="shrink-0 rounded-full transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 active:scale-95"
      >
        <Avatar name={user.name} color={user.color} size="lg" ring />
      </button>
      <ProfileSheet open={profileOpen} onOpenChange={setProfileOpen} />
    </header>
  )
}
