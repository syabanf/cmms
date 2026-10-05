import { fmtDate } from '@cmms/fixtures'
import { Badge, type BadgeProps, Button, Card, IconTile, KeyValue, Kicker, cn } from '@cmms/ui'
import { Plus, X } from 'lucide-react'
import { Link } from 'react-router'
import { useAuth } from '../../auth/auth'
import { CriticalityBadge } from '../../components/badges'
import { useCreate } from '../../components/create'
import { AssetIcon } from '../../components/icons'
import { paths } from '../../components/links'
import { useScoped } from '../../state/scoped'
import { MACHINE_STATE_LABEL, type MachineInfo, type MachineState } from './lib'

const STATE_BADGE: Record<MachineState, NonNullable<BadgeProps['variant']>> = {
  down: 'accent',
  working: 'info',
  waiting: 'warning',
  standby: 'muted',
  running: 'success',
}

/** The selected machine: what it is, where, its state and the way into its records. */
export function MachineCard({
  info,
  onClose,
  className,
}: {
  info: MachineInfo
  onClose: () => void
  className?: string
}) {
  const { maps, locationPath, personName } = useScoped()
  const { can } = useAuth()
  const create = useCreate()
  const { asset, work, crew } = info
  const type = maps.assetType.get(asset.typeId)
  const lead = work[0]

  return (
    <Card className={cn('flex flex-col', className)}>
      <div className="gap-3 p-4 pb-3 flex items-start">
        <IconTile size="lg" tone={info.state === 'down' ? 'danger' : 'default'}>
          <AssetIcon icon={type?.icon} />
        </IconTile>
        <div className="min-w-0 flex-1">
          <Kicker>{type?.name ?? 'Machine'}</Kicker>
          <h2 className="mt-0.5 text-base font-bold leading-tight truncate">{asset.name}</h2>
          <p className="text-xs font-mono text-muted">{asset.code}</p>
        </div>
        <Button variant="ghost" size="icon-sm" aria-label={`Close ${asset.code}`} onClick={onClose}>
          <X />
        </Button>
      </div>
      <div className="gap-1.5 px-4 flex flex-wrap">
        <Badge variant={STATE_BADGE[info.state]} dot>
          {MACHINE_STATE_LABEL[info.state]}
        </Badge>
        <CriticalityBadge criticality={asset.criticality} long />
      </div>
      <KeyValue
        bare
        labelWidth="sm"
        className="mt-2 px-4"
        items={[
          { label: 'Location', value: locationPath(asset.locationId) || 'Not set' },
          {
            label: 'Open work',
            value: lead ? (
              <span>
                <Link
                  to={paths.workOrder(lead.id)}
                  className="text-xs font-medium font-mono hover:text-accent hover:underline"
                >
                  {lead.code}
                </Link>
                {work.length > 1 && <span className="text-muted"> + {work.length - 1} more</span>}
              </span>
            ) : (
              <span className="text-muted">None</span>
            ),
          },
          { label: 'On it', value: crew.map(personName).join(', '), hidden: crew.length === 0 },
          {
            label: 'Last failure',
            value: info.lastFailureAt ? (
              fmtDate(info.lastFailureAt)
            ) : (
              <span className="text-muted">None recorded</span>
            ),
          },
        ]}
      />
      <div className="gap-2 p-4 pt-3 mt-auto flex flex-wrap">
        <Button asChild variant="outline" size="sm">
          <Link to={paths.asset(asset.id)}>Open passport</Link>
        </Button>
        {can('wo.create') && (
          <Button size="sm" onClick={() => create.workOrder({ assetId: asset.id })}>
            <Plus />
            New work order
          </Button>
        )}
      </div>
    </Card>
  )
}
