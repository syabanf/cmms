import type { WorkOrder } from '@cmms/types'
import { toast } from '@cmms/ui'
import { type ReactNode, createContext, useContext, useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import { paths } from './links'
import { RequestDialog } from './RequestDialog'
import { type WoPreset, WorkOrderDialog } from './WorkOrderDialog'

interface CreateApi {
  /** Open the work order form. A preset with requestId converts that request. */
  workOrder: (preset?: WoPreset) => void
  editWorkOrder: (wo: WorkOrder) => void
  request: (assetId?: string) => void
}

const CreateContext = createContext<CreateApi | null>(null)

/** Hosts the work order and request dialogs so any page, menu or shortcut can open them. */
export function CreateProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate()
  const [wo, setWo] = useState<{ open: boolean; preset?: WoPreset; editing: WorkOrder | null }>({ open: false, editing: null })
  const [mr, setMr] = useState<{ open: boolean; assetId?: string }>({ open: false })

  const api = useMemo<CreateApi>(
    () => ({
      workOrder: (preset) => setWo({ open: true, preset, editing: null }),
      editWorkOrder: (editing) => setWo({ open: true, editing }),
      request: (assetId) => setMr({ open: true, assetId }),
    }),
    [],
  )

  return (
    <CreateContext.Provider value={api}>
      {children}
      <WorkOrderDialog
        open={wo.open}
        onOpenChange={(open) => setWo((s) => ({ ...s, open }))}
        preset={wo.preset}
        editing={wo.editing}
        onSaved={(saved) => {
          if (wo.editing) {
            toast('Work order updated', { tone: 'success' })
            return
          }
          toast(wo.preset?.requestId ? 'Request converted to a work order' : 'Work order created', { tone: 'success' })
          navigate(paths.workOrder(saved.id))
        }}
      />
      <RequestDialog
        open={mr.open}
        onOpenChange={(open) => setMr((s) => ({ ...s, open }))}
        assetId={mr.assetId}
        onSaved={() => toast('Request sent for triage', { tone: 'success', description: 'A supervisor reviews it before work starts.' })}
      />
    </CreateContext.Provider>
  )
}

export function useCreate() {
  const ctx = useContext(CreateContext)
  if (!ctx) throw new Error('useCreate must be used inside CreateProvider')
  return ctx
}
