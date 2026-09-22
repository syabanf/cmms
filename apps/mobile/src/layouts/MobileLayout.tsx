import { cn } from '@cmms/ui'
import { Outlet, ScrollRestoration, useLocation } from 'react-router'
import { TabBar } from './TabBar'
import { isTabRoot } from './tabs'

/** Centred phone column. Tab roots keep the bottom bar; detail screens hide it. */
export function MobileLayout() {
  const { pathname } = useLocation()
  const root = isTabRoot(pathname)
  return (
    <div className="relative mx-auto flex min-h-dvh w-full max-w-md flex-col bg-surface">
      <main className={cn('flex-1 px-5 pt-[max(env(safe-area-inset-top),0.75rem)]', root ? 'pb-32' : 'pb-8')}>
        <Outlet />
      </main>
      {root && <TabBar />}
      <ScrollRestoration />
    </div>
  )
}
