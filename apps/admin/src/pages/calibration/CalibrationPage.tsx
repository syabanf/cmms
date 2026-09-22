import { fmtDate, fmtDateShort, plannedAt, plural, toMs, wib } from '@cmms/fixtures'
import type { CalibrationState } from '@cmms/types'
import { CALIBRATION_STATE_LABEL } from '@cmms/types'
import {
  ActionMenu,
  type ActionMenuItem,
  Banner,
  Button,
  Card,
  Chip,
  ChipRow,
  type Column,
  DataTable,
  EmptyState,
  Input,
  PageHeader,
  StatCard,
  cn,
} from '@cmms/ui'
import { CalendarX, ClipboardPlus, Ellipsis, FileCheck2, Gauge, ScanSearch, Search, ShieldCheck, TriangleAlert } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { useAuth } from '../../auth/auth'
import { CalibrationBadge } from '../../components/badges'
import { useCreate } from '../../components/create'
import { AssetLink, paths } from '../../components/links'
import { useHistoryState, useTableHistory } from '../../lib/history-state'
import { useNow, useScoped } from '../../state/scoped'
import { ToolIcon } from '../tools/ToolIcon'
import { CAL_KIND_LABEL, type CalKind, type CalRow, type CalTarget, calibrationJobPlan, calibrationRows, daysLeftText, targetKey } from './lib'
import { RecordCalibrationDialog } from './RecordCalibrationDialog'

const KINDS: CalKind[] = ['asset', 'tool']
const STATES: CalibrationState[] = ['valid', 'expiring', 'expired']
const STATE_RANK: Record<CalibrationState, number> = { expired: 0, expiring: 1, valid: 2 }
const KIND_CHIP: Record<CalKind, string> = { asset: 'Instruments', tool: 'Tools' }

const rowPath = (row: CalRow) => (row.kind === 'asset' ? paths.asset(row.id) : paths.tool(row.id))

function ToolLink({ row }: { row: CalRow }) {
  return (
    <Link to={paths.tool(row.id)} className="group inline-flex min-w-0 items-center gap-2 hover:text-accent">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-surface text-body group-hover:text-accent">
        <ToolIcon category={row.type} className="size-4" />
      </span>
      <span className="min-w-0">
        <span className="block truncate font-medium">{row.name}</span>
        <span className="block font-mono text-[11px] text-muted">{row.code}</span>
      </span>
    </Link>
  )
}

export function CalibrationPage() {
  const { assets, tools, calibrations, workOrders, jobPlans, maps } = useScoped()
  const { can } = useAuth()
  const create = useCreate()
  const navigate = useNavigate()
  const now = useNow(60_000)
  const [kind, setKind] = useHistoryState<CalKind | null>('kind', null)
  const [state, setState] = useHistoryState<CalibrationState | null>('state', null)
  const [query, setQuery] = useHistoryState('query', '')
  const table = useTableHistory()
  const [recording, setRecording] = useState<CalTarget | null>(null)
  const [recordOpen, setRecordOpen] = useState(false)

  const rows = useMemo(
    () =>
      calibrationRows(
        { assets, tools, calibrations, workOrders, typeName: (typeId) => maps.assetType.get(typeId)?.name ?? 'Instrument' },
        now,
      ),
    [assets, tools, calibrations, workOrders, maps.assetType, now],
  )

  const year = wib(now).year
  const certificates = calibrations.filter((r) => wib(toMs(r.date)).year === year)
  const countOf = (s: CalibrationState) => rows.filter((r) => r.state === s).length
  const expired = rows.filter((r) => r.state === 'expired').sort((a, b) => a.daysLeft - b.daysLeft)

  const q = query.trim().toLowerCase()
  const searched = q
    ? rows.filter((r) =>
        [r.code, r.name, r.type, r.lastRecord?.certificateNo ?? '', r.plan.vendorId ? (maps.vendor.get(r.plan.vendorId)?.name ?? '') : ''].some((f) =>
          f.toLowerCase().includes(q),
        ),
      )
    : rows
  const visible = searched.filter((r) => (!kind || r.kind === kind) && (!state || r.state === state))

  const openRecord = (row: CalRow) => {
    setRecording(row)
    setRecordOpen(true)
  }

  const actionsFor = (row: CalRow): ActionMenuItem[] => {
    const items: ActionMenuItem[] = []
    if (can('calibration.record')) items.push({ key: 'record', label: 'Record calibration', icon: <FileCheck2 />, onSelect: () => openRecord(row) })
    const asset = row.kind === 'asset' ? maps.asset.get(row.id) : undefined
    if (row.openWo) {
      const wo = row.openWo
      items.push({ key: 'wo', label: `Open ${wo.code}`, description: `Booked for ${fmtDateShort(plannedAt(wo))}`, icon: <ClipboardPlus />, onSelect: () => navigate(paths.workOrder(wo.id)) })
    } else if (asset && can('wo.create')) {
      items.push({
        key: 'wo',
        label: 'Create calibration work order',
        icon: <ClipboardPlus />,
        onSelect: () =>
          create.workOrder({ assetId: asset.id, type: 'calibration', jobPlanId: calibrationJobPlan(jobPlans, asset.typeId)?.id, title: `${asset.name} calibration` }),
      })
    }
    return items
  }

  const columns: Column<CalRow>[] = [
    {
      id: 'item',
      header: 'Item',
      cell: (r) => (
        <div className="max-w-[14rem]">
          {r.kind === 'asset' ? <AssetLink assetId={r.id} showIcon /> : <ToolLink row={r} />}
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5 sm:hidden">
            <CalibrationBadge state={r.state} />
            <span className={cn('text-xs', r.daysLeft < 0 ? 'font-semibold text-accent' : 'text-muted')}>{daysLeftText(r.daysLeft)}</span>
          </div>
        </div>
      ),
      sortValue: (r) => r.code,
    },
    { id: 'kind', header: 'Kind', cell: (r) => CAL_KIND_LABEL[r.kind], sortValue: (r) => r.kind, hideBelow: 'xl' },
    {
      id: 'last',
      header: 'Last calibrated',
      cell: (r) => (
        <div className="whitespace-nowrap">
          <p className={cn('tabular-nums', !r.plan.lastAt && 'text-muted')}>{r.plan.lastAt ? fmtDate(r.plan.lastAt) : 'Never'}</p>
          <p className="text-[11px] text-muted">Every {plural(r.plan.intervalMonths, 'month')}</p>
        </div>
      ),
      sortValue: (r) => (r.plan.lastAt ? toMs(r.plan.lastAt) : null),
      hideBelow: 'lg',
    },
    {
      id: 'due',
      header: 'Due',
      cell: (r) => (
        <div className="whitespace-nowrap">
          <p className="tabular-nums">{fmtDate(r.plan.due)}</p>
          <p className={cn('text-[11px]', r.daysLeft < 0 ? 'font-semibold text-accent' : r.state === 'expiring' ? 'font-semibold text-warning' : 'text-muted')}>
            {daysLeftText(r.daysLeft)}
          </p>
        </div>
      ),
      sortValue: (r) => toMs(r.plan.due),
      hideBelow: 'sm',
    },
    {
      id: 'state',
      header: 'Status',
      cell: (r) => (
        <div className="whitespace-nowrap">
          <CalibrationBadge state={r.state} />
          {r.openWo && <p className="mt-1 text-[11px] text-muted">Booked for {fmtDateShort(plannedAt(r.openWo))}</p>}
        </div>
      ),
      sortValue: (r) => STATE_RANK[r.state],
      hideBelow: 'sm',
    },
    {
      id: 'certificate',
      header: 'Last certificate',
      cell: (r) => (
        <div className="max-w-[12rem]">
          <p className={cn('font-mono text-xs', !r.lastRecord && 'text-muted')}>{r.lastRecord?.certificateNo ?? 'None on file'}</p>
          <p className="truncate text-[11px] text-muted">{r.plan.vendorId ? maps.vendor.get(r.plan.vendorId)?.name : 'In house'}</p>
        </div>
      ),
      sortValue: (r) => r.lastRecord?.certificateNo ?? null,
      hideBelow: 'lg',
    },
    {
      id: 'actions',
      header: <span className="sr-only">Actions</span>,
      align: 'right',
      cell: (r) => {
        const items = actionsFor(r)
        return items.length ? (
          <ActionMenu
            title={r.code}
            items={items}
            trigger={
              <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${r.code}`}>
                <Ellipsis />
              </Button>
            }
          />
        ) : null
      },
    },
  ]

  const clearFilters = () => {
    setKind(null)
    setState(null)
    setQuery('')
  }
  const filtering = kind !== null || state !== null || q !== ''
  const expiredTools = expired.filter((r) => r.kind === 'tool').length

  return (
    <>
      <PageHeader
        title="Calibration"
        description="Measuring instruments and tools on a calibration plan. An expired tool cannot go on a work order."
        actions={
          <Input
            variant="pill"
            className="w-full sm:w-72"
            leftIcon={<Search />}
            value={query}
            placeholder="Search code, name or certificate"
            aria-label="Search calibration items"
            onChange={(e) => setQuery(e.target.value)}
          />
        }
      />

      <div className="no-scrollbar mb-4 flex snap-x snap-mandatory gap-3 overflow-x-auto pb-1 [&>*]:min-w-[72%] [&>*]:snap-start sm:grid sm:grid-cols-2 sm:gap-4 sm:overflow-visible sm:pb-0 sm:[&>*]:min-w-0 xl:grid-cols-4">
        <StatCard label="Valid" value={countOf('valid')} hint={`${plural(rows.length, 'item')} on a plan`} icon={<ShieldCheck />} tone="success" onClick={() => setState('valid')} />
        <StatCard label="Expiring" value={countOf('expiring')} hint="Due within 30 days" icon={<Gauge />} tone="warning" onClick={() => setState('expiring')} />
        <StatCard
          label="Expired"
          value={expired.length}
          hint={expiredTools ? `${plural(expiredTools, 'tool')} blocked from work orders` : 'Past the due date'}
          icon={<CalendarX />}
          tone={expired.length ? 'danger' : 'default'}
          onClick={() => setState('expired')}
        />
        <StatCard
          label="Certificates this year"
          value={certificates.length}
          hint={`${certificates.filter((r) => r.result === 'adjusted').length} needed adjustment in ${year}`}
          icon={<FileCheck2 />}
        />
      </div>

      {expired.length > 0 && (
        <Banner
          tone="warning"
          icon={<TriangleAlert />}
          className="mb-4"
          title={expiredTools ? 'Expired tools cannot be assigned to work orders' : 'Expired instruments need a new calibration'}
          action={
            state !== 'expired' ? (
              <Button variant="outline" size="sm" onClick={() => setState('expired')}>
                Show expired
              </Button>
            ) : undefined
          }
        >
          <ul className="flex flex-wrap gap-x-4 gap-y-0.5">
            {expired.map((r) => (
              <li key={targetKey(r)}>
                <Link to={rowPath(r)} className="font-medium text-foreground hover:text-accent">
                  {r.code}
                </Link>{' '}
                {r.name}, {daysLeftText(r.daysLeft)}
                {r.openWo ? `, booked for ${fmtDateShort(plannedAt(r.openWo))}` : ''}
              </li>
            ))}
          </ul>
        </Banner>
      )}

      <Card>
        <ChipRow className="px-5 pt-5" aria-label="Filter calibration items">
          <Chip
            variant="filter"
            active={!kind && !state}
            count={searched.length}
            onClick={() => {
              setKind(null)
              setState(null)
            }}
          >
            All items
          </Chip>
          {KINDS.map((k) => (
            <Chip
              key={k}
              variant="filter"
              active={kind === k}
              count={searched.filter((r) => r.kind === k && (!state || r.state === state)).length}
              onClick={() => setKind(kind === k ? null : k)}
            >
              {KIND_CHIP[k]}
            </Chip>
          ))}
          <span aria-hidden="true" className="mx-1 my-2 w-px shrink-0 bg-border" />
          {STATES.map((s) => (
            <Chip
              key={s}
              variant="filter"
              active={state === s}
              count={searched.filter((r) => r.state === s && (!kind || r.kind === kind)).length}
              onClick={() => setState(state === s ? null : s)}
            >
              {CALIBRATION_STATE_LABEL[s]}
            </Chip>
          ))}
        </ChipRow>
        <DataTable
          {...table}
          className="mt-3"
          columns={columns}
          rows={visible}
          getRowKey={targetKey}
          onRowClick={(r) => navigate(rowPath(r))}
          initialSort={{ id: 'due' }}
          pageSize={15}
          resetPageKey={`${kind}|${state}|${q}`}
          empty={
            filtering ? (
              <EmptyState
                compact
                icon={<ScanSearch />}
                title="Nothing matches these filters"
                description="Clear the search and filters to see every instrument and tool."
                action={
                  <Button variant="outline" size="sm" onClick={clearFilters}>
                    Clear filters
                  </Button>
                }
              />
            ) : (
              <EmptyState
                compact
                icon={<Gauge />}
                title="No calibration plans yet"
                description="Give a tool a calibration interval on its page, or set one on an instrument's passport."
                action={
                  <Button asChild variant="outline" size="sm">
                    <Link to="/inventory/tools">Open tools</Link>
                  </Button>
                }
              />
            )
          }
        />
      </Card>

      <RecordCalibrationDialog target={recording} open={recordOpen} onOpenChange={setRecordOpen} />
    </>
  )
}
