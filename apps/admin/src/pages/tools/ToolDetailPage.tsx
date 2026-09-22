import { calibrationState, fmtDate, toMs, toolBlockReason } from '@cmms/fixtures'
import type { Tool, ToolStatus } from '@cmms/types'
import { TOOL_STATUS_LABEL } from '@cmms/types'
import { ActionMenu, type ActionMenuItem, Banner, Button, Card, ConfirmDialog, EmptyState, PageHeader, toast } from '@cmms/ui'
import { CircleCheck, Construction, Ellipsis, FileCheck2, LogIn, LogOut, Pencil, SearchX, ShieldX, Trash2, Warehouse } from 'lucide-react'
import { type ReactNode, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { useAuth } from '../../auth/auth'
import { BackButton } from '../../components/BackButton'
import { ToolStatusBadge } from '../../components/badges'
import { useNow, useScoped } from '../../state/scoped'
import { RecordCalibrationDialog } from '../calibration/RecordCalibrationDialog'
import { toolUses } from './lib'
import { CheckinDialog, CheckoutDialog } from './MoveDialogs'
import { CalibrationPlanCard, CalibrationRecordsCard, CurrentUseCard, DetailsCard, UsesCard } from './ToolDetailCards'
import { ToolDialog } from './ToolDialog'

const LIST = '/inventory/tools'

export function ToolDetailPage() {
  const { id = '' } = useParams()
  const { maps, siteId } = useScoped()
  const tool = maps.tool.get(id)
  if (!tool) return <NotFound />
  if (tool.siteId !== siteId) return <OtherSite tool={tool} />
  return <ToolView key={tool.id} tool={tool} />
}

function NotFound() {
  return (
    <div className="space-y-4">
      <BackButton fallback={LIST} />
      <Card>
        <EmptyState
          icon={<SearchX />}
          title="Tool not found"
          description="It may have been deleted, or the link is out of date. Search the register for it."
          action={
            <Button asChild variant="outline">
              <Link to={LIST}>Open the tool register</Link>
            </Button>
          }
        />
      </Card>
    </div>
  )
}

function OtherSite({ tool }: { tool: Tool }) {
  const { state } = useScoped()
  const { sites, switchSite } = useAuth()
  const home = state.sites.find((s) => s.id === tool.siteId)
  const allowed = sites.some((s) => s.id === tool.siteId)
  return (
    <div className="space-y-4">
      <BackButton fallback={LIST} />
      <Card>
        <EmptyState
          icon={<Warehouse />}
          title={`${tool.code} belongs to ${home?.name ?? 'another site'}`}
          description={allowed ? 'Switch site to open it.' : 'Your account has no access to that site.'}
          action={
            allowed && home ? (
              <Button onClick={() => switchSite(home.id)}>Switch to {home.name}</Button>
            ) : (
              <Button asChild variant="outline">
                <Link to={LIST}>Open the tool register</Link>
              </Button>
            )
          }
        />
      </Card>
    </div>
  )
}

type DialogKind = 'checkout' | 'checkin' | 'calibrate' | 'edit' | 'delete'

type SettableStatus = Exclude<ToolStatus, 'in_use'>

/** What each status change means, for its menu item and confirmation. */
const STATUS_CHANGE: Record<SettableStatus, { label: string; icon: ReactNode; title: (code: string) => string; effect: string }> = {
  available: {
    label: 'Mark available',
    icon: <CircleCheck />,
    title: (code) => `Mark ${code} available?`,
    effect: 'goes back on the shelf and can be checked out again',
  },
  maintenance: {
    label: 'Send to repair',
    icon: <Construction />,
    title: (code) => `Send ${code} to repair?`,
    effect: 'stays off work orders until someone marks it available',
  },
  lost: {
    label: 'Mark missing',
    icon: <ShieldX />,
    title: (code) => `Mark ${code} as missing?`,
    effect: 'stays on the register, and nobody can check it out until it turns up',
  },
}

function ToolView({ tool }: { tool: Tool }) {
  const { workOrders, calibrations, dispatch } = useScoped()
  const { can } = useAuth()
  const navigate = useNavigate()
  const now = useNow(60_000)
  const [dialog, setDialog] = useState<DialogKind | null>(null)
  const [statusChange, setStatusChange] = useState<{ open: boolean; status: SettableStatus }>({ open: false, status: 'available' })

  const canManage = can('tool.manage')
  const plan = tool.calibration
  const canCalibrate = can('calibration.record') && plan !== null
  const blocked = toolBlockReason(tool, now)
  const expired = calibrationState(plan, now) === 'expired'
  const inUse = tool.status === 'in_use'

  const uses = useMemo(() => toolUses(tool, workOrders), [tool, workOrders])
  const records = useMemo(
    () => calibrations.filter((r) => r.target.kind === 'tool' && r.target.id === tool.id).sort((a, b) => toMs(b.date) - toMs(a.date)),
    [calibrations, tool.id],
  )

  const show = (kind: DialogKind) => () => setDialog(kind)
  const onDialogChange = (open: boolean) => {
    if (!open) setDialog(null)
  }
  const askStatus = (status: SettableStatus) => setStatusChange({ open: true, status })

  const menu: (ActionMenuItem | 'separator')[] = []
  if (canManage) {
    // Mark available is the header's main action for tools in repair or missing.
    for (const status of ['maintenance', 'lost'] as const) {
      if (status === tool.status) continue
      menu.push({
        key: status,
        label: STATUS_CHANGE[status].label,
        icon: STATUS_CHANGE[status].icon,
        disabled: inUse,
        description: inUse ? 'Check it in first' : undefined,
        onSelect: () => askStatus(status),
      })
    }
    menu.push('separator', {
      key: 'delete',
      label: 'Delete tool',
      icon: <Trash2 />,
      destructive: true,
      description: inUse ? 'Check it in first' : undefined,
      onSelect: show('delete'),
    })
  }

  const primary = !canManage ? null : inUse ? (
    <Button onClick={show('checkin')}>
      <LogIn />
      Check in
    </Button>
  ) : tool.status === 'available' ? (
    <Button onClick={show('checkout')} disabled={!!blocked}>
      <LogOut />
      Check out
    </Button>
  ) : (
    <Button onClick={() => askStatus('available')}>
      <CircleCheck />
      Mark available
    </Button>
  )

  const change = STATUS_CHANGE[statusChange.status]
  const remove = async () => {
    await navigate(LIST, { replace: true })
    dispatch({ type: 'tools/remove', id: tool.id })
    toast(`${tool.code} deleted`, { tone: 'success', description: tool.name })
  }

  return (
    <>
      <BackButton fallback={LIST} className="mb-3" />

      <PageHeader
        eyebrow={<span className="font-mono normal-case tracking-normal">{tool.code}</span>}
        title={
          <span className="inline-flex flex-wrap items-center gap-x-3 gap-y-1.5">
            {tool.name}
            <ToolStatusBadge status={tool.status} />
          </span>
        }
        description={`${tool.category} · ${tool.location || 'No location set'}`}
        actions={
          <>
            {primary}
            {canCalibrate && (
              <Button variant="outline" onClick={show('calibrate')}>
                <FileCheck2 />
                Record calibration
              </Button>
            )}
            {canManage && (
              <Button variant="outline" onClick={show('edit')}>
                <Pencil />
                Edit
              </Button>
            )}
            {menu.length > 0 && (
              <ActionMenu
                title={tool.code}
                items={menu}
                trigger={
                  <Button variant="outline" size="icon" aria-label="More actions">
                    <Ellipsis />
                  </Button>
                }
              />
            )}
          </>
        }
      />

      {expired && plan && (
        <Banner
          tone="warning"
          className="mb-4"
          title={`Calibration expired on ${fmtDate(plan.due)}`}
          action={
            canCalibrate ? (
              <Button size="sm" onClick={show('calibrate')}>
                Record calibration
              </Button>
            ) : undefined
          }
        >
          Work orders cannot use {tool.code} until it passes a new calibration.
        </Banner>
      )}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-4">
          <CurrentUseCard tool={tool} use={uses.find((u) => u.current)} blocked={blocked} />
          <UsesCard uses={uses} onCheckout={canManage && tool.status === 'available' && !blocked ? show('checkout') : undefined} />
          <CalibrationRecordsCard
            tool={tool}
            records={records}
            onRecord={canCalibrate ? show('calibrate') : undefined}
            onEdit={canManage ? show('edit') : undefined}
          />
        </div>
        <div className="grid min-w-0 grid-cols-1 content-start gap-4 md:grid-cols-2 xl:grid-cols-1">
          <DetailsCard tool={tool} />
          <CalibrationPlanCard tool={tool} now={now} onEdit={canManage ? show('edit') : undefined} />
        </div>
      </div>

      <CheckoutDialog tool={tool} open={dialog === 'checkout'} onOpenChange={onDialogChange} />
      <CheckinDialog tool={tool} open={dialog === 'checkin'} onOpenChange={onDialogChange} />
      <RecordCalibrationDialog
        target={plan ? { kind: 'tool', id: tool.id, code: tool.code, name: tool.name, plan } : null}
        open={dialog === 'calibrate'}
        onOpenChange={onDialogChange}
      />
      <ToolDialog open={dialog === 'edit'} onOpenChange={onDialogChange} editing={tool} />
      <ConfirmDialog
        open={dialog === 'delete'}
        onOpenChange={onDialogChange}
        title={inUse ? `${tool.code} is checked out` : `Delete ${tool.code}?`}
        description={
          inUse
            ? 'Check it in before you delete it, so the holder and the work order are cleared.'
            : 'It leaves the tool register together with its checkout and calibration history. You cannot undo this.'
        }
        confirmLabel="Delete tool"
        destructive
        confirmDisabled={inUse}
        onConfirm={remove}
      />
      <ConfirmDialog
        open={statusChange.open}
        onOpenChange={(openNow) => setStatusChange((s) => ({ ...s, open: openNow }))}
        title={change.title(tool.code)}
        description={`${tool.name} ${change.effect}.${statusChange.status === 'available' && expired ? ' Its calibration has expired, so work orders stay blocked until it passes a new one.' : ''}`}
        confirmLabel={change.label}
        destructive={statusChange.status === 'lost'}
        onConfirm={() => {
          dispatch({ type: 'tools/setStatus', id: tool.id, status: statusChange.status })
          toast(`${tool.code} is now ${TOOL_STATUS_LABEL[statusChange.status].toLowerCase()}`, { tone: 'success' })
        }}
      />
    </>
  )
}
