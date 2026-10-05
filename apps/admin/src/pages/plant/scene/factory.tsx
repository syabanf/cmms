import { type ThreeEvent, useFrame } from '@react-three/fiber'
import { useRef } from 'react'
import type { Group } from 'three'
import { BRAND } from '../../../lib/brand'
import type { PlantLayout } from '../layout'
import type { SceneLabel } from './labels'
import { Block, FLOOR, Patch } from './parts'

const WALL_HEIGHT = 6
const WALL = 0.4
const PARTITION_HEIGHT = 3.2
const DOOR = 4
const SIDE_AISLE = 4
const BACK_AISLE = 4.5
const FRONT_AISLE = 5
const COLUMN = 0.6

export type Bounds = ReturnType<typeof buildingBounds>

/** The building's inner edges: halls plus the aisles around them, up to the top of the walls. */
export function buildingBounds({ width, depth }: Pick<PlantLayout, 'width' | 'depth'>) {
  return {
    left: -width / 2 - SIDE_AISLE,
    right: width / 2 + SIDE_AISLE,
    back: -depth / 2 - BACK_AISLE,
    front: depth / 2 + FRONT_AISLE,
    top: WALL_HEIGHT,
  }
}

/** Evenly spaced positions from `from` to `to` with roughly `step` between them, ends included. */
function spread(from: number, to: number, step: number): number[] {
  const count = Math.max(1, Math.round((to - from) / step))
  return Array.from({ length: count + 1 }, (_, i) => from + ((to - from) * i) / count)
}

function Rack({ x, z }: { x: number; z: number }) {
  return (
    <group position={[x, FLOOR, z]}>
      <Block size={[0.12, 3.6, 1.2]} at={[-1.5, 1.8, 0]} color={BRAND.ink3} />
      <Block size={[0.12, 3.6, 1.2]} at={[1.5, 1.8, 0]} color={BRAND.ink3} />
      {[0.15, 1.35, 2.55].map((y) => (
        <group key={y}>
          <Block size={[3.1, 0.08, 1.2]} at={[0, y, 0]} color={BRAND.chartMuted} />
          <Block size={[0.9, 0.7, 0.9]} at={[-0.8, y + 0.39, 0]} color={BRAND.border} />
          <Block size={[0.9, 0.55, 0.9]} at={[0.6, y + 0.32, 0]} color={BRAND.chartMuted} />
        </group>
      ))}
    </group>
  )
}

/**
 * The factory seen from inside: one floor under every hall, tall walls on three sides with high windows,
 * an open front, partitions with doorways between halls, columns, racks along the back wall and a painted
 * pad per area. A wall the camera stands behind is cut away, so no angle hides the floor. A click on bare
 * floor clears the selection.
 */
export function Factory({
  layout,
  onBackgroundClick,
}: {
  layout: PlantLayout
  onBackgroundClick: () => void
}) {
  const b = buildingBounds(layout)
  const backWall = useRef<Group>(null)
  const leftWall = useRef<Group>(null)
  const rightWall = useRef<Group>(null)
  useFrame(({ camera }) => {
    if (backWall.current) backWall.current.visible = camera.position.z > b.back
    if (leftWall.current) leftWall.current.visible = camera.position.x > b.left
    if (rightWall.current) rightWall.current.visible = camera.position.x < b.right
  })
  const width = b.right - b.left
  const depth = b.front - b.back
  const centerZ = (b.back + b.front) / 2
  const wallY = WALL_HEIGHT / 2
  const partitions = layout.halls.slice(1).map((hall, i) => {
    const prev = layout.halls[i]!
    return (prev.x + prev.width / 2 + hall.x - hall.width / 2) / 2
  })
  const partitionBack = b.back
  const partitionFront = layout.depth / 2
  const doorZ = (partitionBack + partitionFront) / 2
  const segment = (partitionFront - partitionBack - DOOR) / 2
  const byPartition = (x: number) => partitions.some((p) => Math.abs(p - x) < 2.6)
  const racks = spread(b.left + 3, b.right - 3, 4.2).filter((x) => !byPartition(x))

  return (
    <group>
      <mesh
        position={[(b.left + b.right) / 2, 0.005, centerZ]}
        rotation={[-Math.PI / 2, 0, 0]}
        receiveShadow
        onClick={(e: ThreeEvent<MouseEvent>) => e.delta < 6 && onBackgroundClick()}
      >
        <planeGeometry args={[width, depth]} />
        <meshStandardMaterial color={BRAND.surface} roughness={0.95} />
      </mesh>
      <Block
        size={[width, FLOOR, depth]}
        at={[(b.left + b.right) / 2, -FLOOR / 2, centerZ]}
        color={BRAND.chartMuted}
      />

      <group ref={backWall}>
        <Block
          size={[width + WALL * 2, WALL_HEIGHT, WALL]}
          at={[(b.left + b.right) / 2, wallY, b.back - WALL / 2]}
          color={BRAND.card}
        />
        {spread(b.left + 4, b.right - 4, 6).map((x) => (
          <Block
            key={x}
            size={[3.6, 1.3, 0.05]}
            at={[x, WALL_HEIGHT - 1.4, b.back + 0.03]}
            color={BRAND.infoSoft}
          />
        ))}
      </group>
      <group ref={leftWall}>
        <Block
          size={[WALL, WALL_HEIGHT, depth]}
          at={[b.left - WALL / 2, wallY, centerZ]}
          color={BRAND.card}
        />
      </group>
      <group ref={rightWall}>
        <Block
          size={[WALL, WALL_HEIGHT, depth]}
          at={[b.right + WALL / 2, wallY, centerZ]}
          color={BRAND.card}
        />
      </group>
      <Block
        size={[width, 0.3, 0.3]}
        at={[(b.left + b.right) / 2, 0.15, b.front - 0.15]}
        color={BRAND.chartMuted}
      />

      {spread(b.left, b.right, 10).map((x) => (
        <Block
          key={`cb${x}`}
          size={[COLUMN, WALL_HEIGHT, COLUMN]}
          at={[x, wallY, b.back + COLUMN / 2]}
          color={BRAND.chartMuted}
        />
      ))}
      {spread(b.back, b.front, 10).flatMap((z) => [
        <Block
          key={`cl${z}`}
          size={[COLUMN, WALL_HEIGHT, COLUMN]}
          at={[b.left + COLUMN / 2, wallY, z]}
          color={BRAND.chartMuted}
        />,
        <Block
          key={`cr${z}`}
          size={[COLUMN, WALL_HEIGHT, COLUMN]}
          at={[b.right - COLUMN / 2, wallY, z]}
          color={BRAND.chartMuted}
        />,
      ])}

      {partitions.map((x) => (
        <group key={x}>
          <Block
            size={[0.25, PARTITION_HEIGHT, segment]}
            at={[x, PARTITION_HEIGHT / 2, partitionBack + segment / 2]}
            color={BRAND.card}
          />
          <Block
            size={[0.25, PARTITION_HEIGHT, segment]}
            at={[x, PARTITION_HEIGHT / 2, partitionFront - segment / 2]}
            color={BRAND.card}
          />
          <Block
            size={[COLUMN, WALL_HEIGHT, COLUMN]}
            at={[x, wallY, partitionFront]}
            color={BRAND.chartMuted}
          />
          <Patch width={DOOR - 0.4} depth={1.6} at={[x, 0.02, doorZ]} color={BRAND.chartMuted} />
        </group>
      ))}

      {racks.map((x) => (
        <Rack key={x} x={x} z={b.back + 1.2} />
      ))}

      <Patch
        width={width - 2}
        depth={0.12}
        at={[(b.left + b.right) / 2, 0.02, layout.depth / 2 + 1]}
        color={BRAND.card}
      />
      <Patch
        width={width - 2}
        depth={0.12}
        at={[(b.left + b.right) / 2, 0.02, b.front - 1]}
        color={BRAND.card}
      />

      {layout.halls.flatMap((hall) =>
        hall.zones.map((zone) => (
          <group key={zone.id}>
            <Block
              size={[zone.width, FLOOR, zone.depth]}
              at={[zone.x, FLOOR / 2, zone.z]}
              color={BRAND.card}
            />
            {zone.rows.map((row) => (
              <Patch
                key={row.id}
                width={row.length + 0.8}
                depth={3.2}
                at={[row.x, FLOOR + 0.02, row.z]}
                color={BRAND.surface2}
              />
            ))}
          </group>
        )),
      )}
    </group>
  )
}

/**
 * Names inside the building: each hall on the back wall above its section, each area at its pad's front
 * corner. Area names step aside while the plant is too small on screen to fit them.
 */
export function factoryLabels(layout: PlantLayout): SceneLabel[] {
  const back = buildingBounds(layout).back
  return layout.halls.flatMap((hall): SceneLabel[] => [
    {
      id: `hall:${hall.id}`,
      at: [hall.x, WALL_HEIGHT + 0.4, back],
      anchor: 'center',
      content: (
        <span className="px-3 py-1.5 text-xs font-bold block rounded-full bg-card shadow-card">
          {hall.name}
        </span>
      ),
    },
    ...hall.zones.map((zone): SceneLabel => ({
      id: `zone:${zone.id}`,
      at: [zone.x - zone.width / 2 + 0.4, FLOOR, zone.z + zone.depth / 2 - 0.3],
      anchor: 'left',
      content: (
        <span className="px-2.5 py-1 font-semibold block rounded-full bg-card/90 text-[11px] text-body shadow-card group-data-[zoom=far]:hidden">
          {zone.name}
        </span>
      ),
    })),
  ])
}
