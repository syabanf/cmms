import { Button, Tooltip, cn } from '@cmms/ui'
import { House, Minus, Plus, RotateCcw, RotateCw } from 'lucide-react'
import type { ReactNode, RefObject } from 'react'
import type { SceneApi } from './scene/types'

const GROUPS: { label: string; icon: ReactNode; run: (api: SceneApi) => void }[][] = [
  [
    { label: 'Zoom in', icon: <Plus />, run: (api) => api.zoom(1) },
    { label: 'Zoom out', icon: <Minus />, run: (api) => api.zoom(-1) },
  ],
  [
    { label: 'Rotate left', icon: <RotateCcw />, run: (api) => api.rotate(-1) },
    { label: 'Rotate right', icon: <RotateCw />, run: (api) => api.rotate(1) },
    { label: 'Reset view', icon: <House />, run: (api) => api.reset() },
  ],
]

/** The camera pill on the 3D view: zoom, rotate and back to the whole site. */
export function SceneControls({
  apiRef,
  className,
}: {
  apiRef: RefObject<SceneApi | null>
  className?: string
}) {
  return (
    <div
      role="toolbar"
      aria-label="3D view"
      aria-orientation="vertical"
      className={cn(
        'gap-1 p-1 flex flex-col items-center rounded-full bg-card shadow-card print:hidden',
        className,
      )}
    >
      {GROUPS.map((group, i) => (
        <div key={i} className={cn('gap-1 flex flex-col', i > 0 && 'pt-1 border-t border-border')}>
          {group.map((control) => (
            <Tooltip key={control.label} content={control.label} side="left">
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={control.label}
                onClick={() => apiRef.current && control.run(apiRef.current)}
              >
                {control.icon}
              </Button>
            </Tooltip>
          ))}
        </div>
      ))}
    </div>
  )
}
