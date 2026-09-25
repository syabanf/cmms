import { evaluateItem, fmtWhen, limitText } from '@cmms/fixtures'
import type { CheckOutcome, TaskResult, WoTask } from '@cmms/types'
import { Input, PhotoInput, SegmentedControl, type SegmentedOption, SignaturePad, Textarea, cn } from '@cmms/ui'
import type { ReactNode } from 'react'
import { OutcomeBadge } from '../../components/badges'
import { PhotoGrid } from '../../components/PhotoGrid'
import { parseReading } from '../../lib/time'
import { useMobileScope } from '../../state/scope'
import { CheckRow } from './CheckRow'
import { useDraft } from './useDraft'

/** Convention shared with evaluateItem: the first option is healthy, the last is the worst. */
function choiceTone(index: number, count: number): SegmentedOption['tone'] {
  if (count < 2) return 'default'
  return index === 0 ? 'success' : index === count - 1 ? 'danger' : 'warning'
}

const PASS_FAIL: SegmentedOption[] = [
  { value: 'pass', label: 'Pass', tone: 'success' },
  { value: 'fail', label: 'Fail', tone: 'danger' },
]

/** One checklist line, rendered by field type. Results save through workOrders/recordTask. */
export function TaskField({ woId, task, editable }: { woId: string; task: WoTask; editable: boolean }) {
  const { dispatch, user, personName } = useMobileScope()
  const result = task.result

  const record = (value: TaskResult['value'], photos?: string[]) =>
    dispatch({ type: 'workOrders/recordTask', id: woId, taskId: task.id, value, photos })

  const recorded = result ? `${personName(result.by)} · ${fmtWhen(result.at)}` : undefined
  const label = (
    <>
      {task.label}
      {task.required && (
        <span aria-label="required" className="ml-0.5 text-accent">
          *
        </span>
      )}
    </>
  )

  if (task.type === 'check') {
    return (
      <CheckRow
        checked={result?.value === true}
        onToggle={() => record(result?.value === true ? null : true)}
        disabled={!editable}
        label={label}
        hint={recorded ?? task.help}
      />
    )
  }

  const choice = typeof result?.value === 'string' ? result.value : null
  let control: ReactNode
  switch (task.type) {
    case 'passfail':
    case 'choice': {
      const options =
        task.type === 'passfail'
          ? PASS_FAIL
          : (task.options ?? []).map((o, i, all) => ({ value: o, label: o, tone: choiceTone(i, all.length) }))
      control = (
        <SegmentedControl
          aria-label={task.label}
          options={options}
          value={choice}
          onChange={(v) => v !== choice && record(v)}
          disabled={!editable}
          className="flex w-full bg-card [&>button]:h-11"
        />
      )
      break
    }
    case 'measurement':
    case 'number':
      control = <ReadingInput task={task} editable={editable} onCommit={record} />
      break
    case 'text':
      control = <NoteInput task={task} editable={editable} onCommit={record} />
      break
    case 'photo': {
      const photos = result?.photos ?? []
      control = editable ? (
        <PhotoInput
          photos={photos}
          onAdd={(urls) => record(photos.length + urls.length, [...photos, ...urls])}
          onRemove={(url) => {
            const rest = photos.filter((p) => p !== url)
            record(rest.length || null, rest)
          }}
        />
      ) : photos.length ? (
        <PhotoGrid photos={photos.map((url, i) => ({ id: `${task.id}-${i}`, name: `Photo ${i + 1}`, url }))} />
      ) : (
        <p className="text-sm text-muted">No photo taken.</p>
      )
      break
    }
    case 'signature':
      control =
        editable || result ? (
          <SignaturePad
            value={result?.photos[0] ?? null}
            onChange={(dataUrl) => (dataUrl ? record(user.name, [dataUrl]) : record(null))}
            disabled={!editable}
          />
        ) : (
          <p className="text-sm text-muted">Not signed yet.</p>
        )
      break
  }

  return (
    <div className="rounded-2xl bg-surface-2 p-3.5">
      <p className="text-sm font-semibold">{label}</p>
      {task.help && <p className="mt-0.5 text-xs text-muted">{task.help}</p>}
      <div className="mt-3">{control}</div>
      {(task.type === 'passfail' || task.type === 'choice') && <FlagNote outcome={result?.outcome ?? null} />}
      {recorded && <p className="mt-2 text-[11px] text-muted">Recorded by {recorded}</p>}
    </div>
  )
}

/** What a flagged result means. Completing any work order with a warning or failed line raises a follow-up request. */
function FlagNote({ outcome }: { outcome: CheckOutcome | null }) {
  if (outcome !== 'warning' && outcome !== 'fail') return null
  return (
    <p className={cn('mt-2 text-xs font-semibold', outcome === 'fail' ? 'text-accent' : 'text-warning')}>
      {outcome === 'fail' ? 'Out of limit.' : 'Close to the limit.'} Completing the work raises a follow-up request for it.
    </p>
  )
}

function ReadingInput({ task, editable, onCommit }: { task: WoTask; editable: boolean; onCommit: (value: number | null) => void }) {
  const stored = typeof task.result?.value === 'number' ? String(task.result.value) : ''
  const [draft, setDraft] = useDraft(stored)
  const value = parseReading(draft)
  const invalid = draft.trim() !== '' && value === null
  const outcome = invalid ? null : evaluateItem(task, value)
  const limit = limitText(task)
  const warn = [task.warnMin != null ? `below ${task.warnMin}` : null, task.warnMax != null ? `above ${task.warnMax}` : null]
    .filter(Boolean)
    .join(' or ')
  const help = [limit && `Limit ${limit}`, warn && `warning ${warn}`].filter(Boolean).join(' · ')

  const commit = () => {
    if (!invalid && (value === null ? '' : String(value)) !== stored) onCommit(value)
  }

  return (
    <div>
      <div className="flex items-center gap-3">
        <Input
          aria-label={task.label}
          inputMode="decimal"
          enterKeyHint="done"
          autoComplete="off"
          placeholder="0"
          value={draft}
          disabled={!editable}
          invalid={invalid}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
          className="w-40"
          inputClassName="h-12 text-base font-semibold tabular-nums"
          rightSlot={task.unit ? <span className="pr-2 text-sm font-semibold">{task.unit}</span> : undefined}
        />
        <OutcomeBadge outcome={outcome} />
      </div>
      <p className={cn('mt-1.5 text-xs', invalid ? 'text-danger' : 'text-muted')}>
        {invalid ? 'Enter a number, for example 4.2' : help || 'Type the reading'}
      </p>
      <FlagNote outcome={outcome} />
    </div>
  )
}

function NoteInput({ task, editable, onCommit }: { task: WoTask; editable: boolean; onCommit: (value: string | null) => void }) {
  const stored = typeof task.result?.value === 'string' ? task.result.value : ''
  const [draft, setDraft] = useDraft(stored)
  return (
    <Textarea
      aria-label={task.label}
      value={draft}
      disabled={!editable}
      placeholder="What you found"
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        const next = draft.trim()
        if (next !== stored) onCommit(next || null)
      }}
      className="min-h-24"
    />
  )
}
