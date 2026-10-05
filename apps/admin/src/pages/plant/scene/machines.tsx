import type { AssetIconKey } from '@cmms/types'
import type { ReactNode } from 'react'
import { BRAND } from '../../../lib/brand'
import type { MachineState } from '../lib'
import { Block, Drum } from './parts'

interface Palette {
  body: string
  trim: string
  dark: string
}

const NORMAL: Palette = { body: BRAND.card, trim: BRAND.chartMuted, dark: BRAND.ink3 }

/** A down machine is the one accent in the scene; standby reads as switched off. */
export const PALETTE: Record<MachineState, Palette> = {
  running: NORMAL,
  working: NORMAL,
  waiting: NORMAL,
  standby: { body: BRAND.chartMuted, trim: BRAND.silver, dark: BRAND.muted },
  down: { body: BRAND.accentSoft, trim: BRAND.accent, dark: BRAND.ink3 },
}

interface Model {
  /** Top of the model, where its pin floats. */
  height: number
  draw: (p: Palette) => ReactNode
}

const WHEELS: [number, number][] = [
  [-0.6, 0.6],
  [0.6, 0.6],
  [-0.6, -0.5],
  [0.6, -0.5],
]

// Low-poly stand-ins in metres, origin on the floor at the machine's centre, front facing +z.
const MODELS: Partial<Record<AssetIconKey, Model>> = {
  lathe: {
    height: 1.5,
    draw: (p) => (
      <>
        <Block size={[2.8, 0.9, 1.1]} at={[0, 0.45, 0]} color={p.body} />
        <Block size={[0.7, 0.65, 1]} at={[-1, 1.22, 0]} color={p.trim} />
        <Block size={[1.9, 0.6, 0.85]} at={[0.35, 1.2, 0.05]} color={p.dark} />
        <Block size={[0.4, 0.55, 0.12]} at={[1.15, 1.2, 0.6]} color={p.trim} />
      </>
    ),
  },
  mill: {
    height: 2.4,
    draw: (p) => (
      <>
        <Block size={[2.2, 1.9, 1.9]} at={[0, 0.95, 0]} color={p.body} />
        <Block size={[1.2, 1.1, 0.05]} at={[-0.2, 1.05, 0.96]} color={p.dark} />
        <Block size={[0.9, 0.5, 0.9]} at={[0, 2.15, -0.3]} color={p.trim} />
        <Block size={[0.35, 0.7, 0.15]} at={[0.85, 1.25, 1]} color={p.trim} />
      </>
    ),
  },
  press: {
    height: 3.2,
    draw: (p) => (
      <>
        <Block size={[1.9, 0.7, 1.3]} at={[0, 0.35, 0]} color={p.body} />
        <Block size={[0.35, 2.1, 0.5]} at={[-0.75, 1.75, 0]} color={p.body} />
        <Block size={[0.35, 2.1, 0.5]} at={[0.75, 1.75, 0]} color={p.body} />
        <Block size={[1.9, 0.55, 1.1]} at={[0, 2.9, 0]} color={p.trim} />
        <Block size={[1, 0.4, 0.8]} at={[0, 2, 0]} color={p.dark} />
      </>
    ),
  },
  molding: {
    height: 2,
    draw: (p) => (
      <>
        <Block size={[3.2, 0.9, 1.2]} at={[0, 0.45, 0]} color={p.body} />
        <Block size={[1.2, 0.9, 1.1]} at={[-0.9, 1.35, 0]} color={p.trim} />
        <Drum radius={0.18} length={1.5} at={[0.65, 1.15, 0]} color={p.dark} axis="x" />
        <Drum radius={0.28} length={0.5} at={[0.9, 1.6, 0]} color={p.trim} />
      </>
    ),
  },
  oven: {
    height: 2.7,
    draw: (p) => (
      <>
        <Block size={[2.6, 1.8, 2]} at={[0, 0.9, 0]} color={p.body} />
        <Block size={[1.6, 1.3, 0.05]} at={[0, 0.85, 1.01]} color={p.trim} />
        <Drum radius={0.18} length={0.9} at={[0.8, 2.25, -0.5]} color={p.trim} />
      </>
    ),
  },
  booth: {
    height: 2.4,
    draw: (p) => (
      <>
        <Block size={[2.4, 2.2, 0.15]} at={[0, 1.1, -1]} color={p.body} />
        <Block size={[0.15, 2.2, 2.1]} at={[-1.15, 1.1, 0]} color={p.body} />
        <Block size={[0.15, 2.2, 2.1]} at={[1.15, 1.1, 0]} color={p.body} />
        <Block size={[2.4, 0.15, 2.1]} at={[0, 2.25, 0]} color={p.trim} />
        <Block size={[2.1, 0.08, 1.9]} at={[0, 0.04, 0]} color={p.dark} />
      </>
    ),
  },
  conveyor: {
    height: 1.1,
    draw: (p) => (
      <>
        <Block size={[3.8, 0.12, 0.8]} at={[0, 0.82, 0]} color={p.dark} />
        <Block size={[3.9, 0.14, 0.08]} at={[0, 0.78, 0.44]} color={p.trim} />
        <Block size={[3.9, 0.14, 0.08]} at={[0, 0.78, -0.44]} color={p.trim} />
        {[-1.6, 0, 1.6].map((x) => (
          <Block key={x} size={[0.1, 0.75, 0.7]} at={[x, 0.37, 0]} color={p.body} />
        ))}
      </>
    ),
  },
  robot: {
    height: 2.2,
    draw: (p) => (
      <>
        <Block size={[1.4, 0.1, 1.4]} at={[0, 0.05, 0]} color={p.trim} />
        <Drum radius={0.35} length={0.6} at={[0, 0.4, 0]} color={p.body} />
        <Block size={[0.3, 1.1, 0.3]} at={[0.15, 1.15, 0]} color={p.body} rotation={[0, 0, -0.35]} />
        <Block size={[0.9, 0.25, 0.25]} at={[0.6, 1.75, 0]} color={p.body} rotation={[0, 0, 0.3]} />
        <Block size={[0.2, 0.3, 0.2]} at={[1.05, 1.6, 0]} color={p.dark} />
      </>
    ),
  },
  tester: {
    height: 1.7,
    draw: (p) => (
      <>
        <Block size={[1.5, 1.3, 1.1]} at={[0, 0.65, 0]} color={p.body} />
        <Block size={[0.6, 0.4, 0.05]} at={[0.2, 1.05, 0.56]} color={p.dark} />
        <Block size={[0.8, 0.3, 0.8]} at={[-0.2, 1.45, 0]} color={p.trim} />
      </>
    ),
  },
  packer: {
    height: 1.9,
    draw: (p) => (
      <>
        <Block size={[1.6, 0.8, 1.3]} at={[0, 0.4, 0]} color={p.body} />
        <Block size={[0.15, 1, 1.3]} at={[-0.7, 1.3, 0]} color={p.trim} />
        <Block size={[0.15, 1, 1.3]} at={[0.7, 1.3, 0]} color={p.trim} />
        <Block size={[1.55, 0.15, 1.3]} at={[0, 1.8, 0]} color={p.trim} />
      </>
    ),
  },
  forklift: {
    height: 2.4,
    draw: (p) => (
      <>
        <Block size={[1.1, 0.7, 1.9]} at={[0, 0.55, 0.1]} color={p.body} />
        <Block size={[1, 0.08, 1]} at={[0, 2.1, 0.2]} color={p.trim} />
        <Block size={[0.08, 1.4, 0.08]} at={[-0.45, 1.4, 0.65]} color={p.trim} />
        <Block size={[0.08, 1.4, 0.08]} at={[0.45, 1.4, 0.65]} color={p.trim} />
        <Block size={[0.1, 2, 0.1]} at={[-0.3, 1, -0.95]} color={p.dark} />
        <Block size={[0.1, 2, 0.1]} at={[0.3, 1, -0.95]} color={p.dark} />
        <Block size={[0.12, 0.06, 1]} at={[-0.25, 0.1, -1.45]} color={p.dark} />
        <Block size={[0.12, 0.06, 1]} at={[0.25, 0.1, -1.45]} color={p.dark} />
        {WHEELS.map(([x, z]) => (
          <Drum key={`${x}${z}`} radius={0.25} length={0.2} at={[x, 0.25, z]} color={p.dark} axis="x" />
        ))}
      </>
    ),
  },
  compressor: {
    height: 1.6,
    draw: (p) => (
      <>
        <Block size={[2.4, 0.15, 1.2]} at={[0, 0.075, 0]} color={p.trim} />
        <Drum radius={0.5} length={1.9} at={[0, 0.7, 0]} color={p.body} axis="x" />
        <Block size={[0.7, 0.6, 0.7]} at={[0.55, 1.4, 0]} color={p.trim} />
      </>
    ),
  },
  dryer: {
    height: 1.9,
    draw: (p) => (
      <>
        <Block size={[1.4, 0.1, 0.9]} at={[0, 0.05, 0]} color={p.trim} />
        <Drum radius={0.3} length={1.7} at={[-0.35, 0.95, 0]} color={p.body} />
        <Drum radius={0.3} length={1.7} at={[0.35, 0.95, 0]} color={p.body} />
      </>
    ),
  },
  panel: {
    height: 2.1,
    draw: (p) => (
      <>
        <Block size={[1.8, 2, 0.6]} at={[0, 1, 0]} color={p.body} />
        <Block size={[0.03, 1.8, 0.02]} at={[0, 1, 0.31]} color={p.trim} />
        <Block size={[0.5, 0.3, 0.02]} at={[-0.45, 1.5, 0.31]} color={p.dark} />
      </>
    ),
  },
  genset: {
    height: 2,
    draw: (p) => (
      <>
        <Block size={[2.8, 1.4, 1.3]} at={[0, 0.7, 0]} color={p.body} />
        <Block size={[0.8, 0.9, 0.05]} at={[-0.8, 0.75, 0.66]} color={p.trim} />
        <Drum radius={0.12} length={0.6} at={[1.1, 1.7, -0.3]} color={p.dark} />
      </>
    ),
  },
  chiller: {
    height: 1.6,
    draw: (p) => (
      <>
        <Block size={[2.6, 1.3, 1.3]} at={[0, 0.65, 0]} color={p.body} />
        <Drum radius={0.42} length={0.12} at={[-0.6, 1.36, 0]} color={p.dark} />
        <Drum radius={0.42} length={0.12} at={[0.6, 1.36, 0]} color={p.dark} />
      </>
    ),
  },
  tower: {
    height: 2.7,
    draw: (p) => (
      <>
        <Drum radius={1} length={2.2} at={[0, 1.1, 0]} color={p.body} />
        <Drum radius={0.75} length={0.25} at={[0, 2.32, 0]} color={p.dark} />
      </>
    ),
  },
  pump: {
    height: 1,
    draw: (p) => (
      <>
        <Block size={[1.4, 0.15, 0.7]} at={[0, 0.075, 0]} color={p.trim} />
        <Drum radius={0.28} length={0.7} at={[-0.3, 0.45, 0]} color={p.body} axis="x" />
        <Drum radius={0.32} length={0.35} at={[0.35, 0.45, 0]} color={p.dark} axis="z" />
      </>
    ),
  },
  polisher: {
    height: 1.7,
    draw: (p) => (
      <>
        <Block size={[1.8, 0.9, 1.4]} at={[0, 0.45, 0]} color={p.body} />
        <Drum radius={0.45} length={0.15} at={[0, 0.98, 0]} color={p.dark} />
        <Block size={[0.25, 0.7, 0.25]} at={[-0.6, 1.25, -0.4]} color={p.trim} />
        <Block size={[0.9, 0.18, 0.25]} at={[-0.2, 1.55, -0.4]} color={p.trim} />
      </>
    ),
  },
  scale: {
    height: 1.2,
    draw: (p) => (
      <>
        <Block size={[1.2, 0.12, 1.2]} at={[0, 0.06, 0]} color={p.trim} />
        <Block size={[0.08, 0.9, 0.08]} at={[-0.5, 0.55, -0.5]} color={p.dark} />
        <Block size={[0.4, 0.3, 0.12]} at={[-0.5, 1, -0.45]} color={p.body} />
      </>
    ),
  },
}

const FALLBACK: Model = {
  height: 1.4,
  draw: (p) => <Block size={[1.6, 1.3, 1.4]} at={[0, 0.65, 0]} color={p.body} />,
}

export const machineModel = (kind: AssetIconKey | undefined): Model => (kind && MODELS[kind]) || FALLBACK
