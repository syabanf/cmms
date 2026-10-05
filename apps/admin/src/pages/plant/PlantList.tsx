import { Card, EmptyState, IconTile, UnderlineTabs, cn } from '@cmms/ui'
import { ChevronRight, ClipboardList, HardHat, PartyPopper, TriangleAlert, UserRoundX } from 'lucide-react'
import type { ReactNode } from 'react'
import type { PlantListRow, PlantTab } from './lib'

const TABS: {
  value: PlantTab
  label: string
  icon: ReactNode
  empty: { icon: ReactNode; title: string; description: string }
}[] = [
  {
    value: 'attention',
    label: 'Attention',
    icon: <TriangleAlert />,
    empty: {
      icon: <PartyPopper />,
      title: 'Nothing needs attention',
      description: 'No machine is down and no P1 or overdue work is open.',
    },
  },
  {
    value: 'work',
    label: 'Work',
    icon: <ClipboardList />,
    empty: {
      icon: <ClipboardList />,
      title: 'No open work',
      description: 'Work orders from requests and PM schedules appear here.',
    },
  },
  {
    value: 'people',
    label: 'People',
    icon: <HardHat />,
    empty: {
      icon: <UserRoundX />,
      title: 'Nobody is on the clock',
      description: 'Technicians appear here while their labor clock runs.',
    },
  },
]

/** Attention, work and people at the site. A row selects its machine and flies the camera there. */
export function PlantList({
  tab,
  onTab,
  rows,
  isCurrent,
  onPick,
  className,
}: {
  tab: PlantTab
  onTab: (tab: PlantTab) => void
  rows: Record<PlantTab, PlantListRow[]>
  isCurrent: (row: PlantListRow) => boolean
  onPick: (row: PlantListRow) => void
  className?: string
}) {
  const current = TABS.find((t) => t.value === tab) ?? TABS[0]!
  const list = rows[current.value]

  return (
    <Card className={cn('flex flex-col', className)}>
      <div className="px-4 pt-2">
        <UnderlineTabs
          size="sm"
          items={TABS.map((t) => ({ value: t.value, label: t.label, count: rows[t.value].length }))}
          value={current.value}
          onValueChange={(value) => {
            const next = TABS.find((t) => t.value === value)
            if (next) onTab(next.value)
          }}
        />
      </div>
      {list.length > 0 ? (
        <ul className="max-h-72 space-y-1 p-2 xl:max-h-52 overflow-y-auto">
          {list.map((row) => {
            const active = isCurrent(row)
            return (
              <li key={row.key}>
                <button
                  type="button"
                  aria-pressed={active}
                  onClick={() => onPick(row)}
                  className={cn(
                    'gap-3 rounded-2xl p-2.5 flex w-full items-center text-left transition-colors hover:bg-surface-2 focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:outline-none',
                    active && 'bg-surface-2',
                  )}
                >
                  <IconTile size="sm" tone={row.tone}>
                    {current.icon}
                  </IconTile>
                  <span className="min-w-0 flex-1">
                    <span className="text-sm font-semibold block truncate">{row.title}</span>
                    <span className="text-xs block truncate text-muted">{row.detail}</span>
                  </span>
                  <ChevronRight aria-hidden="true" className="size-4 shrink-0 text-muted" />
                </button>
              </li>
            )
          })}
        </ul>
      ) : (
        <EmptyState
          compact
          icon={current.empty.icon}
          title={current.empty.title}
          description={current.empty.description}
        />
      )}
    </Card>
  )
}
