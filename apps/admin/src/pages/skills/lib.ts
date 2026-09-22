import type { Person, Skill, SkillLevel, TechnicianProfile } from '@cmms/types'

/** Ordinal ink ramp: the darker the cell, the deeper the skill. */
export const LEVEL_CELL: Record<SkillLevel, string> = {
  0: 'bg-surface text-silver',
  1: 'bg-ink/20 text-foreground',
  2: 'bg-ink/60 text-white',
  3: 'bg-ink text-on-ink',
}

/** L2 works without supervision, so coverage counts people at L2 or higher. */
const COVERAGE_LEVEL = 2
/** Fewer people than this at L2+ makes the skill a single point of failure. */
export const MIN_COVERAGE = 2

export interface MatrixRow {
  person: Person
  profile: TechnicianProfile
  teamName: string
}

export interface Coverage {
  skill: Skill
  qualified: MatrixRow[]
  onLeave: MatrixRow[]
}

export function skillCoverage(skills: readonly Skill[], rows: readonly MatrixRow[]): Coverage[] {
  return skills.map((skill) => {
    const qualified = rows.filter((r) => (r.profile.skills[skill.id] ?? 0) >= COVERAGE_LEVEL)
    return { skill, qualified, onLeave: qualified.filter((r) => r.profile.availability === 'leave') }
  })
}

