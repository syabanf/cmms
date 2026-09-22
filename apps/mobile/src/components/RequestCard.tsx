import { fmtWhen } from '@cmms/fixtures'
import type { MaintenanceRequest } from '@cmms/types'
import { REQUEST_STATUS_LABEL, SEVERITY_LABEL } from '@cmms/types'
import { StatusDot, cn } from '@cmms/ui'
import { Link } from 'react-router'
import { paths } from '../lib/paths'
import { useMobileScope } from '../state/scope'
import { REQUEST_STATUS_TONE, SEVERITY_TONE, StatusText } from './badges'
import { AssetIcon } from './icons'

export function RequestCard({ request, now, showReporter = false }: { request: MaintenanceRequest; now: number; showReporter?: boolean }) {
  const { maps, personName } = useMobileScope()
  const asset = maps.asset.get(request.assetId)
  const open = request.status === 'new' || request.status === 'monitor'
  const tile = !open ? 'bg-surface text-muted' : request.severity === 'critical' ? 'bg-accent text-white' : 'bg-surface text-body'
  return (
    <Link
      to={paths.request(request.id)}
      className={cn(
        'block rounded-[24px] p-4 shadow-card transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 active:scale-[0.98]',
        open ? 'bg-card' : 'bg-card/70',
      )}
    >
      <div className="flex items-center gap-3">
        <span className={cn('flex size-12 shrink-0 items-center justify-center rounded-full [&_svg]:size-5', tile)}>
          <AssetIcon icon={asset ? maps.assetType.get(asset.typeId)?.icon : undefined} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <span className="truncate font-mono text-[13px] font-semibold">{request.code}</span>
            <StatusText tone={REQUEST_STATUS_TONE[request.status]} label={REQUEST_STATUS_LABEL[request.status]} />
          </div>
          <p className="mt-0.5 truncate text-[13px] text-muted">{asset ? `${asset.name} · ${asset.code}` : 'Removed asset'}</p>
        </div>
      </div>
      <p className="mt-3 text-[15px] font-semibold leading-snug">{request.title}</p>
      <div className="mt-2.5 flex items-center justify-between gap-3 text-xs">
        <span className="flex shrink-0 items-center gap-1.5 font-semibold">
          <StatusDot tone={SEVERITY_TONE[request.severity]} />
          {SEVERITY_LABEL[request.severity]}
        </span>
        <span className="min-w-0 truncate text-muted">
          {showReporter ? `${personName(request.reportedBy)} · ` : ''}
          {fmtWhen(request.reportedAt, now)}
        </span>
      </div>
    </Link>
  )
}
