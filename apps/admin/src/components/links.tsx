import { Avatar, AvatarStack, cn } from '@cmms/ui'
import { Link } from 'react-router'
import { useScoped } from '../state/scoped'
import { AssetIcon } from './icons'

/** Routes for entity detail pages, shared by every feature. */
export const paths = {
  asset: (id: string) => `/assets/${id}`,
  workOrder: (id: string) => `/work/orders/${id}`,
  request: (id: string) => `/work/requests/${id}`,
  pm: (id: string) => `/preventive/pm/${id}`,
  jobPlan: (id: string) => `/preventive/job-plans/${id}`,
  part: (id: string) => `/inventory/parts/${id}`,
  purchaseList: '/inventory/parts/purchase-list',
  tool: (id: string) => `/inventory/tools/${id}`,
  rca: (id: string) => `/reliability/rca/${id}`,
  technician: (id: string) => `/people/technicians/${id}`,
  vendor: (id: string) => `/people/vendors/${id}`,
}

/** Code + name of an asset, linking to its passport. */
export function AssetLink({ assetId, className, showIcon = false }: { assetId: string; className?: string; showIcon?: boolean }) {
  const { maps } = useScoped()
  const asset = maps.asset.get(assetId)
  if (!asset) return <span className="text-muted">Removed asset</span>
  const type = maps.assetType.get(asset.typeId)
  return (
    <Link
      to={paths.asset(asset.id)}
      onClick={(e) => e.stopPropagation()}
      className={cn('group inline-flex min-w-0 items-center gap-2 hover:text-accent', className)}
    >
      {showIcon && (
        <span className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-surface text-body group-hover:text-accent">
          <AssetIcon icon={type?.icon} className="size-4" />
        </span>
      )}
      <span className="min-w-0">
        <span className="block truncate font-medium">{asset.name}</span>
        <span className="block font-mono text-[11px] text-muted">{asset.code}</span>
      </span>
    </Link>
  )
}

export function WoLink({ woId, className }: { woId: string; className?: string }) {
  const { maps } = useScoped()
  const wo = maps.workOrder.get(woId)
  if (!wo) return null
  return (
    <Link
      to={paths.workOrder(wo.id)}
      onClick={(e) => e.stopPropagation()}
      className={cn('font-mono text-xs font-medium text-foreground hover:text-accent hover:underline', className)}
    >
      {wo.code}
    </Link>
  )
}

export function PersonAvatar({ personId, size = 'sm', className }: { personId: string; size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'; className?: string }) {
  const { maps, personName } = useScoped()
  return <Avatar name={personName(personId)} color={maps.person.get(personId)?.color} size={size} className={className} />
}

export function PeopleStack({ personIds, size = 'sm', max = 3 }: { personIds: string[]; size?: 'xs' | 'sm' | 'md'; max?: number }) {
  const { maps, personName } = useScoped()
  if (!personIds.length) return <span className="text-xs text-muted">Unassigned</span>
  return <AvatarStack size={size} max={max} people={personIds.map((id) => ({ name: personName(id), color: maps.person.get(id)?.color }))} />
}

/** Avatar + name, for key/value rows and lists. */
export function PersonChip({ personId, hint }: { personId: string | null; hint?: string }) {
  const { personName } = useScoped()
  if (!personId) return <span className="text-muted">Unassigned</span>
  return (
    <span className="inline-flex min-w-0 items-center gap-2">
      <PersonAvatar personId={personId} size="xs" />
      <span className="min-w-0 truncate">{personName(personId)}</span>
      {hint && <span className="text-xs text-muted">{hint}</span>}
    </span>
  )
}
