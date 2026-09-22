import { type RepeatGroup, fmtDateShort, fmtNumber } from '@cmms/fixtures'
import type { Rca } from '@cmms/types'
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, EmptyState, toast } from '@cmms/ui'
import { ChevronRight, Microscope, Repeat } from 'lucide-react'
import { Link, useNavigate } from 'react-router'
import { useAuth } from '../../auth/auth'
import { RcaStatusBadge } from '../../components/badges'
import { paths } from '../../components/links'
import { useScoped } from '../../state/scoped'
import { createRca } from '../rca/lib'
import { groupDowntime, repeatProblem, spanDays } from './lib'

/** The RCA that covers a chain: an open one first, else the latest closed one. */
function rcaFor(rcas: readonly Rca[], group: RepeatGroup): Rca | undefined {
  const matching = rcas.filter((r) => r.assetId === group.assetId && r.modeId === group.modeId)
  return matching.find((r) => r.status !== 'closed') ?? matching.sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]
}

export function RepeatFailuresCard({ groups, windowDays, periodDays, now }: { groups: RepeatGroup[]; windowDays: number; periodDays: number; now: number }) {
  const s = useScoped()
  const { can } = useAuth()
  const navigate = useNavigate()
  const canManage = can('rca.manage')

  const start = (group: RepeatGroup) => {
    const assetName = s.maps.asset.get(group.assetId)?.name ?? 'the asset'
    const modeName = s.maps.failureCode.get(group.modeId)?.name ?? 'Failure'
    const rca = createRca(s.state.rcas, s.siteId, s.user.id, {
      title: `Repeat ${modeName.toLowerCase()} on ${assetName}`,
      assetId: group.assetId,
      modeId: group.modeId,
      trigger: 'repeat',
      woIds: group.events.map((e) => e.wo.id),
      problem: repeatProblem(group, assetName, modeName, now),
    })
    s.dispatch({ type: 'rca/upsert', item: rca })
    toast(`${rca.code} started`, { tone: 'success', description: `${group.events.length} failures linked. Work through the 5 Why next.` })
    navigate(paths.rca(rca.id))
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Repeat failures</CardTitle>
        <CardDescription>
          The same failure mode on the same asset within {windowDays} days. A repeat means the root cause is still in place.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {groups.length ? (
          groups.map((group) => {
            const asset = s.maps.asset.get(group.assetId)
            const rca = rcaFor(s.rcas, group)
            const down = groupDowntime(group, now)
            return (
              <div key={group.key} className="flex flex-wrap items-center gap-3 rounded-2xl bg-surface-2 p-3">
                <div className="min-w-[12rem] flex-1">
                  <p className="text-sm font-semibold">
                    {asset ? (
                      <Link to={paths.asset(asset.id)} className="hover:text-accent">
                        {asset.name}
                      </Link>
                    ) : (
                      'Removed asset'
                    )}
                    <span className="font-normal text-muted"> · {s.maps.failureCode.get(group.modeId)?.name ?? 'Unknown mode'}</span>
                  </p>
                  <ol aria-label="Failure dates" className="mt-1.5 flex flex-wrap items-center gap-1">
                    {group.events.map((e, i) => (
                      <li key={e.wo.id} className="flex items-center gap-1">
                        {i > 0 && <ChevronRight aria-hidden className="size-3 text-silver" />}
                        <Link
                          to={paths.workOrder(e.wo.id)}
                          title={e.wo.code}
                          className="inline-flex rounded-full bg-card px-2 py-0.5 text-[11px] font-semibold tabular-nums shadow-card transition-colors hover:text-accent"
                        >
                          {fmtDateShort(e.at)}
                        </Link>
                      </li>
                    ))}
                  </ol>
                  <p className="mt-1.5 text-xs text-muted">
                    {group.events.length} failures in {spanDays(group)} days
                    {down > 0 && ` · ${fmtNumber(down, 1)} h down`}
                  </p>
                </div>
                {rca ? (
                  <div className="flex items-center gap-2">
                    <RcaStatusBadge status={rca.status} />
                    <Button asChild variant="outline" size="sm">
                      <Link to={paths.rca(rca.id)}>Open {rca.code}</Link>
                    </Button>
                  </div>
                ) : canManage ? (
                  <Button variant="secondary" size="sm" onClick={() => start(group)}>
                    <Microscope />
                    Start RCA
                  </Button>
                ) : (
                  <span className="text-xs text-muted">No RCA yet</span>
                )}
              </div>
            )
          })
        ) : (
          <EmptyState
            compact
            icon={<Repeat />}
            title={`No repeat failures in the last ${periodDays} days`}
            description="Nothing failed twice the same way inside the window. Keep coding the failure mode on corrective work so repeats show up here."
          />
        )}
      </CardContent>
    </Card>
  )
}
