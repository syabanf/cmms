import type { WorkOrder } from '@cmms/types'
import { ActionMenu, type ActionMenuItem, Button } from '@cmms/ui'
import { EllipsisVertical, Factory, Pause, Play, Timer } from 'lucide-react'
import { useNavigate } from 'react-router'
import { RunningTimer } from '../../components/RunningTimer'
import { BackButton } from '../../layouts/DetailHeader'
import { paths } from '../../lib/paths'
import { useMobileScope } from '../../state/scope'

/**
 * Compact sticky header for the work order flow: back, order code, the signed-in technician's
 * running clock, and a menu for pause, time logging and the asset. Covers the notch when stuck.
 */
export function FlowHeader({
  wo,
  fallback,
  onPause,
  onResume,
  onLogTime,
}: {
  wo: WorkOrder
  fallback: string
  onPause?: () => void
  onResume?: () => void
  onLogTime?: () => void
}) {
  const { user, maps } = useMobileScope()
  const navigate = useNavigate()
  const asset = maps.asset.get(wo.assetId)
  const myClock = wo.labor.find((e) => e.personId === user.id && e.end === null)

  const items: ActionMenuItem[] = []
  if (onPause) items.push({ key: 'pause', label: 'Pause work', description: 'Say what you are waiting for', icon: <Pause />, onSelect: onPause })
  if (onResume) items.push({ key: 'resume', label: 'Resume work', description: 'Your clock starts again', icon: <Play />, onSelect: onResume })
  if (onLogTime) items.push({ key: 'time', label: 'Log time', description: 'Clock in or out, or add time you missed', icon: <Timer />, onSelect: onLogTime })
  if (asset) {
    items.push({
      key: 'asset',
      label: 'Open asset',
      description: `${asset.name} · ${asset.code}`,
      icon: <Factory />,
      onSelect: () => navigate(paths.asset(asset.code)),
    })
  }

  return (
    <header className="sticky top-0 z-30 -mx-5 -mt-[max(env(safe-area-inset-top),0.75rem)] bg-surface/90 px-5 pb-2 pt-[max(env(safe-area-inset-top),0.75rem)] backdrop-blur">
      <div className="flex items-center gap-2 pt-3">
        <BackButton fallback={fallback} />
        <div className="min-w-0 flex-1 pl-1">
          <p className="truncate font-mono text-sm font-bold leading-tight">{wo.code}</p>
          <p className="truncate text-xs text-muted">{asset ? `${asset.name} · ${asset.code}` : 'Removed asset'}</p>
        </div>
        {myClock ? (
          <span title="Your time on this job" className="flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-info-soft px-3 text-sm font-bold text-info">
            <span aria-hidden="true" className="size-2 animate-pulse rounded-full bg-info" />
            <RunningTimer since={myClock.start} />
          </span>
        ) : (
          wo.status === 'waiting' && (
            <span className="flex h-9 shrink-0 items-center rounded-full bg-warning-soft px-3 text-xs font-bold text-warning">Paused</span>
          )
        )}
        {items.length > 0 && (
          <ActionMenu
            title={wo.code}
            items={items}
            trigger={
              <Button variant="card" size="icon-lg" aria-label="Work order actions">
                <EllipsisVertical />
              </Button>
            }
          />
        )}
      </div>
    </header>
  )
}
