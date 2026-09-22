import { MINUTE, fmtDate, fmtDuration, fmtIdr, fmtIdrShort, fmtNumber, fmtPercent, plural, toMs } from '@cmms/fixtures'
import type { Vendor, WorkOrder } from '@cmms/types'
import {
  Badge,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  type Column,
  DataTable,
  EmptyState,
  KeyValue,
  ProgressBar,
  cn,
} from '@cmms/ui'
import { ClipboardList, Package } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link, useNavigate } from 'react-router'
import { WoStatusBadge } from '../../components/badges'
import { WoLink, paths } from '../../components/links'
import { useScoped } from '../../state/scoped'
import { PartStockBadge } from '../parts/badges'
import { partRow } from '../parts/lib'
import { ContractBadge } from './badges'
import { type VendorStats, contractDaysLeft, contractState, isLate, telHref } from './lib'

// ─── Main column ────────────────────────────────────────────────

function Readout({ label, value, hint }: { label: string; value: ReactNode; hint: ReactNode }) {
  return (
    <div className="rounded-2xl bg-surface-2 p-4">
      <p className="text-xs font-medium text-muted">{label}</p>
      <p className="mt-1 truncate text-2xl font-bold tracking-tight tabular-nums">{value}</p>
      <p className="mt-0.5 truncate text-xs text-muted">{hint}</p>
    </div>
  )
}

export function PerformanceCard({ stats }: { stats: VendorStats }) {
  const { site } = useScoped()
  return (
    <Card>
      <CardHeader>
        <CardTitle>Performance</CardTitle>
        <CardDescription>Work at {site.name} requested in the last 12 months.</CardDescription>
      </CardHeader>
      <CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Readout label="Work orders" value={fmtNumber(stats.jobs)} hint={stats.late ? `${fmtNumber(stats.late)} late` : 'None late'} />
        <Readout
          label="On time"
          value={stats.completed ? fmtPercent(stats.onTime / stats.completed) : '-'}
          hint={stats.completed ? `${fmtNumber(stats.onTime)} of ${plural(stats.completed, 'completed job')}` : 'No completed jobs yet'}
        />
        <Readout label="Spend" value={fmtIdrShort(stats.spend)} hint="Vendor cost on these jobs" />
      </CardContent>
    </Card>
  )
}

export function VendorJobsCard({ jobs, now }: { jobs: WorkOrder[]; now: number }) {
  const { maps, site } = useScoped()
  const navigate = useNavigate()
  const lateCount = jobs.filter((w) => isLate(w, now)).length

  const columns: Column<WorkOrder>[] = [
    {
      id: 'wo',
      header: 'Work order',
      cell: (w) => {
        const asset = maps.asset.get(w.assetId)
        const late = isLate(w, now)
        return (
          <div className="max-w-52 sm:max-w-64">
            <span className="flex items-center gap-2">
              <WoLink woId={w.id} />
              {late && <Badge variant="danger">Late</Badge>}
            </span>
            <p className="truncate text-xs text-muted">{w.title}</p>
            {asset ? (
              <Link to={paths.asset(asset.id)} className="block truncate text-xs text-muted hover:text-accent">
                {asset.code} · {asset.name}
              </Link>
            ) : (
              <span className="text-xs text-muted">Removed asset</span>
            )}
            <div className="mt-1.5 flex flex-wrap gap-1.5 sm:hidden">
              {w.completedAt ? <Badge variant={late ? 'danger' : 'muted'}>Done {fmtDate(w.completedAt)}</Badge> : <WoStatusBadge status={w.status} waitingReason={w.waitingReason} />}
              <Badge variant="outline">{fmtIdrShort(w.vendorCost)}</Badge>
            </div>
          </div>
        )
      },
      sortValue: (w) => toMs(w.requestedAt),
    },
    {
      id: 'target',
      header: 'Due vs done',
      cell: (w) => (
        <div className="whitespace-nowrap text-xs">
          <p>Due {fmtDate(w.dueAt)}</p>
          {w.completedAt ? (
            <p className={cn(isLate(w, now) ? 'font-semibold text-accent' : 'text-muted')}>Done {fmtDate(w.completedAt)}</p>
          ) : (
            <div className="mt-1">
              <WoStatusBadge status={w.status} waitingReason={w.waitingReason} />
            </div>
          )}
        </div>
      ),
      sortValue: (w) => toMs(w.dueAt),
      hideBelow: 'sm',
    },
    {
      id: 'duration',
      header: 'Duration',
      align: 'right',
      cell: (w) => {
        const actual = ((w.completedAt ? toMs(w.completedAt) : now) - toMs(w.requestedAt)) / MINUTE
        const target = (toMs(w.dueAt) - toMs(w.requestedAt)) / MINUTE
        return (
          <div className="whitespace-nowrap">
            <p className="font-semibold tabular-nums">
              {fmtDuration(actual)}
              {!w.completedAt && <span className="text-xs font-normal text-muted"> so far</span>}
            </p>
            <p className="text-xs text-muted">target {fmtDuration(target)}</p>
          </div>
        )
      },
      hideBelow: 'sm',
    },
    {
      id: 'cost',
      header: 'Cost',
      align: 'right',
      cell: (w) => <span className="whitespace-nowrap tabular-nums">{fmtIdrShort(w.vendorCost)}</span>,
      sortValue: (w) => w.vendorCost,
      hideBelow: 'sm',
    },
  ]

  return (
    <Card>
      <CardHeader>
        <CardTitle>Work orders</CardTitle>
        <CardDescription>
          {plural(jobs.length, 'job')} at {site.name}, newest first. Duration runs from the request to completion.
          {lateCount > 0 && <span className="font-medium text-accent"> {fmtNumber(lateCount)} late.</span>}
        </CardDescription>
      </CardHeader>
      <DataTable
        columns={columns}
        rows={jobs}
        getRowKey={(w) => w.id}
        onRowClick={(w) => navigate(paths.workOrder(w.id))}
        pageSize={8}
        empty={
          <EmptyState
            compact
            icon={<ClipboardList />}
            title="No work orders yet"
            description="Choose this vendor on a vendor or mixed work order to track its jobs here."
          />
        }
      />
    </Card>
  )
}

export function SuppliedPartsCard({ vendor }: { vendor: Vendor }) {
  const { parts, stock, warehouseIds, site } = useScoped()
  const rows = parts.filter((p) => p.vendorId === vendor.id).map((p) => partRow(p, stock, warehouseIds))

  return (
    <Card>
      <CardHeader>
        <CardTitle>Parts supplied</CardTitle>
        <CardDescription>Catalog parts this vendor delivers, with stock at {site.name}.</CardDescription>
      </CardHeader>
      {rows.length ? (
        <CardContent>
          <ul className="divide-y divide-border">
            {rows.map(({ part, level, state }) => (
              <li key={part.id}>
                <Link to={paths.part(part.id)} className="flex flex-wrap items-center gap-x-4 gap-y-1.5 py-2.5 text-sm transition-colors hover:text-accent">
                  <span className="min-w-48 flex-1">
                    <span className="block font-mono text-xs font-medium">{part.code}</span>
                    <span className="block truncate">{part.name}</span>
                  </span>
                  <span className="whitespace-nowrap text-xs text-muted">
                    {fmtNumber(level.available)} {part.unit} available · {part.leadTimeDays} days lead
                  </span>
                  <PartStockBadge state={state} />
                </Link>
              </li>
            ))}
          </ul>
        </CardContent>
      ) : (
        <EmptyState compact icon={<Package />} title="No catalog parts" description="Pick this vendor on a part's form to list the part here and group its reorders." />
      )}
    </Card>
  )
}

// ─── Side column ────────────────────────────────────────────────

const notSet = <span className="text-muted">Not set</span>

export function ContactCard({ vendor }: { vendor: Vendor }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Contact</CardTitle>
      </CardHeader>
      <CardContent>
        <KeyValue
          bare
          items={[
            { label: 'PIC', value: vendor.pic || notSet },
            {
              label: 'Phone',
              value: vendor.phone ? (
                <a href={telHref(vendor.phone)} className="hover:text-accent">
                  {vendor.phone}
                </a>
              ) : (
                notSet
              ),
            },
            {
              label: 'Email',
              value: vendor.email ? (
                <a href={`mailto:${vendor.email}`} className="hover:text-accent">
                  {vendor.email}
                </a>
              ) : (
                notSet
              ),
            },
          ]}
        />
      </CardContent>
    </Card>
  )
}

export function ContractCard({ vendor, now }: { vendor: Vendor; now: number }) {
  const state = contractState(vendor, now)
  const start = toMs(vendor.contractStart)
  const end = toMs(vendor.contractEnd)
  const elapsed = end > start ? (now - start) / (end - start) : 1
  const days = contractDaysLeft(vendor, now)
  const term =
    state === 'ended'
      ? `Ended ${plural(-days, 'day')} ago`
      : state === 'upcoming'
        ? `Starts ${fmtDate(vendor.contractStart)}`
        : `${plural(days, 'day')} left`

  return (
    <Card>
      <CardHeader action={<ContractBadge vendor={vendor} now={now} showActive />}>
        <CardTitle>Contract</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="font-mono text-sm font-medium">{vendor.contractNo || 'No contract number'}</p>
        <p className="text-xs text-muted">
          {fmtDate(vendor.contractStart)} to {fmtDate(vendor.contractEnd)}
        </p>
        <ProgressBar
          className="mt-3"
          value={elapsed}
          tone={state === 'ending' || state === 'ended' ? 'warning' : 'ink'}
          aria-label={`Contract term: ${term}`}
        />
        <p className="mt-1.5 text-xs text-muted">{term}</p>
        <KeyValue
          bare
          className="mt-3"
          items={[
            { label: 'SLA', value: `${fmtNumber(vendor.slaHours)} h to respond` },
            { label: 'Hourly rate', value: vendor.hourlyRate ? `${fmtIdr(vendor.hourlyRate)} per hour` : 'Not billed by the hour' },
          ]}
        />
      </CardContent>
    </Card>
  )
}
