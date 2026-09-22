// Twelve months of closed work: PM occurrences, random failures, improvements and calibrations.
import type { Asset, CalibrationRecord, Priority, TaskResult, WoType } from '../../packages/types/src/index.ts'
import { DAY, HOUR, MINUTE, addInterval, addMonths, dayKey, fromWib, startOfDay, toIso, wib } from '../../packages/fixtures/src/dates.ts'
import { A, assets, meters } from './assets.ts'
import { STOCK_TARGET } from './master.ts'
import { type MrSpec, type PartSpec, type WoSpec, NOW, severityFor } from './build.ts'
import { JP, PM_DEFS } from './plans.ts'
import { createRng, rng } from './rng.ts'

const extraRng = createRng(99)
import { tools } from './tools.ts'

export const HISTORY_START = addMonths(NOW, -12)
const day = (s: string, h = 0, m = 0) => {
  const [y, mo, d] = s.split('-').map(Number)
  return fromWib(y!, mo! - 1, d!, h, m)
}

// ─── Teams, people and shifts ───────────────────────────────────

const TECHS: Record<string, [id: string, shift: 'A' | 'B' | 'C' | 'N'][]> = {
  'team-bdg-mech': [
    ['per-budi', 'A'],
    ['per-andi', 'A'],
    ['per-rizky', 'A'],
    ['per-agus', 'B'],
    ['per-joko', 'C'],
  ],
  'team-bdg-elec': [
    ['per-wahyu', 'A'],
    ['per-eko', 'B'],
    ['per-deni', 'C'],
  ],
  'team-bdg-utl': [
    ['per-taufik', 'N'],
    ['per-joko', 'C'],
  ],
  'team-bdg-inst': [
    ['per-lina', 'N'],
    ['per-wahyu', 'A'],
  ],
  'team-ckr-mnt': [
    ['per-galih', 'A'],
    ['per-hadi', 'A'],
    ['per-fikri', 'B'],
  ],
}
export const SUPERVISOR: Record<string, string> = {
  'team-bdg-mech': 'per-hendra',
  'team-bdg-utl': 'per-hendra',
  'team-bdg-elec': 'per-yusuf',
  'team-bdg-inst': 'per-yusuf',
  'team-ckr-mnt': 'per-irfan',
}
const plannerFor = (team: string) => (team.includes('ckr') ? 'per-irfan' : 'per-dimas')

function onShift(shift: 'A' | 'B' | 'C' | 'N', hour: number) {
  if (shift === 'A') return hour >= 7 && hour < 15
  if (shift === 'B') return hour >= 15 && hour < 23
  if (shift === 'C') return hour >= 23 || hour < 7
  return hour >= 8 && hour < 17
}

export function pickTechs(team: string, at: number, count: number): string[] {
  const pool = TECHS[team] ?? TECHS['team-bdg-mech']!
  const hour = wib(at).hours
  const available = pool.filter(([, s]) => onShift(s, hour)).map(([id]) => id)
  const ordered = [...(available.length ? available : pool.map(([id]) => id))]
  const out: string[] = []
  while (out.length < count && ordered.length) out.push(ordered.splice(rng.int(0, ordered.length - 1), 1)[0]!)
  return out
}

const REQUESTER_BY_LOCATION: Record<string, string[]> = {
  'loc-bdg-pol': ['per-asep'],
  'loc-bdg-ctg': ['per-asep', 'per-dewi'],
  'loc-bdg-cnc': ['per-rudi'],
  'loc-bdg-prs': ['per-rudi'],
  'loc-bdg-mld': ['per-rudi'],
  'loc-bdg-as1': ['per-dewi'],
  'loc-bdg-pck': ['per-dewi'],
}
function requesterFor(asset: Asset): string {
  if (asset.siteId === 'site-ckr') return 'per-nina'
  return rng.pick(REQUESTER_BY_LOCATION[asset.locationId] ?? ['per-taufik', 'per-hendra'])
}

// ─── Failure modes ──────────────────────────────────────────────

type ModeDef = {
  problems: string[]
  causes: (readonly [string, number])[]
  remedies: string[]
  minutes: [number, number]
  downtime: number
  team: 'mech' | 'elec' | 'inst'
  titles: (asset: Asset) => string[]
  notes: string[]
  parts: (asset: Asset) => PartSpec[]
  vendor?: [id: string, chance: number, min: number, max: number]
}

const consumed = (code: string, qty: number): PartSpec => ({ code, qty, status: 'consumed' })

const MODES: Record<string, ModeDef> = {
  'FM-BW': {
    problems: ['PRB-VB', 'PRB-NS', 'PRB-HT'],
    causes: [
      ['CS-LB', 3],
      ['CS-WR', 3],
      ['CS-CT', 2],
      ['CS-OV', 1],
    ],
    remedies: ['RM-RP'],
    minutes: [90, 240],
    downtime: 0.5,
    team: 'mech',
    titles: () => ['Bearing noise at drive end', 'High vibration, bearing suspected', 'Bearing running hot'],
    notes: ['Outer race pitted, replaced both bearings.', 'Bearing dry, grease discoloured.', 'Cage broken on the drive end bearing.'],
    parts: (a) => {
      if (a.typeId === 'at-polisher' || a.typeId === 'at-motor') return [consumed('BRG-6204', 2), consumed('SEL-ABC', 1)]
      if (a.typeId === 'at-conveyor' || a.typeId === 'at-pump' || a.typeId === 'at-tower') return [consumed('BRG-6205', 2)]
      if (a.typeId === 'at-lathe' || a.typeId === 'at-vmc') return rng.chance(0.35) ? [consumed('BRG-7014', 1)] : []
      return [consumed('BRG-6308', 2)]
    },
  },
  'FM-MA': {
    problems: ['PRB-VB', 'PRB-NS'],
    causes: [
      ['CS-IE', 2],
      ['CS-VB', 2],
    ],
    remedies: ['RM-AL'],
    minutes: [60, 150],
    downtime: 0.3,
    team: 'mech',
    titles: () => ['Vibration after belt change', 'Coupling misalignment', 'Motor and gearbox out of line'],
    notes: ['Laser aligned motor to gearbox, 0.04 mm offset corrected.', 'Soft foot on motor base shimmed.'],
    parts: () => (rng.chance(0.3) ? [consumed('CPL-XYZ', 1)] : []),
  },
  'FM-BB': {
    problems: ['PRB-NS', 'PRB-SM', 'PRB-ST'],
    causes: [
      ['CS-WR', 3],
      ['CS-AG', 2],
      ['CS-IE', 1],
    ],
    remedies: ['RM-RP', 'RM-AD'],
    minutes: [45, 180],
    downtime: 0.6,
    team: 'mech',
    titles: (a) =>
      a.typeId === 'at-conveyor'
        ? ['Chain jumped off sprocket', 'Chain stretched and skipping', 'Conveyor drive chain worn']
        : ['V-belt slipping', 'Drive belt worn and squealing', 'Belt broken'],
    notes: ['Replaced and re-tensioned.', 'Sprocket teeth hooked, replaced chain and adjusted tension.'],
    parts: (a) =>
      a.typeId === 'at-conveyor'
        ? [consumed('CHN-RS60', 1)]
        : a.typeId === 'at-vmc' || a.typeId === 'at-packer'
          ? [consumed('BLT-A40', 1)]
          : [consumed('BLT-B52', 2)],
  },
  'FM-VF': {
    problems: ['PRB-TR', 'PRB-ST'],
    causes: [
      ['CS-OV', 2],
      ['CS-CT', 2],
      ['CS-EF', 1],
    ],
    remedies: ['RM-CL', 'RM-RP', 'RM-RS'],
    minutes: [45, 120],
    downtime: 0.6,
    team: 'elec',
    titles: () => ['Inverter overcurrent trip', 'Inverter overheat alarm'],
    notes: ['Heatsink clogged with polishing dust, cleaned and replaced fan.', 'Reset fault, ramp time increased to 8 s.'],
    parts: () => (rng.chance(0.5) ? [consumed('FAN-INV', 1)] : []),
  },
  'FM-LC': {
    problems: ['PRB-TR', 'PRB-NP', 'PRB-HT'],
    causes: [
      ['CS-VB', 3],
      ['CS-IE', 1],
    ],
    remedies: ['RM-TG'],
    minutes: [30, 90],
    downtime: 0.4,
    team: 'elec',
    titles: () => ['Intermittent trip, loose terminal', 'Hot spot on terminal', 'Signal drops out intermittently'],
    notes: ['Terminal on phase L2 loose and discoloured, re-crimped and tightened.', 'Connector pins corroded, cleaned and secured.'],
    parts: () => [],
  },
  'FM-CT': {
    problems: ['PRB-ST', 'PRB-TR', 'PRB-NP'],
    causes: [
      ['CS-AG', 2],
      ['CS-OV', 1],
      ['CS-EF', 1],
    ],
    remedies: ['RM-RP'],
    minutes: [45, 120],
    downtime: 0.7,
    team: 'elec',
    titles: () => ['Motor will not start, contactor chatter', 'Contactor contacts burnt'],
    notes: ['Main contacts pitted, replaced contactor.', 'Coil open circuit, replaced contactor and overload relay.'],
    parts: () => (rng.chance(0.3) ? [consumed('CTR-32A', 1), consumed('OLR-32A', 1)] : [consumed('CTR-32A', 1)]),
  },
  'FM-SF': {
    problems: ['PRB-TR', 'PRB-QD', 'PRB-HT'],
    causes: [
      ['CS-AG', 2],
      ['CS-CT', 2],
      ['CS-EF', 1],
    ],
    remedies: ['RM-RP', 'RM-CA'],
    minutes: [30, 120],
    downtime: 0.3,
    team: 'inst',
    titles: (a) =>
      a.typeId === 'at-oven' || a.typeId === 'at-molding'
        ? ['Temperature reading unstable', 'Thermocouple open circuit alarm']
        : ['Proximity sensor not detecting', 'False alarm from sensor'],
    notes: ['Sensor reading drifted 9 °C against reference, replaced.', 'Sensor face damaged by chips, replaced and re-gapped.'],
    parts: (a) => (a.typeId === 'at-oven' || a.typeId === 'at-molding' ? [consumed('TCK-K', 1)] : [consumed('PRX-M18', 1)]),
  },
  'FM-BN': {
    problems: ['PRB-ST', 'PRB-QD', 'PRB-TR'],
    causes: [
      ['CS-CT', 3],
      ['CS-WR', 1],
      ['CS-AG', 1],
    ],
    remedies: ['RM-CL', 'RM-RP', 'RM-AD'],
    minutes: [90, 300],
    downtime: 0.7,
    team: 'mech',
    titles: () => ['Burner fails to ignite', 'Flame failure lockout', 'Low zone temperature, cure test failed'],
    notes: ['Nozzle carboned, cleaned electrode and replaced nozzle.', 'Air-fuel ratio rich, adjusted damper.'],
    parts: () => (rng.chance(0.6) ? [consumed('NZL-BRN', 1)] : []),
    vendor: ['ven-oventech', 0.2, 1_500_000, 4_500_000],
  },
  'FM-HY': {
    problems: ['PRB-LK', 'PRB-LP', 'PRB-SM'],
    causes: [
      ['CS-WR', 2],
      ['CS-AG', 2],
      ['CS-OV', 1],
    ],
    remedies: ['RM-RP'],
    minutes: [60, 360],
    downtime: 0.6,
    team: 'mech',
    titles: () => ['Hydraulic oil leak at hose', 'Ram moves slowly', 'Pressure drops under load'],
    notes: ['Hose chafed on frame, replaced and clamped.', 'Fitting O-ring hardened, replaced and topped up oil.'],
    parts: (a) =>
      a.typeId === 'at-press' && rng.chance(0.2)
        ? [consumed('SEL-HYD-200', 1), consumed('OIL-HYD-46', 40)]
        : [consumed('HOS-HYD', 1), consumed('OIL-HYD-46', rng.pick([10, 15, 20]))],
    vendor: ['ven-hidrolik', 0.15, 2_000_000, 6_500_000],
  },
  'FM-SD': {
    problems: ['PRB-LK'],
    causes: [
      ['CS-WR', 2],
      ['CS-CT', 1],
      ['CS-IE', 1],
    ],
    remedies: ['RM-RP'],
    minutes: [60, 180],
    downtime: 0.3,
    team: 'mech',
    titles: () => ['Oil leak at shaft seal', 'Air leak at cylinder', 'Seal leaking'],
    notes: ['Seal lip worn, replaced.', 'Rod scored, polished and resealed.'],
    parts: (a) =>
      a.typeId === 'at-pump' || a.typeId === 'at-polisher'
        ? [consumed('SEL-ABC', 2)]
        : a.typeId === 'at-compressor'
          ? []
          : [consumed('PNS-KIT', 1)],
  },
  'FM-CL': {
    problems: ['PRB-LP', 'PRB-HT'],
    causes: [['CS-CT', 3]],
    remedies: ['RM-CL', 'RM-RP'],
    minutes: [30, 90],
    downtime: 0.2,
    team: 'mech',
    titles: () => ['Low air pressure, filter blocked', 'High temperature, filter clogged', 'Filter differential alarm'],
    notes: ['Filter loaded with dust, replaced.', 'Cooler fins packed with lint, cleaned with air.'],
    parts: (a) =>
      a.typeId === 'at-compressor'
        ? [consumed('FLT-AIR-37', 1)]
        : a.typeId === 'at-chiller'
          ? [consumed('FLT-DRY', 1)]
          : a.typeId === 'at-press' || a.typeId === 'at-molding'
            ? [consumed('FLT-HYD', 1)]
            : [],
  },
  'FM-PL': {
    problems: ['PRB-TR', 'PRB-ST', 'PRB-QD'],
    causes: [
      ['CS-EF', 2],
      ['CS-AG', 1],
    ],
    remedies: ['RM-RP', 'RM-RS'],
    minutes: [60, 240],
    downtime: 0.8,
    team: 'elec',
    titles: () => ['PLC input card fault', 'I/O module error, machine stops'],
    notes: ['Input module channel 5 dead, replaced module and restored program.', 'Module reseated, fault cleared.'],
    parts: () => (rng.chance(0.4) ? [consumed('PLC-DI16', 1)] : []),
  },
  'FM-MF': {
    problems: ['PRB-HT', 'PRB-ST', 'PRB-NS'],
    causes: [
      ['CS-OV', 2],
      ['CS-AG', 2],
      ['CS-LB', 1],
    ],
    remedies: ['RM-RP', 'RM-RR'],
    minutes: [180, 480],
    downtime: 1,
    team: 'elec',
    titles: () => ['Motor overheating and tripping', 'Motor burnt, will not start'],
    notes: ['Winding insulation 0.3 MΩ, motor sent for rewinding.', 'Replaced motor from critical spare.'],
    parts: () => (rng.chance(0.4) ? [consumed('MTR-7K5', 1)] : []),
    vendor: ['ven-elektrindo', 0.5, 3_000_000, 6_000_000],
  },
}

type Profile = { perYear: number; modes: [string, number][] }
const PROFILES: Record<string, Profile> = {
  'POL-01': { perYear: 3, modes: [['FM-BW', 3], ['FM-BB', 2], ['FM-VF', 1], ['FM-LC', 1]] },
  'POL-02': { perYear: 3, modes: [['FM-BW', 2], ['FM-BB', 2], ['FM-MA', 1], ['FM-LC', 1]] },
  'POL-03': { perYear: 4, modes: [['FM-BB', 2], ['FM-LC', 1], ['FM-MA', 2]] },
  'OVN-01': { perYear: 3, modes: [['FM-BN', 3], ['FM-SF', 2], ['FM-CT', 1]] },
  'OVN-02': { perYear: 8, modes: [['FM-BN', 4], ['FM-SF', 3], ['FM-CT', 1], ['FM-LC', 1]] },
  'SPB-01': { perYear: 2, modes: [['FM-BB', 2], ['FM-BW', 1]] },
  'CNV-02': { perYear: 5, modes: [['FM-BB', 3], ['FM-BW', 2], ['FM-LC', 1], ['FM-CT', 1]] },
  'CNC-01': { perYear: 4, modes: [['FM-SF', 2], ['FM-PL', 1], ['FM-BW', 1], ['FM-LC', 1]] },
  'CNC-02': { perYear: 2, modes: [['FM-SF', 2], ['FM-LC', 1]] },
  'VMC-01': { perYear: 3, modes: [['FM-SF', 1], ['FM-PL', 1], ['FM-BW', 1], ['FM-BB', 1]] },
  'HPR-01': { perYear: 6, modes: [['FM-HY', 4], ['FM-SD', 2], ['FM-SF', 1], ['FM-CT', 1]] },
  'HPR-02': { perYear: 2, modes: [['FM-HY', 2], ['FM-SF', 1]] },
  'INJ-01': { perYear: 4, modes: [['FM-HY', 2], ['FM-SF', 2], ['FM-CT', 1]] },
  'INJ-02': { perYear: 2, modes: [['FM-HY', 1], ['FM-SF', 2], ['FM-CT', 1]] },
  'CNV-01': { perYear: 3, modes: [['FM-BB', 2], ['FM-BW', 1], ['FM-CT', 1]] },
  'ROB-01': { perYear: 1, modes: [['FM-SF', 2]] },
  'LKT-01': { perYear: 2, modes: [['FM-SF', 2], ['FM-SD', 1]] },
  'STR-01': { perYear: 2, modes: [['FM-BB', 2], ['FM-MA', 1]] },
  'FLT-01': { perYear: 2, modes: [['FM-HY', 2], ['FM-SD', 1]] },
  'CMP-01': { perYear: 5, modes: [['FM-CL', 2], ['FM-SD', 2], ['FM-SF', 1], ['FM-LC', 1]] },
  'CMP-02': { perYear: 1, modes: [['FM-CL', 1]] },
  'DRY-01': { perYear: 2, modes: [['FM-CL', 2], ['FM-SF', 1]] },
  'PNL-01': { perYear: 1, modes: [['FM-LC', 2], ['FM-CT', 1]] },
  'PNL-02': { perYear: 2, modes: [['FM-LC', 2], ['FM-CT', 2]] },
  'GEN-01': { perYear: 1, modes: [['FM-SF', 1], ['FM-CT', 1]] },
  'CHL-01': { perYear: 3, modes: [['FM-CL', 2], ['FM-SF', 1], ['FM-MF', 1]] },
  'CT-01': { perYear: 1, modes: [['FM-BW', 1], ['FM-BB', 1]] },
  'PMP-01': { perYear: 1, modes: [['FM-SD', 1], ['FM-BW', 1]] },
  'CKR-CNC-01': { perYear: 3, modes: [['FM-SF', 2], ['FM-LC', 1]] },
  'CKR-CNC-02': { perYear: 2, modes: [['FM-SF', 1], ['FM-BW', 1]] },
  'CKR-VMC-01': { perYear: 2, modes: [['FM-SF', 1], ['FM-PL', 1]] },
  'CKR-HPR-01': { perYear: 4, modes: [['FM-HY', 3], ['FM-SD', 1]] },
  'CKR-CNV-01': { perYear: 3, modes: [['FM-BB', 2], ['FM-SF', 1]] },
  'CKR-CMP-01': { perYear: 3, modes: [['FM-SD', 3], ['FM-CL', 1]] },
  'CKR-PNL-01': { perYear: 1, modes: [['FM-LC', 1]] },
  'CKR-CHL-01': { perYear: 2, modes: [['FM-CL', 1], ['FM-SF', 1]] },
}

function teamFor(mode: ModeDef, asset: Asset): string {
  if (asset.siteId === 'site-ckr') return 'team-ckr-mnt'
  const utility = ['at-compressor', 'at-dryer', 'at-chiller', 'at-tower', 'at-pump'].includes(asset.typeId)
  if (mode.team === 'mech') return utility ? 'team-bdg-utl' : 'team-bdg-mech'
  if (mode.team === 'inst') return asset.typeId === 'at-oven' || asset.typeId === 'at-tester' ? 'team-bdg-inst' : 'team-bdg-elec'
  return 'team-bdg-elec'
}

function priorityFor(asset: Asset, downtime: boolean): Priority {
  const c = asset.criticality
  if (c === 'A') return downtime || rng.chance(0.5) ? 'P2' : 'P3'
  if (c === 'B') return downtime && rng.chance(0.6) ? 'P2' : 'P3'
  if (c === 'C') return rng.chance(0.7) ? 'P3' : 'P4'
  return rng.chance(0.6) ? 'P4' : 'P3'
}

/** A random working-hours instant between two bounds. */
function randomWorkTime(from: number, to: number): number {
  const dayStart = startOfDay(from + rng.next() * (to - from))
  const hour = rng.weighted([
    [7, 2],
    [8, 3],
    [9, 3],
    [10, 3],
    [11, 2],
    [13, 3],
    [14, 3],
    [15, 2],
    [16, 2],
    [18, 1],
    [20, 1],
    [22, 1],
  ] as const)
  return dayStart + hour * HOUR + rng.int(0, 55) * MINUTE
}

const delayAfterRequest: Record<Priority, [number, number]> = {
  P1: [5, 25],
  P2: [20, 240],
  P3: [120, 2_400],
  P4: [1_440, 7_200],
}

export interface Generated {
  wos: WoSpec[]
  mrs: MrSpec[]
  calibrations: CalibrationRecord[]
}

// ─── PM occurrences ─────────────────────────────────────────────

/** Scripted weekly inspection results on Poles-03: [temperature, vibration, noise]. */
const POL03_INSPECTIONS: Record<string, [number, number, string]> = {
  '2026-07-13': [58, 2.2, 'Normal'],
  '2026-07-20': [59, 2.4, 'Normal'],
  '2026-07-27': [61, 2.9, 'Normal'],
  '2026-08-03': [63, 3.6, 'Normal'],
  '2026-08-10': [66, 4.8, 'Rough'],
  '2026-08-17': [72, 7.4, 'Loud'],
  '2026-08-24': [57, 1.9, 'Normal'],
  '2026-08-31': [64, 3.4, 'Normal'],
  '2026-09-07': [58, 2.0, 'Normal'],
  '2026-09-14': [70, 5.4, 'Normal'],
  '2026-09-21': [59, 2.3, 'Normal'],
}

/** PM codes whose latest completion is one of the hand-written current work orders. */
const LAST_OCCURRENCE_IS_CURRENT = new Set(['PM-0019'])

export function generatePmHistory(out: Generated) {
  for (const def of PM_DEFS) {
    const plan = JP(def.plan)
    const asset = A(def.asset)
    const floor = Math.max(def.historyFrom ? day(def.historyFrom) : HISTORY_START, Date.parse(asset.installedAt) + 14 * DAY)
    const trigger = def.trigger
    const meter = trigger.kind !== 'calendar' ? meters.find((m) => m.id === trigger.meterId) : undefined
    const stepDays = (): number => {
      const t = def.trigger
      if (t.kind === 'meter') return (t.every / meter!.dailyRate) * rng.float(0.92, 1.08)
      if (t.kind === 'combined') return Math.min(t.every, (t.meterEvery / meter!.dailyRate) * rng.float(0.92, 1.08))
      return 0
    }
    let done = day(def.lastDone, 15, 0)
    let first = true
    while (done >= floor) {
      if (!(first && LAST_OCCURRENCE_IS_CURRENT.has(def.code))) out.wos.push(pmOccurrence(def.code, plan.code, asset, def.team, def.assignee, def.lead, done))
      first = false
      const t = def.trigger
      if (t.kind === 'calendar') done = addInterval(done, -t.every, t.unit)
      else done = startOfDay(done - stepDays() * DAY) + 15 * HOUR
    }
  }
}

function pmOccurrence(pmCode: string, planCode: string, asset: Asset, team: string, assignee: string | undefined, lead: number, doneAt: number): WoSpec {
  const plan = JP(planCode)
  const late = rng.chance(0.1)
  const dueDay = startOfDay(doneAt) + (late ? -rng.int(1, 5) : rng.int(0, 1)) * DAY
  const dueAt = dueDay + 17 * HOUR
  const requestedAt = startOfDay(dueAt - lead * DAY) + 6 * HOUR
  const duration = Math.round(plan.durationMin * rng.float(0.8, 1.3))
  const startedAt = doneAt - duration * MINUTE
  const tech = assignee && rng.chance(0.8) ? assignee : pickTechs(team, startedAt, 1)[0]!
  const assignees = plan.personnel > 1 ? [tech, ...pickTechs(team, startedAt, 2).filter((p) => p !== tech).slice(0, 1)] : [tech]
  const key = `pm-${pmCode.toLowerCase()}-${dayKey(doneAt)}`
  const values: Record<number, TaskResult['value']> = {}
  const scripted = pmCode === 'PM-0006' ? POL03_INSPECTIONS[dayKey(doneAt)] : undefined
  if (scripted) {
    values[1] = scripted[0]
    values[2] = scripted[1]
    values[3] = scripted[2]
  } else if (plan.woType === 'inspection' && rng.chance(0.06)) {
    const idx = plan.tasks.findIndex((t) => t.type === 'measurement' && t.warnMax != null && t.max != null)
    if (idx >= 0) {
      const t = plan.tasks[idx]!
      values[idx] = rng.round(t.warnMax! + (t.max! - t.warnMax!) * rng.float(0.2, 0.7), 1)
    }
  }
  const verified = asset.criticality === 'A' ? { by: SUPERVISOR[team]!, at: doneAt + rng.int(2, 18) * HOUR } : undefined
  const closedAt = (verified?.at ?? doneAt) + rng.int(2, 30) * HOUR
  const spec: WoSpec = {
    key,
    asset: asset.code,
    title: plan.name,
    type: plan.woType,
    priority: 'P3',
    status: 'closed',
    pm: pmCode,
    plan: plan.code,
    team,
    assignees,
    requestedBy: 'system',
    requestedAt,
    assignedAt: requestedAt + rng.int(30, 90) * MINUTE,
    assignedBy: plannerFor(team),
    scheduledAt: startOfDay(startedAt) + 8 * HOUR,
    dueAt,
    startedAt,
    completedAt: doneAt,
    verified,
    closed: { by: plannerFor(team), at: Math.min(closedAt, NOW - HOUR) },
    estimatedMin: plan.durationMin,
    parts: plan.parts.map((p) => ({ code: p.partId.replace('part-', '').toUpperCase(), qty: p.qty, status: 'consumed' as const })),
    values,
  }
  return planCode === 'JP-CMP-002' ? { ...spec, ...vendorOverhaul(spec, doneAt) } : spec
}

/**
 * The 4,000 h compressor service is ABC Compressor Service's job, planned for two working days
 * (brainstorm section 31). The August run took three: the airend coupling came from Jakarta.
 */
function vendorOverhaul(spec: WoSpec, doneAt: number): Partial<WoSpec> {
  const days = dayKey(doneAt) === '2026-08-18' ? 3 : 2
  const start = startOfDay(doneAt) - (days - 1) * DAY + 8 * HOUR
  const dueAt = start + DAY + 9 * HOUR
  return {
    execution: 'mixed',
    vendor: 'ven-abc',
    vendorCost: 18_500_000,
    requestedAt: startOfDay(start - 14 * DAY) + 6 * HOUR,
    scheduledAt: start,
    startedAt: start,
    dueAt,
    estimatedMin: 16 * 60,
    labor: Array.from({ length: days }, (_, d) => ({
      person: spec.assignees[0]!,
      start: start + d * DAY,
      end: d === days - 1 ? doneAt : start + d * DAY + 8 * HOUR,
    })),
    completionNote:
      days === 3
        ? 'ABC replaced the separator, filters and oil. One day over plan: the airend coupling needed a spare from Jakarta.'
        : 'ABC replaced the separator, filters and oil on plan.',
  }
}

// ─── Random failures ────────────────────────────────────────────

let failureSeq = 0
export function generateFailures(out: Generated) {
  const latest = NOW - 9 * DAY
  for (const [code, profile] of Object.entries(PROFILES)) {
    const asset = A(code)
    const count = Math.max(0, profile.perYear + rng.int(-1, 1))
    for (let i = 0; i < count; i++) {
      const modeCode = rng.weighted(profile.modes)
      pushFailure(out, asset, modeCode, randomWorkTime(HISTORY_START + 2 * DAY, latest))
    }
  }
}

export function pushFailure(
  out: Generated,
  asset: Asset,
  modeCode: string,
  requestedAt: number,
  overrides: Partial<WoSpec> = {},
): WoSpec {
  const mode = MODES[modeCode]!
  const downtime = overrides.downtime ?? rng.chance(mode.downtime)
  const emergency = downtime && (asset.criticality === 'A' || asset.criticality === 'B') && rng.chance(0.45)
  const type: WoType = emergency ? 'emergency' : 'corrective'
  const priority: Priority = emergency ? 'P1' : priorityFor(asset, downtime)
  const team = teamFor(mode, asset)
  const [dMin, dMax] = delayAfterRequest[priority]
  const assignedAt = requestedAt + rng.int(3, Math.max(5, Math.round(dMin * 0.6))) * MINUTE
  let startedAt = assignedAt + rng.int(dMin, dMax) * MINUTE
  const assignees = pickTechs(team, startedAt, rng.chance(0.3) ? 2 : 1)
  const active = rng.int(mode.minutes[0], mode.minutes[1])
  const waits = rng.chance(0.12)
  const gap = waits ? rng.int(6, 72) * HOUR : 0
  let completedAt = startedAt + active * MINUTE + gap
  const needsVerify = asset.criticality === 'A'
  let verifiedAt = needsVerify ? completedAt + rng.int(1, 16) * HOUR : undefined
  let closedAt = (verifiedAt ?? completedAt) + rng.int(2, 40) * HOUR
  // Keep closed history in the past.
  const overflow = closedAt - (NOW - 2 * HOUR)
  const shift = overflow > 0 ? overflow + rng.int(1, 48) * HOUR : 0
  const r = requestedAt - shift
  startedAt -= shift
  completedAt -= shift
  if (verifiedAt) verifiedAt -= shift
  closedAt -= shift
  const lead = assignees[0]!
  const labor = waits
    ? assignees.flatMap((p) => [
        { person: p, start: startedAt, end: startedAt + Math.round(active * 0.4) * MINUTE },
        { person: p, start: startedAt + Math.round(active * 0.4) * MINUTE + gap, end: completedAt },
      ])
    : undefined
  const vendorHit = mode.vendor && rng.chance(mode.vendor[1])
  const key = `f-${String(++failureSeq).padStart(4, '0')}`
  const withRequest = rng.chance(0.8)
  const mrKey = `mr-${key}`
  const problem = rng.pick(mode.problems)
  const title = overrides.title ?? rng.pick(mode.titles(asset))
  const spec: WoSpec = {
    key,
    asset: asset.code,
    title,
    type,
    priority,
    status: 'closed',
    request: withRequest ? mrKey : undefined,
    team,
    assignees,
    requestedBy: withRequest ? SUPERVISOR[team]! : lead,
    requestedAt: r,
    assignedAt: assignedAt - shift,
    assignedBy: SUPERVISOR[team],
    startedAt,
    completedAt,
    verified: verifiedAt ? { by: SUPERVISOR[team]!, at: verifiedAt } : undefined,
    closed: { by: plannerFor(team), at: closedAt },
    estimatedMin: Math.round(((mode.minutes[0] + mode.minutes[1]) / 2 / 30)) * 30,
    downtime,
    labor,
    parts: mode.parts(asset),
    execution: vendorHit ? 'mixed' : 'internal',
    vendor: vendorHit ? mode.vendor![0] : undefined,
    vendorCost: vendorHit ? Math.round(rng.int(mode.vendor![2], mode.vendor![3]) / 50_000) * 50_000 : 0,
    miscCost: rng.chance(0.12) ? rng.pick([50_000, 120_000, 250_000, 400_000]) : 0,
    failure: {
      problem,
      mode: modeCode,
      cause: rng.weighted(mode.causes),
      remedy: rng.pick(mode.remedies),
      note: rng.pick(mode.notes),
    },
    completionNote: rng.pick(mode.notes),
    photos: rng.chance(0.4) ? rng.int(1, 3) : 0,
    ...overrides,
  }
  // Some jobs take a spare along and bring it back unused. Only well-stocked Bandung parts, so the
  // ledger still ends on today's counts; a separate generator keeps every other record stable.
  const spare = spec.parts?.[0]?.code
  if (spare && asset.siteId === 'site-bdg' && (STOCK_TARGET['wh-bdg-a']![spare] ?? 0) >= 3 && extraRng.chance(0.15)) {
    spec.parts = [...spec.parts!, { code: spare, qty: 1, status: 'returned' }]
  }
  out.wos.push(spec)
  if (withRequest && !overrides.request) {
    const reportedBy = rng.chance(0.85) ? requesterFor(asset) : lead
    out.mrs.push({
      key: mrKey,
      asset: asset.code,
      title,
      severity: severityFor(priority),
      impact: downtime ? 'stopped' : rng.chance(0.5) ? 'reduced' : 'none',
      status: 'converted',
      source: reportedBy === lead ? 'technician' : 'operator',
      reportedBy,
      reportedAt: r - rng.int(5, 40) * MINUTE,
      wo: key,
      triagedBy: SUPERVISOR[team],
      triagedAt: r,
      photos: rng.chance(0.5) ? rng.int(1, 2) : 0,
    })
  }
  return spec
}

// ─── Improvements ───────────────────────────────────────────────

const IMPROVEMENTS: [asset: string, date: string, title: string, team: string, minutes: number, parts: PartSpec[]][] = [
  ['PNL-02', '2025-11-12', 'Label all outgoing MCCB circuits', 'team-bdg-elec', 360, []],
  ['CNV-01', '2026-01-14', 'Add fixed guard over tail pulley', 'team-bdg-mech', 420, []],
  ['STR-01', '2026-02-18', 'Replace worn strap guide with hardened guide', 'team-bdg-mech', 180, []],
  ['HPR-01', '2026-04-08', 'Upgrade light curtain to Type 4 with muting', 'team-bdg-elec', 480, []],
  ['OVN-02', '2026-06-10', 'Log flame signal to the oven PLC', 'team-bdg-elec', 300, []],
  ['CMP-01', '2026-07-06', 'Replace manual drain with zero-loss drain', 'team-bdg-utl', 120, []],
  ['CHL-01', '2026-08-12', 'Fit dust cover on condenser for dry season', 'team-bdg-utl', 240, []],
  ['CKR-CNV-01', '2026-05-20', 'Add photo-eye bracket with adjustable mount', 'team-ckr-mnt', 150, []],
]

export function generateImprovements(out: Generated) {
  IMPROVEMENTS.forEach(([code, date, title, team, minutes, partsUsed], i) => {
    const requestedAt = day(date, 9, 0)
    const startedAt = requestedAt + rng.int(3, 12) * DAY + HOUR
    const assignees = pickTechs(team, startedAt, 2)
    const completedAt = startedAt + minutes * MINUTE
    const asset = A(code)
    const verified = asset.criticality === 'A' ? { by: SUPERVISOR[team]!, at: completedAt + 20 * HOUR } : undefined
    out.wos.push({
      key: `imp-${i + 1}`,
      asset: code,
      title,
      type: 'improvement',
      priority: 'P4',
      status: 'closed',
      team,
      assignees,
      requestedBy: plannerFor(team),
      requestedAt,
      assignedBy: plannerFor(team),
      assignedAt: requestedAt + 2 * HOUR,
      scheduledAt: startOfDay(startedAt) + 8 * HOUR,
      dueAt: requestedAt + 21 * DAY,
      startedAt,
      completedAt,
      verified,
      closed: { by: plannerFor(team), at: (verified?.at ?? completedAt) + 26 * HOUR },
      estimatedMin: minutes,
      parts: partsUsed,
      tasks: [
        { label: 'Prepare materials and permit', type: 'check', required: true },
        { label: 'Install and commission', type: 'check', required: true },
        { label: 'Hand over to production', type: 'signature', required: true },
      ],
      photos: 2,
      miscCost: rng.pick([350_000, 750_000, 1_200_000, 2_400_000]),
    })
  })
}

// ─── Calibration ────────────────────────────────────────────────

let certSeq = 4100
export function generateCalibrations(out: Generated) {
  for (const asset of assets.filter((a) => a.calibration)) {
    const plan = asset.calibration!
    let at = Date.parse(plan.lastAt!)
    while (at >= HISTORY_START) {
      const cert = `KN-${wib(at).year % 100}-${++certSeq}`
      const asFound = rng.round(rng.float(0.2, 1.3), 2)
      const adjusted = asFound > 0.8
      const asLeft = adjusted ? rng.round(rng.float(0.1, 0.35), 2) : asFound
      const key = `cal-${asset.code.toLowerCase()}-${dayKey(at)}`
      const team = asset.siteId === 'site-ckr' ? 'team-ckr-mnt' : 'team-bdg-inst'
      const tech = asset.siteId === 'site-ckr' ? 'per-hadi' : 'per-lina'
      out.wos.push({
        key,
        asset: asset.code,
        title: `${asset.name} calibration`,
        type: 'calibration',
        priority: 'P3',
        status: 'closed',
        plan: 'JP-CAL-001',
        team,
        assignees: [tech],
        requestedBy: plannerFor(team),
        requestedAt: at - 7 * DAY + 9 * HOUR,
        assignedBy: plannerFor(team),
        scheduledAt: at + 9 * HOUR,
        dueAt: at + 17 * HOUR,
        startedAt: at + 9 * HOUR,
        completedAt: at + 11 * HOUR,
        closed: { by: plannerFor(team), at: at + 35 * HOUR },
        estimatedMin: 60,
        execution: 'vendor',
        vendor: 'ven-kalibra',
        vendorCost: rng.pick([350_000, 450_000, 600_000, 850_000]),
        values: { 0: asFound, 1: adjusted, 2: asLeft, 3: cert },
      })
      const nextDue = addMonths(at, plan.intervalMonths)
      out.calibrations.push({
        id: `calrec-${asset.code.toLowerCase()}-${dayKey(at)}`,
        target: { kind: 'asset', id: asset.id },
        date: toIso(at + 11 * HOUR),
        vendorId: 'ven-kalibra',
        performedBy: 'PT Kalibrasi Nusantara',
        certificateNo: cert,
        result: adjusted ? 'adjusted' : 'pass',
        nextDue: toIso(nextDue),
        notes: `As found ${asFound} %, as left ${asLeft} % of span.`,
      })
      at = addMonths(at, -plan.intervalMonths)
    }
  }
  for (const tool of tools.filter((t) => t.calibration)) {
    const plan = tool.calibration!
    let at = Date.parse(plan.lastAt!)
    let n = 0
    while (n < 2) {
      const cert = `KN-${wib(at).year % 100}-${++certSeq}`
      const adjusted = rng.chance(0.2)
      out.calibrations.push({
        id: `calrec-${tool.code.toLowerCase()}-${dayKey(at)}`,
        target: { kind: 'tool', id: tool.id },
        date: toIso(at + 10 * HOUR),
        vendorId: 'ven-kalibra',
        performedBy: 'PT Kalibrasi Nusantara',
        certificateNo: cert,
        result: adjusted ? 'adjusted' : 'pass',
        nextDue: toIso(addMonths(at, plan.intervalMonths)),
        notes: adjusted ? 'Adjusted to within tolerance.' : 'Within tolerance as found.',
      })
      at = addMonths(at, -plan.intervalMonths)
      n++
    }
  }
}

