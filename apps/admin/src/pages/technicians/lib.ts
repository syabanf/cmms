import {
  DAY,
  MINUTE,
  type TechnicianLoad,
  fmtDate,
  fmtDateShort,
  fmtWeekday,
  runningLabor,
  startOfDay,
  startOfWeek,
  technicianLoad,
  toMs,
  wib,
} from '@cmms/fixtures'
import type {
  Availability,
  Certification,
  LaborEntry,
  Person,
  Settings,
  Shift,
  Skill,
  SkillLevel,
  TechnicianProfile,
  WorkOrder,
} from '@cmms/types'

/** Shift hours in plant time, as in SHIFT_LABEL. Shift C runs past midnight. */
const SHIFT_HOURS: Record<Shift, readonly [start: number, end: number]> = {
  A: [7, 15],
  B: [15, 23],
  C: [23, 7],
  N: [8, 17],
}

export function inShiftHours(shift: Shift, now: number): boolean {
  const { hours, minutes } = wib(now)
  const h = hours + minutes / 60
  const [start, end] = SHIFT_HOURS[shift]
  return start < end ? h >= start && h < end : h >= start || h < end
}

export const shiftStart = (shift: Shift) => `${String(SHIFT_HOURS[shift][0]).padStart(2, '0')}:00`

/** A rostered technician counts as off shift outside their shift hours. */
function availabilityNow(profile: TechnicianProfile, now: number): Availability {
  return profile.availability === 'on_shift' && !inShiftHours(profile.shift, now)
    ? 'off_shift'
    : profile.availability
}

export const AVAILABILITIES: Availability[] = ['on_shift', 'off_shift', 'leave']

/** What a technician's badge shows. A running labor clock beats the roster. */
export type Presence = Availability | 'clocked_in'

export const presenceOf = (profile: TechnicianProfile, clockedIn: boolean, now: number): Presence =>
  clockedIn ? 'clocked_in' : availabilityNow(profile, now)

/** This week's logged hours, finished jobs and open load per technician, by person id. */
export function loadThisWeek(
  people: readonly Person[],
  workOrders: readonly WorkOrder[],
  settings: Settings,
  now: number,
): Map<string, TechnicianLoad> {
  const weekStart = startOfWeek(now)
  return new Map(
    technicianLoad(people, workOrders, settings, weekStart, weekStart + 7 * DAY, now).map((l) => [
      l.person.id,
      l,
    ]),
  )
}

/** People with a labor clock running on any of the work orders. */
export const clockedInIds = (workOrders: readonly WorkOrder[]) =>
  new Set(workOrders.flatMap((w) => runningLabor(w).map((e) => e.personId)))

/** Certificates this close to expiry get a warning. */
export const CERT_WARNING_DAYS = 60

export const certDaysLeft = (cert: Certification, now: number) =>
  cert.expiresAt ? Math.ceil((toMs(cert.expiresAt) - now) / DAY) : null

export interface CertAlert {
  cert: Certification
  expiresAt: string
  daysLeft: number
}

/** The certificate to renew first: expired, or expiring inside the warning window. */
export function certAlert(certs: readonly Certification[], now: number): CertAlert | null {
  let first: CertAlert | null = null
  for (const cert of certs) {
    if (!cert.expiresAt) continue
    const daysLeft = Math.ceil((toMs(cert.expiresAt) - now) / DAY)
    if (daysLeft > CERT_WARNING_DAYS) continue
    if (!first || daysLeft < first.daysLeft) first = { cert, expiresAt: cert.expiresAt, daysLeft }
  }
  return first
}

export const certAlertText = ({ cert, expiresAt, daysLeft }: CertAlert) =>
  `${cert.name} ${daysLeft < 0 ? 'expired' : 'expires'} ${fmtDate(expiresAt)}`

export const SKILL_LEVELS: SkillLevel[] = [0, 1, 2, 3]

export interface HeldSkill {
  skill: Skill
  level: SkillLevel
}

/** Skills the technician holds, strongest first, master-data order within a level. */
export function heldSkills(profile: TechnicianProfile, skills: readonly Skill[]): HeldSkill[] {
  return skills
    .map((skill) => ({ skill, level: profile.skills[skill.id] ?? 0 }))
    .filter((s) => s.level > 0)
    .sort((a, b) => b.level - a.level)
}

export interface LaborRow {
  entry: LaborEntry
  wo: WorkOrder
}

/** A person's labor entries still running or ending after `from`, newest first. */
export function laborSince(
  workOrders: readonly WorkOrder[],
  personId: string,
  from: number,
  now: number,
): LaborRow[] {
  return workOrders
    .flatMap((wo) =>
      wo.labor
        .filter((e) => e.personId === personId && (e.end ? toMs(e.end) : now) > from)
        .map((entry) => ({ entry, wo })),
    )
    .sort((a, b) => toMs(b.entry.start) - toMs(a.entry.start))
}

/** Logged hours per calendar day for the last `days` days, today last. */
export function hoursPerDay(rows: readonly LaborRow[], days: number, now: number) {
  const today = startOfDay(now)
  return Array.from({ length: days }, (_, i) => {
    const from = today - (days - 1 - i) * DAY
    const to = from + DAY
    const minutes = rows.reduce((sum, { entry }) => {
      const start = Math.max(toMs(entry.start), from)
      const end = Math.min(entry.end ? toMs(entry.end) : now, to)
      return end > start ? sum + (end - start) / MINUTE : sum
    }, 0)
    return {
      label: from === today ? 'Today' : `${fmtWeekday(from)} ${fmtDateShort(from)}`,
      value: minutes / 60,
    }
  })
}

/** Work permits the dialog suggests; people can add their own. */
export const AUTHORIZATION_SUGGESTIONS = [
  'LOTO',
  'High voltage',
  'Hot work',
  'Work at height',
  'Confined space',
]

export const AVATAR_COLORS = [
  { value: '#0F766E', label: 'Teal' },
  { value: '#0369A1', label: 'Blue' },
  { value: '#1D4ED8', label: 'Royal blue' },
  { value: '#7C3AED', label: 'Violet' },
  { value: '#9333EA', label: 'Purple' },
  { value: '#BE185D', label: 'Pink' },
  { value: '#9F1239', label: 'Crimson' },
  { value: '#C2410C', label: 'Orange' },
  { value: '#B45309', label: 'Amber' },
  { value: '#A16207', label: 'Ochre' },
  { value: '#4D7C0F', label: 'Olive' },
  { value: '#475569', label: 'Slate' },
]
