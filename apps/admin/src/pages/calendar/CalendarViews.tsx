import { dayKey, fmtDate, fmtDateShort, fmtDuration, fmtTime, fmtWeekday, isSameDay, plural, startOfDay, wib } from '@cmms/fixtures'
import { ACTIVE_WO_STATUSES, WO_TYPE_LABEL } from '@cmms/types'
import { Badge, EmptyState, cn } from '@cmms/ui'
import { CalendarDays } from 'lucide-react'
import { type ComponentProps, type DragEvent, type ReactNode, useState } from 'react'
import { WoStatusBadge } from '../../components/badges'
import { useScoped } from '../../state/scoped'
import { EntryChip, EntryOverlay } from './EntryChip'
import { type CalendarEntry, type EntryTone, type Range, TONE_CLASS, WEEKDAY_NAMES, byUrgency, daysIn, overdueDotClass } from './lib'

const DRAG_TYPE = 'application/x-cmms-work-order'

/** Drag an open work order onto another day. Days before today refuse the drop. */
export function useDayDrop(enabled: boolean, now: number, onMove: (woId: string, day: number) => void) {
  const [over, setOver] = useState<number | null>(null)
  const today = startOfDay(now)

  const source = ({ item }: CalendarEntry) => {
    const woId = item.woId
    if (!enabled || !woId || !item.status || !ACTIVE_WO_STATUSES.includes(item.status)) return {}
    return {
      draggable: true,
      onDragStart: (e: DragEvent<HTMLElement>) => {
        e.dataTransfer.setData(DRAG_TYPE, woId)
        e.dataTransfer.effectAllowed = 'move'
      },
      onDragEnd: () => setOver(null),
    }
  }

  const target = (day: number) => {
    if (!enabled || day < today) return {}
    return {
      'data-over': over === day || undefined,
      onDragOver: (e: DragEvent<HTMLElement>) => {
        if (!e.dataTransfer.types.includes(DRAG_TYPE)) return
        e.preventDefault()
        e.dataTransfer.dropEffect = 'move'
        setOver(day)
      },
      onDragLeave: (e: DragEvent<HTMLElement>) => {
        if (!(e.relatedTarget instanceof Node) || !e.currentTarget.contains(e.relatedTarget)) setOver(null)
      },
      onDrop: (e: DragEvent<HTMLElement>) => {
        setOver(null)
        const woId = e.dataTransfer.getData(DRAG_TYPE)
        if (!woId) return
        e.preventDefault()
        onMove(woId, day)
      },
    }
  }

  return { source, target }
}

type DayDrop = ReturnType<typeof useDayDrop>

interface GridProps {
  grid: Range
  byDay: Map<string, CalendarEntry[]>
  now: number
  drop: DayDrop
  onOpenDay: (day: number) => void
}

function DayNumber({ day, now, muted = false, onOpenDay }: { day: number; now: number; muted?: boolean; onOpenDay: (day: number) => void }) {
  return (
    <button
      type="button"
      onClick={() => onOpenDay(day)}
      aria-label={`Open ${fmtWeekday(day)} ${fmtDate(day)}`}
      className={cn(
        'flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40',
        isSameDay(day, now) ? 'bg-ink text-on-ink' : cn('hover:bg-surface', muted ? 'text-muted' : 'text-foreground'),
      )}
    >
      {wib(day).day}
    </button>
  )
}

/** Desktop and tablet month: seven columns, three items per day, the rest behind "+N more". */
export function MonthGrid({ grid, period, byDay, now, drop, onOpenDay }: GridProps & { period: Range }) {
  const days = daysIn(grid)
  return (
    <div>
      <div className="grid grid-cols-7 border-b border-border">
        {WEEKDAY_NAMES.map((name) => (
          <div key={name} className="px-2 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted">
            {name}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((day, i) => {
          const list = [...(byDay.get(dayKey(day)) ?? [])].sort(byUrgency)
          const inMonth = day >= period.from && day < period.to
          return (
            <div
              key={day}
              {...drop.target(day)}
              className={cn(
                'flex min-h-28 min-w-0 flex-col gap-1 border-border p-1.5 transition-colors data-[over]:bg-info-soft',
                i % 7 < 6 && 'border-r',
                i < days.length - 7 && 'border-b',
                !inMonth && 'bg-surface-2',
              )}
            >
              <DayNumber day={day} now={now} muted={!inMonth} onOpenDay={onOpenDay} />
              {list.slice(0, 3).map((entry) => (
                <EntryOverlay key={entry.item.id} entry={entry}>
                  <EntryChip entry={entry} variant="compact" {...drop.source(entry)} />
                </EntryOverlay>
              ))}
              {list.length > 3 && (
                <button
                  type="button"
                  onClick={() => onOpenDay(day)}
                  className="self-start rounded-full px-2 py-0.5 text-[11px] font-semibold text-muted transition-colors hover:bg-surface hover:text-foreground"
                >
                  +{list.length - 3} more
                </button>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

/** Phone month: an agenda of the days that have something on them. */
export function MonthAgenda({
  period,
  byDay,
  now,
  onOpenDay,
  emptyAction,
}: {
  period: Range
  byDay: Map<string, CalendarEntry[]>
  now: number
  onOpenDay: (day: number) => void
  emptyAction: ReactNode
}) {
  const days = daysIn(period).filter((day) => byDay.has(dayKey(day)))
  if (!days.length) {
    return (
      <EmptyState
        icon={<CalendarDays />}
        title="Nothing planned this month"
        description="Scheduled work, PM forecasts and calibration due dates show here."
        action={emptyAction}
      />
    )
  }
  return (
    <div className="divide-y divide-border">
      {days.map((day) => {
        const list = byDay.get(dayKey(day)) ?? []
        return (
          <section key={day} className="px-4 py-3">
            <div className="mb-2 flex items-center gap-2">
              <button type="button" onClick={() => onOpenDay(day)} className="text-sm font-semibold transition-colors hover:text-accent">
                {fmtWeekday(day)} {fmtDateShort(day)}
              </button>
              {isSameDay(day, now) && <Badge variant="ink">Today</Badge>}
              <span className="ml-auto text-xs text-muted">{plural(list.length, 'item')}</span>
            </div>
            <div className="space-y-1.5">
              {list.map((entry) => (
                <EntryOverlay key={entry.item.id} entry={entry}>
                  <EntryChip entry={entry} variant="row" />
                </EntryOverlay>
              ))}
            </div>
          </section>
        )
      })}
    </div>
  )
}

/** Seven columns from `md` up; a stack of days on phones. */
export function WeekGrid({ grid, byDay, now, drop, onOpenDay }: GridProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-7">
      {daysIn(grid).map((day, i) => {
        const list = byDay.get(dayKey(day)) ?? []
        return (
          <section
            key={day}
            aria-label={`${fmtWeekday(day)} ${fmtDate(day)}`}
            {...drop.target(day)}
            className={cn(
              'flex min-w-0 flex-col border-border transition-colors data-[over]:bg-info-soft',
              i < 6 && 'border-b md:border-b-0 md:border-r',
            )}
          >
            <header className="flex items-center gap-2 px-3 pb-1 pt-3">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-muted">{WEEKDAY_NAMES[i]}</span>
              <DayNumber day={day} now={now} onOpenDay={onOpenDay} />
              <span className="ml-auto text-xs text-muted md:hidden">{list.length ? plural(list.length, 'item') : 'Nothing planned'}</span>
            </header>
            <div className="flex flex-col gap-1.5 p-2 pt-1 md:min-h-80">
              {list.map((entry) => (
                <EntryOverlay key={entry.item.id} entry={entry}>
                  <EntryChip entry={entry} variant="block" {...drop.source(entry)} />
                </EntryOverlay>
              ))}
            </div>
          </section>
        )
      })}
    </div>
  )
}

/** One day as an ordered agenda with the details a planner scans for. */
export function DayAgenda({ entries, emptyAction }: { entries: CalendarEntry[]; emptyAction: ReactNode }) {
  if (!entries.length) {
    return (
      <EmptyState
        icon={<CalendarDays />}
        title="Nothing planned on this day"
        description="Work orders, PM forecasts and calibration due dates for the day show here."
        action={emptyAction}
      />
    )
  }
  return (
    <ol className="space-y-1 p-2">
      {entries.map((entry) => (
        <li key={entry.item.id}>
          <EntryOverlay entry={entry}>
            <DayRow entry={entry} />
          </EntryOverlay>
        </li>
      ))}
    </ol>
  )
}

function DayRow({ entry, className, ...props }: ComponentProps<'button'> & { entry: CalendarEntry }) {
  const { maps, personName, locationPath } = useScoped()
  const { item, tone } = entry
  const asset = item.assetId ? maps.asset.get(item.assetId) : undefined
  const tool = item.toolId ? maps.tool.get(item.toolId) : undefined
  const wo = item.woId ? maps.workOrder.get(item.woId) : undefined
  const place = asset ? `${asset.name} · ${locationPath(asset.locationId)}` : (tool?.location ?? '')
  const people = item.kind === 'calibration' ? null : item.assigneeIds.map((id) => personName(id)).join(', ') || 'Unassigned'
  const meta = [wo?.code, fmtDuration(item.durationMin), people].filter(Boolean).join(' · ')

  return (
    <button
      type="button"
      className={cn(
        'flex w-full items-start gap-3 rounded-2xl p-3 text-left transition-colors hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40',
        className,
      )}
      {...props}
    >
      <span className="w-12 shrink-0 pt-0.5 text-sm font-semibold tabular-nums">{fmtTime(item.at)}</span>
      <span className="min-w-0 flex-1">
        <span className="flex min-w-0 flex-wrap items-center gap-2">
          <KindPill tone={tone} overdue={item.overdue}>
            {item.kind === 'pm_forecast' ? 'PM forecast' : WO_TYPE_LABEL[item.woType]}
          </KindPill>
          <span className="min-w-0 truncate font-semibold">{entry.label}</span>
        </span>
        <span className="mt-0.5 block truncate text-xs text-muted">
          <span className="font-mono">{entry.code}</span>
          {place ? ` · ${place}` : ''}
        </span>
        <span className="mt-1 block truncate text-xs text-muted">
          {meta}
          {item.overdue && <span className="font-semibold text-accent"> · overdue</span>}
        </span>
      </span>
      {wo && (
        <span className="hidden shrink-0 sm:block">
          <WoStatusBadge status={wo.status} waitingReason={wo.waitingReason} />
        </span>
      )}
    </button>
  )
}

function KindPill({ tone, overdue = false, children }: { tone: EntryTone; overdue?: boolean; children: ReactNode }) {
  return (
    <span className={cn('inline-flex h-6 shrink-0 items-center gap-1.5 rounded-full px-2.5 text-[11px] font-semibold', TONE_CLASS[tone])}>
      {overdue && <span aria-hidden="true" className={cn('size-1.5 rounded-full', overdueDotClass(tone))} />}
      {children}
    </span>
  )
}

const LEGEND: { tone: EntryTone; label: string }[] = [
  { tone: 'planned', label: 'Preventive, inspection, calibration' },
  { tone: 'neutral', label: 'Corrective, improvement' },
  { tone: 'urgent', label: 'P1 or emergency' },
  { tone: 'forecast', label: 'PM forecast' },
  { tone: 'done', label: 'Done' },
]

export function Legend({ hint }: { hint?: string }) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-border px-5 py-3">
      {LEGEND.map((l) => (
        <KindPill key={l.tone} tone={l.tone}>
          {l.label}
        </KindPill>
      ))}
      <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-body">
        <span aria-hidden="true" className="size-1.5 rounded-full bg-accent" />
        Overdue
      </span>
      {hint && <span className="text-xs text-muted md:ml-auto">{hint}</span>}
    </div>
  )
}
