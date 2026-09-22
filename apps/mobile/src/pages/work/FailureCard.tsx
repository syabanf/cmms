import { isFailureWork } from '@cmms/fixtures'
import type { FailureCodeKind, FailureReport, WorkOrder } from '@cmms/types'
import { FAILURE_CODE_KINDS, FAILURE_CODE_KIND_LABEL } from '@cmms/types'
import { Card, CardContent, CardDescription, CardHeader, CardTitle, Combobox, FormField, Textarea } from '@cmms/ui'
import { useMemo } from 'react'
import { useMobileScope } from '../../state/scope'
import { FAILURE_FIELD } from './flow'
import { useDraft } from './useDraft'

const EMPTY: FailureReport = { problemId: null, modeId: null, causeId: null, remedyId: null, note: '' }

/** Failure coding from the library. Every pick saves at once, so leaving the flow loses nothing. */
export function FailureCard({ wo, editable }: { wo: WorkOrder; editable: boolean }) {
  const { dispatch } = useMobileScope()
  const report = wo.failure ?? EMPTY
  const required = isFailureWork(wo)
  const [note, setNote] = useDraft(report.note)

  const save = (patch: Partial<FailureReport>) => dispatch({ type: 'workOrders/setFailure', id: wo.id, failure: { ...report, ...patch } })
  const pick = (kind: FailureCodeKind, id: string | null) => {
    const patch: Partial<FailureReport> = {}
    patch[FAILURE_FIELD[kind]] = id
    save(patch)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Failure coding</CardTitle>
        <CardDescription>
          {required
            ? 'Required for breakdown work. It drives repeat-failure alerts and reliability reports.'
            : 'Optional on planned work. Code it when you found a failure.'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {FAILURE_CODE_KINDS.map((kind) => (
          <FormField key={kind} label={FAILURE_CODE_KIND_LABEL[kind]} required={required}>
            <FailureCodePicker kind={kind} value={report[FAILURE_FIELD[kind]]} disabled={!editable} onChange={(id) => pick(kind, id)} />
          </FormField>
        ))}
        <FormField label="Failure note">
          <Textarea
            variant="soft"
            value={note}
            disabled={!editable}
            placeholder="Bearing outer race pitted, grease dry"
            onChange={(e) => setNote(e.target.value)}
            onBlur={() => {
              const next = note.trim()
              if (next !== report.note) save({ note: next })
            }}
            className="min-h-24"
          />
        </FormField>
      </CardContent>
    </Card>
  )
}

function FailureCodePicker({
  kind,
  value,
  disabled,
  onChange,
}: {
  kind: FailureCodeKind
  value: string | null
  disabled: boolean
  onChange: (id: string | null) => void
}) {
  const { failureCodes } = useMobileScope()
  const items = useMemo(() => failureCodes.filter((f) => f.kind === kind), [failureCodes, kind])
  const label = FAILURE_CODE_KIND_LABEL[kind].toLowerCase()
  return (
    <Combobox
      variant="soft"
      clearable
      items={items}
      value={value}
      onChange={onChange}
      disabled={disabled}
      placeholder={`Select ${label}`}
      searchPlaceholder={`Search ${label}`}
      getKey={(f) => f.id}
      getLabel={(f) => f.name}
      getDescription={(f) => f.code}
    />
  )
}
