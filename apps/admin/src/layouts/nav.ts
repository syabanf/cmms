import type { LucideIcon } from 'lucide-react'
import {
  Activity,
  BadgeCheck,
  BellRing,
  Building,
  CalendarClock,
  CalendarDays,
  ChartColumn,
  ClipboardCheck,
  ClipboardList,
  ClockFading,
  Database,
  Factory,
  Gauge,
  Grid3x3,
  HardHat,
  Hourglass,
  Inbox,
  LayoutGrid,
  ListChecks,
  Microscope,
  Package,
  Settings2,
  ShieldCheck,
  TriangleAlert,
  Users,
  Warehouse,
  Workflow,
  Wrench,
} from 'lucide-react'

/** Counts shown on navigation items. */
export type BadgeKey = 'newRequests' | 'approvals' | 'reorder'

export interface NavLeaf {
  to: string
  label: string
  icon: LucideIcon
  badge?: BadgeKey
}

export interface NavSection {
  id: string
  label: string
  icon: LucideIcon
  to: string
  items?: NavLeaf[]
}

export const NAV: NavSection[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutGrid, to: '/' },
  { id: 'assets', label: 'Assets', icon: Factory, to: '/assets' },
  {
    id: 'work',
    label: 'Work',
    icon: ClipboardList,
    to: '/work/orders',
    items: [
      { to: '/work/requests', label: 'Requests', icon: Inbox, badge: 'newRequests' },
      { to: '/work/orders', label: 'Work orders', icon: ClipboardList },
      { to: '/work/calendar', label: 'Calendar', icon: CalendarDays },
      { to: '/work/backlog', label: 'Backlog', icon: Hourglass },
      { to: '/work/approvals', label: 'Approvals', icon: BadgeCheck, badge: 'approvals' },
    ],
  },
  {
    id: 'preventive',
    label: 'Preventive',
    icon: CalendarClock,
    to: '/preventive/pm',
    items: [
      { to: '/preventive/pm', label: 'PM schedules', icon: CalendarClock },
      { to: '/preventive/job-plans', label: 'Job plans', icon: ListChecks },
      { to: '/preventive/inspections', label: 'Inspections', icon: ClipboardCheck },
      { to: '/preventive/calibration', label: 'Calibration', icon: Gauge },
    ],
  },
  {
    id: 'inventory',
    label: 'Inventory',
    icon: Package,
    to: '/inventory/parts',
    items: [
      { to: '/inventory/parts', label: 'Spare parts', icon: Package, badge: 'reorder' },
      { to: '/inventory/stock', label: 'Stock', icon: Warehouse },
      { to: '/inventory/tools', label: 'Tools', icon: Wrench },
    ],
  },
  {
    id: 'reliability',
    label: 'Reliability',
    icon: Activity,
    to: '/reliability/failures',
    items: [
      { to: '/reliability/failures', label: 'Failures', icon: TriangleAlert },
      { to: '/reliability/rca', label: 'RCA', icon: Microscope },
      { to: '/reliability/history', label: 'History', icon: ClockFading },
    ],
  },
  {
    id: 'people',
    label: 'People',
    icon: Users,
    to: '/people/technicians',
    items: [
      { to: '/people/technicians', label: 'Technicians', icon: HardHat },
      { to: '/people/skills', label: 'Skill matrix', icon: Grid3x3 },
      { to: '/people/vendors', label: 'Vendors', icon: Building },
    ],
  },
  { id: 'reports', label: 'Reports', icon: ChartColumn, to: '/reports' },
  {
    id: 'settings',
    label: 'Settings',
    icon: Settings2,
    to: '/settings/master-data',
    items: [
      { to: '/settings/master-data', label: 'Master data', icon: Database },
      { to: '/settings/rules', label: 'Work rules', icon: Workflow },
      { to: '/settings/notifications', label: 'Notifications', icon: BellRing },
      { to: '/settings/roles', label: 'Roles & access', icon: ShieldCheck },
    ],
  },
]

/** The section a path belongs to, by its first segment. */
export function sectionFor(pathname: string): NavSection {
  const segment = pathname.split('/')[1] ?? ''
  return NAV.find((s) => s.id === segment) ?? NAV[0]!
}

/** The section item a path belongs to (longest matching prefix). */
export function leafFor(pathname: string): NavLeaf | undefined {
  const items = sectionFor(pathname).items ?? []
  return [...items].sort((a, b) => b.to.length - a.to.length).find((i) => pathname === i.to || pathname.startsWith(`${i.to}/`))
}
