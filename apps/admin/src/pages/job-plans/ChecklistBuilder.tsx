import { plural } from '@cmms/fixtures'
import type { ChecklistItem, FieldType } from '@cmms/types'
import { FIELD_TYPES, FIELD_TYPE_LABEL } from '@cmms/types'
import {
  ActionMenu,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  EmptyState,
  FormField,
  Input,
  NativeSelect,
  Switch,
} from '@cmms/ui'
import { ArrowDown, ArrowUp, Camera, CircleCheck, Gauge, Hash, ListChecks, ListTodo, PenLine, Plus, SquareCheck, Trash2, Type, X } from 'lucide-react'
import { type ReactElement, type ReactNode, useState } from 'react'
import { OutcomeBadge } from '../../components/badges'
import { ChecklistPreview } from './ChecklistPreview'
import { DEFAULT_OPTIONS, FIELD_TYPE_HINT, emptyTask, optionOutcome } from './lib'

const FIELD_ICON: Record<FieldType, ReactNode> = {
  check: <SquareCheck />,
  number: <Hash />,
  text: <Type />,
  passfail: <CircleCheck />,
  choice: <ListTodo />,
  measurement: <Gauge />,
  photo: <Camera />,
  signature: <PenLine />,
}

const LIMITS = [
  { key: 'min', label: 'Fail below' },
  { key: 'warnMin', label: 'Warn below' },
  { key: 'warnMax', label: 'Warn above' },
  { key: 'max', label: 'Fail above' },
] as const

type Patch = (patch: Partial<ChecklistItem>) => void

export function ChecklistBuilder({
  tasks,
  errors,
  error,
  readOnly,
  onChange,
}: {
  tasks: ChecklistItem[]
  /** Task id → message */
  errors: Record<string, string>
  error?: string
  readOnly: boolean
  onChange: (tasks: ChecklistItem[]) => void
}) {
  const update = (id: string, patch: Partial<ChecklistItem>) => onChange(tasks.map((t) => (t.id === id ? { ...t, ...patch } : t)))
  const move = (index: number, step: -1 | 1) => onChange(swap(tasks, index, index + step))
  const required = tasks.filter((t) => t.required).length
  const measured = tasks.filter((t) => t.type === 'measurement').length

  const addMenu = (trigger: ReactElement) => (
    <ActionMenu
      title="Add a checklist line"
      trigger={trigger}
      items={FIELD_TYPES.map((type) => ({
        key: type,
        label: FIELD_TYPE_LABEL[type],
        description: FIELD_TYPE_HINT[type],
        icon: FIELD_ICON[type],
        onSelect: () => onChange([...tasks, emptyTask(type)]),
      }))}
    />
  )

  return (
    <Card>
      <CardHeader
        action={
          readOnly
            ? undefined
            : addMenu(
                <Button variant="outline" size="sm">
                  <Plus />
                  Add line
                </Button>,
              )
        }
      >
        <CardTitle>Checklist</CardTitle>
        <CardDescription>
          {tasks.length
            ? `${plural(tasks.length, 'line')} · ${required} required${measured ? ` · ${plural(measured, 'measurement')}` : ''}`
            : 'What the technician checks, measures and records'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {error && <p className="mb-3 text-sm text-danger">{error}</p>}
        {tasks.length ? (
          <ol className="space-y-3">
            {tasks.map((task, index) => (
              <ChecklistRow
                key={task.id}
                task={task}
                index={index}
                last={index === tasks.length - 1}
                error={errors[task.id]}
                readOnly={readOnly}
                onChange={(patch) => update(task.id, patch)}
                onMove={(step) => move(index, step)}
                onRemove={() => onChange(tasks.filter((t) => t.id !== task.id))}
              />
            ))}
          </ol>
        ) : (
          <EmptyState
            compact
            icon={<ListChecks />}
            title="No checklist lines yet"
            description="Add the checks, readings and sign-offs every work order from this plan carries."
            action={
              readOnly
                ? undefined
                : addMenu(
                    <Button size="sm">
                      <Plus />
                      Add line
                    </Button>,
                  )
            }
          />
        )}
      </CardContent>
    </Card>
  )
}

function swap<T>(list: readonly T[], from: number, to: number): T[] {
  const next = [...list]
  const [item] = next.splice(from, 1)
  if (item !== undefined) next.splice(to, 0, item)
  return next
}

function ChecklistRow({
  task,
  index,
  last,
  error,
  readOnly,
  onChange,
  onMove,
  onRemove,
}: {
  task: ChecklistItem
  index: number
  last: boolean
  error?: string
  readOnly: boolean
  onChange: Patch
  onMove: (step: -1 | 1) => void
  onRemove: () => void
}) {
  const line = index + 1
  return (
    <li className="@container rounded-2xl bg-surface-2 p-3 sm:p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-card text-xs font-bold tabular-nums shadow-card">{line}</span>
        <NativeSelect
          className="w-48 max-w-full"
          aria-label={`Line ${line} field type`}
          value={task.type}
          options={FIELD_TYPES.map((t) => ({ value: t, label: FIELD_TYPE_LABEL[t] }))}
          onChange={(e) => {
            const type = FIELD_TYPES.find((t) => t === e.target.value)
            if (!type) return
            onChange(type === 'choice' && !task.options?.length ? { type, options: [...DEFAULT_OPTIONS] } : { type })
          }}
        />
        <label className="inline-flex h-11 items-center gap-2 rounded-2xl bg-card px-3 text-sm font-medium">
          <Switch size="sm" checked={task.required} onCheckedChange={(required) => onChange({ required })} />
          Required
        </label>
        {!readOnly && (
          <div className="ml-auto flex items-center gap-1">
            <Button variant="ghost" size="icon-sm" aria-label={`Move line ${line} up`} disabled={index === 0} onClick={() => onMove(-1)}>
              <ArrowUp />
            </Button>
            <Button variant="ghost" size="icon-sm" aria-label={`Move line ${line} down`} disabled={last} onClick={() => onMove(1)}>
              <ArrowDown />
            </Button>
            <Button variant="ghost" size="icon-sm" aria-label={`Delete line ${line}`} className="text-accent" onClick={onRemove}>
              <Trash2 />
            </Button>
          </div>
        )}
      </div>

      <div className="mt-3 grid grid-cols-1 gap-4 @2xl:grid-cols-[minmax(0,1fr)_minmax(0,16rem)]">
        <div className="min-w-0 space-y-3">
          <Input
            aria-label={`Line ${line}`}
            value={task.label}
            invalid={!!error && !task.label.trim()}
            placeholder="What should the technician check?"
            onChange={(e) => onChange({ label: e.target.value })}
          />
          {(task.type === 'measurement' || task.type === 'number') && <LimitFields task={task} onChange={onChange} />}
          {task.type === 'choice' && <OptionsEditor options={task.options ?? []} readOnly={readOnly} onChange={(options) => onChange({ options })} />}
          <Input
            aria-label={`Line ${line} help text`}
            value={task.help ?? ''}
            placeholder="Help text for the technician (optional)"
            onChange={(e) => onChange({ help: e.target.value })}
          />
          {error && <p className="text-xs text-danger">{error}</p>}
        </div>
        <ChecklistPreview item={task} />
      </div>
    </li>
  )
}

function LimitFields({ task, onChange }: { task: ChecklistItem; onChange: Patch }) {
  return (
    <div className="grid grid-cols-2 gap-2 @lg:grid-cols-5">
      <FormField label="Unit" className="col-span-2 @lg:col-span-1">
        <Input value={task.unit ?? ''} placeholder="°C" onChange={(e) => onChange({ unit: e.target.value })} />
      </FormField>
      {LIMITS.map(({ key, label }) => (
        <FormField key={key} label={label}>
          <Input
            type="number"
            step="any"
            inputMode="decimal"
            placeholder="None"
            value={task[key] ?? ''}
            onChange={(e) => {
              const patch: Partial<ChecklistItem> = {}
              patch[key] = e.target.value === '' ? null : Number(e.target.value)
              onChange(patch)
            }}
          />
        </FormField>
      ))}
    </div>
  )
}

function OptionsEditor({ options, readOnly, onChange }: { options: string[]; readOnly: boolean; onChange: (options: string[]) => void }) {
  const [draft, setDraft] = useState('')
  const add = () => {
    const value = draft.trim()
    if (!value) return
    onChange([...options, value])
    setDraft('')
  }
  return (
    <div className="space-y-2">
      <p className="text-xs text-muted">The first option counts as a pass, the last as a fail, anything between as a warning.</p>
      <ol className="space-y-1.5">
        {options.map((option, i) => (
          <li key={i} className="flex items-center gap-2">
            <Input
              className="min-w-0 flex-1"
              aria-label={`Option ${i + 1}`}
              value={option}
              onChange={(e) => onChange(options.map((o, j) => (j === i ? e.target.value : o)))}
            />
            <span className="flex w-16 shrink-0 justify-center">
              <OutcomeBadge outcome={optionOutcome(i, options.length)} />
            </span>
            {!readOnly && (
              <>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="hidden @md:inline-flex"
                  aria-label={`Move option ${i + 1} up`}
                  disabled={i === 0}
                  onClick={() => onChange(swap(options, i, i - 1))}
                >
                  <ArrowUp />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="hidden @md:inline-flex"
                  aria-label={`Move option ${i + 1} down`}
                  disabled={i === options.length - 1}
                  onClick={() => onChange(swap(options, i, i + 1))}
                >
                  <ArrowDown />
                </Button>
                <Button variant="ghost" size="icon-sm" aria-label={`Remove option ${i + 1}`} onClick={() => onChange(options.filter((_, j) => j !== i))}>
                  <X />
                </Button>
              </>
            )}
          </li>
        ))}
      </ol>
      {!readOnly && (
        <div className="flex gap-2">
          <Input
            className="min-w-0 flex-1"
            aria-label="New option"
            placeholder="Add an option"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key !== 'Enter') return
              e.preventDefault()
              add()
            }}
          />
          <Button variant="outline" disabled={!draft.trim()} onClick={add}>
            <Plus />
            Add
          </Button>
        </div>
      )}
    </div>
  )
}
