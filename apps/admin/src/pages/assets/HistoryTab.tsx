import {
  DAY,
  HISTORY_KINDS,
  HISTORY_KIND_LABEL,
  type HistoryKind,
  fmtDate,
  fmtIdr,
  fmtTime,
  fmtWeekday,
  historyItems,
  isSameDay,
  subtreeIds,
} from '@cmms/fixtures'
import type { Asset } from '@cmms/types'
import { Button, Chip, ChipRow, EmptyState, IconTile, type Tone } from '@cmms/ui'
import {
  ChevronDown,
  ClipboardCheck,
  Coins,
  Crosshair,
  FileText,
  Gauge,
  History,
  Package,
  TriangleAlert,
  Wrench,
} from 'lucide-react'
import { type ReactNode, useMemo, useState } from 'react'
import { Link } from 'react-router'
import { OutcomeBadge } from '../../components/badges'
import { paths } from '../../components/links'
import { useScoped } from '../../state/scoped'
import { groupByDay } from './lib'

const PAGE = 10

const KIND_META: Record<HistoryKind, { icon: ReactNode; tone: Tone }> = {
  work_order: { icon: <Wrench />, tone: 'default' },
  failure: { icon: <TriangleAlert />, tone: 'danger' },
  part: { icon: <Package />, tone: 'warning' },
  measurement: { icon: <Gauge />, tone: 'default' },
  cost: { icon: <Coins />, tone: 'default' },
  document: { icon: <FileText />, tone: 'default' },
  inspection: { icon: <ClipboardCheck />, tone: 'info' },
  calibration: { icon: <Crosshair />, tone: 'info' },
}

function dayLabel(at: number, now: number) {
  if (isSameDay(at, now)) return 'Today'
  if (isSameDay(at, now - DAY)) return 'Yesterday'
  return `${fmtWeekday(at)} ${fmtDate(at)}`
}

/** Everything that happened to the asset and its components, newest first. */
export function HistoryTab({ asset, now }: { asset: Asset; now: number }) {
  const scoped = useScoped()
  const [kind, setKind] = useState<HistoryKind | 'all'>('all')
  const [shown, setShown] = useState(PAGE)

  const items = useMemo(
    () =>
      historyItems(
        {
          workOrders: scoped.workOrders,
          meters: scoped.meters,
          meterReadings: scoped.meterReadings,
          documents: scoped.documents,
          calibrations: scoped.calibrations,
          parts: scoped.maps.part,
          failureCodes: scoped.maps.failureCode,
          people: scoped.maps.person,
        },
        subtreeIds(scoped.assets, asset.id),
        now,
      ),
    [scoped, asset.id, now],
  )

  // Cost rows repeat the amount already on their work order row, so "All" leaves them out.
  const list = kind === 'all' ? items.filter((i) => i.kind !== 'cost') : items.filter((i) => i.kind === kind)
  const groups = groupByDay(list.slice(0, shown))
  const pick = (next: HistoryKind | 'all') => {
    setKind(next)
    setShown(PAGE)
  }

  return (
    <div>
      <ChipRow className="mb-4">
        <Chip
          variant="filter"
          className="h-8 px-3 text-xs"
          active={kind === 'all'}
          onClick={() => pick('all')}
        >
          All
        </Chip>
        {HISTORY_KINDS.map((k) => (
          <Chip
            key={k}
            variant="filter"
            className="h-8 px-3 text-xs"
            active={kind === k}
            count={items.filter((i) => i.kind === k).length}
            onClick={() => pick(k)}
          >
            {HISTORY_KIND_LABEL[k]}
          </Chip>
        ))}
      </ChipRow>

      {groups.length === 0 ? (
        <EmptyState
          compact
          icon={<History />}
          title={kind === 'all' ? 'No history yet' : `No ${HISTORY_KIND_LABEL[kind].toLowerCase()} entries`}
          description="Closed work, part changes, meter readings, documents and calibrations appear here as they happen."
        />
      ) : (
        <div className="space-y-5">
          {groups.map((group) => (
            <section key={group.key}>
              <h3 className="mb-1 text-xs font-semibold tracking-wide text-muted uppercase">
                {dayLabel(group.at, now)}
              </h3>
              <ul className="divide-y divide-border">
                {group.items.map((item) => {
                  const meta = KIND_META[item.kind]
                  const component =
                    item.assetId !== asset.id ? scoped.maps.asset.get(item.assetId) : undefined
                  return (
                    <li key={item.id} className="flex items-start gap-3 py-3">
                      <IconTile size="sm" tone={meta.tone}>
                        {meta.icon}
                      </IconTile>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          {item.woId ? (
                            <Link
                              to={paths.workOrder(item.woId)}
                              className="min-w-0 text-sm font-medium transition-colors hover:text-accent"
                            >
                              {item.title}
                            </Link>
                          ) : (
                            <p className="min-w-0 text-sm font-medium">{item.title}</p>
                          )}
                          <OutcomeBadge outcome={item.outcome} />
                          {component && (
                            <span className="rounded-full bg-surface px-2 py-0.5 font-mono text-[11px] text-body">
                              {component.code}
                            </span>
                          )}
                        </div>
                        <p className="mt-0.5 text-xs text-muted">
                          {fmtTime(item.at)} · {HISTORY_KIND_LABEL[item.kind]}
                          {item.detail ? ` · ${item.detail}` : ''}
                        </p>
                      </div>
                      {item.amount ? (
                        <span className="shrink-0 text-sm font-semibold tabular-nums">
                          {fmtIdr(item.amount)}
                        </span>
                      ) : null}
                    </li>
                  )
                })}
              </ul>
            </section>
          ))}
        </div>
      )}

      {list.length > shown && (
        <div className="mt-4 flex justify-center">
          <Button variant="outline" onClick={() => setShown((n) => n + PAGE)}>
            Show more
            <span className="font-medium text-muted">{list.length - shown} left</span>
            <ChevronDown />
          </Button>
        </div>
      )}
    </div>
  )
}
