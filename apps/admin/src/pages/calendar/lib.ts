import type { CalendarItem } from '@cmms/fixtures'
import {
  addDays,
  addMonths,
  dayKey,
  fmtDate,
  fmtDateShort,
  fmtTime,
  fmtWeekday,
  fromDayKey,
  startOfDay,
  startOfMonth,
  startOfWeek,
  wib,
} from '@cmms/fixtures'
import { DONE_WO_STATUSES } from '@cmms/types'

export type CalendarView = 'month' | 'week' | 'day'
export const CALENDAR_VIEWS: CalendarView[] = ['month', 'week', 'day']

export const WEEKDAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

export interface Range {
  from: number
  to: number
}

/** The period a view covers: the month itself, the Monday-first week, or the day. */
export function periodRange(view: CalendarView, anchor: number): Range {
  if (view === 'month') {
    const from = startOfMonth(anchor)
    return { from, to: addMonths(from, 1) }
  }
  const from = view === 'week' ? startOfWeek(anchor) : startOfDay(anchor)
  return { from, to: addDays(from, view === 'week' ? 7 : 1) }
}

/** What the view draws. The month grid runs from the Monday before the 1st to the Sunday after the last day. */
export function gridRange(view: CalendarView, anchor: number): Range {
  const period = periodRange(view, anchor)
  if (view !== 'month') return period
  return { from: startOfWeek(period.from), to: addDays(startOfWeek(period.to - 1), 7) }
}

export function daysIn({ from, to }: Range): number[] {
  const days: number[] = []
  for (let day = from; day < to; day = addDays(day, 1)) days.push(day)
  return days
}

export function shiftAnchor(view: CalendarView, anchor: number, step: 1 | -1): number {
  if (view === 'month') return addMonths(startOfMonth(anchor), step)
  return addDays(anchor, view === 'week' ? 7 * step : step)
}

/** "September 2026", "21 to 27 Sep 2026", "Tue 22 Sep 2026" */
export function periodTitle(view: CalendarView, anchor: number): string {
  if (view === 'day') return `${fmtWeekday(anchor)} ${fmtDate(anchor)}`
  if (view === 'month') {
    const { year, month } = wib(anchor)
    return `${MONTH_NAMES[month]} ${year}`
  }
  const from = startOfWeek(anchor)
  const to = addDays(from, 6)
  const a = wib(from)
  const b = wib(to)
  if (a.year !== b.year) return `${fmtDate(from)} to ${fmtDate(to)}`
  if (a.month !== b.month) return `${fmtDateShort(from)} to ${fmtDate(to)}`
  return `${String(a.day).padStart(2, '0')} to ${fmtDate(to)}`
}

/** The same wall-clock time on another day. */
export function onDay(at: number, day: number): number {
  const { hours, minutes } = wib(at)
  return fromDayKey(dayKey(day), hours, minutes)
}

export type EntryTone = 'forecast' | 'done' | 'urgent' | 'planned' | 'neutral'

export function entryTone(item: CalendarItem): EntryTone {
  if (item.kind === 'pm_forecast') return 'forecast'
  if (item.status && DONE_WO_STATUSES.includes(item.status)) return 'done'
  if (item.priority === 'P1' || item.woType === 'emergency') return 'urgent'
  if (item.woType === 'preventive' || item.woType === 'inspection' || item.woType === 'calibration') return 'planned'
  return 'neutral'
}

export const TONE_CLASS: Record<EntryTone, string> = {
  forecast: 'border border-dashed border-silver bg-card text-muted',
  done: 'bg-surface text-muted line-through decoration-muted/60',
  urgent: 'bg-accent text-white',
  planned: 'bg-info-soft text-info',
  neutral: 'bg-surface text-body',
}

/** The overdue marker: an accent dot, white on the accent chip. */
export const overdueDotClass = (tone: EntryTone) => (tone === 'urgent' ? 'bg-white' : 'bg-accent')

export interface CalendarEntry {
  /** PM forecasts carry their job plan's work type. */
  item: CalendarItem
  /** Asset or tool code. */
  code: string
  label: string
  areaId: string | null
  tone: EntryTone
}

export function groupByDay(entries: readonly CalendarEntry[]): Map<string, CalendarEntry[]> {
  const days = new Map<string, CalendarEntry[]>()
  for (const entry of entries) {
    const key = dayKey(entry.item.at)
    const list = days.get(key)
    if (list) list.push(entry)
    else days.set(key, [entry])
  }
  return days
}

/** Month cells show three items, so urgent and overdue work goes first. */
export function byUrgency(a: CalendarEntry, b: CalendarEntry): number {
  const rank = (e: CalendarEntry) => (e.tone === 'urgent' ? 0 : e.item.overdue ? 1 : 2)
  return rank(a) - rank(b) || a.item.at - b.item.at
}

export const entryText = (e: CalendarEntry) =>
  `${e.code} ${e.label}, ${fmtWeekday(e.item.at)} ${fmtDateShort(e.item.at)} ${fmtTime(e.item.at)}${e.item.overdue ? ', overdue' : ''}`
