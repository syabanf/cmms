import { type NotificationItem, deriveNotifications, fmtAgo } from '@cmms/fixtures'
import { NOTIFICATION_EVENT_LABEL } from '@cmms/types'
import {
  Button,
  EmptyState,
  IconTile,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  cn,
  useIsPhone,
} from '@cmms/ui'
import { Bell, BellOff, CalendarClock, Gauge, Package, Repeat, ShieldAlert, Siren, TriangleAlert } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import { paths } from '../components/links'
import { usePersistentState } from '../lib/storage'
import { useScoped } from '../state/scoped'

const EVENT_ICON = {
  pm_due_tomorrow: CalendarClock,
  pm_overdue: CalendarClock,
  critical_wo_created: Siren,
  wo_sla_exceeded: TriangleAlert,
  part_below_min: Package,
  calibration_expiring: Gauge,
  warranty_expiring: ShieldAlert,
  repeat_failure: Repeat,
  approval_required: ShieldAlert,
} as const

function targetPath(n: NotificationItem): string {
  switch (n.target.kind) {
    case 'wo':
      return paths.workOrder(n.target.id)
    case 'pm':
      return paths.pm(n.target.id)
    case 'part':
      return paths.part(n.target.id)
    case 'tool':
      return paths.tool(n.target.id)
    case 'asset':
    case 'repeat':
      return paths.asset(n.target.id)
  }
}

export function useNotifications() {
  const s = useScoped()
  return useMemo(
    () =>
      deriveNotifications({
        workOrders: s.workOrders,
        pmSchedules: s.pmSchedules,
        meters: s.maps.meter,
        assets: s.assets,
        tools: s.tools,
        parts: s.parts,
        stock: s.stock,
        warehouseIds: s.warehouseIds,
        failureCodes: s.maps.failureCode,
        repeatWindowDays: s.settings.repeatWindowDays,
      }),
    [s],
  )
}

export function NotificationsButton() {
  const items = useNotifications()
  const [readIds, setReadIds] = usePersistentState<string[]>('cmms.admin.read', [])
  const [open, setOpen] = useState(false)
  const isPhone = useIsPhone()
  const navigate = useNavigate()
  const unread = items.filter((i) => !readIds.includes(i.id)).length

  const openItem = (n: NotificationItem) => {
    setReadIds((ids) => (ids.includes(n.id) ? ids : [...ids, n.id]))
    setOpen(false)
    navigate(targetPath(n))
  }
  const markAll = () => setReadIds(items.map((i) => i.id))

  const trigger = (
    <Button variant="card" size="icon-lg" className="relative" aria-label={unread ? `Notifications, ${unread} unread` : 'Notifications'}>
      <Bell />
      {unread > 0 && (
        <span className="absolute -right-1 -top-1 flex h-[19px] min-w-[19px] items-center justify-center rounded-full border-2 border-surface bg-accent px-1 text-[10.5px] font-bold text-on-ink">
          {unread > 99 ? '99+' : unread}
        </span>
      )}
    </Button>
  )

  const body = (
    <>
      <div className="flex items-center justify-between gap-3 px-4 pb-2 pt-4">
        <div>
          <p className="text-base font-semibold">Notifications</p>
          <p className="text-xs text-muted">{unread ? `${unread} unread` : 'All caught up'}</p>
        </div>
        <Button variant="ghost" size="sm" onClick={markAll} disabled={!unread}>
          Mark all read
        </Button>
      </div>
      <div className="max-h-[min(70dvh,480px)] overflow-y-auto p-2">
        {items.length === 0 ? (
          <EmptyState compact icon={<BellOff />} title="Nothing needs attention" description="PM, stock, calibration and approval alerts show up here." />
        ) : (
          items.map((n) => {
            const Icon = EVENT_ICON[n.event]
            const isRead = readIds.includes(n.id)
            return (
              <button
                key={n.id}
                type="button"
                onClick={() => openItem(n)}
                className={cn('flex w-full items-start gap-3 rounded-2xl p-3 text-left transition-colors hover:bg-surface', isRead && 'opacity-70')}
              >
                <IconTile size="sm" tone={n.severity === 'danger' ? 'danger' : n.severity === 'warning' ? 'warning' : 'info'}>
                  <Icon />
                </IconTile>
                <span className="min-w-0 flex-1">
                  <span className="flex items-start justify-between gap-2">
                    <span className="text-sm font-semibold leading-snug">{n.title}</span>
                    {!isRead && <span className="mt-1.5 size-2 shrink-0 rounded-full bg-accent" aria-label="Unread" />}
                  </span>
                  <span className="mt-0.5 block text-xs text-muted">{n.body}</span>
                  <span className="mt-1 block text-[11px] font-medium text-silver">
                    {NOTIFICATION_EVENT_LABEL[n.event]} · {fmtAgo(n.at)}
                  </span>
                </span>
              </button>
            )
          })
        )}
      </div>
    </>
  )

  if (isPhone) {
    return (
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>{trigger}</SheetTrigger>
        <SheetContent side="bottom" aria-describedby={undefined}>
          <SheetHeader className="sr-only">
            <SheetTitle>Notifications</SheetTitle>
          </SheetHeader>
          {body}
        </SheetContent>
      </Sheet>
    )
  }
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent align="end" className="w-[400px] p-0">
        {body}
      </PopoverContent>
    </Popover>
  )
}
