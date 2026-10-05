import { CameraControls, type CameraControlsImpl, useCursor } from '@react-three/drei'
import { Canvas, type ThreeEvent, useThree } from '@react-three/fiber'
import { Avatar, cn, useMediaQuery } from '@cmms/ui'
import { Hourglass, Siren, Wrench } from 'lucide-react'
import { type ReactNode, type RefObject, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Box3, Vector3 } from 'three'
import { BRAND } from '../../../lib/brand'
import type { PlantLayout } from '../layout'
import type { MachineState } from '../lib'
import { type Anchors, LabelLayer, LabelProjector, type SceneLabel } from './labels'
import { PALETTE, machineModel } from './machines'
import { FLOOR } from './parts'
import { type Bounds, Factory, buildingBounds, factoryLabels } from './factory'
import type { PlantSceneProps, SceneApi, SceneMachine } from './types'

const PIN: Partial<Record<MachineState, { tile: string; icon: ReactNode }>> = {
  down: { tile: 'bg-accent-strong', icon: <Siren /> },
  working: { tile: 'bg-info', icon: <Wrench /> },
  waiting: { tile: 'bg-warning', icon: <Hourglass /> },
}

/**
 * The chip over a machine: a status pin when it needs one, its code, and who is working on it. From afar a
 * pinned machine shows the pin alone, so neighbours do not cover each other; up close, hovered or selected,
 * the chip opens.
 */
function MachineTag({
  machine,
  selected,
  open,
}: {
  machine: SceneMachine
  selected: boolean
  open: boolean
}) {
  const pin = PIN[machine.state]
  const detail = !open && 'hidden group-data-[zoom=near]:flex'
  return (
    <span className="flex flex-col items-center">
      <span
        className={cn(
          'gap-1.5 p-1 flex items-center rounded-full shadow-float',
          selected ? 'bg-ink text-on-ink' : 'bg-card text-foreground',
          !pin && 'px-2.5',
        )}
      >
        {pin && (
          <span
            className={cn(
              'size-6 text-white [&_svg]:size-3.5 relative flex items-center justify-center rounded-full',
              pin.tile,
            )}
          >
            {machine.state === 'down' && (
              <span className="inset-0 motion-safe:animate-ping absolute rounded-full bg-accent/60" />
            )}
            <span className="relative flex">{pin.icon}</span>
          </span>
        )}
        <span className={cn('font-semibold font-mono text-[11px]', pin && 'pr-1', detail)}>
          {machine.code}
        </span>
        {machine.crew.length > 0 && (
          <span className={cn('-space-x-1.5 pr-0.5 flex', detail)}>
            {machine.crew.slice(0, 3).map((person) => (
              <Avatar
                key={person.name}
                name={person.name}
                color={person.color}
                size="xs"
                className="ring-2 ring-card"
              />
            ))}
          </span>
        )}
      </span>
      <span className="h-3 w-px bg-ink/30" />
    </span>
  )
}

function Ring({ color }: { color: string }) {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]}>
      <ringGeometry args={[2, 2.25, 48]} />
      <meshBasicMaterial color={color} />
    </mesh>
  )
}

function Machine({
  machine,
  selected,
  hovered,
  onHover,
  onSelect,
}: {
  machine: SceneMachine
  selected: boolean
  hovered: boolean
  onHover: (id: string | null) => void
  onSelect: (id: string) => void
}) {
  return (
    <group
      position={[machine.x, FLOOR, machine.z]}
      onClick={(e: ThreeEvent<MouseEvent>) => {
        e.stopPropagation()
        if (e.delta < 6) onSelect(machine.id)
      }}
      onPointerOver={(e) => {
        e.stopPropagation()
        onHover(machine.id)
      }}
      onPointerOut={() => onHover(null)}
    >
      {machineModel(machine.kind).draw(PALETTE[machine.state])}
      {(selected || hovered) && <Ring color={selected ? BRAND.ink : BRAND.silver} />}
    </group>
  )
}

const POLAR = 0.72
const AZIMUTH = 0.22
const HALF_FOV = (32 / 2) * (Math.PI / 180)
/** Room around the building in the opening view, as a share of the frame. */
const FRAME_MARGIN = 1.06

/**
 * The opening view: the whole building in frame, seen through its open front. On a portrait canvas the camera
 * looks in from the end instead, so the long side runs up the screen. The distance is the nearest one at
 * which every corner of the building fits the frame.
 */
function homeView(b: Bounds, aspect: number) {
  const azimuth = aspect < 1 ? Math.PI / 2 - AZIMUTH : AZIMUTH
  const toCamera = new Vector3(
    Math.sin(POLAR) * Math.sin(azimuth),
    Math.cos(POLAR),
    Math.sin(POLAR) * Math.cos(azimuth),
  )
  const right = new Vector3(0, 1, 0).cross(toCamera).normalize()
  const up = toCamera.clone().cross(right)
  const target = new Vector3((b.left + b.right) / 2, 0, (b.back + b.front) / 2)
  const tanY = Math.tan(HALF_FOV) / FRAME_MARGIN
  const tanX = tanY * aspect
  let distance = 40
  for (const x of [b.left, b.right]) {
    for (const y of [0, b.top]) {
      for (const z of [b.back, b.front]) {
        const corner = new Vector3(x, y, z).sub(target)
        const toward = corner.dot(toCamera)
        distance = Math.max(
          distance,
          toward + Math.abs(corner.dot(right)) / tanX,
          toward + Math.abs(corner.dot(up)) / tanY,
        )
      }
    }
  }
  return { distance, target, position: toCamera.multiplyScalar(distance).add(target) }
}

/** Orbit, pan and zoom, plus the page's commands. With reduced motion the camera jumps instead of flying. */
function CameraRig({
  layout,
  focus,
  apiRef,
}: {
  layout: PlantLayout
  focus: SceneMachine | null
  apiRef: RefObject<SceneApi | null>
}) {
  const controls = useRef<CameraControlsImpl>(null)
  const invalidate = useThree((state) => state.invalidate)
  const getState = useThree((state) => state.get)
  // The canvas reports a size only after its first measure; the home view needs the real aspect ratio.
  const measured = useThree((state) => state.size.width > 0 && state.size.height > 0)
  const animate = !useMediaQuery('(prefers-reduced-motion: reduce)')
  // The page hands in a new layout object after every store update; only a new building size moves the camera.
  const { width, depth } = layout

  useEffect(() => {
    const c = controls.current
    if (!c || !measured) return
    // The canvas size is read here, not tracked, so a later resize leaves the camera where the user put it.
    const { size } = getState()
    const b = buildingBounds({ width, depth })
    const home = homeView(b, size.width / size.height)
    // The camera may pan anywhere inside the building, never off into the void around it.
    c.setBoundary(new Box3(new Vector3(b.left, 0, b.back), new Vector3(b.right, b.top, b.front)))
    c.maxDistance = home.distance * 1.4
    void c.setLookAt(
      home.position.x,
      home.position.y,
      home.position.z,
      home.target.x,
      home.target.y,
      home.target.z,
      false,
    )
    c.saveState()
    invalidate()
  }, [width, depth, measured, getState, invalidate])

  useEffect(() => {
    // Camera methods only flag a change; with on-demand rendering each command asks for the frame itself.
    const run = (command: (c: CameraControlsImpl) => void) => {
      if (!controls.current) return
      command(controls.current)
      invalidate()
    }
    apiRef.current = {
      zoom: (direction) => run((c) => void c.dolly(direction * c.distance * 0.3, animate)),
      rotate: (direction) => run((c) => void c.rotate((direction * Math.PI) / 4, 0, animate)),
      reset: () => run((c) => void c.reset(animate)),
    }
    return () => {
      apiRef.current = null
    }
  }, [apiRef, animate, invalidate])

  useEffect(() => {
    const c = controls.current
    if (!c || !focus) return
    void c.moveTo(focus.x, 1, focus.z, animate)
    if (c.distance > 40) void c.dollyTo(40, animate)
    invalidate()
    // Only a new selection moves the camera; other re-renders hand in an equal machine.
  }, [focus?.id, animate, invalidate])

  return (
    <CameraControls
      ref={controls}
      makeDefault
      minDistance={10}
      minPolarAngle={0.2}
      maxPolarAngle={1.25}
      smoothTime={0.35}
      dollyToCursor
    />
  )
}

export default function PlantScene({ layout, machines, selectedId, onSelect, apiRef }: PlantSceneProps) {
  const [hoverId, setHoverId] = useState<string | null>(null)
  const anchors = useRef<Anchors>(new Map())
  const redraw = useRef<(() => void) | null>(null)
  useCursor(hoverId !== null)

  const reach = Math.max(layout.width, layout.depth) / 2 + 12
  const focus = machines.find((m) => m.id === selectedId) ?? null
  const base = useMemo(() => factoryLabels(layout), [layout])
  const labels: SceneLabel[] = [
    ...base,
    ...machines
      .filter((m) => PIN[m.state] || m.id === selectedId || m.id === hoverId)
      .map((m): SceneLabel => ({
        id: `machine:${m.id}`,
        at: [m.x, FLOOR + machineModel(m.kind).height + 0.4, m.z],
        anchor: 'center',
        content: (
          <MachineTag
            machine={m}
            selected={m.id === selectedId}
            open={m.id === selectedId || m.id === hoverId}
          />
        ),
      })),
  ]

  // New labels wait hidden for a frame; ask for one after every change.
  useLayoutEffect(() => {
    redraw.current?.()
  })

  return (
    <div className="relative size-full">
      <Canvas
        shadows="percentage"
        flat
        frameloop="demand"
        dpr={[1, 2]}
        camera={{ fov: 32, near: 1, far: 1200 }}
        gl={{ preserveDrawingBuffer: true }}
      >
        <color attach="background" args={[BRAND.surface2]} />
        <hemisphereLight args={[BRAND.card, BRAND.surface, 1.6]} />
        <directionalLight
          position={[reach * 0.6, reach * 1.2, reach * 0.8]}
          intensity={1.5}
          castShadow
          shadow-mapSize={[2048, 2048]}
          shadow-bias={-0.0004}
          shadow-normalBias={0.04}
          shadow-camera-left={-reach}
          shadow-camera-right={reach}
          shadow-camera-top={reach}
          shadow-camera-bottom={-reach}
          shadow-camera-far={reach * 4}
        />
        <Factory layout={layout} onBackgroundClick={() => onSelect(null)} />
        {machines.map((machine) => (
          <Machine
            key={machine.id}
            machine={machine}
            selected={machine.id === selectedId}
            hovered={machine.id === hoverId}
            onHover={setHoverId}
            onSelect={onSelect}
          />
        ))}
        <CameraRig layout={layout} focus={focus} apiRef={apiRef} />
        <LabelProjector anchors={anchors} redraw={redraw} />
      </Canvas>
      <LabelLayer labels={labels} anchors={anchors} />
    </div>
  )
}
