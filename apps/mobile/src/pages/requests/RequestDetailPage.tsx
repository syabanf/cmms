import { fmtWhen, isActive } from '@cmms/fixtures'
import type { MaintenanceRequest } from '@cmms/types'
import { IMPACT_LABEL, REQUEST_SOURCE_LABEL } from '@cmms/types'
import { Badge, Card, CardContent, CardDescription, CardHeader, CardTitle, KeyValue, cn } from '@cmms/ui'
import { Check, ChevronRight, MessageSquareWarning, X } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link, useParams } from 'react-router'
import { RequestStatusBadge, SeverityBadge, woStatusLabel } from '../../components/badges'
import { PhotoGrid } from '../../components/PhotoGrid'
import { DetailHeader } from '../../layouts/DetailHeader'
import { paths } from '../../lib/paths'
import { useMobileScope, useNow } from '../../state/scope'
import { NotFound } from '../NotFoundPage'

export function RequestDetailPage() {
  const { id = '' } = useParams()
  const { maps, site } = useMobileScope()
  const request = maps.request.get(id)
  if (!request || request.siteId !== site.id) {
    return (
      <NotFound
        title="Request"
        heading="Request not found"
        description={`It does not exist at ${site.name}, or the link is out of date.`}
        back={paths.requests}
        backLabel="Back to requests"
      />
    )
  }
  return <RequestView request={request} />
}

function RequestView({ request }: { request: MaintenanceRequest }) {
  const { maps, personName, locationPath } = useMobileScope()
  const now = useNow()
  const asset = maps.asset.get(request.assetId)
  const photos = request.attachments.filter((a) => a.kind === 'photo')

  return (
    <div className="space-y-4">
      <DetailHeader title={request.code} mono subtitle={asset ? `${asset.name} · ${asset.code}` : undefined} fallback={paths.requests} />

      <Card variant="ink" className="p-6">
        <div className="flex items-start justify-between gap-3">
          <span className="flex size-12 items-center justify-center rounded-2xl bg-white/10 [&_svg]:size-5">
            <MessageSquareWarning aria-hidden="true" />
          </span>
          <RequestStatusBadge status={request.status} />
        </div>
        <h2 className="mt-5 text-xl font-bold leading-snug">{request.title}</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          <SeverityBadge severity={request.severity} />
          <Badge className="bg-white/10 text-white">{IMPACT_LABEL[request.impact]}</Badge>
        </div>
        <p className="mt-4 text-sm text-on-ink-muted">
          Reported by {personName(request.reportedBy)} · {fmtWhen(request.reportedAt, now)}
        </p>
      </Card>

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
          { label: 'Source', value: `${REQUEST_SOURCE_LABEL[request.source]} report` },
        ]}
      />

      <Card>
        <CardHeader>
          <CardTitle>What was reported</CardTitle>
          <CardDescription>In the reporter's own words.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="whitespace-pre-line text-sm text-body">{request.description || 'No details added.'}</p>
          {photos.length > 0 && <PhotoGrid photos={photos} />}
        </CardContent>
      </Card>

      <StatusTrail request={request} now={now} />
    </div>
  )
}

type StepState = 'done' | 'current' | 'closed'

interface Step {
  title: string
  detail?: ReactNode
  state: StepState
  to?: string
}

function StatusTrail({ request, now }: { request: MaintenanceRequest; now: number }) {
  const { maps, personName } = useMobileScope()
  const wo = request.woId ? maps.workOrder.get(request.woId) : undefined
  const original = request.duplicateOfId ? maps.request.get(request.duplicateOfId) : undefined
  const triaged = [request.triagedBy ? personName(request.triagedBy) : null, request.triagedAt ? fmtWhen(request.triagedAt, now) : null]
    .filter(Boolean)
    .join(' · ')

  const steps: Step[] = [{ title: 'Reported', detail: `${personName(request.reportedBy)} · ${fmtWhen(request.reportedAt, now)}`, state: 'done' }]
  if (request.status === 'new') {
    steps.push({ title: 'Waiting for triage', detail: 'A supervisor reviews new reports and decides the next step.', state: 'current' })
  } else {
    steps.push({ title: 'Triaged', detail: triaged, state: 'done' })
    switch (request.status) {
      case 'converted':
        steps.push({
          title: wo ? `Converted to ${wo.code}` : 'Converted to a work order',
          detail: wo ? `${woStatusLabel(wo.status, wo.waitingReason)} · ${wo.assigneeIds.map(personName).join(', ') || 'Not assigned yet'}` : undefined,
          state: wo && !isActive(wo) ? 'done' : 'current',
          to: wo ? paths.workOrder(wo.id) : undefined,
        })
        if (wo?.completedAt) steps.push({ title: 'Work completed', detail: fmtWhen(wo.completedAt, now), state: 'done' })
        break
      case 'monitor':
        steps.push({ title: 'Monitoring', detail: request.triageNote || 'The team checks it again at the next inspection.', state: 'current' })
        break
      case 'rejected':
        steps.push({ title: 'Rejected', detail: request.triageNote || 'Closed without a work order.', state: 'closed' })
        break
      case 'duplicate':
        steps.push({
          title: original ? `Duplicate of ${original.code}` : 'Marked as duplicate',
          detail: request.triageNote || undefined,
          state: 'closed',
          to: original ? paths.request(original.id) : undefined,
        })
        break
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Status</CardTitle>
      </CardHeader>
      <CardContent>
        <ol>
          {steps.map((step, i) => (
            <li key={step.title} className="relative flex gap-3 pb-5 last:pb-0">
              {i < steps.length - 1 && <span aria-hidden="true" className="absolute bottom-0 left-[13px] top-7 w-0.5 bg-border" />}
              <StepDot state={step.state} />
              <div className="min-w-0 flex-1 pt-0.5">
                {step.to ? (
                  <Link to={step.to} className="-my-2 flex min-h-11 items-center gap-1 py-2 text-sm font-semibold text-accent">
                    {step.title}
                    <ChevronRight aria-hidden="true" className="size-4" />
                  </Link>
                ) : (
                  <p className="text-sm font-semibold">{step.title}</p>
                )}
                {step.detail && <p className="mt-0.5 text-sm text-muted">{step.detail}</p>}
              </div>
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  )
}

function StepDot({ state }: { state: StepState }) {
  return (
    <span
      className={cn(
        'relative flex size-7 shrink-0 items-center justify-center rounded-full [&_svg]:size-4',
        state === 'done' && 'bg-success text-white',
        state === 'current' && 'bg-accent-soft text-accent',
        state === 'closed' && 'bg-surface text-muted',
      )}
    >
      {state === 'done' && <Check aria-hidden="true" strokeWidth={3} />}
      {state === 'current' && <span className="size-2.5 rounded-full bg-accent" />}
      {state === 'closed' && <X aria-hidden="true" strokeWidth={3} />}
    </span>
  )
}
