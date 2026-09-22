import { fmtDuration, fmtNumber, listOf, plural } from '@cmms/fixtures'
import {
  Avatar,
  Badge,
  Banner,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  EmptyState,
  cn,
} from '@cmms/ui'
import { ListChecks, UserX } from 'lucide-react'
import { useMemo } from 'react'
import { Link } from 'react-router'
import { paths } from '../../components/links'
import { JobPlanPicker } from '../../components/pickers'
import { useHistoryState } from '../../lib/history-state'
import { useScoped } from '../../state/scoped'
import { PresenceBadge } from '../technicians/badges'
import { clockedInIds, loadThisWeek, presenceOf } from '../technicians/lib'
import { LEVEL_CELL, type MatrixRow } from './lib'

/** Technicians who meet a job plan's skill requirement, least open work first. */
export function JobFinderCard({ rows, now, canEdit }: { rows: MatrixRow[]; now: number; canEdit: boolean }) {
  const { jobPlans, workOrders, settings, maps } = useScoped()
  const [planId, setPlanId] = useHistoryState<string | null>(
    'plan',
    () => jobPlans.find((j) => j.active)?.id ?? null,
  )
  const plan = planId ? maps.jobPlan.get(planId) : undefined
  const skillName = plan ? (maps.skill.get(plan.skillId)?.name ?? 'Removed skill') : ''

  const loads = useMemo(
    () =>
      loadThisWeek(
        rows.map((r) => r.person),
        workOrders,
        settings,
        now,
      ),
    [rows, workOrders, settings, now],
  )
  const clocked = useMemo(() => clockedInIds(workOrders), [workOrders])

  const { qualified, oneShort } = useMemo(() => {
    if (!plan) return { qualified: [], oneShort: [] }
    const leveled = rows.map((row) => ({ row, level: row.profile.skills[plan.skillId] ?? 0 }))
    const onLeave = (row: MatrixRow) => Number(row.profile.availability === 'leave')
    const openHours = (row: MatrixRow) => loads.get(row.person.id)?.openManHours ?? 0
    return {
      // People on leave go last: pickers do not offer them.
      qualified: leveled
        .filter((x) => x.level >= plan.skillLevel)
        .sort(
          (a, b) =>
            onLeave(a.row) - onLeave(b.row) || openHours(a.row) - openHours(b.row) || b.level - a.level,
        ),
      oneShort: leveled.filter((x) => x.level > 0 && x.level === plan.skillLevel - 1),
    }
  }, [plan, rows, loads])
  const available = qualified.filter((x) => x.row.profile.availability !== 'leave').length

  return (
    <Card>
      <CardHeader>
        <CardTitle>Who can do this job?</CardTitle>
        <CardDescription>
          Pick a job plan to see who holds its skill at the required level, least open work first.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="gap-3 flex flex-wrap items-center">
          <JobPlanPicker value={planId} onChange={setPlanId} className="sm:max-w-md w-full" />
          {plan && (
            <div className="gap-1.5 flex flex-wrap items-center">
              <Badge variant="ink">
                {skillName} L{plan.skillLevel}+
              </Badge>
              <Badge>{plural(plan.personnel, 'person', 'people')}</Badge>
              <Badge variant="outline">{fmtDuration(plan.durationMin)}</Badge>
            </div>
          )}
        </div>

        {!plan ? (
          <EmptyState
            compact
            icon={<ListChecks />}
            title="Pick a job plan"
            description="The list shows every technician at this site who meets its skill requirement."
          />
        ) : qualified.length === 0 ? (
          <EmptyState
            compact
            icon={<UserX />}
            title={`Nobody at ${skillName} L${plan.skillLevel} or higher`}
            description={
              canEdit
                ? 'Raise a level in the matrix above, or plan vendor support for this job.'
                : 'Ask a supervisor to plan training or vendor support.'
            }
          />
        ) : (
          <>
            {available < plan.personnel && (
              <Banner
                tone="warning"
                title={`${plan.name} needs ${plural(plan.personnel, 'person', 'people')}. ${available} qualified ${available === 1 ? 'technician is' : 'technicians are'} available.`}
              >
                Pair them with a technician one level below, or book vendor support.
              </Banner>
            )}
            <ul className="gap-2 lg:grid-cols-2 grid grid-cols-1">
              {qualified.map(({ row, level }) => {
                const load = loads.get(row.person.id)
                return (
                  <li key={row.person.id}>
                    <Link
                      to={paths.technician(row.person.id)}
                      className="gap-3 rounded-2xl p-3 flex items-center bg-surface-2 transition-colors hover:bg-card hover:shadow-card"
                    >
                      <Avatar name={row.person.name} color={row.person.color} />
                      <span className="min-w-0 flex-1">
                        <span className="gap-x-2 gap-y-1 flex flex-wrap items-center">
                          <span className="min-w-0 text-sm font-semibold truncate">{row.person.name}</span>
                          <PresenceBadge
                            presence={presenceOf(row.profile, clocked.has(row.person.id), now)}
                          />
                        </span>
                        <span className="mt-0.5 text-xs block truncate text-muted">
                          {row.teamName} · {plural(load?.openJobs ?? 0, 'open job')},{' '}
                          {fmtNumber(load?.openManHours ?? 0, 1)} h
                        </span>
                      </span>
                      <span
                        className={cn(
                          'h-7 w-10 rounded-lg text-xs font-bold inline-flex shrink-0 items-center justify-center',
                          LEVEL_CELL[level],
                        )}
                      >
                        L{level}
                      </span>
                    </Link>
                  </li>
                )
              })}
            </ul>
            {oneShort.length > 0 && (
              <p className="text-xs text-muted">
                One level short: {listOf(oneShort.map((x) => `${x.row.person.name} (L${x.level})`))}.
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}
