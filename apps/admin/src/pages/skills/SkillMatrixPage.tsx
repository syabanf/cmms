import { listOf } from '@cmms/fixtures'
import { Banner, Button, Card, Chip, ChipRow, EmptyState, PageHeader } from '@cmms/ui'
import { Grid3x3, HardHat } from 'lucide-react'
import { useMemo } from 'react'
import { Link } from 'react-router'
import { useAuth } from '../../auth/auth'
import { useHistoryState } from '../../lib/history-state'
import { useNow, useScoped } from '../../state/scoped'
import { JobFinderCard } from './JobFinderCard'
import { type Coverage, MIN_COVERAGE, type MatrixRow, skillCoverage } from './lib'
import { SkillMatrixCard } from './SkillMatrixCard'

/** One sentence per skill that depends on too few people. */
function thinCoverNotes(coverage: Coverage[]): string[] {
  return coverage.flatMap(({ skill, qualified, onLeave }) => {
    const names = qualified.map((r) => r.person.name)
    if (qualified.length === 0) return [`Nobody covers ${skill.name} at L2 or higher.`]
    if (qualified.length < MIN_COVERAGE) return [`Only ${names[0]} covers ${skill.name} at L2 or higher.`]
    const present = qualified.filter((r) => !onLeave.includes(r))
    if (present.length >= MIN_COVERAGE) return []
    const away = listOf(onLeave.map((r) => r.person.name))
    return [
      `${skill.name} is down to ${present.length ? listOf(present.map((r) => r.person.name)) : 'nobody'} while ${away} ${onLeave.length === 1 ? 'is' : 'are'} on leave.`,
    ]
  })
}

export function SkillMatrixPage() {
  const now = useNow(60_000)
  const { technicians, skills, teams, site, maps } = useScoped()
  const { can } = useAuth()
  const canEdit = can('people.manage')
  const [teamPick, setTeam] = useHistoryState<string | null>('team', null)
  const team = teams.some((t) => t.id === teamPick) ? teamPick : null

  const rows = useMemo(
    () =>
      technicians
        .flatMap((person): MatrixRow[] =>
          person.technician
            ? [
                {
                  person,
                  profile: person.technician,
                  teamName: maps.team.get(person.technician.teamId)?.name ?? 'No team',
                },
              ]
            : [],
        )
        .sort((a, b) => a.teamName.localeCompare(b.teamName) || a.person.name.localeCompare(b.person.name)),
    [technicians, maps],
  )
  const notes = useMemo(() => thinCoverNotes(skillCoverage(skills, rows)), [skills, rows])
  const shown = team ? rows.filter((r) => r.profile.teamId === team) : rows

  return (
    <>
      <PageHeader title="Skill matrix" description="Who can do which job, and where the team is thin." />

      {rows.length === 0 || skills.length === 0 ? (
        <Card>
          {rows.length === 0 ? (
            <EmptyState
              icon={<HardHat />}
              title={`No technicians at ${site.name} yet`}
              description="Add technicians first. Their skill levels fill this matrix."
              action={
                <Button asChild variant="outline">
                  <Link to="/people/technicians">Go to technicians</Link>
                </Button>
              }
            />
          ) : (
            <EmptyState
              icon={<Grid3x3 />}
              title="No skills defined"
              description="Add skills such as Mechanical or PLC in master data. Job plans and levels build on them."
              action={
                <Button asChild variant="outline">
                  <Link to="/settings/master-data?tab=skills">Open master data</Link>
                </Button>
              }
            />
          )}
        </Card>
      ) : (
        <div className="space-y-4">
          {notes.length > 0 && (
            <Banner
              tone="warning"
              title={`Thin cover on ${notes.length === 1 ? 'one skill' : `${notes.length} skills`}`}
            >
              {notes.join(' ')} Cross-train a second technician to L2.
            </Banner>
          )}

          {teams.length > 1 && (
            <ChipRow className="md:flex-wrap" role="group" aria-label="Filter by team">
              <Chip variant="filter" active={!team} count={rows.length} onClick={() => setTeam(null)}>
                All teams
              </Chip>
              {teams.map((t) => (
                <Chip
                  key={t.id}
                  variant="filter"
                  active={team === t.id}
                  count={rows.filter((r) => r.profile.teamId === t.id).length}
                  onClick={() => setTeam(team === t.id ? null : t.id)}
                >
                  {t.name}
                </Chip>
              ))}
            </ChipRow>
          )}

          <SkillMatrixCard rows={shown} coverage={skillCoverage(skills, shown)} canEdit={canEdit} />
          <JobFinderCard rows={rows} now={now} canEdit={canEdit} />
        </div>
      )}
    </>
  )
}
