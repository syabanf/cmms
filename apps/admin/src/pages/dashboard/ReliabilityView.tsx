import {
  DAY,
  assetReliability,
  badActors,
  failureEvents,
  fleetReliability,
  fmtDateShort,
  fmtIdrShort,
  fmtNumber,
  pareto,
  repeatFailures,
} from '@cmms/fixtures'
import { BarList, Button, Card, CardContent, CardHeader, CardTitle, EmptyState, ProgressBar, StatCard } from '@cmms/ui'
import { Activity, Clock, Microscope, Repeat, Timer, TriangleAlert } from 'lucide-react'
import { useMemo } from 'react'
import { Link } from 'react-router'
import { RcaStatusBadge } from '../../components/badges'
import { paths } from '../../components/links'
import { useScoped } from '../../state/scoped'

export function ReliabilityView({ now }: { now: number }) {
  const s = useScoped()
  const d = useMemo(() => {
    const from = now - 90 * DAY
    const rows = assetReliability(s.assets, s.workOrders, s.meters, s.maps.person, from, now, s.settings.repeatWindowDays, now)
    const events = failureEvents(s.workOrders).filter((e) => e.at >= from)
    const groups = repeatFailures(failureEvents(s.workOrders), s.settings.repeatWindowDays).filter((g) => g.lastAt >= from)
    return {
      fleet: fleetReliability(rows, s.meters, from, now),
      bad: badActors(rows, 5),
      modes: pareto(events.map((e) => e.modeId)).slice(0, 6),
      groups,
      rcas: s.rcas.filter((r) => r.status !== 'closed'),
    }
  }, [s, now])

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <StatCard label="MTBF" value={d.fleet.mtbfHours ? fmtNumber(d.fleet.mtbfHours) : 'None'} unit="h" hint="Mean time between failures, 90 days" icon={<Activity />} tone="ink" />
        <StatCard label="MTTR" value={d.fleet.mttrHours ? fmtNumber(d.fleet.mttrHours, 1) : 'None'} unit="h" hint="Hands-on repair time per failure" icon={<Timer />} />
        <StatCard label="Downtime" value={fmtNumber(d.fleet.downtimeHours, 1)} unit="h" hint={`${d.fleet.failures} failures stopped production`} icon={<Clock />} tone="warning" />
        <StatCard
          label="Repeat failures"
          value={d.groups.length}
          hint={`Same asset and mode within ${s.settings.repeatWindowDays} days`}
          icon={<Repeat />}
          tone={d.groups.length ? 'danger' : 'default'}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader action={<Button asChild variant="outline" size="sm"><Link to="/reliability/failures">All failures</Link></Button>}>
            <CardTitle>Bad actors</CardTitle>
            <p className="text-sm text-muted">Assets with the most failures in 90 days</p>
          </CardHeader>
          <CardContent>
            {d.bad.length ? (
              <BarList
                ariaLabel="Failures per asset"
                items={d.bad.map((r, i) => {
                  const asset = s.maps.asset.get(r.assetId)
                  return {
                    key: r.assetId,
                    label: (
                      <Link to={paths.asset(r.assetId)} className="hover:text-accent">
                        {asset?.name} <span className="font-mono text-xs text-muted">{asset?.code}</span>
                      </Link>
                    ),
                    value: r.failures,
                    display: `${r.failures} failures`,
                    hint: `${fmtNumber(r.downtimeHours, 1)} h down · ${fmtIdrShort(r.cost)}${r.repeats ? ` · ${r.repeats} repeat` : ''}`,
                    emphasis: i === 0,
                  }
                })}
              />
            ) : (
              <EmptyState compact icon={<Activity />} title="No failures in 90 days" />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Top failure modes</CardTitle>
            <p className="text-sm text-muted">Coded on completed corrective work, 90 days</p>
          </CardHeader>
          <CardContent>
            {d.modes.length ? (
              <BarList
                ariaLabel="Failures by failure mode"
                tone="info"
                items={d.modes.map((m, i) => ({
                  key: m.key,
                  label: s.maps.failureCode.get(m.key)?.name ?? 'Unknown',
                  value: m.count,
                  display: `${m.count} · ${Math.round(m.share * 100)}%`,
                  emphasis: i === 0,
                }))}
              />
            ) : (
              <EmptyState compact icon={<TriangleAlert />} title="No coded failures yet" />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Repeat failures</CardTitle>
            <p className="text-sm text-muted">The same failure coming back is a root cause left in place</p>
          </CardHeader>
          <CardContent className="space-y-2">
            {d.groups.length ? (
              d.groups.slice(0, 4).map((g) => {
                const asset = s.maps.asset.get(g.assetId)
                const rca = s.rcas.find((r) => r.assetId === g.assetId && r.modeId === g.modeId)
                return (
                  <div key={g.key} className="flex flex-wrap items-center gap-3 rounded-2xl bg-surface-2 p-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">
                        {asset?.name} · {s.maps.failureCode.get(g.modeId)?.name}
                      </p>
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {g.events.map((e) => (
                          <span key={e.wo.id} className="rounded-full bg-card px-2 py-0.5 text-[11px] font-semibold tabular-nums shadow-card">
                            {fmtDateShort(e.at)}
                          </span>
                        ))}
                      </div>
                    </div>
                    {rca ? (
                      <Button asChild variant="outline" size="sm">
                        <Link to={paths.rca(rca.id)}>{rca.code}</Link>
                      </Button>
                    ) : (
                      <Button asChild variant="soft" size="sm">
                        <Link to="/reliability/failures">Start RCA</Link>
                      </Button>
                    )}
                  </div>
                )
              })
            ) : (
              <EmptyState compact icon={<Repeat />} title="No repeat failures" description="Nothing failed twice the same way inside the window." />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader action={<Button asChild variant="outline" size="sm"><Link to="/reliability/rca">All RCA</Link></Button>}>
            <CardTitle>Open root cause analysis</CardTitle>
            <p className="text-sm text-muted">Corrective and preventive actions in progress</p>
          </CardHeader>
          <CardContent className="space-y-2">
            {d.rcas.length ? (
              d.rcas.map((r) => {
                const done = r.actions.filter((a) => a.status === 'done').length
                return (
                  <Link key={r.id} to={paths.rca(r.id)} className="block rounded-2xl bg-surface-2 p-3 transition-colors hover:bg-card hover:shadow-card">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-mono text-[11px] text-muted">{r.code}</p>
                        <p className="truncate text-sm font-semibold">{r.title}</p>
                      </div>
                      <RcaStatusBadge status={r.status} />
                    </div>
                    <div className="mt-2 flex items-center gap-3">
                      <ProgressBar value={r.actions.length ? done / r.actions.length : 0} size="xs" className="flex-1" aria-label="Actions done" />
                      <span className="text-xs text-muted tabular-nums">
                        {done}/{r.actions.length} actions
                      </span>
                    </div>
                  </Link>
                )
              })
            ) : (
              <EmptyState compact icon={<Microscope />} title="No open RCA" />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
