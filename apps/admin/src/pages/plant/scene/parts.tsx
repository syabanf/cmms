import { MeshStandardMaterial } from 'three'

export type Vec3 = [number, number, number]

/** Top of the hall floor slab: halls, zones and machines all stand on it. */
export const FLOOR = 0.25

const materials = new Map<string, MeshStandardMaterial>()

/** One shared matte material per colour, so thirty machines do not mean three hundred materials. */
function mat(color: string, flat = false): MeshStandardMaterial {
  const key = `${color}|${flat}`
  let material = materials.get(key)
  if (!material) {
    material = new MeshStandardMaterial({ color, roughness: 0.9, metalness: 0, flatShading: flat })
    materials.set(key, material)
  }
  return material
}

export function Block({
  size,
  at,
  color,
  rotation,
}: {
  size: Vec3
  at: Vec3
  color: string
  rotation?: Vec3
}) {
  return (
    <mesh position={at} rotation={rotation} material={mat(color)} castShadow receiveShadow>
      <boxGeometry args={size} />
    </mesh>
  )
}

const AXIS_ROTATION: Record<'x' | 'y' | 'z', Vec3> = {
  x: [0, 0, Math.PI / 2],
  y: [0, 0, 0],
  z: [Math.PI / 2, 0, 0],
}

export function Drum({
  radius,
  length,
  at,
  color,
  axis = 'y',
}: {
  radius: number
  length: number
  at: Vec3
  color: string
  axis?: 'x' | 'y' | 'z'
}) {
  return (
    <mesh position={at} rotation={AXIS_ROTATION[axis]} material={mat(color)} castShadow receiveShadow>
      <cylinderGeometry args={[radius, radius, length, 24]} />
    </mesh>
  )
}

/** A flat rectangle lying on the ground at height `y`. */
export function Patch({
  width,
  depth,
  at,
  color,
}: {
  width: number
  depth: number
  at: Vec3
  color: string
}) {
  return (
    <mesh position={at} rotation={[-Math.PI / 2, 0, 0]} material={mat(color)} receiveShadow>
      <planeGeometry args={[width, depth]} />
    </mesh>
  )
}
