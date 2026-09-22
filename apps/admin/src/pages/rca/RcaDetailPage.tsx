import { fmtDate, fmtDateShort, nowIso, plural } from '@cmms/fixtures'
import type { Rca, RcaStatus } from '@cmms/types'
import { RCA_STATUS_FLOW, RCA_STATUS_LABEL, RCA_TRIGGER_LABEL } from '@cmms/types'
import { ActionMenu, type ActionMenuItem, Badge, Button, Card, ConfirmDialog, EmptyState, PageHeader, type StepState, Steps, cn, toast } from '@cmms/ui'
import { CircleCheck, Ellipsis, Microscope, Pencil, Play, RotateCcw, Trash2, Undo2 } from 'lucide-react'
import { type ReactNode, useCallback, useLayoutEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { useAuth } from '../../auth/auth'
import { BackButton } from '../../components/BackButton'
import { RcaStatusBadge } from '../../components/badges'
import { AssetLink, PersonChip } from '../../components/links'
import { useNow, useScoped } from '../../state/scoped'
import { CapaCard } from './CapaCard'
import { FishboneCard } from './FishboneCard'
import { LinkedFailuresCard } from './LinkedFailuresCard'
import { ProblemCard } from './ProblemCard'
import { RcaDialog } from './RcaDialog'
import { WhyChainCard } from './WhyChainCard'
import { type RcaUpdate, isPastDue } from './lib'

const LIST = '/reliability/rca'

type Move = Exclude<RcaStatus, 'open'>

/** The next step on the happy path and the button that takes it. */
const NEXT: Partial<Record<RcaStatus, { status: Move; label: string }>> = {
  open: { status: 'analysis', label: 'Start analysis' },
  analysis: { status: 'actions', label: 'Start actions' },
  actions: { status: 'closed', label: 'Close RCA' },
}

const MOVED: Record<Move, string> = {
  analysis: 'is in analysis',
  actions: 'is running its actions',
  closed: 'closed',
}

export function RcaDetailPage() {
  const { id = '' } = useParams()
  const { rcas } = useScoped()
  const rca = rcas.find((r) => r.id === id)
  if (!rca) {
    return (
      <Card>
        <EmptyState
          icon={<Microscope />}
          title="RCA not found"
          description="It may have been deleted, or it belongs to another site. Switch site from the workspace menu to open it."
          action={
            <Button asChild variant="outline">
              <Link to={LIST}>All RCAs</Link>
            </Button>
          }
        />
      </Card>
    )
  }
  return <RcaDetail rca={rca} />
}

/** Saves a change against the latest stored RCA, so undo callbacks never write stale copies. */
function useRcaUpdate(rca: Rca): RcaUpdate {
  const { dispatch } = useScoped()
  const latest = useRef(rca)
  useLayoutEffect(() => {
    latest.current = rca
  })
  return useCallback(
    (change) => {
      const next = change(latest.current)
      latest.current = next
      dispatch({ type: 'rca/upsert', item: next })
    },
    [dispatch],
  )
}

function RcaDetail({ rca }: { rca: Rca }) {
  const s = useScoped()
  const now = useNow(60_000)
  const navigate = useNavigate()
  const { can } = useAuth()
  const editable = can('rca.manage')
  const update = useRcaUpdate(rca)
  const [editing, setEditing] = useState(false)
  const [confirm, setConfirm] = useState<'close' | 'delete' | null>(null)

  const mode = rca.modeId ? s.maps.failureCode.get(rca.modeId)?.name : undefined
  const openActions = rca.actions.filter((a) => a.status === 'open').length
  const closed = rca.status === 'closed'
  const late = !closed && isPastDue(rca.dueAt, now)
  const next = NEXT[rca.status]
  const needsRootCause = rca.status === 'analysis' && !rca.rootCause.trim()

  const setStatus = (status: Move) => {
    update((r) => ({ ...r, status, closedAt: status === 'closed' ? nowIso() : null }))
    toast(`${rca.code} ${MOVED[status]}`, { tone: 'success' })
  }
  const close = () => (openActions ? setConfirm('close') : setStatus('closed'))
  const reopen = () => {
    update((r) => ({ ...r, status: r.rootCause.trim() ? 'actions' : 'analysis', closedAt: null }))
    toast(`${rca.code} reopened`, { tone: 'success' })
  }

  const index = RCA_STATUS_FLOW.indexOf(rca.status)
  const steps = RCA_STATUS_FLOW.map((status, i) => {
    const state: StepState = closed || i < index ? 'done' : i === index ? 'current' : 'upcoming'
    const hint = status === 'open' ? fmtDateShort(rca.createdAt) : status === 'closed' && rca.closedAt ? fmtDateShort(rca.closedAt) : undefined
    return { key: status, label: RCA_STATUS_LABEL[status], state, hint }
  })

  const menu: (ActionMenuItem | 'separator')[] = [
    { key: 'edit', label: 'Edit details', icon: <Pencil />, onSelect: () => setEditing(true) },
    ...(rca.status === 'open' || rca.status === 'analysis'
      ? [{ key: 'close', label: 'Close RCA', icon: <CircleCheck />, onSelect: close }]
      : []),
    ...(rca.status === 'actions'
      ? [{ key: 'back', label: 'Back to analysis', icon: <Undo2 />, onSelect: () => setStatus('analysis') }]
      : []),
    'separator',
    { key: 'delete', label: 'Delete RCA', icon: <Trash2 />, destructive: true, onSelect: () => setConfirm('delete') },
  ]

  return (
    <>
      <BackButton fallback={LIST} className="mb-3" />
      <PageHeader
        eyebrow={<span className="font-mono normal-case tracking-normal">{rca.code}</span>}
        title={
          <span className="inline-flex flex-wrap items-center gap-x-3 gap-y-1.5">
            {rca.title}
            <RcaStatusBadge status={rca.status} />
            {!editable && <Badge variant="muted">View only</Badge>}
          </span>
        }
        description={`${RCA_TRIGGER_LABEL[rca.trigger]} · opened ${fmtDate(rca.createdAt)}`}
        actions={
          editable ? (
            <>
              {closed ? (
                <Button variant="outline" onClick={reopen}>
                  <RotateCcw />
                  Reopen
                </Button>
              ) : (
                next && (
                  <Button
                    disabled={needsRootCause}
                    onClick={() => (next.status === 'closed' ? close() : setStatus(next.status))}
                  >
                    {next.status === 'closed' ? <CircleCheck /> : <Play />}
                    {next.label}
                  </Button>
                )
              )}
              <ActionMenu
                title={rca.code}
                trigger={
                  <Button variant="outline" size="icon" aria-label="More actions">
                    <Ellipsis />
                  </Button>
                }
                items={menu}
              />
            </>
          ) : undefined
        }
      />

      <div className="space-y-4">
        <Card className="p-5">
          <Steps steps={steps} />
          {editable && needsRootCause && <p className="mt-1 text-xs text-muted">Write the root cause at the end of the 5 Why chain to start the actions.</p>}
          <dl className="mt-4 grid grid-cols-1 gap-x-6 gap-y-4 border-t border-border pt-4 sm:grid-cols-2 xl:grid-cols-4">
            <Fact label="Asset">
              <AssetLink assetId={rca.assetId} showIcon />
            </Fact>
            <Fact label="Failure mode">{mode ?? <span className="text-muted">Not set</span>}</Fact>
            <Fact label="Owner">
              <PersonChip personId={rca.ownerId} />
            </Fact>
            <Fact label={closed ? 'Closed' : 'Due'}>
              {closed && rca.closedAt ? (
                fmtDate(rca.closedAt)
              ) : (
                <span className={cn('tabular-nums', late && 'font-semibold text-accent')}>
                  {fmtDate(rca.dueAt)}
                  {late && ' · late'}
                </span>
              )}
            </Fact>
          </dl>
        </Card>

        <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-2">
          <ProblemCard rca={rca} editable={editable} update={update} />
          <LinkedFailuresCard rca={rca} editable={editable} update={update} now={now} />
        </div>
        <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-2">
          <WhyChainCard rca={rca} editable={editable} update={update} />
          <CapaCard rca={rca} editable={editable} update={update} now={now} />
        </div>
        <FishboneCard rca={rca} editable={editable} update={update} />
      </div>

      <RcaDialog open={editing} onOpenChange={setEditing} editing={rca} onSaved={(saved) => toast(`${saved.code} updated`, { tone: 'success' })} />
      <ConfirmDialog
        open={confirm === 'close'}
        onOpenChange={(open) => {
          if (!open) setConfirm(null)
        }}
        title={`Close ${rca.code} with ${plural(openActions, 'open action')}?`}
        description="The open actions keep their owners and due dates. Reopen the RCA if the failure comes back."
        confirmLabel="Close RCA"
        onConfirm={() => {
          setStatus('closed')
          setConfirm(null)
        }}
      />
      <ConfirmDialog
        open={confirm === 'delete'}
        onOpenChange={(open) => {
          if (!open) setConfirm(null)
        }}
        title={`Delete ${rca.code}?`}
        description="The problem statement, 5 Why, fishbone and actions are removed. The linked work orders stay."
        confirmLabel="Delete RCA"
        destructive
        onConfirm={() => {
          s.dispatch({ type: 'rca/remove', id: rca.id })
          toast(`${rca.code} deleted`, { tone: 'success', description: rca.title })
          navigate(LIST, { replace: true })
        }}
      />
    </>
  )
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="mt-1 text-sm">{children}</dd>
    </div>
  )
}
