import { fmtDateTime, fmtDuration, fmtIdr, fmtWhen, slaState, woCost } from '@cmms/fixtures'
import type { WorkOrder } from '@cmms/types'
import { APPROVAL_LEVEL_LABEL, EXECUTION_LABEL } from '@cmms/types'
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  FormField,
  Input,
  KeyValue,
  toast,
} from '@cmms/ui'
import { ShieldAlert, ShieldCheck } from 'lucide-react'
import { type FormEvent, useState } from 'react'
import { Link } from 'react-router'
import { ApprovalBadge, CriticalityBadge } from '../../../components/badges'
import { AssetLink, PeopleStack, paths } from '../../../components/links'
import { useNow, useScoped } from '../../../state/scoped'
import type { WoAccess } from './useWoAccess'

const SLA_BADGE = {
  on_track: { variant: 'success', label: 'On track' },
  due_soon: { variant: 'warning', label: 'Due soon' },
  overdue: { variant: 'danger', label: 'Overdue' },
  met: { variant: 'success', label: 'Met' },
  missed: { variant: 'danger', label: 'Missed' },
} as const

export function DetailsCard({ wo }: { wo: WorkOrder }) {
  const { maps, personName, locationPath } = useScoped()
  const now = useNow()
  const asset = maps.asset.get(wo.assetId)
  const request = wo.requestId ? maps.request.get(wo.requestId) : undefined
  const pm = wo.pmScheduleId ? maps.pm.get(wo.pmScheduleId) : undefined
  const plan = wo.jobPlanId ? maps.jobPlan.get(wo.jobPlanId) : undefined
  const sla = SLA_BADGE[slaState(wo, now)]

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-[13px] font-bold uppercase tracking-[0.4px]">Details</CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <KeyValue
          bare
          labelWidth="md"
          items={[
            { label: 'Asset', value: <AssetLink assetId={wo.assetId} showIcon /> },
            { label: 'Location', value: asset ? locationPath(asset.locationId) : '' },
            { label: 'Criticality', value: asset ? <CriticalityBadge criticality={asset.criticality} long /> : null },
            { label: 'Team', value: maps.team.get(wo.teamId)?.name ?? 'Not set' },
            {
              label: 'Assigned',
              value: wo.assigneeIds.length ? (
                <span className="flex flex-wrap items-center gap-2">
                  <PeopleStack personIds={wo.assigneeIds} size="xs" />
                  <span className="text-sm">{wo.assigneeIds.map((id) => personName(id)).join(', ')}</span>
                </span>
              ) : (
                <span className="text-muted">Unassigned</span>
              ),
            },
            { label: 'Requested', value: `${personName(wo.requestedBy)} · ${fmtDateTime(wo.requestedAt)}` },
            {
              label: 'Request',
              hidden: !request,
              value: request && (
                <Link to={paths.request(request.id)} className="font-mono text-xs hover:text-accent">
                  {request.code}
                </Link>
              ),
            },
            {
              label: 'PM schedule',
              hidden: !pm,
              value: pm && (
                <Link to={paths.pm(pm.id)} className="hover:text-accent">
                  <span className="font-mono text-xs">{pm.code}</span> {pm.name}
                </Link>
              ),
            },
            {
              label: 'Job plan',
              hidden: !plan,
              value: plan && (
                <Link to={paths.jobPlan(plan.id)} className="hover:text-accent">
                  <span className="font-mono text-xs">{plan.code}</span> {plan.name}
                </Link>
              ),
            },
            { label: 'Scheduled', value: wo.scheduledAt ? fmtWhen(wo.scheduledAt, now) : <span className="text-muted">Not scheduled</span> },
            {
              label: 'Due',
              value: (
                <span className="flex flex-wrap items-center gap-2">
                  {fmtDateTime(wo.dueAt)}
                  <Badge variant={sla.variant}>{sla.label}</Badge>
                </span>
              ),
            },
            { label: 'Estimate', value: fmtDuration(wo.estimatedMin) },
            {
              label: 'Execution',
              value: `${EXECUTION_LABEL[wo.execution]}${wo.vendorId ? ` · ${maps.vendor.get(wo.vendorId)?.name}` : ''}`,
            },
            { label: 'Production', value: wo.downtime ? <Badge variant="accent">Stopped</Badge> : 'Running' },
          ]}
        />
      </CardContent>
    </Card>
  )
}

export function CostCard({ wo, access }: { wo: WorkOrder; access: WoAccess }) {
  const { maps, dispatch } = useScoped()
  const now = useNow(30_000)
  const [editing, setEditing] = useState(false)
  const cost = woCost(wo, maps.person, now)
  const reserved = wo.parts.filter((l) => l.status === 'reserved').reduce((s, l) => s + l.qty * l.unitCost, 0)
  const rows = [
    ['Labor', cost.labor],
    ['Spare parts', cost.parts],
    ['Vendor', cost.vendor],
    ['Other', cost.misc],
  ] as const

  return (
    <Card>
      <CardHeader
        action={
          access.edit && (
            <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>
              Edit
            </Button>
          )
        }
      >
        <CardTitle className="text-[13px] font-bold uppercase tracking-[0.4px]">Cost</CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <dl className="space-y-2 text-sm">
          {rows.map(([label, value]) => (
            <div key={label} className="flex items-center justify-between gap-3">
              <dt className="text-muted">{label}</dt>
              <dd className="font-medium tabular-nums">{fmtIdr(value)}</dd>
            </div>
          ))}
          <div className="flex items-center justify-between gap-3 border-t border-border pt-2">
            <dt className="font-semibold">Total</dt>
            <dd className="text-base font-bold tabular-nums">{fmtIdr(cost.total)}</dd>
          </div>
          {reserved > 0 && <p className="text-xs text-muted">Plus {fmtIdr(reserved)} in reserved parts not yet issued.</p>}
        </dl>
      </CardContent>
      {editing && (
        <CostDialog
          vendorCost={wo.vendorCost}
          miscCost={wo.miscCost}
          onClose={() => setEditing(false)}
          onSave={(vendorCost, miscCost) => {
            dispatch({ type: 'workOrders/update', id: wo.id, patch: { vendorCost, miscCost } })
            toast('Costs updated', { tone: 'success' })
          }}
        />
      )}
    </Card>
  )
}

function CostDialog({ vendorCost, miscCost, onClose, onSave }: { vendorCost: number; miscCost: number; onClose: () => void; onSave: (v: number, m: number) => void }) {
  const [vendor, setVendor] = useState(vendorCost)
  const [misc, setMisc] = useState(miscCost)
  const submit = (e: FormEvent) => {
    e.preventDefault()
    onSave(vendor, misc)
    onClose()
  }
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent size="sm">
        <form onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>Edit costs</DialogTitle>
            <DialogDescription>Labor and parts come from the job itself. Enter vendor invoices and other costs here.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 gap-4">
            <FormField label="Vendor cost (Rp)" htmlFor="cost-vendor">
              <Input id="cost-vendor" type="number" min={0} step={50_000} value={vendor} onChange={(e) => setVendor(Math.max(0, Number(e.target.value) || 0))} />
            </FormField>
            <FormField label="Other cost (Rp)" htmlFor="cost-misc" hint="Consumables, transport, rentals.">
              <Input id="cost-misc" type="number" min={0} step={10_000} value={misc} onChange={(e) => setMisc(Math.max(0, Number(e.target.value) || 0))} />
            </FormField>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit">Save costs</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function SafetyCard({ wo, onConfirm }: { wo: WorkOrder; onConfirm?: () => void }) {
  const { maps, personName } = useScoped()
  const { safety } = wo
  const ppe = safety.ppeIds.map((id) => maps.safetyItem.get(id)?.name).filter(Boolean)
  const hazards = safety.hazardIds.map((id) => maps.safetyItem.get(id)?.name).filter(Boolean)
  const confirmed = !!safety.confirmedAt

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-[13px] font-bold uppercase tracking-[0.4px]">Safety</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 pt-0 text-sm">
        <div className="flex flex-wrap gap-1.5">
          {safety.loto && <Badge variant="ink">LOTO required</Badge>}
          {hazards.map((h) => (
            <Badge key={h} variant="warning">
              {h}
            </Badge>
          ))}
          {!safety.loto && !hazards.length && <span className="text-muted">No special hazards listed</span>}
        </div>
        {ppe.length > 0 && (
          <p>
            <span className="text-muted">PPE: </span>
            {ppe.join(', ')}
          </p>
        )}
        {safety.notes && <p className="text-muted">{safety.notes}</p>}
        <div className={confirmed ? 'flex items-center gap-2 rounded-2xl bg-success-soft px-3 py-2 text-success' : 'flex items-center gap-2 rounded-2xl bg-surface px-3 py-2 text-body'}>
          {confirmed ? <ShieldCheck className="size-4 shrink-0" /> : <ShieldAlert className="size-4 shrink-0" />}
          <span className="min-w-0 flex-1 text-xs font-medium">
            {confirmed ? `Confirmed by ${personName(safety.confirmedBy)} · ${fmtWhen(safety.confirmedAt!)}` : 'Not confirmed yet. The technician confirms before starting.'}
          </span>
          {!confirmed && onConfirm && (safety.loto || ppe.length > 0) && (
            <Button size="sm" variant="outline" onClick={onConfirm}>
              Confirm
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

export function ApprovalCard({ wo }: { wo: WorkOrder }) {
  const { personName } = useScoped()
  if (!wo.approval && !wo.verification && !wo.completionNote && !wo.signature) return null
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-[13px] font-bold uppercase tracking-[0.4px]">Sign-off</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 pt-0 text-sm">
        {wo.approval && (
          <div className="rounded-2xl bg-surface-2 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-semibold">{APPROVAL_LEVEL_LABEL[wo.approval.level]}</p>
              <ApprovalBadge status={wo.approval.status} />
            </div>
            <p className="mt-1 text-xs text-muted">{wo.approval.reason}</p>
            {wo.approval.decidedBy && (
              <p className="mt-1 text-xs">
                {personName(wo.approval.decidedBy)} · {fmtWhen(wo.approval.decidedAt!)}
                {wo.approval.note && <span className="text-muted"> · {wo.approval.note}</span>}
              </p>
            )}
          </div>
        )}
        {wo.completionNote && (
          <div className="rounded-2xl bg-surface-2 p-3">
            <p className="font-semibold">Completion note</p>
            <p className="mt-1 text-muted">{wo.completionNote}</p>
          </div>
        )}
        {wo.signature && <img src={wo.signature} alt="Technician signature" className="h-20 w-full rounded-2xl bg-surface object-contain" />}
        {wo.verification && (
          <div className="rounded-2xl bg-success-soft p-3 text-success">
            <p className="font-semibold">Verified by {personName(wo.verification.by)}</p>
            <p className="mt-0.5 text-xs">{fmtWhen(wo.verification.at)}</p>
            {wo.verification.note && <p className="mt-1 text-xs text-body">{wo.verification.note}</p>}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
