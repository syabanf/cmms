import { ROLE_LABEL } from '@cmms/types'
import { Avatar, BottomBar, BottomBarAction, BottomBarItem, Button, Sheet, SheetContent, SheetTitle, cn } from '@cmms/ui'
import { ClipboardList, Factory, House, Inbox, LayoutGrid, LogOut, Plus } from 'lucide-react'
import { Link, useLocation, useNavigate } from 'react-router'
import { useAuth } from '../auth/auth'
import { CreateMenu } from './CreateMenu'
import { NAV, leafFor, sectionFor } from './nav'
import { useNavCounts } from './useNavCounts'

/** Phone navigation: floating ink bar plus a dark bottom sheet with every destination. */
export function PhoneNav({ moreOpen, onMoreChange }: { moreOpen: boolean; onMoreChange: (open: boolean) => void }) {
  const { pathname } = useLocation()
  const counts = useNavCounts()
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const is = (path: string) => (path === '/' ? pathname === '/' : pathname === path || pathname.startsWith(`${path}/`))
  const currentLeaf = leafFor(pathname)
  const currentSection = sectionFor(pathname)

  return (
    <>
      <BottomBar className="print:hidden">
        <BottomBarItem asChild icon={<House />} label="Home" active={is('/')}>
          <Link to="/" />
        </BottomBarItem>
        <BottomBarItem asChild icon={<Inbox />} label="Requests" active={is('/work/requests')} badge={counts.newRequests}>
          <Link to="/work/requests" />
        </BottomBarItem>
        <CreateMenu
          trigger={
            <BottomBarAction label="Create">
              <Plus />
            </BottomBarAction>
          }
        />
        <BottomBarItem asChild icon={<ClipboardList />} label="Work orders" active={is('/work/orders')}>
          <Link to="/work/orders" />
        </BottomBarItem>
        <BottomBarItem asChild icon={<Factory />} label="Assets" active={is('/assets')}>
          <Link to="/assets" />
        </BottomBarItem>
        <BottomBarItem icon={<LayoutGrid />} label="More" active={moreOpen} onClick={() => onMoreChange(true)} />
      </BottomBar>

      <Sheet open={moreOpen} onOpenChange={onMoreChange}>
        <SheetContent side="bottom" tone="dark" hideClose aria-describedby={undefined}>
          <SheetTitle className="sr-only">All destinations</SheetTitle>
          {NAV.map((section) => {
            const destinations = section.items ?? [{ to: section.to, label: section.label, icon: section.icon }]
            return (
              <div key={section.id}>
                <p className="px-5 pt-4 text-[11px] font-semibold uppercase tracking-wider text-on-ink-muted">{section.label}</p>
                <div className="grid grid-cols-3 gap-2 px-3 pb-1 pt-2">
                  {destinations.map((d) => {
                    const Icon = d.icon
                    const active = section.items ? currentLeaf?.to === d.to : currentSection.id === section.id
                    const badge = 'badge' in d && d.badge ? counts[d.badge] : 0
                    return (
                      <Link
                        key={d.to}
                        to={d.to}
                        onClick={() => onMoreChange(false)}
                        className="flex flex-col items-center gap-2 rounded-2xl p-3 text-center transition-colors hover:bg-white/10"
                      >
                        <span
                          className={cn(
                            'relative flex size-11 items-center justify-center rounded-2xl bg-white/10 [&_svg]:size-5',
                            active && 'bg-accent text-white shadow-glow',
                          )}
                        >
                          <Icon />
                          {badge > 0 && (
                            <span className="absolute -right-1 -top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-white px-1 text-[10px] font-bold text-ink">
                              {badge}
                            </span>
                          )}
                        </span>
                        <span className="text-xs font-medium leading-tight">{d.label}</span>
                      </Link>
                    )
                  })}
                </div>
              </div>
            )
          })}
          {user && (
            <div className="mt-3 flex items-center gap-3 border-t border-white/10 px-5 pt-4">
              <Avatar name={user.name} color={user.color} size="md" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{user.name}</p>
                <p className="truncate text-xs text-on-ink-muted">{ROLE_LABEL[user.role]}</p>
              </div>
              <Button
                variant="onInk"
                size="sm"
                onClick={() => {
                  onMoreChange(false)
                  signOut()
                  navigate('/login')
                }}
              >
                <LogOut />
                Sign out
              </Button>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </>
  )
}
