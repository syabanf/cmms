import { calibrationDaysLeft, calibrationState, fmtDate, fmtDateTime, plural, toMs } from '@cmms/fixtures'
import type { CalibrationRecord, Tool } from '@cmms/types'
import { CALIBRATION_RESULT_LABEL, TOOL_CONDITION_LABEL } from '@cmms/types'
import {
  Avatar,
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  type Column,
  DataTable,
  EmptyState,
  IconTile,
  KeyValue,
  cn,
} from '@cmms/ui'
import { ClipboardList, FileCheck2, Gauge, MapPin, Wrench } from 'lucide-react'
import { Link } from 'react-router'
import { CalibrationBadge } from '../../components/badges'
import { AssetLink, WoLink, paths } from '../../components/links'
import { useScoped } from '../../state/scoped'
import { daysLeftText } from '../calibration/lib'
import type { ToolUse } from './lib'

const STATUS_NOTE = {
  maintenance: 'In repair. Work orders cannot use it until someone marks it available.',
  lost: 'Marked missing. Nobody can check it out until it turns up.',
} as const

/** Who holds the tool and for which job, or where it waits. `blocked` is the reason it cannot go out. */
export function CurrentUseCard({ tool, use, blocked }: { tool: Tool; use: ToolUse | undefined; blocked: string | null }) {
  const { maps } = useScoped()
  const holder = tool.holderId ? maps.person.get(tool.holderId) : undefined
  const wo = tool.woId ? maps.workOrder.get(tool.woId) : undefined

  if (tool.status !== 'in_use') {
    const note = tool.status === 'available' ? (blocked ? `Blocked: ${blocked.toLowerCase()}.` : 'Ready to check out.') : STATUS_NOTE[tool.status]
    return (
      <Card>
        <CardHeader>
          <CardTitle>Current use</CardTitle>
        </CardHeader>
        <CardContent className="flex items-start gap-3">
          <IconTile tone={tool.status === 'available' ? 'default' : tool.status === 'lost' ? 'danger' : 'warning'}>
            <MapPin />
          </IconTile>
          <div className="min-w-0">
            <p className="font-semibold">{tool.location || 'No location set'}</p>
            <p className="text-sm text-muted">{note}</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Current use</CardTitle>
        <CardDescription>{use?.from ? `Out since ${fmtDateTime(use.from)}` : 'Checked out'}</CardDescription>
      </CardHeader>
      <CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="flex items-center gap-3 rounded-2xl bg-surface-2 p-3">
          {holder ? (
            <Avatar name={holder.name} color={holder.color} size="md" />
          ) : (
            <IconTile>
              <Wrench />
            </IconTile>
          )}
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{holder?.name ?? 'Unknown holder'}</p>
            <p className="truncate text-xs text-muted">{holder ? [holder.title, holder.phone].filter(Boolean).join(' · ') : 'Check it in to clear the record'}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-2xl bg-surface-2 p-3">
          <IconTile>
            <ClipboardList />
          </IconTile>
          <div className="min-w-0">
            {wo ? (
              <>
                <WoLink woId={wo.id} />
                <p className="truncate text-sm font-semibold">{wo.title}</p>
                <AssetLink assetId={wo.assetId} className="text-xs text-muted" />
              </>
            ) : (
              <>
                <p className="text-sm font-semibold">No work order</p>
                <p className="text-xs text-muted">Checked out for general use</p>
              </>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export function UsesCard({ uses, onCheckout }: { uses: ToolUse[]; onCheckout?: () => void }) {
  const columns: Column<ToolUse>[] = [
    {
      id: 'wo',
      header: 'Work order',
      cell: (u) => (
        <div className="min-w-0 max-w-[18rem]">
          <WoLink woId={u.wo.id} />
          <p className="truncate text-sm">{u.wo.title}</p>
          <p className="mt-1 text-[11px] text-muted sm:hidden">
            {u.from ? fmtDateTime(u.from) : 'Start not recorded'}
            {u.current ? ', still out' : u.to ? ` to ${fmtDateTime(u.to)}` : ''}
          </p>
        </div>
      ),
    },
    { id: 'asset', header: 'Asset', cell: (u) => <AssetLink assetId={u.wo.assetId} />, hideBelow: 'md' },
    {
      id: 'from',
      header: 'Out',
      cell: (u) => <span className={cn('whitespace-nowrap tabular-nums', !u.from && 'text-muted')}>{u.from ? fmtDateTime(u.from) : 'Not recorded'}</span>,
      sortValue: (u) => u.from,
      hideBelow: 'sm',
    },
    {
      id: 'to',
      header: 'Back',
      cell: (u) =>
        u.current ? (
          <Badge variant="info" dot>
            Still out
          </Badge>
        ) : (
          <span className={cn('whitespace-nowrap tabular-nums', !u.to && 'text-muted')}>{u.to ? fmtDateTime(u.to) : 'Not recorded'}</span>
        ),
      hideBelow: 'sm',
    },
  ]

  return (
    <Card>
      <CardHeader>
        <CardTitle>Checkout history</CardTitle>
        <CardDescription>Work orders that took this tool, newest first.</CardDescription>
      </CardHeader>
      <DataTable
        columns={columns}
        rows={uses}
        getRowKey={(u) => `${u.wo.id}-${u.from ?? 'start'}`}
        pageSize={8}
        empty={
          <EmptyState
            compact
            icon={<ClipboardList />}
            title="No work order has used it yet"
            description="Checkouts linked to a work order show here with their out and back times."
            action={
              onCheckout ? (
                <Button variant="outline" size="sm" onClick={onCheckout}>
                  Check out
                </Button>
              ) : undefined
            }
          />
        }
      />
    </Card>
  )
}

export function CalibrationRecordsCard({
  tool,
  records,
  onRecord,
  onEdit,
}: {
  tool: Tool
  records: CalibrationRecord[]
  onRecord?: () => void
  onEdit?: () => void
}) {
  const columns: Column<CalibrationRecord>[] = [
    {
      id: 'date',
      header: 'Date',
      cell: (r) => (
        <div>
          <p className="whitespace-nowrap tabular-nums">{fmtDate(r.date)}</p>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5 sm:hidden">
            <Badge variant={r.result === 'fail' ? 'danger' : 'success'}>{CALIBRATION_RESULT_LABEL[r.result]}</Badge>
            <span className="font-mono text-[11px] text-muted">{r.certificateNo}</span>
          </div>
        </div>
      ),
      sortValue: (r) => toMs(r.date),
    },
    {
      id: 'result',
      header: 'Result',
      cell: (r) => <Badge variant={r.result === 'fail' ? 'danger' : 'success'}>{CALIBRATION_RESULT_LABEL[r.result]}</Badge>,
      hideBelow: 'sm',
    },
    { id: 'certificate', header: 'Certificate', cell: (r) => <span className="font-mono text-xs">{r.certificateNo}</span>, hideBelow: 'sm' },
    { id: 'by', header: 'Performed by', cell: (r) => <span className="block max-w-[12rem] truncate">{r.performedBy}</span>, hideBelow: 'md' },
    { id: 'next', header: 'Next due', cell: (r) => <span className="whitespace-nowrap tabular-nums">{fmtDate(r.nextDue)}</span>, hideBelow: 'md' },
    { id: 'notes', header: 'Notes', cell: (r) => <span className="block max-w-[16rem] truncate text-muted">{r.notes || 'None'}</span>, className: 'hidden 2xl:table-cell', headerClassName: 'hidden 2xl:table-cell' },
  ]

  return (
    <Card>
      <CardHeader>
        <CardTitle>Calibration records</CardTitle>
        <CardDescription>Certificates on file, newest first.</CardDescription>
      </CardHeader>
      <DataTable
        columns={columns}
        rows={records}
        getRowKey={(r) => r.id}
        initialSort={{ id: 'date', desc: true }}
        pageSize={8}
        empty={
          tool.calibration ? (
            <EmptyState
              compact
              icon={<FileCheck2 />}
              title="No certificate on file"
              description="Record the first calibration to start the history."
              action={
                onRecord ? (
                  <Button variant="outline" size="sm" onClick={onRecord}>
                    Record calibration
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <EmptyState
              compact
              icon={<Gauge />}
              title="No calibration plan"
              description="Give the tool a calibration interval if it measures anything."
              action={
                onEdit ? (
                  <Button variant="outline" size="sm" onClick={onEdit}>
                    Add a plan
                  </Button>
                ) : undefined
              }
            />
          )
        }
      />
    </Card>
  )
}

export function DetailsCard({ tool }: { tool: Tool }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Details</CardTitle>
      </CardHeader>
      <CardContent>
        <KeyValue
          bare
          labelWidth="md"
          items={[
            { label: 'Code', value: <span className="font-mono text-xs">{tool.code}</span> },
            { label: 'Category', value: tool.category },
            { label: 'Location', value: tool.location || <span className="text-muted">Not set</span> },
            { label: 'Serial number', value: tool.serialNumber ? <span className="font-mono text-xs">{tool.serialNumber}</span> : <span className="text-muted">Not set</span> },
            { label: 'Condition', value: TOOL_CONDITION_LABEL[tool.condition] },
          ]}
        />
      </CardContent>
    </Card>
  )
}

export function CalibrationPlanCard({ tool, now, onEdit }: { tool: Tool; now: number; onEdit?: () => void }) {
  const { maps } = useScoped()
  const plan = tool.calibration
  const vendor = plan?.vendorId ? maps.vendor.get(plan.vendorId) : undefined
  const days = plan ? calibrationDaysLeft(plan, now) : 0

  return (
    <Card>
      <CardHeader>
        <CardTitle>Calibration</CardTitle>
      </CardHeader>
      <CardContent>
        {plan ? (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <CalibrationBadge state={calibrationState(plan, now)} />
              <span className={cn('text-xs', days < 0 ? 'font-semibold text-accent' : 'text-muted')}>{daysLeftText(days)}</span>
            </div>
            <KeyValue
              bare
              className="mt-2"
              items={[
                { label: 'Next due', value: fmtDate(plan.due) },
                { label: 'Interval', value: `Every ${plural(plan.intervalMonths, 'month')}` },
                { label: 'Last done', value: plan.lastAt ? fmtDate(plan.lastAt) : <span className="text-muted">Never</span> },
                {
                  label: 'Vendor',
                  value: vendor ? (
                    <Link to={paths.vendor(vendor.id)} className="hover:text-accent">
                      {vendor.name}
                    </Link>
                  ) : (
                    <span className="text-muted">In house</span>
                  ),
                },
              ]}
            />
          </>
        ) : (
          <div>
            <p className="text-sm text-muted">No calibration plan. Work orders can use it without a certificate.</p>
            {onEdit && (
              <Button variant="outline" size="sm" className="mt-3" onClick={onEdit}>
                Add a plan
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
