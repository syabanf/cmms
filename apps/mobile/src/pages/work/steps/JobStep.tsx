import { fmtWhen, isClockedIn } from '@cmms/fixtures'
import type { MaintenanceRequest, WorkOrder } from '@cmms/types'
import { WAITING_REASON_LABEL } from '@cmms/types'
import { Banner, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, toast } from '@cmms/ui'
import { Play, Timer } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { PhotoGrid } from '../../../components/PhotoGrid'
import { paths } from '../../../lib/paths'
import { safetyPending } from '../../../lib/work'
import { useMobileScope, useNow } from '../../../state/scope'
import { DetailsCard } from '../DetailsCard'
import { type StepProps, autoStep } from '../flow'
import { PartsCard } from '../PartsCard'
import { ContinueButton, StepActions } from '../StepActions'
import { ToolsCard } from '../ToolsCard'
import { WoHero } from '../WoHero'

/** What, where and why: the brief a technician reads before walking to the machine. */
export function JobStep({ wo, nav, access, onResume }: StepProps & { onResume: () => void }) {
  const { user, maps, dispatch } = useMobileScope()
  const now = useNow()
  const request = wo.requestId ? maps.request.get(wo.requestId) : undefined

  // Safety first when the job asks for it: the safety step confirms and starts in one go.
  const start = () => {
    if (safetyPending(wo)) {
      nav.go('safety')
      return
    }
    dispatch({ type: 'workOrders/start', id: wo.id })
    toast('Work started', { tone: 'success', description: 'Your clock is running.' })
    nav.go('checklist')
  }

  const clockIn = () => {
    dispatch({ type: 'workOrders/clock', id: wo.id, personId: user.id, running: true })
    toast('Clocked in', { tone: 'success', description: 'Your time now counts on this work order.' })
    nav.go(autoStep(wo))
  }

  let primary: ReactNode = <ContinueButton onClick={nav.next} />
  let note: string | null = null
  if (access.assigned && (wo.status === 'open' || wo.status === 'assigned')) {
    primary = (
      <Button size="lg" className="flex-1" onClick={start}>
        <Play />
        Start work
      </Button>
    )
  } else if (access.working && !isClockedIn(wo, user.id)) {
    primary = (
      <Button size="lg" className="flex-1" onClick={clockIn}>
        <Timer />
        Clock in
      </Button>
    )
  } else if (wo.status === 'draft') {
    note = 'Work can start once the supervisor approves it.'
  } else if (!nav.next) {
    note = 'The next steps open once the assigned technician starts the work.'
  }

  return (
    <>
      <WoHero wo={wo} now={now} />
      {wo.status === 'waiting' && <WaitingBanner wo={wo} now={now} onResume={access.assigned ? onResume : undefined} />}
      {request && <ReportCard request={request} now={now} />}
      {wo.description && (
        <Card>
          <CardHeader>
            <CardTitle>Planner notes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-line text-sm text-body">{wo.description}</p>
          </CardContent>
        </Card>
      )}
      <DetailsCard wo={wo} />
      <PartsCard wo={wo} editable={false} />
      <ToolsCard wo={wo} editable={false} />
      <StepActions onBack={null} note={note}>
        {primary}
      </StepActions>
    </>
  )
}

function WaitingBanner({ wo, now, onResume }: { wo: WorkOrder; now: number; onResume?: () => void }) {
  const label = wo.waitingReason ? WAITING_REASON_LABEL[wo.waitingReason] : 'Something'
  // The reducer logs "Waiting: <reason>. <note>", so the note follows the reason.
  const prefix = `Waiting: ${label}. `
  const paused = [...wo.events].reverse().find((e) => e.kind === 'status' && e.text.startsWith('Waiting'))
  const reasonNote = paused?.text.startsWith(prefix) ? paused.text.slice(prefix.length) : ''
  return (
    <Banner
      tone="warning"
      title={`Paused: waiting for ${label.toLowerCase()}`}
      action={
        onResume && (
          <Button className="h-11" onClick={onResume}>
            <Play />
            Resume work
          </Button>
        )
      }
    >
      {[paused ? `Since ${fmtWhen(paused.at, now)}` : null, reasonNote].filter(Boolean).join('. ')}
    </Banner>
  )
}

function ReportCard({ request, now }: { request: MaintenanceRequest; now: number }) {
  const { personName } = useMobileScope()
  const photos = request.attachments.filter((a) => a.kind === 'photo')
  return (
    <Card>
      <CardHeader
        action={
          <Link to={paths.request(request.id)} className="inline-flex min-h-11 items-center font-mono text-xs font-semibold text-accent">
            {request.code}
          </Link>
        }
      >
        <CardTitle>Reported problem</CardTitle>
        <CardDescription>
          {personName(request.reportedBy)} · {fmtWhen(request.reportedAt, now)}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-[15px] font-semibold leading-snug">{request.title}</p>
        {request.description && <p className="whitespace-pre-line text-sm text-body">{request.description}</p>}
        {photos.length > 0 && <PhotoGrid photos={photos} />}
      </CardContent>
    </Card>
  )
}
