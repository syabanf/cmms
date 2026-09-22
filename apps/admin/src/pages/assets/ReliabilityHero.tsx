import {
  DAY,
  assetReliability,
  failureEvents,
  fmtIdrShort,
  fmtNumber,
  plural,
  repeatFailures,
} from '@cmms/fixtures'
import type { Asset } from '@cmms/types'
import { RCA_STATUS_LABEL } from '@cmms/types'
import { Card, Kicker } from '@cmms/ui'
import { ArrowUpRight, Repeat } from 'lucide-react'
import { useMemo } from 'react'
import { Link } from 'react-router'
import { paths } from '../../components/links'
import { useScoped } from '../../state/scoped'

const WINDOW_DAYS = 90

/** Dark hero on the passport: the last 90 days of failures, MTBF, MTTR and cost. */
export function ReliabilityHero({ asset, now }: { asset: Asset; now: number }) {
  const { workOrders, meters, maps, settings, rcas } = useScoped()
  const from = now - WINDOW_DAYS * DAY

  const [rel] = useMemo(
    () =>
      assetReliability([asset], workOrders, meters, maps.person, from, now, settings.repeatWindowDays, now),
    [asset, workOrders, meters, maps.person, from, now, settings.repeatWindowDays],
  )
  const repeat = useMemo(
    () =>
      repeatFailures(failureEvents(workOrders), settings.repeatWindowDays).find(
        (g) => g.assetId === asset.id && g.lastAt >= from,
      ),
    [workOrders, settings.repeatWindowDays, asset.id, from],
  )
  const rca = rcas.find((r) => r.assetId === asset.id && r.status !== 'closed')
  if (!rel) return null

  const headline = rel.failures
    ? `${plural(rel.failures, 'breakdown')} and ${fmtNumber(rel.downtimeHours, 1)}\u00a0h of downtime.`
    : 'No breakdowns in the last 90 days.'

  return (
    <Card variant="ink" className="p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-[12rem] flex-1">
          <Kicker className="text-on-ink-muted">Reliability · last {WINDOW_DAYS} days</Kicker>
          <p className="mt-1 text-lg leading-snug font-semibold">{headline}</p>
        </div>
        {repeat && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-accent px-3 py-1.5 text-xs font-semibold text-white shadow-glow">
              <Repeat aria-hidden="true" className="size-3.5" />
              Repeat failure: {maps.failureCode.get(repeat.modeId)?.name ?? 'same failure mode'} ×
              {repeat.events.length} in{' '}
              {plural(Math.max(1, Math.round((repeat.lastAt - repeat.firstAt) / DAY)), 'day')}
            </span>
            {rca && (
              <Link
                to={paths.rca(rca.id)}
                className="inline-flex items-center gap-1 rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-white/20"
              >
                {rca.code} · {RCA_STATUS_LABEL[rca.status]}
                <ArrowUpRight aria-hidden="true" className="size-3.5" />
              </Link>
            )}
          </div>
        )}
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Metric
          label="Failures"
          value={fmtNumber(rel.failures)}
          hint={rel.repeats ? `${rel.repeats} of them repeats` : 'Corrective and emergency'}
        />
        <Metric
          label="MTBF"
          value={rel.mtbfHours === null ? 'n/a' : fmtNumber(rel.mtbfHours)}
          unit={rel.mtbfHours === null ? undefined : 'h'}
          hint="Between failures"
        />
        <Metric
          label="MTTR"
          value={rel.mttrHours === null ? 'n/a' : fmtNumber(rel.mttrHours, 1)}
          unit={rel.mttrHours === null ? undefined : 'h'}
          hint="Hands-on repair"
        />
        <Metric
          label="Maintenance cost"
          value={fmtIdrShort(rel.cost)}
          hint={`${plural(rel.workOrders, 'work order')} completed`}
        />
      </div>
    </Card>
  )
}

function Metric({ label, value, unit, hint }: { label: string; value: string; unit?: string; hint: string }) {
  return (
    <div className="min-w-0 rounded-2xl bg-white/5 p-4">
      <p className="truncate text-xs font-medium text-on-ink-muted">{label}</p>
      <p className="mt-1.5 flex items-start gap-1 leading-none">
        <span className="truncate text-xl font-bold tracking-tight tabular-nums sm:text-[26px]">{value}</span>
        {unit && <span className="shrink-0 pt-0.5 text-sm font-semibold text-on-ink-muted">{unit}</span>}
      </p>
      <p className="mt-1.5 truncate text-[11px] text-on-ink-muted">{hint}</p>
    </div>
  )
}
