import type { TaskResult, WoTask } from '@cmms/types'
import { Input, PhotoInput, SegmentedControl, SignaturePad, Switch } from '@cmms/ui'
import { useState } from 'react'

type OnRecord = (value: TaskResult['value'], photos?: string[]) => void

/** The input for one checklist line, by field type. */
export function TaskField({ task, disabled, signer, onRecord }: { task: WoTask; disabled: boolean; signer: string; onRecord: OnRecord }) {
  const value = task.result?.value ?? null
  switch (task.type) {
    case 'check':
      return <Switch checked={value === true} disabled={disabled} onCheckedChange={(on) => onRecord(on ? true : null)} aria-label={task.label} />
    case 'passfail':
      return (
        <SegmentedControl
          size="sm"
          disabled={disabled}
          aria-label={task.label}
          value={typeof value === 'string' ? value : null}
          onChange={onRecord}
          options={[
            { value: 'pass', label: 'Pass', tone: 'success' },
            { value: 'fail', label: 'Fail', tone: 'danger' },
          ]}
        />
      )
    case 'choice': {
      const options = task.options ?? []
      return (
        <SegmentedControl
          size="sm"
          disabled={disabled}
          aria-label={task.label}
          value={typeof value === 'string' ? value : null}
          onChange={onRecord}
          options={options.map((o, i) => ({
            value: o,
            label: o,
            tone: i === 0 ? 'success' : i === options.length - 1 ? 'danger' : 'warning',
          }))}
        />
      )
    }
    case 'measurement':
    case 'number':
      return <NumberField task={task} disabled={disabled} onRecord={onRecord} />
    case 'text':
      return <TextField task={task} disabled={disabled} onRecord={onRecord} />
    case 'photo':
      return (
        <PhotoInput
          className="w-full sm:w-72"
          photos={task.result?.photos ?? []}
          max={4}
          onAdd={(urls) => {
            const photos = [...(task.result?.photos ?? []), ...urls]
            onRecord(photos.length, photos)
          }}
          onRemove={
            disabled
              ? undefined
              : (url) => {
                  const photos = (task.result?.photos ?? []).filter((p) => p !== url)
                  onRecord(photos.length ? photos.length : null, photos)
                }
          }
        />
      )
    case 'signature':
      return (
        <SignaturePad
          className="w-full sm:w-72"
          disabled={disabled}
          value={task.result?.photos[0] ?? null}
          onChange={(dataUrl) => onRecord(dataUrl ? signer : null, dataUrl ? [dataUrl] : [])}
        />
      )
  }
}

function NumberField({ task, disabled, onRecord }: { task: WoTask; disabled: boolean; onRecord: OnRecord }) {
  const recorded = typeof task.result?.value === 'number' ? String(task.result.value) : ''
  const [draft, setDraft] = useState(recorded)
  const commit = () => {
    if (draft === recorded) return
    const n = Number(draft.replace(',', '.'))
    onRecord(draft.trim() === '' || Number.isNaN(n) ? null : n)
  }
  return (
    <Input
      className="w-40"
      inputClassName="text-right tabular-nums"
      inputMode="decimal"
      disabled={disabled}
      aria-label={task.label}
      value={draft}
      placeholder="Value"
      rightSlot={task.unit ? <span className="text-xs font-medium text-muted">{task.unit}</span> : undefined}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => e.key === 'Enter' && commit()}
    />
  )
}

function TextField({ task, disabled, onRecord }: { task: WoTask; disabled: boolean; onRecord: OnRecord }) {
  const recorded = typeof task.result?.value === 'string' ? task.result.value : ''
  const [draft, setDraft] = useState(recorded)
  const commit = () => draft !== recorded && onRecord(draft.trim() || null)
  return (
    <Input
      className="w-full sm:w-60"
      disabled={disabled}
      aria-label={task.label}
      value={draft}
      placeholder="Type the answer"
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => e.key === 'Enter' && commit()}
    />
  )
}
