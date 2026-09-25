import { isActive, toMs, toolBlockReason } from '@cmms/fixtures'
import type { Tool, ToolCondition, WorkOrder } from '@cmms/types'
import { WO_STATUS_LABEL } from '@cmms/types'
import {
  Button,
  Combobox,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  FormField,
  SegmentedControl,
  Textarea,
  toast,
} from '@cmms/ui'
import { type FormEvent, useMemo, useState } from 'react'
import { PersonPicker } from '../../components/pickers'
import { useScoped } from '../../state/scoped'
import { CONDITION_OPTIONS, asCondition } from './lib'

type MoveDialogProps = { tool: Tool; open: boolean; onOpenChange: (open: boolean) => void }

export function CheckoutDialog({ tool, open, onOpenChange }: MoveDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <CheckoutForm tool={tool} onDone={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  )
}

function CheckoutForm({ tool, onDone }: { tool: Tool; onDone: () => void }) {
  const { workOrders, maps, dispatch, personName } = useScoped()
  const [holderId, setHolderId] = useState<string | null>(null)
  const [woId, setWoId] = useState<string | null>(null)
  const [tried, setTried] = useState(false)
  // The page only offers checkout for a free tool; this catches a calibration that expires while the dialog is open.
  const blocked = toolBlockReason(tool)

  // Work orders that call for this kind of tool come first.
  const candidates = useMemo(() => {
    const needs = (w: WorkOrder) => Number(w.requiredTools.includes(tool.category))
    return workOrders.filter(isActive).sort((a, b) => needs(b) - needs(a) || toMs(a.dueAt) - toMs(b.dueAt))
  }, [workOrders, tool.category])

  const pickWo = (id: string | null) => {
    setWoId(id)
    const lead = id ? maps.workOrder.get(id)?.assigneeIds[0] : undefined
    if (!holderId && lead) setHolderId(lead)
  }

  const submit = (e: FormEvent) => {
    e.preventDefault()
    setTried(true)
    if (!holderId || blocked) return
    const wo = woId ? maps.workOrder.get(woId) : undefined
    // With a work order, assignTool records the holder and puts the tool on the job in one step.
    if (wo) dispatch({ type: 'workOrders/assignTool', id: wo.id, toolId: tool.id, holderId })
    else dispatch({ type: 'tools/checkout', id: tool.id, holderId, woId: null })
    toast(`${tool.code} checked out to ${personName(holderId)}`, {
      tone: 'success',
      description: wo ? `For ${wo.code}, ${wo.title}` : 'No work order linked',
    })
    onDone()
  }

  return (
    <form onSubmit={submit} noValidate>
      <DialogHeader>
        <DialogTitle>Check out {tool.code}</DialogTitle>
        <DialogDescription>
          {tool.name} leaves {tool.location || 'the tool crib'} until someone checks it in.
        </DialogDescription>
      </DialogHeader>

      <div className="grid grid-cols-1 gap-4">
        <FormField label="Holder" required error={tried && !holderId ? 'Pick who takes the tool' : undefined}>
          <PersonPicker value={holderId} onChange={setHolderId} placeholder="Who takes it" />
        </FormField>
        <FormField label="Work order" hint="The tool returns to the crib when that work order completes.">
          <Combobox
            clearable
            items={candidates}
            value={woId}
            onChange={pickWo}
            getKey={(w) => w.id}
            getLabel={(w) => `${w.code} · ${w.title}`}
            getDescription={(w) =>
              [maps.asset.get(w.assetId)?.code, WO_STATUS_LABEL[w.status], w.requiredTools.includes(tool.category) ? `Needs a ${tool.category.toLowerCase()}` : null]
                .filter(Boolean)
                .join(' · ')
            }
            getKeywords={(w) => [maps.asset.get(w.assetId)?.name ?? '', ...w.assigneeIds.map(personName)]}
            placeholder="No work order"
            searchPlaceholder="Search code, title or asset"
          />
        </FormField>
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" disabled={!!blocked} title={blocked ?? undefined}>
          Check out
        </Button>
      </DialogFooter>
    </form>
  )
}

export function CheckinDialog({ tool, open, onOpenChange }: MoveDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <CheckinForm tool={tool} onDone={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  )
}

function CheckinForm({ tool, onDone }: { tool: Tool; onDone: () => void }) {
  const { maps, dispatch, personName } = useScoped()
  const [condition, setCondition] = useState<ToolCondition>(tool.condition)
  const [note, setNote] = useState('')
  const wo = tool.woId ? maps.workOrder.get(tool.woId) : undefined

  const submit = (e: FormEvent) => {
    e.preventDefault()
    // One return in the log: checkin also takes the tool off its work order.
    dispatch({ type: 'tools/checkin', id: tool.id, condition, note: note.trim() })
    toast(`${tool.code} checked in`, {
      tone: 'success',
      description: condition === 'poor' ? 'Condition is poor, so it went to repair.' : `Back at ${tool.location || 'the tool crib'}`,
    })
    onDone()
  }

  return (
    <form onSubmit={submit}>
      <DialogHeader>
        <DialogTitle>Check in {tool.code}</DialogTitle>
        <DialogDescription>
          Returned by {personName(tool.holderId)}
          {wo ? ` from ${wo.code}` : ''}.
        </DialogDescription>
      </DialogHeader>

      <div className="grid grid-cols-1 gap-4">
        <FormField label="Condition on return" hint={condition === 'poor' ? 'A poor tool goes to repair instead of back on the shelf.' : undefined}>
          <SegmentedControl
            className="w-full"
            aria-label="Condition on return"
            value={condition}
            onChange={(value) => setCondition(asCondition(value))}
            options={CONDITION_OPTIONS}
          />
        </FormField>
        <FormField label="Note" hint="Damage, missing parts, anything the next holder should know.">
          <Textarea value={note} placeholder="Optional" onChange={(e) => setNote(e.target.value)} />
        </FormField>
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit">Check in</Button>
      </DialogFooter>
    </form>
  )
}
