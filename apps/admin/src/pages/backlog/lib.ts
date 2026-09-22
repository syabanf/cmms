import { type BacklogRow, fmtAgo } from '@cmms/fixtures'
import type { WaitingReason } from '@cmms/types'

export type BacklogView = 'all' | 'ready' | 'blocked' | 'overdue'

/** Open or assigned work with no start date yet: the planner's next pick. */
export const isReady = (r: BacklogRow) => (r.wo.status === 'open' || r.wo.status === 'assigned') && !r.wo.scheduledAt

export const VIEW_TEST: Record<BacklogView, (r: BacklogRow) => boolean> = {
  all: () => true,
  ready: isReady,
  blocked: (r) => r.wo.status === 'waiting',
  overdue: (r) => r.overdue,
}

export const BACKLOG_VIEWS = Object.keys(VIEW_TEST) as BacklogView[]

export const asView = (value: string): BacklogView => BACKLOG_VIEWS.find((v) => v === value) ?? 'all'

/** Work older than this reads as aged in the table. */
export const AGED_DAYS = 14

export const sumHours = (rows: readonly BacklogRow[]) => rows.reduce((sum, r) => sum + r.manHours, 0)

export const fmtAge = (days: number) => (days < 1 ? '<1 d' : `${Math.floor(days)} d`)

export const lateBy = (dueAt: string, now: number) => `${fmtAgo(dueAt, now).replace(' ago', '')} late`

/** Age in days of the longest wait for one reason. */
export const oldestWait = (rows: readonly BacklogRow[], reason: WaitingReason) =>
  Math.max(0, ...rows.filter((r) => r.wo.status === 'waiting' && r.wo.waitingReason === reason).map((r) => r.ageDays))
