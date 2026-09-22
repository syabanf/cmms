import { HISTORY_KIND_LABEL, type HistoryItem, fmtDate, fmtIdr, fmtTime, fmtWeekday, plural } from '@cmms/fixtures'
import { IconTile } from '@cmms/ui'
import { Link } from 'react-router'
import { OutcomeBadge } from '../../components/badges'
import { paths } from '../../components/links'
import { useScoped } from '../../state/scoped'
import { KIND_STYLE, groupByDay } from './lib'

/** History items grouped by day, newest first. `assetId` hides the asset name on its own rows. */
export function HistoryTimeline({ items, assetId }: { items: HistoryItem[]; assetId: string | null }) {
  return (
    <div className="space-y-5">
      {groupByDay(items).map((group) => {
        const day = `${fmtWeekday(group.at)} ${fmtDate(group.at)}`
        return (
          <section key={group.key} aria-label={day}>
            <h3 className="flex items-baseline gap-2 text-[13px] font-semibold">
              {day}
              <span className="text-xs font-normal text-muted">{plural(group.items.length, 'event')}</span>
            </h3>
            <ul className="mt-1 divide-y divide-border">
              {group.items.map((item) => (
                <HistoryRow key={item.id} item={item} showAsset={item.assetId !== assetId} />
              ))}
            </ul>
          </section>
        )
      })}
    </div>
  )
}

function HistoryRow({ item, showAsset }: { item: HistoryItem; showAsset: boolean }) {
  const { maps } = useScoped()
  const { icon: Icon, tone } = KIND_STYLE[item.kind]
  const asset = showAsset ? maps.asset.get(item.assetId) : undefined
  return (
    <li className="flex items-start gap-3 py-3">
      <IconTile size="sm" tone={tone}>
        <Icon />
      </IconTile>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          {item.woId ? (
            <Link to={paths.workOrder(item.woId)} className="min-w-0 break-words text-sm font-semibold hover:text-accent hover:underline">
              {item.title}
            </Link>
          ) : (
            <p className="min-w-0 break-words text-sm font-semibold">{item.title}</p>
          )}
          <OutcomeBadge outcome={item.outcome} />
        </div>
        {item.detail && <p className="mt-0.5 break-words text-xs text-muted">{item.detail}</p>}
        <p className="mt-1 flex flex-wrap items-center gap-x-1.5 text-xs text-muted">
          <span className="tabular-nums">{fmtTime(item.at)}</span>
          <span aria-hidden>·</span>
          <span>{HISTORY_KIND_LABEL[item.kind]}</span>
          {asset && (
            <>
              <span aria-hidden>·</span>
              <Link to={paths.asset(asset.id)} className="font-medium text-body hover:text-accent">
                {asset.name}
              </Link>
            </>
          )}
        </p>
      </div>
      {item.amount !== null && item.amount > 0 && <p className="shrink-0 text-sm font-semibold tabular-nums">{fmtIdr(item.amount)}</p>}
    </li>
  )
}
