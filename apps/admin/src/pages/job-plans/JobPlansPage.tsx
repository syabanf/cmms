import { fmtDuration, plural } from '@cmms/fixtures'
import type { JobPlan, WoType } from '@cmms/types'
import { WO_TYPES, WO_TYPE_LABEL } from '@cmms/types'
import { Badge, Button, Card, Chip, EmptyState, IconTile, Input, PageHeader, SplitStats, type Tone } from '@cmms/ui'
import { Clock, HardHat, ListChecks, Lock, Plus, Search, Users } from 'lucide-react'
import { useMemo } from 'react'
import { Link, useNavigate } from 'react-router'
import { useAuth } from '../../auth/auth'
import { WoTypeBadge } from '../../components/badges'
import { WoTypeIcon } from '../../components/icons'
import { paths } from '../../components/links'
import { useHistoryState } from '../../lib/history-state'
import { useScoped } from '../../state/scoped'

const TYPE_TONE: Record<WoType, Tone> = {
  preventive: 'info',
  inspection: 'info',
  calibration: 'info',
  improvement: 'info',
  corrective: 'default',
  emergency: 'danger',
}

export function JobPlansPage() {
  const s = useScoped()
  const { can } = useAuth()
  const navigate = useNavigate()
  const [query, setQuery] = useHistoryState('query', '')
  const [type, setType] = useHistoryState<WoType | null>('type', null)

  const schedulesByPlan = useMemo(() => {
    const counts = new Map<string, number>()
    for (const pm of s.pmSchedules) counts.set(pm.jobPlanId, (counts.get(pm.jobPlanId) ?? 0) + 1)
    return counts
  }, [s.pmSchedules])

  const typeCounts = useMemo(
    () => WO_TYPES.map((t) => ({ type: t, count: s.jobPlans.filter((p) => p.woType === t).length })).filter((t) => t.count > 0),
    [s.jobPlans],
  )

  const plans = useMemo(() => {
    const terms = query.toLowerCase().split(/\s+/).filter(Boolean)
    return s.jobPlans
      .filter((p) => !type || p.woType === type)
      .filter((p) => {
        if (!terms.length) return true
        const assetTypes = p.assetTypeIds.map((id) => s.maps.assetType.get(id)?.name ?? '').join(' ')
        const text = `${p.code} ${p.name} ${p.description} ${p.toolCategories.join(' ')} ${assetTypes}`.toLowerCase()
        return terms.every((t) => text.includes(t))
      })
      .sort((a, b) => a.code.localeCompare(b.code))
  }, [s.jobPlans, s.maps.assetType, type, query])

  const filtered = query.trim() !== '' || type !== null
  const canManage = can('jobplan.manage')

  return (
    <>
      <PageHeader
        title="Job plans"
        description="Reusable maintenance templates: checklist, parts, tools, skill and safety steps."
        actions={
          <>
            <Input
              variant="pill"
              type="search"
              className="w-full sm:w-64"
              leftIcon={<Search />}
              placeholder="Search code, name or tool"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            {canManage && (
              <Button onClick={() => navigate('/preventive/job-plans/new')}>
                <Plus />
                New job plan
              </Button>
            )}
          </>
        }
      />

      <div className="mb-4 flex flex-wrap gap-2">
        <Chip variant="filter" active={type === null} count={s.jobPlans.length} onClick={() => setType(null)}>
          All
        </Chip>
        {typeCounts.map((t) => (
          <Chip key={t.type} variant="filter" active={type === t.type} count={t.count} onClick={() => setType(type === t.type ? null : t.type)}>
            {WO_TYPE_LABEL[t.type]}
          </Chip>
        ))}
      </div>

      {plans.length ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {plans.map((plan) => (
            <PlanCard key={plan.id} plan={plan} schedules={schedulesByPlan.get(plan.id) ?? 0} />
          ))}
        </div>
      ) : (
        <Card>
          {filtered ? (
            <EmptyState
              icon={<ListChecks />}
              title="No job plans match"
              description="Clear the search or type filter to see every plan."
              action={
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setQuery('')
                    setType(null)
                  }}
                >
                  Clear filters
                </Button>
              }
            />
          ) : (
            <EmptyState
              icon={<ListChecks />}
              title="No job plans yet"
              description="A job plan holds the checklist, parts, tools and safety steps that PM schedules copy onto work orders."
              action={
                canManage ? (
                  <Button size="sm" onClick={() => navigate('/preventive/job-plans/new')}>
                    <Plus />
                    New job plan
                  </Button>
                ) : undefined
              }
            />
          )}
        </Card>
      )}
    </>
  )
}

function PlanCard({ plan, schedules }: { plan: JobPlan; schedules: number }) {
  const { maps } = useScoped()
  const skill = maps.skill.get(plan.skillId)?.name ?? 'Any skill'
  const assetTypes = plan.assetTypeIds.map((id) => maps.assetType.get(id)?.name).filter(Boolean)
  const tools = plan.toolCategories

  return (
    <Link
      to={paths.jobPlan(plan.id)}
      className="group flex flex-col rounded-card bg-card p-5 shadow-card transition-shadow hover:shadow-float focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 active:scale-[0.99]"
    >
      <div className="flex items-start gap-3">
        <IconTile tone={TYPE_TONE[plan.woType]}>
          <WoTypeIcon type={plan.woType} />
        </IconTile>
        <div className="min-w-0 flex-1">
          <p className="font-mono text-xs text-muted">{plan.code}</p>
          <h3 className="mt-0.5 font-semibold leading-snug transition-colors group-hover:text-accent">{plan.name}</h3>
        </div>
        <WoTypeBadge type={plan.woType} />
      </div>

      {plan.description && <p className="mt-3 line-clamp-2 text-sm text-muted">{plan.description}</p>}

      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-body">
        <span className="inline-flex items-center gap-1">
          <Clock aria-hidden="true" className="size-3.5 text-muted" />
          {fmtDuration(plan.durationMin)}
        </span>
        <span className="inline-flex items-center gap-1">
          <HardHat aria-hidden="true" className="size-3.5 text-muted" />
          {skill} L{plan.skillLevel}+
        </span>
        <span className="inline-flex items-center gap-1">
          <Users aria-hidden="true" className="size-3.5 text-muted" />
          {plural(plan.personnel, 'person', 'people')}
        </span>
        {plan.safety.loto && (
          <Badge variant="warning">
            <Lock />
            LOTO
          </Badge>
        )}
        {!plan.active && <Badge variant="muted">Inactive</Badge>}
      </div>

      {tools.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {tools.slice(0, 4).map((tool) => (
            <span key={tool} className="rounded-full bg-surface px-2.5 py-1 text-[11px] font-medium text-body">
              {tool}
            </span>
          ))}
          {tools.length > 4 && <span className="rounded-full bg-surface px-2.5 py-1 text-[11px] font-medium text-muted">+{tools.length - 4}</span>}
        </div>
      )}
      {assetTypes.length > 0 && <p className="mt-3 truncate text-xs text-muted">For {assetTypes.join(', ')}</p>}

      <div className="min-h-4 flex-1" />
      <SplitStats
        items={[
          { label: 'Checklist lines', value: plan.tasks.length },
          { label: 'Parts', value: plan.parts.length },
          { label: 'PM schedules', value: schedules },
        ]}
      />
    </Link>
  )
}
