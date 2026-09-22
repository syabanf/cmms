import { fmtNumber, fmtPercent, weeklyCapacity } from '@cmms/fixtures'
import { Button, Card, Chip, ChipRow, EmptyState, Input, PageHeader, StatCard, toast } from '@cmms/ui'
import { Gauge, HardHat, Plus, Search, Timer, UserCheck } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import { useAuth } from '../../auth/auth'
import { paths } from '../../components/links'
import { useHistoryState } from '../../lib/history-state'
import { useNow, useScoped } from '../../state/scoped'
import { type Presence, certAlert, clockedInIds, heldSkills, loadThisWeek, presenceOf } from './lib'
import { TechnicianCard, type TechnicianRow } from './TechnicianCard'
import { TechnicianDialog } from './TechnicianDialog'

/** Status chips. "On shift" includes people on the clock, who are at work by definition. */
const STATUS_FILTERS: Record<Presence, { label: string; match: (p: Presence) => boolean }> = {
  on_shift: { label: 'On shift', match: (p) => p === 'on_shift' || p === 'clocked_in' },
  clocked_in: { label: 'Clocked in', match: (p) => p === 'clocked_in' },
  off_shift: { label: 'Off shift', match: (p) => p === 'off_shift' },
  leave: { label: 'On leave', match: (p) => p === 'leave' },
}
const STATUS_ORDER: Presence[] = ['on_shift', 'clocked_in', 'off_shift', 'leave']

function matchesQuery(row: TechnicianRow, terms: string[]) {
  const text = [
    row.person.name,
    row.person.title,
    row.person.email,
    row.teamName,
    ...row.skills.map((s) => s.skill.name),
    ...row.profile.authorizations,
  ]
    .join(' ')
    .toLowerCase()
  return terms.every((t) => text.includes(t))
}

export function TechniciansPage() {
  const now = useNow(60_000)
  const { technicians, teams, workOrders, skills, settings, site, maps } = useScoped()
  const { can } = useAuth()
  const canManage = can('people.manage')
  const navigate = useNavigate()
  const [query, setQuery] = useHistoryState('query', '')
  const [teamPick, setTeam] = useHistoryState<string | null>('team', null)
  const [status, setStatus] = useHistoryState<Presence | null>('status', null)
  const [adding, setAdding] = useState(false)
  // A team picked before a site switch belongs to the other site.
  const team = teams.some((t) => t.id === teamPick) ? teamPick : null

  const rows = useMemo(() => {
    const loads = loadThisWeek(technicians, workOrders, settings, now)
    const clocked = clockedInIds(workOrders)
    return technicians
      .flatMap((person): TechnicianRow[] => {
        const profile = person.technician
        if (!profile) return []
        return [
          {
            person,
            profile,
            presence: presenceOf(profile, clocked.has(person.id), now),
            load: loads.get(person.id),
            teamName: maps.team.get(profile.teamId)?.name ?? 'No team',
            skills: heldSkills(profile, skills),
            alert: certAlert(profile.certifications, now),
          },
        ]
      })
      .sort((a, b) => a.person.name.localeCompare(b.person.name))
  }, [technicians, workOrders, settings, skills, maps, now])

  const countOf = (list: TechnicianRow[], p: Presence) =>
    list.filter((r) => STATUS_FILTERS[p].match(r.presence)).length
  const clockedIn = rows.filter((r) => r.presence === 'clocked_in')
  const offShift = countOf(rows, 'off_shift')
  const onLeave = countOf(rows, 'leave')

  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean)
  const searched = rows.filter((r) => matchesQuery(r, terms))
  const inTeam = (r: TechnicianRow) => !team || r.profile.teamId === team
  const inStatus = (r: TechnicianRow) => !status || STATUS_FILTERS[status].match(r.presence)
  const byStatus = searched.filter(inStatus)
  const byTeam = searched.filter(inTeam)
  const visible = byStatus.filter(inTeam)

  const clearFilters = () => {
    setQuery('')
    setTeam(null)
    setStatus(null)
  }

  return (
    <>
      <PageHeader
        title="Technicians"
        description={`The people who carry out maintenance at ${site.name}: shifts, skills, certificates and workload.`}
        actions={
          <>
            <Input
              variant="pill"
              className="sm:w-72 w-full"
              leftIcon={<Search />}
              value={query}
              placeholder="Search name, skill or permit"
              aria-label="Search technicians"
              onChange={(e) => setQuery(e.target.value)}
            />
            {canManage && (
              <Button onClick={() => setAdding(true)}>
                <Plus />
                Add technician
              </Button>
            )}
          </>
        }
      />

      <div className="mb-4 gap-3 sm:gap-4 xl:grid-cols-4 grid grid-cols-2">
        <StatCard
          label="Technicians"
          value={fmtNumber(rows.length)}
          hint={`${teams.length} teams`}
          icon={<HardHat />}
          onClick={clearFilters}
        />
        <StatCard
          label="On shift now"
          value={fmtNumber(countOf(rows, 'on_shift'))}
          unit={`of ${rows.length}`}
          hint={onLeave ? `${offShift} off shift, ${onLeave} on leave` : `${offShift} off shift`}
          icon={<UserCheck />}
          tone="success"
          onClick={() => setStatus('on_shift')}
        />
        <StatCard
          label="Clocked in now"
          value={fmtNumber(clockedIn.length)}
          hint={
            clockedIn.length
              ? clockedIn.map((r) => r.person.name.split(' ')[0]).join(', ')
              : 'No labor clock running'
          }
          icon={<Timer />}
          tone="info"
          onClick={() => setStatus('clocked_in')}
        />
        <StatCard
          label="Weekly capacity"
          value={fmtNumber(weeklyCapacity(technicians, settings))}
          unit="h"
          hint={`${fmtPercent(settings.wrenchTime)} wrench time on ${settings.weeklyHours} h weeks`}
          icon={<Gauge />}
          tone="ink"
        />
      </div>

      <ChipRow className="mb-4 md:flex-wrap" role="group" aria-label="Filter technicians">
        <Chip variant="filter" active={!team} count={byStatus.length} onClick={() => setTeam(null)}>
          All teams
        </Chip>
        {teams.map((t) => (
          <Chip
            key={t.id}
            variant="filter"
            active={team === t.id}
            count={byStatus.filter((r) => r.profile.teamId === t.id).length}
            onClick={() => setTeam(team === t.id ? null : t.id)}
          >
            {t.name}
          </Chip>
        ))}
        <span aria-hidden="true" className="mx-1 h-6 w-px shrink-0 self-center bg-border" />
        <Chip variant="filter" active={!status} count={byTeam.length} onClick={() => setStatus(null)}>
          Any status
        </Chip>
        {STATUS_ORDER.map((p) => (
          <Chip
            key={p}
            variant="filter"
            active={status === p}
            count={countOf(byTeam, p)}
            onClick={() => setStatus(status === p ? null : p)}
          >
            {STATUS_FILTERS[p].label}
          </Chip>
        ))}
      </ChipRow>

      {visible.length > 0 ? (
        <div className="gap-4 md:grid-cols-2 xl:grid-cols-3 grid grid-cols-1">
          {visible.map((row) => (
            <TechnicianCard key={row.person.id} row={row} />
          ))}
        </div>
      ) : (
        <Card>
          {rows.length === 0 ? (
            <EmptyState
              icon={<HardHat />}
              title={`No technicians at ${site.name} yet`}
              description="Add the people who carry out the work. Work orders, PM schedules and the skill matrix pick them from this list."
              action={
                canManage ? (
                  <Button onClick={() => setAdding(true)}>
                    <Plus />
                    Add technician
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <EmptyState
              icon={<Search />}
              title={
                terms.length ? `No technicians match "${query.trim()}"` : 'No technicians match these filters'
              }
              description="Search by name, title, team, skill or work permit, or clear the filters to see everyone."
              action={
                <Button variant="outline" onClick={clearFilters}>
                  Clear filters
                </Button>
              }
            />
          )}
        </Card>
      )}

      <TechnicianDialog
        open={adding}
        onOpenChange={setAdding}
        editing={null}
        onSaved={(person) => {
          toast(`${person.name} added`, { tone: 'success', description: 'Set their skill levels next.' })
          navigate(paths.technician(person.id))
        }}
      />
    </>
  )
}
