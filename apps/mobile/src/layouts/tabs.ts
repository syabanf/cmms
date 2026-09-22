import type { LucideIcon } from 'lucide-react'
import { ClipboardList, House, Inbox, ScanLine } from 'lucide-react'
import { paths } from '../lib/paths'

export type TabId = 'home' | 'work' | 'scan' | 'requests'

export interface TabDef {
  id: TabId
  to: string
  label: string
  icon: LucideIcon
}

const HOME: TabDef = { id: 'home', to: paths.home, label: 'Home', icon: House }
const WORK: TabDef = { id: 'work', to: paths.work(), label: 'Work', icon: ClipboardList }
const SCAN: TabDef = { id: 'scan', to: paths.scan, label: 'Scan', icon: ScanLine }
const REQUESTS: TabDef = { id: 'requests', to: paths.requests, label: 'Requests', icon: Inbox }

export const TECHNICIAN_TABS = [HOME, WORK, SCAN, REQUESTS]
export const REQUESTER_TABS = [HOME, SCAN, REQUESTS]

const TAB_ROOTS = new Set([HOME.to, WORK.to, SCAN.to, REQUESTS.to])

/** Tab roots show the bottom bar; every other route is a detail screen with a back button. */
export const isTabRoot = (pathname: string) => TAB_ROOTS.has(pathname)
