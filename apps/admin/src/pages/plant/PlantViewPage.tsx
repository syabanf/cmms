import { Button, EmptyState, cn } from '@cmms/ui'
import { Box, LoaderCircle } from 'lucide-react'
import { Suspense, lazy, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { useHistoryState } from '../../lib/history-state'
import { useNow, useScoped } from '../../state/scoped'
import { buildLayout } from './layout'
import {
  type PlantListRow,
  type PlantTab,
  attentionRows,
  machineInfos,
  peopleRows,
  plantStats,
  workRows,
} from './lib'
import { MachineCard } from './MachineCard'
import { PlantList } from './PlantList'
import { PlantStats } from './PlantStats'
import { SceneControls } from './SceneControls'
import type { SceneApi, SceneMachine } from './scene/types'
import { TrackingCard } from './TrackingCard'

// three.js loads with the scene only, so the cards render while it streams in.
const PlantScene = lazy(() => import('./scene/PlantScene'))

function supportsWebGL(): boolean {
  try {
    const canvas = document.createElement('canvas')
    return Boolean(canvas.getContext('webgl2') ?? canvas.getContext('webgl'))
  } catch {
    return false
  }
}

/**
 * The plant in 3D with live machine state. From xl the cards float over the scene; below xl the scene is
 * one card and the others stack under it.
 */
export function PlantViewPage() {
  const s = useScoped()
  const now = useNow(60_000)
  const [params, setParams] = useSearchParams()
  const [tab, setTab] = useHistoryState<PlantTab>('tab', 'attention')
  const [trackedWoId, setTrackedWoId] = useState<string | null>(null)
  const [webgl] = useState(supportsWebGL)
  const apiRef = useRef<SceneApi | null>(null)

  const machines = useMemo(() => s.assets.filter((a) => !a.parentId && a.status !== 'retired'), [s.assets])
  const layout = useMemo(() => buildLayout(s.locations, machines), [s.locations, machines])
  const infos = useMemo(
    () => machineInfos(machines, s.workOrders, s.maps.asset, now),
    [machines, s.workOrders, s.maps.asset, now],
  )
  const infoList = useMemo(() => [...infos.values()], [infos])
  const stats = useMemo(() => plantStats(infoList, s.workOrders), [infoList, s.workOrders])
  const rows = useMemo<Record<PlantTab, PlantListRow[]>>(
    () => ({
      attention: attentionRows(infoList, now),
      work: workRows(s.workOrders, s.maps.asset, now),
      people: peopleRows(s.workOrders, s.maps.asset, s.personName),
    }),
    [infoList, s.workOrders, s.maps.asset, s.personName, now],
  )
  const sceneMachines = useMemo(
    () =>
      layout.machines.flatMap((spot): SceneMachine[] => {
        const info = infos.get(spot.assetId)
        if (!info) return []
        return [
          {
            id: info.asset.id,
            code: info.asset.code,
            x: spot.x,
            z: spot.z,
            kind: s.maps.assetType.get(info.asset.typeId)?.icon,
            state: info.state,
            crew: info.crew.map((id) => ({ name: s.personName(id), color: s.maps.person.get(id)?.color })),
          },
        ]
      }),
    [layout, infos, s],
  )

  const selected = infos.get(params.get('asset') ?? '')
  const tracked = trackedWoId
    ? s.maps.workOrder.get(trackedWoId)
    : selected
      ? selected.work[0]
      : s.maps.workOrder.get(rows.work[0]?.woId ?? '')

  const select = (assetId: string | null, woId: string | null = null) => {
    setTrackedWoId(woId)
    setParams(
      (p) => {
        if (assetId) p.set('asset', assetId)
        else p.delete('asset')
        return p
      },
      { replace: true },
    )
  }

  const summary = `${s.site.name} in 3D: ${stats.machines} machines, ${stats.down} down, ${stats.inProgress} jobs in progress.`
  const float = 'xl:absolute xl:z-30'

  return (
    <div className="gap-4 xl:block xl:h-full xl:min-h-[640px] relative flex flex-col">
      <h1 className="sr-only">Plant view</h1>
      <section
        aria-label="3D plant"
        className="xl:absolute xl:inset-0 xl:h-auto relative h-[58dvh] min-h-[360px] overflow-hidden rounded-card bg-surface-2 shadow-card print:hidden"
      >
        {webgl ? (
          <Suspense
            fallback={
              <p className="gap-2 text-sm flex h-full items-center justify-center text-muted">
                <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
                Loading the 3D plant
              </p>
            }
          >
            <div role="img" aria-label={summary} className="size-full">
              <PlantScene
                layout={layout}
                machines={sceneMachines}
                selectedId={selected?.asset.id ?? null}
                onSelect={(id) => select(id)}
                apiRef={apiRef}
              />
            </div>
          </Suspense>
        ) : (
          <EmptyState
            className="h-full"
            icon={<Box />}
            title="This browser cannot draw the 3D plant"
            description="The cards on this page list the same machines and work."
            action={
              <Button asChild variant="outline" size="sm">
                <Link to="/assets">Open the asset register</Link>
              </Button>
            }
          />
        )}
        {webgl && (
          <SceneControls
            apiRef={apiRef}
            className={cn('right-3 top-3 absolute', selected ? 'xl:right-[22rem]' : 'xl:right-4', 'xl:top-4')}
          />
        )}
      </section>

      <div className="gap-4 md:grid-cols-2 xl:contents grid grid-cols-1">
        <PlantStats
          stats={stats}
          onPick={setTab}
          className={cn('md:col-span-2', float, 'xl:left-4 xl:top-4')}
        />
        {selected && (
          <MachineCard
            info={selected}
            onClose={() => select(null)}
            className={cn(float, 'xl:right-4 xl:top-4 xl:w-80')}
          />
        )}
        <TrackingCard
          wo={tracked}
          machine={selected}
          now={now}
          className={cn(float, 'xl:bottom-4 xl:left-4 xl:w-[min(36rem,calc(100%-26rem))]')}
        />
        <PlantList
          tab={tab}
          onTab={setTab}
          rows={rows}
          isCurrent={(row) =>
            tab === 'attention' ? row.assetId === selected?.asset.id : row.woId === tracked?.id
          }
          onPick={(row) => select(row.assetId, tab === 'attention' ? null : row.woId)}
          className={cn(float, 'xl:bottom-4 xl:right-4 xl:w-[23rem]')}
        />
      </div>
    </div>
  )
}
