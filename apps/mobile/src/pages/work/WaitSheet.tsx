import type { WaitingReason, WorkOrder } from '@cmms/types'
import { WAITING_REASONS, WAITING_REASON_LABEL } from '@cmms/types'
import { Button, FormField, Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, Textarea, cn, toast } from '@cmms/ui'
import { Pause } from 'lucide-react'
import { useState } from 'react'
import { useMobileScope } from '../../state/scope'

export function WaitSheet({ wo, open, onOpenChange }: { wo: WorkOrder; open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom">
        <WaitForm wo={wo} onDone={() => onOpenChange(false)} />
      </SheetContent>
    </Sheet>
  )
}

function WaitForm({ wo, onDone }: { wo: WorkOrder; onDone: () => void }) {
  const { dispatch } = useMobileScope()
  const [reason, setReason] = useState<WaitingReason | null>(null)
  const [note, setNote] = useState('')

  const pause = () => {
    if (!reason) return
    dispatch({ type: 'workOrders/wait', id: wo.id, reason, note: note.trim() })
    toast(`Paused: waiting for ${WAITING_REASON_LABEL[reason].toLowerCase()}`, { description: 'Every running clock on this job stopped.' })
    onDone()
  }

  return (
    <>
      <SheetHeader>
        <SheetTitle>Pause the work</SheetTitle>
        <SheetDescription>Tell the planner what you are waiting for. Clocks stop until someone resumes the job.</SheetDescription>
      </SheetHeader>
      <div className="space-y-4 px-5 pb-2">
        <div role="radiogroup" aria-label="Waiting for" className="grid grid-cols-2 gap-2">
          {WAITING_REASONS.map((r) => (
            <button
              key={r}
              type="button"
              role="radio"
              aria-checked={reason === r}
              onClick={() => setReason(r)}
              className={cn(
                'flex min-h-12 items-center rounded-2xl px-4 py-2 text-left text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 active:scale-[0.98]',
                reason === r ? 'bg-ink text-on-ink' : 'bg-surface-2 text-body hover:bg-surface',
              )}
            >
              {WAITING_REASON_LABEL[r]}
            </button>
          ))}
        </div>
        <FormField label="Note" hint="Part numbers, PO or vendor name help the planner follow up.">
          <Textarea variant="soft" value={note} placeholder="Bearing 6204 out of stock, PO raised" onChange={(e) => setNote(e.target.value)} />
        </FormField>
        <Button size="lg" className="w-full" disabled={!reason} onClick={pause}>
          <Pause />
          Pause work
        </Button>
      </div>
    </>
  )
}
