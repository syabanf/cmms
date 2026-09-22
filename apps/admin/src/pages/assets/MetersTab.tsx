import { fmtDate, fmtNumber, fmtWhen, newId, nowIso, pmDue, toMs, triggerText } from '@cmms/fixtures'
import type { Asset, Meter, MeterKind } from '@cmms/types'
import { METER_KIND_LABEL } from '@cmms/types'
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  EmptyState,
  FormField,
  Input,
  Kicker,
  NativeSelect,
  Sparkline,
  toast,
} from '@cmms/ui'
import { ChevronRight, Gauge, Plus } from 'lucide-react'
import { type FormEvent, useState } from 'react'
import { Link } from 'react-router'
import { useAuth } from '../../auth/auth'
import { paths } from '../../components/links'
import { useScoped } from '../../state/scoped'
import { PmStateBadge, SectionTitle } from './ui'

const KINDS: MeterKind[] = ['runtime', 'cycle', 'distance', 'energy']
const DEFAULT_UNIT: Record<MeterKind, string> = {
  runtime: 'h',
  cycle: 'cycles',
  distance: 'km',
  energy: 'kWh',
}

/** Runtime, cycle, distance and energy meters with their readings and the PM they trigger. */
export function MetersTab({ asset, now }: { asset: Asset; now: number }) {
  const { meters } = useScoped()
  const { can } = useAuth()
  const canRecord = can('asset.manage') || can('wo.execute')
  const [recording, setRecording] = useState<Meter | null>(null)
  const [adding, setAdding] = useState(false)
  const mine = meters.filter((m) => m.assetId === asset.id)
  const addButton = can('asset.manage') && (
    <Button variant="outline" size="sm" onClick={() => setAdding(true)}>
      <Plus />
      Add meter
    </Button>
  )

  return (
    <div>
      <SectionTitle count={mine.length} action={mine.length > 0 && addButton}>
        Meters
      </SectionTitle>
      {mine.length ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
          {mine.map((meter) => (
            <MeterPanel
              key={meter.id}
              meter={meter}
              now={now}
              onRecord={canRecord ? () => setRecording(meter) : undefined}
            />
          ))}
        </div>
      ) : (
        <EmptyState
          compact
          icon={<Gauge />}
          title="No meters on this asset"
          description="Add a runtime, cycle, distance or energy meter to trigger PM by usage instead of the calendar."
          action={addButton || undefined}
        />
      )}

      <Dialog open={recording !== null} onOpenChange={(open) => !open && setRecording(null)}>
        <DialogContent size="sm">
          {recording && <RecordForm meter={recording} asset={asset} onDone={() => setRecording(null)} />}
        </DialogContent>
      </Dialog>
      <Dialog open={adding} onOpenChange={setAdding}>
        <DialogContent size="sm">
          {adding && <AddMeterForm asset={asset} onDone={() => setAdding(false)} />}
        </DialogContent>
      </Dialog>
    </div>
  )
}

function MeterPanel({ meter, now, onRecord }: { meter: Meter; now: number; onRecord?: () => void }) {
  const { meterReadings, pmSchedules, maps } = useScoped()
  const readings = meterReadings.filter((r) => r.meterId === meter.id).sort((a, b) => toMs(a.at) - toMs(b.at))
  const first = readings[0]
  const plans = pmSchedules.filter((pm) => pm.trigger.kind !== 'calendar' && pm.trigger.meterId === meter.id)

  return (
    <div className="rounded-2xl bg-surface-2 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <Kicker>{METER_KIND_LABEL[meter.kind]}</Kicker>
          <p className="mt-1 flex items-start gap-1 leading-none">
            <span className="text-3xl font-bold tracking-tight tabular-nums">{fmtNumber(meter.value)}</span>
            <span className="pt-1 text-sm font-semibold text-muted">{meter.unit}</span>
          </p>
          <p className="mt-1.5 text-xs text-muted">
            +{fmtNumber(meter.dailyRate, meter.dailyRate % 1 ? 1 : 0)} {meter.unit} per day · updated{' '}
            {fmtWhen(meter.updatedAt, now)}
          </p>
        </div>
        {onRecord && (
          <Button variant="outline" size="sm" onClick={onRecord}>
            Record reading
          </Button>
        )}
      </div>

      {first && readings.length > 1 ? (
        <Sparkline
          className="mt-4"
          height={48}
          data={readings.map((r) => r.value)}
          labels={readings.map((r) => fmtDate(r.at))}
          format={(v) => `${fmtNumber(v)} ${meter.unit}`}
          ariaLabel={`${METER_KIND_LABEL[meter.kind]} readings, ${readings.length} points from ${fmtDate(first.at)}`}
        />
      ) : (
        <p className="mt-4 text-xs text-muted">The trend shows once there are two readings.</p>
      )}

      <div className="mt-4 border-t border-border pt-3">
        <p className="mb-2 text-xs font-semibold text-muted">PM triggered by this meter</p>
        {plans.length ? (
          <ul className="space-y-1.5">
            {plans.map((pm) => {
              const due = pmDue(pm, maps.meter, now)
              return (
                <li key={pm.id}>
                  <Link
                    to={paths.pm(pm.id)}
                    className="flex items-center gap-3 rounded-xl bg-card px-3 py-2 transition-colors hover:bg-surface"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{pm.name}</p>
                      <p className="truncate text-xs text-muted">
                        {triggerText(pm, maps.meter)}
                        {due.meterDueValue !== null &&
                          ` · next at ${fmtNumber(due.meterDueValue)} ${meter.unit}`}
                      </p>
                    </div>
                    <PmStateBadge state={due.state} active={pm.active} />
                    <ChevronRight aria-hidden="true" className="size-4 shrink-0 text-muted" />
                  </Link>
                </li>
              )
            })}
          </ul>
        ) : (
          <p className="text-xs text-muted">
            None yet. Meter-based PM schedules are set up under Preventive.
          </p>
        )}
      </div>
    </div>
  )
}

function RecordForm({ meter, asset, onDone }: { meter: Meter; asset: Asset; onDone: () => void }) {
  const { dispatch } = useScoped()
  const [value, setValue] = useState(String(meter.value))
  const [tried, setTried] = useState(false)
  const reading = Number(value)
  const error =
    value.trim() === '' || !Number.isFinite(reading)
      ? 'Enter the value shown on the meter.'
      : reading < meter.value
        ? `A reading cannot go below the current ${fmtNumber(meter.value)} ${meter.unit}.`
        : null

  const submit = (e: FormEvent) => {
    e.preventDefault()
    setTried(true)
    if (error) return
    dispatch({ type: 'meters/record', meterId: meter.id, value: reading })
    toast(`${METER_KIND_LABEL[meter.kind]} reading saved`, {
      tone: 'success',
      description: `${fmtNumber(reading)} ${meter.unit} on ${asset.code}`,
    })
    onDone()
  }

  return (
    <form onSubmit={submit}>
      <DialogHeader>
        <DialogTitle>Record {METER_KIND_LABEL[meter.kind].toLowerCase()} reading</DialogTitle>
        <DialogDescription>
          {asset.code} reads {fmtNumber(meter.value)} {meter.unit} now. Meter-based PM moves with the new
          value.
        </DialogDescription>
      </DialogHeader>
      <FormField
        label={`Reading (${meter.unit})`}
        required
        htmlFor="meter-value"
        error={tried ? (error ?? undefined) : undefined}
      >
        <Input
          id="meter-value"
          type="number"
          inputMode="decimal"
          min={meter.value}
          value={value}
          autoFocus
          onChange={(e) => setValue(e.target.value)}
        />
      </FormField>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit">Save reading</Button>
      </DialogFooter>
    </form>
  )
}

function AddMeterForm({ asset, onDone }: { asset: Asset; onDone: () => void }) {
  const { dispatch } = useScoped()
  const [kind, setKind] = useState<MeterKind>('runtime')
  const [unit, setUnit] = useState(DEFAULT_UNIT.runtime)
  const [value, setValue] = useState(0)
  const [dailyRate, setDailyRate] = useState(8)
  const [tried, setTried] = useState(false)

  const submit = (e: FormEvent) => {
    e.preventDefault()
    setTried(true)
    if (!unit.trim()) return
    const id = newId('mtr')
    dispatch({
      type: 'meters/upsert',
      item: { id, assetId: asset.id, kind, unit: unit.trim(), value, dailyRate, updatedAt: nowIso() },
    })
    // The first reading starts the trend line.
    dispatch({ type: 'meters/record', meterId: id, value })
    toast(`${METER_KIND_LABEL[kind]} meter added to ${asset.code}`, { tone: 'success' })
    onDone()
  }

  return (
    <form onSubmit={submit}>
      <DialogHeader>
        <DialogTitle>Add meter</DialogTitle>
        <DialogDescription>
          Meters let PM schedules trigger on usage, such as every 500 running hours.
        </DialogDescription>
      </DialogHeader>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FormField label="Meter" htmlFor="meter-kind">
          <NativeSelect
            id="meter-kind"
            value={kind}
            onChange={(e) => {
              const next = KINDS.find((k) => k === e.target.value) ?? 'runtime'
              setKind(next)
              setUnit(DEFAULT_UNIT[next])
            }}
            options={KINDS.map((k) => ({ value: k, label: METER_KIND_LABEL[k] }))}
          />
        </FormField>
        <FormField
          label="Unit"
          required
          htmlFor="meter-unit"
          error={tried && !unit.trim() ? 'Enter a unit.' : undefined}
        >
          <Input id="meter-unit" value={unit} onChange={(e) => setUnit(e.target.value)} />
        </FormField>
        <FormField label="Current value" htmlFor="meter-start">
          <Input
            id="meter-start"
            type="number"
            min={0}
            value={value}
            onChange={(e) => setValue(Math.max(0, Number(e.target.value) || 0))}
          />
        </FormField>
        <FormField label="Average per day" htmlFor="meter-rate" hint="Used to forecast meter-based PM.">
          <Input
            id="meter-rate"
            type="number"
            min={0}
            step="0.1"
            value={dailyRate}
            onChange={(e) => setDailyRate(Math.max(0, Number(e.target.value) || 0))}
          />
        </FormField>
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit">Add meter</Button>
      </DialogFooter>
    </form>
  )
}
