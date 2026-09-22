import { fmtAgo, fmtWhen } from '@cmms/fixtures'
import type { MaintenanceRequest } from '@cmms/types'
import { IMPACT_LABEL } from '@cmms/types'
import { Badge, Button, Card, EmptyState } from '@cmms/ui'
import { ArrowRight, Factory, RotateCcw, SearchX, Wrench } from 'lucide-react'
import { type ReactNode, useState } from 'react'
import { Link, useParams } from 'react-router'
import { useAuth } from '../../auth/auth'
import { BackButton } from '../../components/BackButton'
import { RequestStatusBadge, SeverityBadge } from '../../components/badges'
import { useCreate } from '../../components/create'
import { PersonAvatar, paths } from '../../components/links'
import { useNow, useScoped } from '../../state/scoped'
import { conversionFor } from './lib'
import { AssetCard, PrioritySuggestion, ReportCard, TriageCard } from './RequestCards'
import { SourceBadge } from './SourceBadge'
import { type TriageMode, TriageDialog } from './TriageDialog'

export function RequestDetailPage() {
  const { id = '' } = useParams()
  const { maps, siteId } = useScoped()
  const request = maps.request.get(id)
  if (!request) {
    return <Unavailable icon={<SearchX />} title="Request not found" description="The link may be out of date. Find the request in the list." />
  }
  if (request.siteId !== siteId) return <OtherSite request={request} />
  return <RequestView key={request.id} request={request} />
}

function Unavailable({ icon, title, description, action }: { icon: ReactNode; title: string; description: string; action?: ReactNode }) {
  return (
    <div className="space-y-4">
      <BackButton fallback="/work/requests" />
      <Card>
        <EmptyState
          icon={icon}
          title={title}
          description={description}
          action={
            action ?? (
              <Button asChild variant="outline">
                <Link to="/work/requests">All requests</Link>
              </Button>
            )
          }
        />
      </Card>
    </div>
  )
}

function OtherSite({ request }: { request: MaintenanceRequest }) {
  const { state } = useScoped()
  const { sites, switchSite } = useAuth()
  const home = state.sites.find((x) => x.id === request.siteId)
  const allowed = sites.some((x) => x.id === request.siteId)
  return (
    <Unavailable
      icon={<Factory />}
      title={`${request.code} belongs to ${home?.name ?? 'another site'}`}
      description={allowed ? 'Switch site to open it.' : 'Your account has no access to that site.'}
      action={allowed && home ? <Button onClick={() => switchSite(home.id)}>Switch to {home.name}</Button> : undefined}
    />
  )
}

function RequestView({ request: r }: { request: MaintenanceRequest }) {
  const { maps, personName } = useScoped()
  const now = useNow()
  const [mode, setMode] = useState<TriageMode | null>(null)
  const asset = maps.asset.get(r.assetId)
  const stopped = r.impact === 'stopped'

  return (
    <>
      <BackButton fallback="/work/requests" />

      <Card variant="ink" className="mb-4 mt-2 p-5 sm:p-6">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-xs text-on-ink-muted">{r.code}</span>
          <RequestStatusBadge status={r.status} />
          <SeverityBadge severity={r.severity} />
          <Badge variant={stopped ? 'accent' : 'default'} className={stopped ? undefined : 'bg-white/10 text-white'}>
            {IMPACT_LABEL[r.impact]}
          </Badge>
          <SourceBadge source={r.source} />
        </div>
        <h1 className="mt-3 max-w-3xl text-2xl font-bold leading-tight tracking-tight sm:text-[28px]">{r.title}</h1>
        <div className="mt-6 flex flex-wrap items-end justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <PersonAvatar personId={r.reportedBy} size="md" />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{personName(r.reportedBy)}</p>
              <p className="text-xs text-on-ink-muted">
                {maps.person.get(r.reportedBy)?.title ?? 'Reporter'} · {fmtWhen(r.reportedAt, now)} · {fmtAgo(r.reportedAt, now)}
              </p>
            </div>
          </div>
          <TriageActions request={r} onTriage={setMode} />
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-4">
          <ReportCard request={r} />
          <TriageCard request={r} now={now} />
        </div>
        <div className="min-w-0 space-y-4">
          {asset && (r.status === 'new' || r.status === 'monitor') && <PrioritySuggestion request={r} asset={asset} />}
          <AssetCard request={r} now={now} />
        </div>
      </div>

      {mode && <TriageDialog request={r} mode={mode} onClose={() => setMode(null)} />}
    </>
  )
}

function TriageActions({ request: r, onTriage }: { request: MaintenanceRequest; onTriage: (mode: TriageMode) => void }) {
  const { maps } = useScoped()
  const { can } = useAuth()
  const create = useCreate()
  const asset = maps.asset.get(r.assetId)

  if (r.status === 'converted') {
    const workOrder = r.woId ? maps.workOrder.get(r.woId) : undefined
    if (!workOrder) return null
    return (
      <Button asChild variant="card">
        <Link to={paths.workOrder(workOrder.id)}>
          Open {workOrder.code}
          <ArrowRight />
        </Link>
      </Button>
    )
  }

  if (!can('request.triage')) {
    return <p className="text-xs text-on-ink-muted">Planners, supervisors and managers triage requests.</p>
  }

  const convert = () => {
    if (!asset) return
    create.workOrder({
      requestId: r.id,
      assetId: asset.id,
      title: r.title,
      description: r.description,
      ...conversionFor(r, asset.criticality),
    })
  }
  const undecided = r.status === 'new' || r.status === 'monitor'

  return (
    <div className="flex w-full flex-wrap gap-2 sm:w-auto">
      {undecided && (
        <Button variant="onInk" onClick={() => onTriage('reject')}>
          Reject
        </Button>
      )}
      {r.status === 'new' ? (
        <>
          <Button variant="onInk" onClick={() => onTriage('duplicate')}>
            Duplicate
          </Button>
          <Button variant="onInk" onClick={() => onTriage('monitor')}>
            Monitor
          </Button>
        </>
      ) : (
        <Button variant="onInk" onClick={() => onTriage('reopen')}>
          <RotateCcw />
          Reopen
        </Button>
      )}
      {undecided && (
        <Button className="w-full sm:w-auto" disabled={!asset} onClick={convert}>
          <Wrench />
          Convert to work order
        </Button>
      )}
    </div>
  )
}
