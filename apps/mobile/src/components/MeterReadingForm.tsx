import { fmtAgo, fmtNumber } from '@cmms/fixtures'
import type { Meter } from '@cmms/types'
import { METER_KIND_LABEL } from '@cmms/types'
import { Button, FormField, Input, SegmentedControl, toast } from '@cmms/ui'
import { type FormEvent, useState } from 'react'
import { parseReading } from '../lib/time'
import { useMobileScope } from '../state/scope'

/** Record a meter reading. Meters only count up, so a reading below the last one is refused. */
export function MeterReadingForm({
  meters,
  initialId,
  assetCode,
  autoFocus = false,
  onSaved,
}: {
  meters: Meter[]
  initialId: string
  assetCode: string
  autoFocus?: boolean
  onSaved?: () => void
}) {
  const { dispatch } = useMobileScope()
  const [meterId, setMeterId] = useState(initialId)
  const [text, setText] = useState('')
  const meter = meters.find((m) => m.id === meterId) ?? meters[0]
  if (!meter) return null

  const value = parseReading(text)
  const invalid = text.trim() !== '' && value === null
  const tooLow = value !== null && value < meter.value

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (value === null || tooLow) return
    dispatch({ type: 'meters/record', meterId: meter.id, value })
    toast(`Reading saved: ${fmtNumber(value)} ${meter.unit}`, {
      tone: 'success',
      description: `${METER_KIND_LABEL[meter.kind]} on ${assetCode}. Meter-based PM uses it right away.`,
    })
    setText('')
    onSaved?.()
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      {meters.length > 1 && (
        <SegmentedControl
          aria-label="Meter"
          options={meters.map((m) => ({ value: m.id, label: METER_KIND_LABEL[m.kind] }))}
          value={meter.id}
          onChange={(id) => {
            setMeterId(id)
            setText('')
          }}
          className="flex w-full [&>button]:h-11"
        />
      )}
      <FormField
        label={`${METER_KIND_LABEL[meter.kind]} in ${meter.unit}`}
        hint={`Last reading ${fmtNumber(meter.value)} ${meter.unit}, ${fmtAgo(meter.updatedAt)}.`}
        error={tooLow ? `Enter ${fmtNumber(meter.value)} or more. Meters only count up.` : invalid ? 'Enter a number, for example 8450' : undefined}
      >
        <Input
          inputMode="decimal"
          enterKeyHint="done"
          autoComplete="off"
          autoFocus={autoFocus}
          placeholder={String(meter.value)}
          value={text}
          onChange={(e) => setText(e.target.value)}
          inputClassName="h-12 text-base font-semibold tabular-nums"
          rightSlot={<span className="pr-2 text-sm font-semibold">{meter.unit}</span>}
        />
      </FormField>
      <Button type="submit" size="lg" className="w-full" disabled={value === null || tooLow}>
        Save reading
      </Button>
    </form>
  )
}
