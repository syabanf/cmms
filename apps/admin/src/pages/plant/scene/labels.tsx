import { useFrame, useThree } from '@react-three/fiber'
import { cn } from '@cmms/ui'
import { type ReactNode, type RefObject, useEffect } from 'react'
import { Vector3 } from 'three'
import type { Vec3 } from './parts'

export interface SceneLabel {
  id: string
  at: Vec3
  /** `center` sits on the point by its bottom centre, `left` by its bottom left corner. */
  anchor: 'center' | 'left'
  content: ReactNode
}

export type Anchors = Map<string, { el: HTMLElement; at: Vec3 }>

const point = new Vector3()

/**
 * Screen pixels per metre at an anchor's spot where its `data-zoom` turns from `far` to `mid` and from `mid`
 * to `near`, so a label can show more as the plant grows on screen.
 */
const MID = 5
const NEAR = 20

/**
 * Plain DOM labels over the canvas, in the page's own React tree. The projector inside the canvas moves
 * them each frame; until their first frame they stay hidden.
 */
export function LabelLayer({ labels, anchors }: { labels: SceneLabel[]; anchors: RefObject<Anchors> }) {
  return (
    <div aria-hidden="true" className="inset-0 pointer-events-none absolute overflow-hidden select-none">
      {labels.map((label) => (
        <div
          key={label.id}
          ref={(el) => {
            if (!el) return
            anchors.current.set(label.id, { el, at: label.at })
            return () => {
              anchors.current.delete(label.id)
            }
          }}
          className="group left-0 top-0 invisible absolute will-change-transform"
        >
          <div
            className={cn(
              '-translate-y-full whitespace-nowrap',
              label.anchor === 'center' && '-translate-x-1/2',
            )}
          >
            {label.content}
          </div>
        </div>
      ))}
    </div>
  )
}

/** Projects every label onto the screen each time the scene renders, and hands out the scene's redraw. */
export function LabelProjector({
  anchors,
  redraw,
}: {
  anchors: RefObject<Anchors>
  redraw: RefObject<(() => void) | null>
}) {
  const invalidate = useThree((state) => state.invalidate)
  useEffect(() => {
    redraw.current = invalidate
    return () => {
      redraw.current = null
    }
  }, [invalidate, redraw])
  useFrame(({ camera, size }) => {
    // Pixels per metre at one metre from the camera: half the canvas height over tan(fov / 2).
    const unit = (size.height / 2) * camera.projectionMatrix.elements[5]!
    for (const { el, at } of anchors.current.values()) {
      point.set(at[0], at[1], at[2])
      const scale = unit / camera.position.distanceTo(point)
      const zoom = scale >= NEAR ? 'near' : scale >= MID ? 'mid' : 'far'
      if (el.dataset.zoom !== zoom) el.dataset.zoom = zoom
      point.project(camera)
      const onScreen = point.z < 1 && Math.abs(point.x) < 1.1 && Math.abs(point.y) < 1.1
      el.style.visibility = onScreen ? 'visible' : 'hidden'
      el.style.transform = `translate3d(${((point.x + 1) / 2) * size.width}px, ${((1 - point.y) / 2) * size.height}px, 0)`
    }
  })
  return null
}
