import { fmtWhen, limitText, newId, taskProgress } from '@cmms/fixtures'
import type { FieldType, TaskResult, WoTask, WorkOrder } from '@cmms/types'
import { FIELD_TYPES, FIELD_TYPE_LABEL } from '@cmms/types'
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  EmptyState,
  FormField,
  Input,
  NativeSelect,
  ProgressBar,
  Switch,
  cn,
} from '@cmms/ui'
import { ListChecks, Plus, Trash } from 'lucide-react'
import { type FormEvent, useState } from 'react'
import { OutcomeBadge } from '../../../components/badges'
import { useScoped } from '../../../state/scoped'
import { TaskField } from './TaskField'
import type { WoAccess } from './useWoAccess'

export function ChecklistCard({ wo, access }: { wo: WorkOrder; access: WoAccess }) {
  const { dispatch, personName, user } = useScoped()
  const [adding, setAdding] = useState(false)
  const progress = taskProgress(wo.tasks)

  return (
    <Card>
      <CardHeader
        action={
          access.edit && (
            <Button variant="outline" size="sm" onClick={() => setAdding(true)}>
              <Plus />
              Add check
            </Button>
          )
        }
      >
        <CardTitle>Checklist</CardTitle>
        <p className="text-sm text-muted">
          {progress.total ? `${progress.done} of ${progress.total} done` : 'No checklist on this work order'}
          {progress.missingRequired > 0 && <span className="text-accent"> · {progress.missingRequired} required still open</span>}
        </p>
      </CardHeader>
      <CardContent className="space-y-2">
        {progress.total > 0 && <ProgressBar value={progress.ratio} tone={progress.missingRequired ? 'ink' : 'success'} className="mb-3" aria-label="Checklist progress" />}
        {wo.tasks.length === 0 ? (
          <EmptyState
            compact
            icon={<ListChecks />}
            title="No checks yet"
            description="Add checks here, or pick a job plan when the work order is created."
          />
        ) : (
          wo.tasks.map((task, i) => (
            <TaskRow
              key={task.id}
              index={i + 1}
              task={task}
              disabled={!access.execute}
              signer={user.name}
              by={task.result ? `${personName(task.result.by)} · ${fmtWhen(task.result.at)}` : null}
              onRecord={(value, photos) => dispatch({ type: 'workOrders/recordTask', id: wo.id, taskId: task.id, value, photos })}
              onRemove={access.edit && !task.result ? () => dispatch({ type: 'workOrders/removeTask', id: wo.id, taskId: task.id }) : undefined}
            />
          ))
        )}
      </CardContent>
      <AddTaskDialog
        open={adding}
        onOpenChange={setAdding}
        onAdd={(task) => dispatch({ type: 'workOrders/addTask', id: wo.id, task })}
      />
    </Card>
  )
}

function TaskRow({
  index,
  task,
  disabled,
  signer,
  by,
  onRecord,
  onRemove,
}: {
  index: number
  task: WoTask
  disabled: boolean
  signer: string
  by: string | null
  onRecord: (value: TaskResult['value'], photos?: string[]) => void
  onRemove?: () => void
}) {
  const limit = limitText(task)
  const outcome = task.result?.outcome ?? null
  return (
    <div
      className={cn(
        'grid grid-cols-1 items-center gap-3 rounded-2xl p-3 sm:grid-cols-[minmax(0,1fr)_auto]',
        outcome === 'fail' ? 'bg-accent-soft/60' : outcome === 'warning' ? 'bg-warning-soft/60' : 'bg-surface-2',
      )}
    >
      <div className="flex min-w-0 items-start gap-3">
        <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-card text-[11px] font-bold tabular-nums text-muted shadow-card">
          {index}
        </span>
        <div className="min-w-0">
          <p className="text-sm font-medium">
            {task.label}
            {task.required && <span className="ml-0.5 text-accent">*</span>}
          </p>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
            <span>{FIELD_TYPE_LABEL[task.type]}</span>
            {limit && <span>· Limit {limit}</span>}
            {task.help && <span>· {task.help}</span>}
            {by && <span>· {by}</span>}
          </p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 sm:justify-end">
        <OutcomeBadge outcome={outcome} />
        <TaskField task={task} disabled={disabled} signer={signer} onRecord={onRecord} />
        {onRemove && (
          <Button variant="ghost" size="icon-sm" aria-label={`Remove ${task.label}`} onClick={onRemove}>
            <Trash />
          </Button>
        )}
      </div>
    </div>
  )
}

function AddTaskDialog({ open, onOpenChange, onAdd }: { open: boolean; onOpenChange: (o: boolean) => void; onAdd: (task: WoTask) => void }) {
  const [label, setLabel] = useState('')
  const [type, setType] = useState<FieldType>('check')
  const [required, setRequired] = useState(true)
  const [unit, setUnit] = useState('')
  const [min, setMin] = useState('')
  const [max, setMax] = useState('')
  const [options, setOptions] = useState('Normal, Rough, Loud')
  const numeric = type === 'measurement' || type === 'number'
  const num = (v: string) => (v.trim() === '' ? null : Number(v))

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!label.trim()) return
    onAdd({
      id: newId('t'),
      label: label.trim(),
      type,
      required,
      ...(numeric ? { unit: unit.trim() || undefined, min: num(min), max: num(max) } : {}),
      ...(type === 'choice' ? { options: options.split(',').map((o) => o.trim()).filter(Boolean) } : {}),
      result: null,
    })
    setLabel('')
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>Add a check</DialogTitle>
            <DialogDescription>Structured checks feed the inspection trends and failure analysis. Free text stays available as a note.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField label="What to check" required htmlFor="task-label" className="sm:col-span-2">
              <Input id="task-label" value={label} placeholder="Bearing temperature" onChange={(e) => setLabel(e.target.value)} autoFocus />
            </FormField>
            <FormField label="Field type" htmlFor="task-type">
              <NativeSelect
                id="task-type"
                value={type}
                onChange={(e) => setType(e.target.value as FieldType)}
                options={FIELD_TYPES.map((t) => ({ value: t, label: FIELD_TYPE_LABEL[t] }))}
              />
            </FormField>
            <label className="flex items-center justify-between gap-3 self-end rounded-2xl bg-surface px-4 py-2.5">
              <span className="text-sm font-medium">Required</span>
              <Switch checked={required} onCheckedChange={setRequired} aria-label="Required" />
            </label>
            {numeric && (
              <>
                <FormField label="Unit" htmlFor="task-unit">
                  <Input id="task-unit" value={unit} placeholder="°C" onChange={(e) => setUnit(e.target.value)} />
                </FormField>
                <div className="grid grid-cols-2 gap-3">
                  <FormField label="Min" htmlFor="task-min">
                    <Input id="task-min" inputMode="decimal" value={min} onChange={(e) => setMin(e.target.value)} />
                  </FormField>
                  <FormField label="Max" htmlFor="task-max">
                    <Input id="task-max" inputMode="decimal" value={max} placeholder="75" onChange={(e) => setMax(e.target.value)} />
                  </FormField>
                </div>
              </>
            )}
            {type === 'choice' && (
              <FormField label="Options, best first" hint="Separate with commas. The first counts as a pass, the last as a fail." htmlFor="task-options" className="sm:col-span-2">
                <Input id="task-options" value={options} onChange={(e) => setOptions(e.target.value)} />
              </FormField>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!label.trim()}>
              Add check
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
