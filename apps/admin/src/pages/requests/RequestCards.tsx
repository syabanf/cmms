import { MINUTE, failureEvents, fmtDate, fmtDateTime, fmtDuration, isActive, plural, recentFailures, toMs } from '@cmms/fixtures'
import type { Asset, Attachment, AttachmentKind, MaintenanceRequest, RequestStatus } from '@cmms/types'
import { IMPACT_LABEL, PRIORITY_LABEL, SEVERITY_LABEL, WO_TYPE_LABEL } from '@cmms/types'
import { Banner, Card, CardContent, CardDescription, CardHeader, CardTitle, IconTile, Kicker, type Tone } from '@cmms/ui'
import type { LucideIcon } from 'lucide-react'
import { Ban, ChevronRight, ClipboardCheck, Copy, Eye, FileText, Gauge, Hourglass, ImageIcon, Repeat, RotateCcw, Video, Wrench } from 'lucide-react'
import { type ReactNode, useMemo } from 'react'
import { Link } from 'react-router'
import { AssetStatusBadge, CriticalityBadge, RequestStatusBadge, WoStatusBadge } from '../../components/badges'
import { AssetLink, paths } from '../../components/links'
import { useScoped } from '../../state/scoped'
import { conversionFor, triageMinutes } from './lib'

/** The reporter's own words and photos. Descriptions stay in the language they were written in. */
export function ReportCard({ request: r }: { request: MaintenanceRequest }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>What was reported</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {r.description ? (
          <p className="whitespace-pre-line text-[15px] leading-relaxed">{r.description}</p>
        ) : (
          <p className="text-sm text-muted">No details beyond the title.</p>
        )}
        <div>
          <Kicker className="mb-2">{r.attachments.length ? `Photos · ${r.attachments.length}` : 'Photos'}</Kicker>
          {r.attachments.length ? (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {r.attachments.map((a) => (
                <AttachmentTile key={a.id} attachment={a} />
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted">No photos attached.</p>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

const ATTACHMENT_ICON: Record<AttachmentKind, LucideIcon> = { photo: ImageIcon, video: Video, document: FileText }

/** Photos added in this session carry an object URL; seeded ones only have a name. */
function AttachmentTile({ attachment: a }: { attachment: Attachment }) {
  if (a.url && a.kind === 'photo') {
    return (
      <a
        href={a.url}
        target="_blank"
        rel="noreferrer"
        className="block overflow-hidden rounded-2xl bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
      >
        <img src={a.url} alt={a.name} className="aspect-square w-full object-cover" />
      </a>
    )
  }
  const Icon = ATTACHMENT_ICON[a.kind]
  return (
    <div title={a.name} className="flex aspect-square flex-col items-center justify-center gap-1.5 rounded-2xl bg-surface p-2 text-muted">
      <Icon aria-hidden="true" className="size-5" />
      <span className="w-full truncate text-center text-[11px]">{a.name}</span>
    </div>
  )
}

const DECISION: Record<RequestStatus, { verb: string; icon: LucideIcon; tone: Tone }> = {
  new: { verb: 'Reopened', icon: RotateCcw, tone: 'info' },
  monitor: { verb: 'Put on monitoring', icon: Eye, tone: 'warning' },
  converted: { verb: 'Converted', icon: Wrench, tone: 'success' },
  rejected: { verb: 'Rejected', icon: Ban, tone: 'default' },
  duplicate: { verb: 'Marked as duplicate', icon: Copy, tone: 'default' },
}

/** Where the request came from and every triage decision on it. */
export function TriageCard({ request: r, now }: { request: MaintenanceRequest; now: number }) {
  const { maps, requests, personName } = useScoped()
  const inspection = r.inspectionWoId ? maps.workOrder.get(r.inspectionWoId) : undefined
  const workOrder = r.woId ? maps.workOrder.get(r.woId) : undefined
  const original = r.duplicateOfId ? maps.request.get(r.duplicateOfId) : undefined
  const duplicates = requests.filter((x) => x.duplicateOfId === r.id)
  const decision = r.triagedBy && r.triagedAt ? { ...DECISION[r.status], by: r.triagedBy, at: r.triagedAt } : null
  const minutes = triageMinutes(r)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Triage</CardTitle>
        <CardDescription>Who decided what happens to this report, and why.</CardDescription>
      </CardHeader>
      <CardContent>
        <ol className="space-y-5">
          {inspection && (
            <TrailItem icon={<ClipboardCheck />} tone="info" title="Raised by an inspection" meta={`Flagged on ${fmtDateTime(r.reportedAt)}`}>
              <LinkedRow to={paths.workOrder(inspection.id)} code={inspection.code} title={inspection.title} badge={<WoStatusBadge status={inspection.status} />} />
            </TrailItem>
          )}
          {decision && (
            <TrailItem
              icon={<decision.icon />}
              tone={decision.tone}
              title={`${decision.verb} by ${personName(decision.by)}`}
              meta={`${fmtDateTime(decision.at)}${minutes === null ? '' : ` · ${fmtDuration(minutes)} after the report`}`}
            >
              {r.triageNote && <p className="rounded-2xl bg-surface-2 px-3 py-2 text-sm">{r.triageNote}</p>}
              {workOrder && (
                <LinkedRow to={paths.workOrder(workOrder.id)} code={workOrder.code} title={workOrder.title} badge={<WoStatusBadge status={workOrder.status} />} />
              )}
              {original && (
                <LinkedRow to={paths.request(original.id)} code={original.code} title={original.title} badge={<RequestStatusBadge status={original.status} />} />
              )}
            </TrailItem>
          )}
          {r.status === 'new' && (
            <TrailItem icon={<Hourglass />} tone="danger" title="Waiting for triage" meta={`In the queue for ${fmtDuration((now - toMs(r.reportedAt)) / MINUTE)}`} />
          )}
          {duplicates.length > 0 && (
            <TrailItem icon={<Copy />} tone="default" title={`Reported again: ${plural(duplicates.length, 'duplicate')}`}>
              {duplicates.map((d) => (
                <LinkedRow key={d.id} to={paths.request(d.id)} code={d.code} title={d.title} badge={<RequestStatusBadge status={d.status} />} />
              ))}
            </TrailItem>
          )}
        </ol>
      </CardContent>
    </Card>
  )
}

function TrailItem({ icon, tone, title, meta, children }: { icon: ReactNode; tone: Tone; title: string; meta?: string; children?: ReactNode }) {
  return (
    <li className="flex gap-3">
      <IconTile size="sm" shape="round" tone={tone}>
        {icon}
      </IconTile>
      <div className="min-w-0 flex-1 pt-0.5">
        <p className="text-sm font-semibold">{title}</p>
        {meta && <p className="text-xs text-muted">{meta}</p>}
        <div className="mt-2 space-y-2 empty:hidden">{children}</div>
      </div>
    </li>
  )
}

function LinkedRow({ to, code, title, badge }: { to: string; code: string; title: string; badge: ReactNode }) {
  return (
    <Link
      to={to}
      className="flex w-full items-center gap-3 rounded-2xl bg-surface-2 p-3 transition-colors hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
    >
      <span className="min-w-0 flex-1">
        <span className="block font-mono text-[11px] text-muted">{code}</span>
        <span className="block truncate text-sm font-medium">{title}</span>
      </span>
      {badge}
      <ChevronRight aria-hidden="true" className="size-4 shrink-0 text-muted" />
    </Link>
  )
}

/** What a conversion would create, shown while the request still waits for a decision. */
export function PrioritySuggestion({ request: r, asset }: { request: MaintenanceRequest; asset: Asset }) {
  const { settings } = useScoped()
  const { priority, type } = conversionFor(r, asset.criticality)
  const rule = settings.approvalByPriority[priority]
  return (
    <Banner tone="info" icon={<Gauge />} title={`Suggested priority: ${priority} ${PRIORITY_LABEL[priority]}`}>
      {SEVERITY_LABEL[r.severity]} severity, class {asset.criticality} asset, {IMPACT_LABEL[r.impact].toLowerCase()}. Converting opens{' '}
      {type === 'emergency' ? 'an' : 'a'} {WO_TYPE_LABEL[type].toLowerCase()} work order due within {settings.slaHours[priority]} h
      {rule === 'auto' ? '.' : `, and it waits for ${rule} approval.`}
    </Banner>
  )
}

/** The asset with its criticality, repeat failures and the work already open on it. */
export function AssetCard({ request: r, now }: { request: MaintenanceRequest; now: number }) {
  const { maps, workOrders, settings, locationPath } = useScoped()
  const asset = maps.asset.get(r.assetId)
  const windowDays = settings.repeatWindowDays * 2
  const recent = useMemo(() => recentFailures(r.assetId, failureEvents(workOrders), windowDays, now), [r.assetId, workOrders, windowDays, now])
  const openWork = useMemo(
    () => workOrders.filter((w) => w.assetId === r.assetId && isActive(w) && w.id !== r.woId),
    [workOrders, r.assetId, r.woId],
  )

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-[13px] font-bold uppercase tracking-[0.4px]">Asset</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {asset ? (
          <>
            <AssetLink assetId={asset.id} showIcon />
            <div className="flex flex-wrap items-center gap-1.5">
              <AssetStatusBadge status={asset.status} />
              <CriticalityBadge criticality={asset.criticality} long />
            </div>
            <p className="text-xs text-muted">{locationPath(asset.locationId)}</p>
            {recent.length >= 2 && (
              <Banner tone="warning" icon={<Repeat />} title={`${recent.length} failures in the last ${windowDays} days`}>
                Latest: {recent[0].wo.title}, {fmtDate(recent[0].at)}. Check the asset history before you convert.
              </Banner>
            )}
            {openWork.length > 0 && (
              <div className="space-y-2 pt-1">
                <p className="text-xs font-semibold text-muted">Open work on this asset</p>
                {openWork.slice(0, 3).map((w) => (
                  <LinkedRow key={w.id} to={paths.workOrder(w.id)} code={w.code} title={w.title} badge={<WoStatusBadge status={w.status} />} />
                ))}
                {openWork.length > 3 && (
                  <Link to={paths.asset(asset.id)} className="inline-block text-xs font-semibold text-accent hover:underline">
                    {openWork.length - 3} more on the asset page
                  </Link>
                )}
              </div>
            )}
          </>
        ) : (
          <p className="text-sm text-muted">This asset is no longer in the register.</p>
        )}
      </CardContent>
    </Card>
  )
}
