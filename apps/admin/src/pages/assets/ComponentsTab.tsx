import type { Asset } from '@cmms/types'
import { Button, EmptyState, IconTile } from '@cmms/ui'
import { ChevronRight, Component, Plus } from 'lucide-react'
import { useMemo } from 'react'
import { Link } from 'react-router'
import { AssetStatusBadge, CriticalityBadge } from '../../components/badges'
import { AssetIcon } from '../../components/icons'
import { paths } from '../../components/links'
import { useScoped } from '../../state/scoped'
import { byCode, workByAsset } from './lib'
import { SectionTitle } from './ui'

/** Child assets that keep their own history, each linking to its passport. */
export function ComponentsTab({ asset, onAdd }: { asset: Asset; onAdd?: () => void }) {
  const { assets, workOrders, maps } = useScoped()
  const children = useMemo(
    () => assets.filter((a) => a.parentId === asset.id).sort(byCode),
    [assets, asset.id],
  )
  const work = useMemo(() => workByAsset(workOrders), [workOrders])
  const add = onAdd && (
    <Button variant="outline" size="sm" onClick={onAdd}>
      <Plus />
      Add component
    </Button>
  )

  return (
    <div>
      <SectionTitle count={children.length} action={children.length > 0 && add}>
        Components
      </SectionTitle>
      {children.length ? (
        <ul className="space-y-2">
          {children.map((child) => {
            const open = work.get(child.id)?.open ?? 0
            return (
              <li key={child.id}>
                <Link
                  to={paths.asset(child.id)}
                  className="flex items-center gap-3 rounded-2xl bg-surface-2 p-3 transition-colors hover:bg-card hover:shadow-card"
                >
                  <IconTile
                    size="sm"
                    tone={child.status === 'down' ? 'danger' : 'default'}
                    className={child.status === 'down' ? undefined : 'bg-card'}
                  >
                    <AssetIcon icon={maps.assetType.get(child.typeId)?.icon} />
                  </IconTile>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{child.name}</p>
                    <p className="truncate text-xs text-muted">
                      <span className="font-mono">{child.code}</span> ·{' '}
                      {maps.assetType.get(child.typeId)?.name ?? 'Unknown type'}
                      {open > 0 && ` · ${open} open`}
                    </p>
                    <div className="mt-1.5 flex flex-wrap gap-1.5 sm:hidden">
                      <AssetStatusBadge status={child.status} />
                      <CriticalityBadge criticality={child.criticality} />
                    </div>
                  </div>
                  <div className="hidden shrink-0 items-center gap-1.5 sm:flex">
                    <CriticalityBadge criticality={child.criticality} />
                    <AssetStatusBadge status={child.status} />
                  </div>
                  <ChevronRight aria-hidden="true" className="size-4 shrink-0 text-muted" />
                </Link>
              </li>
            )
          })}
        </ul>
      ) : (
        <EmptyState
          compact
          icon={<Component />}
          title="No components registered"
          description="Register a component when it needs its own history, such as a drive motor, spindle or inverter. Standard bearings and bolts belong in the BOM."
          action={add || undefined}
        />
      )}
    </div>
  )
}
