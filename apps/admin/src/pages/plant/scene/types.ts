import type { AssetIconKey } from '@cmms/types'
import type { RefObject } from 'react'
import type { PlantLayout } from '../layout'
import type { MachineState } from '../lib'

export interface SceneMachine {
  id: string
  code: string
  x: number
  z: number
  kind: AssetIconKey | undefined
  state: MachineState
  crew: { name: string; color?: string }[]
}

/** Camera commands for the page's control pill. */
export interface SceneApi {
  zoom: (direction: 1 | -1) => void
  rotate: (direction: 1 | -1) => void
  reset: () => void
}

export interface PlantSceneProps {
  layout: PlantLayout
  machines: SceneMachine[]
  selectedId: string | null
  onSelect: (id: string | null) => void
  apiRef: RefObject<SceneApi | null>
}
