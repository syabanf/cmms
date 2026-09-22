import { fmtNumber } from '@cmms/fixtures'
import type { StockTxnKind } from '@cmms/types'
import {
  Banner,
  Button,
  Combobox,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  FormField,
  Input,
  toast,
} from '@cmms/ui'
import { type FormEvent, useState } from 'react'
import { PartPicker } from '../../components/pickers'
import { useScoped } from '../../state/scoped'
import { parseQuantity } from './lib'

export type MoveKind = Exclude<StockTxnKind, 'return'>

const COPY: Record<MoveKind, { title: string; description: string; submit: string }> = {
  receive: {
    title: 'Receive stock',
    description: 'Book delivered parts into a warehouse. The ledger keeps the purchase order reference.',
    submit: 'Receive',
  },
  adjust: {
    title: 'Adjust count',
    description: 'Enter what is on the shelf. The difference posts to the ledger as an adjustment.',
    submit: 'Post adjustment',
  },
  issue: {
    title: 'Issue without work order',
    description: 'Hand out parts for work that has no work order, such as workshop use or a trial.',
    submit: 'Issue',
  },
}

export function StockMoveDialog({
  kind,
  open,
  onOpenChange,
  partId = null,
  lockPart = false,
}: {
  kind: MoveKind
  open: boolean
  onOpenChange: (open: boolean) => void
  partId?: string | null
  /** Show the part as fixed, for dialogs opened from a part page. */
  lockPart?: boolean
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>{open && <MoveForm kind={kind} initialPartId={partId} lockPart={lockPart} onDone={() => onOpenChange(false)} />}</DialogContent>
    </Dialog>
  )
}

function MoveForm({ kind, initialPartId, lockPart, onDone }: { kind: MoveKind; initialPartId: string | null; lockPart: boolean; onDone: () => void }) {
  const { warehouses, stock, maps, dispatch } = useScoped()
  const [partId, setPartId] = useState(initialPartId)
  const [warehouseId, setWarehouseId] = useState<string | null>(() => {
    const held = stock.find((s) => s.partId === initialPartId)
    return held?.warehouseId ?? warehouses[0]?.id ?? null
  })
  const [qty, setQty] = useState('')
  const [ref, setRef] = useState('')
  const [note, setNote] = useState('')
  const [tried, setTried] = useState(false)

  const part = partId ? maps.part.get(partId) : undefined
  const row = stock.find((s) => s.partId === partId && s.warehouseId === warehouseId)
  const onHand = row?.onHand ?? 0
  const reserved = row?.reserved ?? 0
  const amount = parseQuantity(qty)
  const unit = part?.unit ?? ''
  const delta = amount === null ? 0 : kind === 'receive' ? amount : kind === 'issue' ? -amount : amount - onHand

  const qtyError =
    amount === null
      ? kind === 'adjust'
        ? 'Enter the counted quantity.'
        : 'Enter a quantity.'
      : kind === 'adjust'
        ? amount === onHand
          ? `Matches the system count of ${fmtNumber(onHand)}. Nothing to post.`
          : undefined
        : amount <= 0
          ? 'Enter a quantity above zero.'
          : kind === 'issue' && amount > onHand
            ? `Only ${fmtNumber(onHand)} ${unit} on hand in this warehouse.`
            : undefined
  const errors = {
    part: partId ? undefined : 'Choose the part.',
    warehouse: warehouseId ? undefined : 'Choose the warehouse.',
    qty: qtyError,
    ref: kind === 'issue' && !ref.trim() ? 'Say who takes the parts.' : undefined,
    note: kind !== 'receive' && !note.trim() ? (kind === 'adjust' ? 'Say why the count differs.' : 'Say what the parts are for.') : undefined,
  }
  const show = (error: string | undefined) => (tried ? error : undefined)
  const eatsReservation = kind === 'issue' && amount !== null && amount <= onHand && amount > onHand - reserved

  const submit = (e: FormEvent) => {
    e.preventDefault()
    setTried(true)
    if (!part || !warehouseId || Object.values(errors).some(Boolean)) return
    const warehouse = maps.warehouse.get(warehouseId)?.name ?? 'the warehouse'
    const after = onHand + delta
    dispatch({
      type: 'stock/move',
      partId: part.id,
      warehouseId,
      kind,
      qty: delta,
      ref: kind === 'adjust' ? 'Cycle count' : ref.trim(),
      note: note.trim(),
    })
    if (kind === 'receive') {
      toast(`Received ${fmtNumber(delta)} ${unit} ${part.code}`, {
        tone: 'success',
        description: row?.bin ? `${warehouse}, ${row.bin}. On hand ${fmtNumber(after)}.` : `${warehouse}. On hand ${fmtNumber(after)}. Set a bin on the part page.`,
      })
    } else if (kind === 'adjust') {
      toast(`Count adjusted by ${delta > 0 ? '+' : ''}${fmtNumber(delta)} ${unit}`, { tone: 'success', description: `${part.code} in ${warehouse}. On hand ${fmtNumber(after)}.` })
    } else {
      toast(`Issued ${fmtNumber(-delta)} ${unit} ${part.code}`, { tone: 'success', description: `To ${ref.trim()}. On hand ${fmtNumber(after)} in ${warehouse}.` })
    }
    onDone()
  }

  const copy = COPY[kind]
  return (
    <form onSubmit={submit} noValidate>
      <DialogHeader>
        <DialogTitle>{copy.title}</DialogTitle>
        <DialogDescription>{copy.description}</DialogDescription>
      </DialogHeader>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FormField label="Part" required htmlFor="move-part" error={show(errors.part)} className="sm:col-span-2">
          <PartPicker id="move-part" value={partId} disabled={lockPart} onChange={setPartId} />
        </FormField>
        <FormField
          label="Warehouse"
          required
          htmlFor="move-warehouse"
          error={show(errors.warehouse)}
          hint={part ? (row ? `On hand ${fmtNumber(onHand)}, reserved ${fmtNumber(reserved)}${row.bin ? `, bin ${row.bin}` : ''}` : 'No stock record here yet.') : undefined}
          className="sm:col-span-2"
        >
          <Combobox
            id="move-warehouse"
            items={warehouses}
            value={warehouseId}
            onChange={setWarehouseId}
            getKey={(w) => w.id}
            getLabel={(w) => w.name}
            getDescription={(w) => {
              const held = stock.find((s) => s.partId === partId && s.warehouseId === w.id)
              return held ? `${w.code} · ${fmtNumber(held.onHand)} on hand` : w.code
            }}
            placeholder="Select warehouse"
            searchPlaceholder="Search warehouses"
          />
        </FormField>

        <FormField
          label={kind === 'adjust' ? 'Counted quantity' : 'Quantity'}
          required
          htmlFor="move-qty"
          error={show(errors.qty)}
          hint={kind === 'adjust' && amount !== null && amount !== onHand ? `Posts ${delta > 0 ? '+' : ''}${fmtNumber(delta)} ${unit} against ${fmtNumber(onHand)} in the system.` : unit ? `In ${unit}` : undefined}
        >
          <Input id="move-qty" type="number" min={0} inputMode="decimal" value={qty} onChange={(e) => setQty(e.target.value)} />
        </FormField>
        {kind === 'receive' && (
          <FormField label="Purchase order" htmlFor="move-ref">
            <Input id="move-ref" value={ref} placeholder="PO-2026-0412" onChange={(e) => setRef(e.target.value)} />
          </FormField>
        )}
        {kind === 'issue' && (
          <FormField label="Issued to" required htmlFor="move-ref" error={show(errors.ref)}>
            <Input id="move-ref" value={ref} placeholder="Workshop, line 2" onChange={(e) => setRef(e.target.value)} />
          </FormField>
        )}

        <FormField
          label={kind === 'adjust' ? 'Reason' : kind === 'issue' ? 'Purpose' : 'Note'}
          required={kind !== 'receive'}
          htmlFor="move-note"
          error={show(errors.note)}
          className="sm:col-span-2"
        >
          <Input
            id="move-note"
            value={note}
            placeholder={kind === 'adjust' ? 'Two found damaged during the count' : kind === 'issue' ? 'Spare for the jig rebuild' : 'Partial delivery, rest due next week'}
            onChange={(e) => setNote(e.target.value)}
          />
        </FormField>

        {eatsReservation && (
          <Banner tone="warning" title="This takes reserved stock" className="sm:col-span-2">
            {fmtNumber(reserved)} {unit} are held for work orders. Issuing {fmtNumber(amount)} leaves them short.
          </Banner>
        )}
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit">{copy.submit}</Button>
      </DialogFooter>
    </form>
  )
}
