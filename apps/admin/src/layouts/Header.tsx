import { fmtDate, fmtWeekday } from '@cmms/fixtures'
import { ROLE_LABEL } from '@cmms/types'
import { ActionMenu, Avatar, Button } from '@cmms/ui'
import { LogOut, Menu, Plus, Search, UserRoundCog } from 'lucide-react'
import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { useAuth } from '../auth/auth'
import { useNow } from '../state/scoped'
import { CreateMenu } from './CreateMenu'
import { GlobalSearch } from './GlobalSearch'
import { leafFor, sectionFor } from './nav'
import { NotificationsButton } from './notifications'

export function Header({ onMenu }: { onMenu: () => void }) {
  const { pathname } = useLocation()
  const { site } = useAuth()
  const now = useNow(60_000)
  const [searchOpen, setSearchOpen] = useState(false)
  const section = sectionFor(pathname)
  const leaf = leafFor(pathname)

  return (
    <>
      <header className="flex h-14 shrink-0 items-center gap-3 print:hidden">
        <Button variant="card" size="icon-lg" className="md:hidden" aria-label="Open menu" onClick={onMenu}>
          <Menu />
        </Button>
        <div className="hidden min-w-0 shrink-0 md:block md:max-w-[14rem] lg:max-w-[18rem]">
          <h2 className="truncate text-lg font-bold leading-tight">{leaf?.label ?? section.label}</h2>
          <p className="truncate text-xs text-muted">
            {site?.name} · {fmtWeekday(now)} {fmtDate(now)}
          </p>
        </div>
        <GlobalSearch className="hidden min-w-0 flex-1 md:ml-4 md:block md:max-w-md" />
        <div className="ml-auto flex shrink-0 items-center gap-2">
          <Button variant="card" size="icon-lg" className="md:hidden" aria-label="Search" aria-expanded={searchOpen} onClick={() => setSearchOpen((v) => !v)}>
            <Search />
          </Button>
          <CreateMenu
            trigger={
              <Button className="hidden sm:inline-flex">
                <Plus />
                Create
              </Button>
            }
          />
          <NotificationsButton />
          <UserMenu />
        </div>
      </header>
      {searchOpen && (
        <div className="-mt-2 md:hidden">
          <GlobalSearch autoFocus onNavigate={() => setSearchOpen(false)} />
        </div>
      )}
    </>
  )
}

function UserMenu() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  if (!user) return null
  const leave = () => {
    signOut()
    navigate('/login')
  }
  return (
    <ActionMenu
      title={`${user.name} · ${ROLE_LABEL[user.role]}`}
      trigger={
        <button
          type="button"
          aria-label={`Account: ${user.name}`}
          className="flex h-11 items-center gap-2.5 rounded-full bg-card p-1.5 shadow-card transition-colors hover:bg-surface-2 xl:pr-4"
        >
          <Avatar name={user.name} color={user.color} size="sm" />
          <span className="hidden min-w-0 text-left xl:block">
            <span className="block max-w-[10rem] truncate text-sm font-semibold leading-tight">{user.name}</span>
            <span className="block max-w-[10rem] truncate text-[11px] text-muted">{ROLE_LABEL[user.role]}</span>
          </span>
        </button>
      }
      items={[
        { key: 'switch', label: 'Switch demo user', description: 'Try another role', icon: <UserRoundCog />, onSelect: leave },
        { key: 'out', label: 'Sign out', icon: <LogOut />, onSelect: leave },
      ]}
    />
  )
}
