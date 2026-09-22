import { isActive, plural, subtreeIds } from '@cmms/fixtures'
import type { Asset, AssetStatus } from '@cmms/types'
import { ASSET_STATUS_LABEL } from '@cmms/types'
import {
  ActionMenu,
  type ActionMenuItem,
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  IconTile,
  type TabItem,
  UnderlineTabs,
  toast,
} from '@cmms/ui'
import {
  Archive,
  CircleCheck,
  CirclePause,
  ClipboardPlus,
  Ellipsis,
  Factory,
  MapPin,
  Megaphone,
  Pencil,
  PowerOff,
  Printer,
  SearchX,
  Trash2,
} from 'lucide-react'
import { type ReactNode, useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router'
import { useAuth } from '../../auth/auth'
import { BackButton } from '../../components/BackButton'
import { AssetStatusBadge, CriticalityBadge } from '../../components/badges'
import { useCreate } from '../../components/create'
import { AssetIcon } from '../../components/icons'
import { paths } from '../../components/links'
import { useNow, useScoped } from '../../state/scoped'
import { AssetDialog } from './AssetDialog'
import { BomTab } from './BomTab'
import { ComponentsTab } from './ComponentsTab'
import { DocumentsTab } from './DocumentsTab'
import { HistoryTab } from './HistoryTab'
import { CalibrationCard, PmSchedulesCard, ResponsibleCard } from './InfoCards'
import { MetersTab } from './MetersTab'
import { OverviewTab } from './OverviewTab'
import { PrintableLabel, QrLabelCard, useLabelPrinter } from './QrLabel'
import { ReliabilityHero } from './ReliabilityHero'
import { WarrantyCard } from './WarrantyCard'
import { WorkTab } from './WorkTab'

const TABS = ['overview', 'work', 'history', 'bom', 'documents', 'meters', 'components'] as const
type Tab = (typeof TABS)[number]
const asTab = (value: string | null): Tab => TABS.find((t) => t === value) ?? 'overview'

const STATUS_ACTIONS: { status: AssetStatus; label: string; description: string; icon: ReactNode }[] = [
  {
    status: 'operational',
    label: 'Mark operational',
    description: 'Running normally',
    icon: <CircleCheck />,
  },
  {
    status: 'standby',
    label: 'Put on standby',
    description: 'Available, not running',
    icon: <CirclePause />,
  },
  { status: 'down', label: 'Mark as down', description: 'Production stopped', icon: <PowerOff /> },
  { status: 'retired', label: 'Retire', description: 'Keeps history, leaves pickers', icon: <Archive /> },
]

export function AssetDetailPage() {
  const { id = '' } = useParams()
  const { maps, siteId } = useScoped()
  const asset = maps.asset.get(id)
  if (!asset) return <NotFound />
  if (asset.siteId !== siteId) return <OtherSite asset={asset} />
  return <Passport key={asset.id} asset={asset} />
}

function NotFound() {
  return (
    <div className="space-y-4">
      <BackButton fallback="/assets" />
      <Card>
        <EmptyState
          icon={<SearchX />}
          title="Asset not found"
          description="It may have been deleted, or the link is out of date. Search the register for it."
          action={
            <Button asChild variant="outline">
              <Link to="/assets">Open the asset register</Link>
            </Button>
          }
        />
      </Card>
    </div>
  )
}

function OtherSite({ asset }: { asset: Asset }) {
  const { state } = useScoped()
  const { sites, switchSite } = useAuth()
  const home = state.sites.find((s) => s.id === asset.siteId)
  const allowed = sites.some((s) => s.id === asset.siteId)
  return (
    <div className="space-y-4">
      <BackButton fallback="/assets" />
      <Card>
        <EmptyState
          icon={<Factory />}
          title={`${asset.code} belongs to ${home?.name ?? 'another site'}`}
          description={
            allowed ? 'Switch site to open its passport.' : 'Your account has no access to that site.'
          }
          action={
            allowed && home ? (
              <Button onClick={() => switchSite(home.id)}>Switch to {home.name}</Button>
            ) : (
              <Button asChild variant="outline">
                <Link to="/assets">Open the asset register</Link>
              </Button>
            )
          }
        />
      </Card>
    </div>
  )
}

function Passport({ asset }: { asset: Asset }) {
  const {
    assets,
    workOrders,
    requests,
    warrantyClaims,
    rcas,
    calibrations,
    documents,
    bom,
    meters,
    maps,
    locationPath,
    dispatch,
  } = useScoped()
  const { can } = useAuth()
  const create = useCreate()
  const navigate = useNavigate()
  const now = useNow()
  const [params, setParams] = useSearchParams()
  const tab = asTab(params.get('tab'))
  const [dialog, setDialog] = useState<'edit' | 'component' | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const label = useLabelPrinter()
  const canManage = can('asset.manage')
  const type = maps.assetType.get(asset.typeId)
  const parent = asset.parentId ? maps.asset.get(asset.parentId) : undefined
  const edit = canManage ? () => setDialog('edit') : undefined

  const counts = useMemo(() => {
    const ids = subtreeIds(assets, asset.id)
    return {
      open: workOrders.filter((w) => ids.has(w.assetId) && isActive(w)).length,
      bom: bom.filter((b) => b.assetId === asset.id).length,
      documents: documents.filter((d) => d.assetId === asset.id).length,
      meters: meters.filter((m) => m.assetId === asset.id).length,
      components: assets.filter((a) => a.parentId === asset.id).length,
    }
  }, [assets, workOrders, bom, documents, meters, asset.id])

  // Records that point at the asset. Deleting it would orphan them, so retiring is offered instead.
  const references = (
    [
      [workOrders.filter((w) => w.assetId === asset.id).length, 'work order'],
      [requests.filter((r) => r.assetId === asset.id).length, 'request'],
      [warrantyClaims.filter((c) => c.assetId === asset.id).length, 'warranty claim'],
      [rcas.filter((r) => r.assetId === asset.id).length, 'RCA'],
      [
        calibrations.filter((c) => c.target.kind === 'asset' && c.target.id === asset.id).length,
        'calibration record',
      ],
    ] as const
  )
    .filter(([count]) => count > 0)
    .map(([count, noun]) => plural(count, noun))
  const blocked = references.length > 0

  const setTab = (next: string) =>
    setParams(
      (p) => {
        if (next === 'overview') p.delete('tab')
        else p.set('tab', next)
        return p
      },
      { replace: true },
    )

  const setStatus = (status: AssetStatus) => {
    dispatch({ type: 'assets/setStatus', id: asset.id, status })
    toast(`${asset.code} is now ${ASSET_STATUS_LABEL[status].toLowerCase()}`, { tone: 'success' })
  }

  // Leave the page first so the passport never renders its own "not found" state.
  const remove = async () => {
    await navigate('/assets', { replace: true })
    dispatch({ type: 'assets/remove', id: asset.id })
    toast(`${asset.code} deleted`, { tone: 'success', description: asset.name })
  }

  const menu: (ActionMenuItem | 'separator')[] = [
    { key: 'print', label: 'Print QR label', icon: <Printer />, onSelect: label.print },
  ]
  if (canManage) {
    menu.push('separator')
    for (const action of STATUS_ACTIONS) {
      if (action.status === asset.status) continue
      menu.push({
        key: action.status,
        label: action.label,
        description: action.description,
        icon: action.icon,
        onSelect: () => setStatus(action.status),
      })
    }
    menu.push('separator', {
      key: 'delete',
      label: 'Delete asset',
      icon: <Trash2 />,
      destructive: true,
      description: blocked ? 'Has maintenance records' : undefined,
      disabled: blocked && asset.status === 'retired',
      onSelect: () => setConfirmDelete(true),
    })
  }

  const tabs: TabItem[] = [
    { value: 'overview', label: 'Overview' },
    { value: 'work', label: 'Work', count: counts.open },
    { value: 'history', label: 'History' },
    { value: 'bom', label: 'Parts & BOM', count: counts.bom },
    { value: 'documents', label: 'Documents', count: counts.documents },
    { value: 'meters', label: 'Meters', count: counts.meters },
    { value: 'components', label: 'Components', count: counts.components },
  ]

  const panels: Record<Tab, ReactNode> = {
    overview: <OverviewTab asset={asset} now={now} onEdit={edit} />,
    work: <WorkTab asset={asset} now={now} onShowHistory={() => setTab('history')} />,
    history: <HistoryTab asset={asset} now={now} />,
    bom: <BomTab asset={asset} />,
    documents: <DocumentsTab asset={asset} />,
    meters: <MetersTab asset={asset} now={now} />,
    components: <ComponentsTab asset={asset} onAdd={canManage ? () => setDialog('component') : undefined} />,
  }

  const children = counts.components
  return (
    <div className="space-y-4">
      <BackButton fallback="/assets" />

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-[16rem] flex-1 items-start gap-4">
          <IconTile
            size="lg"
            tone={asset.status === 'down' ? 'danger' : 'default'}
            className={asset.status === 'down' ? undefined : 'bg-card shadow-card'}
          >
            <AssetIcon icon={type?.icon} />
          </IconTile>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-xs font-semibold text-muted">{asset.code}</span>
              <AssetStatusBadge status={asset.status} />
              <CriticalityBadge criticality={asset.criticality} long />
            </div>
            <h1 className="mt-1 text-2xl font-bold tracking-tight">{asset.name}</h1>
            <p className="mt-1 flex items-start gap-1.5 text-sm text-muted">
              <MapPin aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
              <span className="min-w-0">
                {locationPath(asset.locationId) || 'No location'}
                {type ? ` · ${type.name}` : ''}
              </span>
            </p>
            {parent && (
              <p className="mt-1 text-sm text-muted">
                Component of{' '}
                <Link to={paths.asset(parent.id)} className="font-medium text-foreground hover:text-accent">
                  {parent.code} · {parent.name}
                </Link>
              </p>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {can('request.create') && (
            <Button variant="outline" onClick={() => create.request(asset.id)}>
              <Megaphone />
              Report problem
            </Button>
          )}
          {can('wo.create') && (
            <Button onClick={() => create.workOrder({ assetId: asset.id })}>
              <ClipboardPlus />
              New work order
            </Button>
          )}
          {canManage && (
            <Button variant="outline" onClick={() => setDialog('edit')}>
              <Pencil />
              Edit
            </Button>
          )}
          <ActionMenu
            title={asset.code}
            items={menu}
            trigger={
              <Button variant="outline" size="icon" aria-label="More actions">
                <Ellipsis />
              </Button>
            }
          />
        </div>
      </header>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-4">
          <ReliabilityHero asset={asset} now={now} />
          <Card>
            <div className="px-5 pt-2">
              <UnderlineTabs items={tabs} value={tab} onValueChange={setTab} />
            </div>
            <div className="p-5">{panels[tab]}</div>
          </Card>
        </div>
        <aside className="grid min-w-0 grid-cols-1 content-start gap-4 md:grid-cols-2 xl:grid-cols-1">
          <QrLabelCard asset={asset} onPrint={label.print} />
          <WarrantyCard asset={asset} now={now} onEdit={edit} />
          <CalibrationCard asset={asset} now={now} />
          <PmSchedulesCard asset={asset} now={now} />
          <ResponsibleCard asset={asset} />
        </aside>
      </div>

      {label.printing && <PrintableLabel asset={asset} />}

      <AssetDialog
        open={dialog !== null}
        onOpenChange={(open) => !open && setDialog(null)}
        asset={dialog === 'edit' ? asset : null}
        preset={
          dialog === 'component'
            ? {
                parentId: asset.id,
                locationId: asset.locationId,
                teamId: asset.teamId,
                costCenterId: asset.costCenterId,
              }
            : undefined
        }
        onSaved={(saved, created) => {
          if (created) navigate(paths.asset(saved.id))
        }}
      />

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={blocked ? `${asset.code} has maintenance records` : `Delete ${asset.code}?`}
        description={
          blocked
            ? `${references.join(', ')} point at this asset, so deleting it would break their history. Retire it instead: the passport and records stay, and it drops out of pickers and new work.`
            : `This removes ${asset.name} with its meters, documents, parts list and PM schedules.${
                children
                  ? ` ${plural(children, 'component')} under it ${parent ? `will move up to ${parent.code}` : 'will stay as stand-alone assets'}.`
                  : ''
              } You cannot undo this.`
        }
        confirmLabel={blocked ? 'Retire asset' : 'Delete asset'}
        destructive={!blocked}
        onConfirm={blocked ? () => setStatus('retired') : remove}
      />
    </div>
  )
}
