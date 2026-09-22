import { fmtAgo } from '@cmms/fixtures'
import type { MaintenanceRequest } from '@cmms/types'
import { Camera } from 'lucide-react'
import { Link } from 'react-router'
import { RequestStatusBadge, SeverityBadge } from '../../components/badges'
import { AssetLink, PersonAvatar, paths } from '../../components/links'
import { useScoped } from '../../state/scoped'
import { SourceBadge } from './SourceBadge'

/**
 * One request in the triage list. The title link stretches over the whole row, while the asset link
 * sits above it with its own target. Below `lg` the asset and reporter sit under the title; from `lg`
 * they become columns.
 */
export function RequestRow({ request: r, now }: { request: MaintenanceRequest; now: number }) {
  const { personName } = useScoped()
  const photos = r.attachments.filter((a) => a.kind === 'photo').length

  return (
    <li className="relative grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-2.5 px-5 py-3.5 transition-colors hover:bg-surface-2 lg:grid-cols-[minmax(0,1fr)_13rem_11rem_7rem] lg:items-center">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="font-mono text-[11px] text-muted">{r.code}</span>
          <SourceBadge source={r.source} />
          {photos > 0 && (
            <span className="inline-flex items-center gap-1 text-[11px] text-muted" title={`${photos} photo${photos === 1 ? '' : 's'}`}>
              <Camera aria-hidden="true" className="size-3.5" />
              {photos}
            </span>
          )}
        </div>
        <Link
          to={paths.request(r.id)}
          className="mt-1 block text-sm font-semibold after:absolute after:inset-0 focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-inset focus-visible:after:ring-accent/40"
        >
          <span className="line-clamp-2">{r.title}</span>
        </Link>
      </div>

      <div className="col-start-1 row-start-2 flex min-w-0 flex-wrap items-center gap-x-6 gap-y-2 lg:contents">
        <AssetLink assetId={r.assetId} showIcon className="relative z-10 max-w-full" />
        <span className="flex min-w-0 items-center gap-2">
          <PersonAvatar personId={r.reportedBy} />
          <span className="min-w-0">
            <span className="block truncate text-sm">{personName(r.reportedBy)}</span>
            <span className="block text-[11px] text-muted">{fmtAgo(r.reportedAt, now)}</span>
          </span>
        </span>
      </div>

      <div className="col-start-2 row-span-2 row-start-1 flex flex-col items-end gap-1.5 lg:col-start-auto lg:row-span-1 lg:row-start-auto">
        <RequestStatusBadge status={r.status} />
        <SeverityBadge severity={r.severity} />
      </div>
    </li>
  )
}
