import { addMonths, dayKey, fmtDate, fromDayKey, fromInput, newId, nowMs, plural } from '@cmms/fixtures'
import type { CalibrationResult } from '@cmms/types'
import { CALIBRATION_RESULT_LABEL } from '@cmms/types'
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  FormField,
  Input,
  SegmentedControl,
  Textarea,
  toast,
} from '@cmms/ui'
import { type FormEvent, useState } from 'react'
import { VendorPicker } from '../../components/pickers'
import { useScoped } from '../../state/scoped'
import type { CalTarget } from './lib'

const RESULTS: CalibrationResult[] = ['pass', 'adjusted', 'fail']
const RESULT_TONE = { pass: 'success', adjusted: 'default', fail: 'danger' } as const

/** Records a certificate for an instrument or a tool and moves its plan to the next due date. */
export function RecordCalibrationDialog({
  target,
  open,
  onOpenChange,
}: {
  target: CalTarget | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">{target && <RecordForm target={target} onDone={() => onOpenChange(false)} />}</DialogContent>
    </Dialog>
  )
}

function RecordForm({ target, onDone }: { target: CalTarget; onDone: () => void }) {
  const { dispatch, maps, user } = useScoped()
  const today = dayKey(nowMs())
  const interval = target.plan.intervalMonths
  const vendorName = (id: string | null) => (id ? (maps.vendor.get(id)?.name ?? '') : user.name)
  // A tool at calibration comes back to the crib when its record is saved.
  const away = target.kind === 'tool' && target.status === 'calibration'

  const [date, setDate] = useState(today)
  const [result, setResult] = useState<CalibrationResult>('pass')
  const [vendorId, setVendorId] = useState(target.plan.vendorId)
  const [performedBy, setPerformedBy] = useState(() => vendorName(target.plan.vendorId))
  const [certificateNo, setCertificateNo] = useState('')
  const [customDue, setCustomDue] = useState<string | null>(null)
  const [notes, setNotes] = useState('')
  const [tried, setTried] = useState(false)

  const intervalDue = date ? dayKey(addMonths(fromDayKey(date), interval)) : ''
  // A failed calibration keeps the item expired until one passes.
  const nextDue = result === 'fail' ? date : (customDue ?? intervalDue)

  const errors = {
    date: !date ? 'Pick the calibration date' : date > today ? 'The date cannot be in the future' : null,
    nextDue: result !== 'fail' && (!nextDue || nextDue <= date) ? 'Next due must fall after the calibration date' : null,
    performedBy: performedBy.trim() ? null : 'Name the lab or the person who calibrated it',
    certificateNo: certificateNo.trim() ? null : 'Enter the certificate number',
  }
  const shown = (error: string | null) => (tried ? error : null)

  // Keep "performed by" in step with the vendor until someone types their own name.
  const changeVendor = (id: string | null) => {
    if (!performedBy.trim() || performedBy === vendorName(vendorId)) setPerformedBy(vendorName(id))
    setVendorId(id)
  }

  const submit = (e: FormEvent) => {
    e.preventDefault()
    setTried(true)
    if (Object.values(errors).some(Boolean)) return
    const due = fromInput(nextDue)
    dispatch({
      type: 'calibrations/record',
      item: {
        id: newId('calrec'),
        target: { kind: target.kind, id: target.id },
        date: fromInput(date),
        vendorId,
        performedBy: performedBy.trim(),
        certificateNo: certificateNo.trim(),
        result,
        nextDue: due,
        notes: notes.trim(),
      },
    })
    toast(`${target.code} calibration recorded`, {
      tone: result === 'fail' ? 'danger' : 'success',
      description:
        result !== 'fail'
          ? `${away ? 'Back from calibration. ' : ''}Next due ${fmtDate(due)}`
          : target.kind === 'tool'
            ? 'It failed, so the tool went to repair.'
            : 'It failed, so it stays expired until a calibration passes.',
    })
    onDone()
  }

  const dueHint =
    result === 'fail' ? (
      'A failed calibration keeps it expired until one passes.'
    ) : customDue === null ? (
      `${plural(interval, 'month')} after the calibration date.`
    ) : (
      <button type="button" className="font-semibold text-accent hover:underline" onClick={() => setCustomDue(null)}>
        Reset to {plural(interval, 'month')} after the calibration date
      </button>
    )

  return (
    <form onSubmit={submit} noValidate>
      <DialogHeader>
        <DialogTitle>Record calibration</DialogTitle>
        <DialogDescription>
          {target.code} · {target.name}. Calibrated every {plural(interval, 'month')}.
          {away && ' It is out for calibration now, and saving this record brings it back.'}
        </DialogDescription>
      </DialogHeader>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FormField label="Result" className="sm:col-span-2">
          <SegmentedControl
            className="w-full"
            aria-label="Result"
            value={result}
            onChange={(value) => setResult(RESULTS.find((r) => r === value) ?? 'pass')}
            options={RESULTS.map((r) => ({
              value: r,
              tone: RESULT_TONE[r],
              label: (
                <span className="truncate" title={CALIBRATION_RESULT_LABEL[r]}>
                  {CALIBRATION_RESULT_LABEL[r]}
                </span>
              ),
            }))}
          />
        </FormField>
        <FormField label="Calibrated on" required error={shown(errors.date)}>
          <Input type="date" max={today} value={date} onChange={(e) => setDate(e.target.value)} />
        </FormField>
        <FormField label="Next due" required hint={dueHint} error={shown(errors.nextDue)}>
          <Input type="date" min={date} value={nextDue} disabled={result === 'fail'} onChange={(e) => setCustomDue(e.target.value)} />
        </FormField>
        <FormField label="Vendor" hint="Leave empty for an in-house calibration.">
          <VendorPicker clearable placeholder="In house" value={vendorId} onChange={changeVendor} />
        </FormField>
        <FormField label="Performed by" required error={shown(errors.performedBy)}>
          <Input value={performedBy} onChange={(e) => setPerformedBy(e.target.value)} />
        </FormField>
        <FormField label="Certificate number" required error={shown(errors.certificateNo)}>
          <Input value={certificateNo} placeholder="KN-26-4133" inputClassName="font-mono" onChange={(e) => setCertificateNo(e.target.value)} />
        </FormField>
        <FormField label="Notes" className="sm:col-span-2">
          <Textarea value={notes} placeholder="As found and as left readings, adjustments made" onChange={(e) => setNotes(e.target.value)} />
        </FormField>
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit">Save record</Button>
      </DialogFooter>
    </form>
  )
}
