import { plural } from '@cmms/fixtures'
import { Card, IconTile, type Tone, cn } from '@cmms/ui'
import { ClipboardList, Factory, HardHat } from 'lucide-react'
import type { ReactNode } from 'react'
import type { PlantStats as Stats, PlantTab } from './lib'

interface Cell {
  tab: PlantTab
  label: string
  value: number
  unit?: string
  hint: string
  icon: ReactNode
  tone: Tone
}

/** Three site figures in one strip; each opens the list tab behind it. */
export function PlantStats({
  stats,
  onPick,
  className,
}: {
  stats: Stats
  onPick: (tab: PlantTab) => void
  className?: string
}) {
  const stopped = [stats.down && `${stats.down} down`, stats.standby && `${stats.standby} on standby`]
    .filter(Boolean)
    .join(' · ')
  const cells: Cell[] = [
    {
      tab: 'attention',
      label: 'Machines running',
      value: stats.running,
      unit: `of ${stats.machines}`,
      hint: stopped || 'None stopped',
      icon: <Factory />,
      tone: stats.down ? 'danger' : 'success',
    },
    {
      tab: 'work',
      label: 'Active work orders',
      value: stats.activeWork,
      hint: `${stats.inProgress} in progress · ${stats.waiting} waiting`,
      icon: <ClipboardList />,
      tone: 'info',
    },
    {
      tab: 'people',
      label: 'Technicians at work',
      value: stats.crew,
      unit: `on ${plural(stats.jobs, 'job')}`,
      hint: 'Clocked in right now',
      icon: <HardHat />,
      tone: 'default',
    },
  ]

  return (
    <Card
      className={cn(
        'sm:grid-cols-3 sm:divide-x sm:divide-y-0 grid grid-cols-1 divide-y divide-border overflow-hidden',
        className,
      )}
    >
      {cells.map((cell) => (
        <button
          key={cell.tab}
          type="button"
          onClick={() => onPick(cell.tab)}
          className="min-w-0 gap-3 px-4 py-3 flex items-center text-left transition-colors hover:bg-surface-2 focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:outline-none focus-visible:ring-inset"
        >
          <IconTile tone={cell.tone}>{cell.icon}</IconTile>
          <span className="min-w-0">
            <span className="text-xs font-medium block truncate text-muted">{cell.label}</span>
            <span className="mt-1 gap-1 flex items-start leading-none">
              <span className="font-extrabold text-[22px] tracking-[-0.5px] tabular-nums">{cell.value}</span>
              {cell.unit && (
                <span className="pt-0.5 text-xs font-semibold whitespace-nowrap text-muted">{cell.unit}</span>
              )}
            </span>
            <span className="mt-1 block truncate text-[11px] text-muted">{cell.hint}</span>
          </span>
        </button>
      ))}
    </Card>
  )
}
