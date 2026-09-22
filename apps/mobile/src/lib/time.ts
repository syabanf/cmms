import { MINUTE, fmtDateShort, fmtDuration, fmtWeekday, toMs } from '@cmms/fixtures'
import type { IsoDate } from '@cmms/types'

/** "Hi Budi · Tue 22 Sep" */
export const greeting = (name: string, now: number) => `Hi ${name.split(' ')[0]} · ${fmtWeekday(now)} ${fmtDateShort(now)}`

/** Elapsed time as a running clock: "07:05" or "1:02:05". */
export function fmtTimer(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000))
  const hours = Math.floor(total / 3600)
  const minutes = String(Math.floor((total % 3600) / 60)).padStart(2, '0')
  const seconds = String(total % 60).padStart(2, '0')
  return hours ? `${hours}:${minutes}:${seconds}` : `${minutes}:${seconds}`
}

/** "Due in 2h 19m" or "Overdue by 20m". */
export function dueText(dueAt: IsoDate, now: number): string {
  const minutes = (toMs(dueAt) - now) / MINUTE
  return minutes >= 0 ? `Due in ${fmtDuration(minutes)}` : `Overdue by ${fmtDuration(-minutes)}`
}

/** A typed reading. Accepts the decimal comma used on Indonesian keyboards. */
export function parseReading(text: string): number | null {
  const trimmed = text.trim()
  if (!trimmed) return null
  const value = Number(trimmed.replace(',', '.'))
  return Number.isFinite(value) ? value : null
}
