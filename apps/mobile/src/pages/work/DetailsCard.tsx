import { fmtDuration, fmtWhen, isClockedIn, plural } from '@cmms/fixtures'
import type { WorkOrder } from '@cmms/types'
import { Avatar, KeyValue } from '@cmms/ui'
import { Link } from 'react-router'
import { paths } from '../../lib/paths'
import { useMobileScope } from '../../state/scope'

/** Where the job is, who is on it and what the plan asks for. */
export function DetailsCard({ wo }: { wo: WorkOrder }) {
  const { maps, personName, locationPath } = useMobileScope()
  const asset = maps.asset.get(wo.assetId)
  const plan = wo.jobPlanId ? maps.jobPlan.get(wo.jobPlanId) : undefined
  const team = maps.team.get(wo.teamId)
  const required = wo.tasks.filter((t) => t.required).length

  return (
    <KeyValue
      items={[
        {
          label: 'Machine',
          value: asset ? (
            <Link to={paths.asset(asset.code)} className="-my-3 block py-3 font-semibold text-accent">
              {asset.name} · {asset.code}
            </Link>
          ) : (
            'Removed asset'
          ),
        },
        { label: 'Location', value: asset ? locationPath(asset.locationId) : '', hidden: !asset },
        {
          label: 'Team',
          value: team ? `${team.name}${team.supervisorId ? ` · supervisor ${personName(team.supervisorId)}` : ''}` : 'No team',
        },
        {
          label: 'People',
          value: wo.assigneeIds.length ? (
            <span className="flex flex-col gap-1.5">
              {wo.assigneeIds.map((id) => (
                <span key={id} className="flex items-center gap-2">
                  <Avatar name={personName(id)} color={maps.person.get(id)?.color} size="xs" />
                  <span className="min-w-0 truncate">{personName(id)}</span>
                  {isClockedIn(wo, id) && <span className="shrink-0 text-xs font-semibold text-info">On the clock</span>}
                </span>
              ))}
            </span>
          ) : (
            'Nobody yet'
          ),
        },
        { label: 'Job plan', value: plan ? `${plan.code} · ${plan.name}` : 'None, checklist set on this work order' },
        {
          label: 'Scope',
          value: `${plural(wo.tasks.length, 'check')}, ${required} required · ${fmtDuration(wo.estimatedMin)} estimated`,
        },
        { label: 'Planned', value: wo.scheduledAt ? fmtWhen(wo.scheduledAt) : '', hidden: !wo.scheduledAt },
        { label: 'Requested', value: `${personName(wo.requestedBy)} · ${fmtWhen(wo.requestedAt)}` },
      ]}
    />
  )
}
