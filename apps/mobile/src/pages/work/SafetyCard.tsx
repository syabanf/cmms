import { fmtWhen } from '@cmms/fixtures'
import type { SafetyItem, WorkOrder } from '@cmms/types'
import { Card, CardContent, CardDescription, CardHeader, CardTitle, IconTile, Kicker, cn } from '@cmms/ui'
import { Check, ShieldAlert, ShieldCheck } from 'lucide-react'
import { useMobileScope } from '../../state/scope'
import { CheckRow } from './CheckRow'

type SafetyGroup = 'loto' | 'permit' | 'ppe' | 'hazard'

const GROUPS: { id: SafetyGroup; label: string }[] = [
  { id: 'loto', label: 'Lock out, tag out' },
  { id: 'permit', label: 'Permits' },
  { id: 'ppe', label: 'PPE on' },
  { id: 'hazard', label: 'Hazards understood' },
]

interface SafetyRow {
  id: string
  group: SafetyGroup
  label: string
  hint?: string
  /** The viewer lacks the permit this line asks for. */
  warn?: boolean
}

/**
 * One line per lock-out point, permit, PPE item and hazard. `permits` are the technician's
 * authorizations from their profile, or null when a viewer only reads the requirements.
 * A permit counts as held when its name matches an authorization, whatever the case.
 */
export function safetyRows(wo: WorkOrder, items: ReadonlyMap<string, SafetyItem>, permits: string[] | null): SafetyRow[] {
  const { loto, lotoIds, permitIds, ppeIds, hazardIds } = wo.safety
  const rows: SafetyRow[] = []
  if (lotoIds.length) {
    for (const id of lotoIds) {
      rows.push({ id, group: 'loto', label: items.get(id)?.name ?? 'Lock-out point', hint: 'Apply your lock and tag, then test for zero energy.' })
    }
  } else if (loto) {
    rows.push({
      id: 'loto',
      group: 'loto',
      label: 'Energy isolated, my lock and tag applied',
      hint: 'Isolate every energy source and test for zero energy before you touch the machine.',
    })
  }
  // An order that names no permit but asks for LOTO still needs the LOTO authorization.
  const permitNames: [string, string][] = permitIds.length
    ? permitIds.map((id) => [id, items.get(id)?.name ?? 'Permit'])
    : loto
      ? [['permit-loto', 'LOTO']]
      : []
  for (const [id, name] of permitNames) {
    const held = permits?.some((p) => p.toLowerCase() === name.toLowerCase()) ?? false
    rows.push({
      id,
      group: 'permit',
      label: name,
      hint: permits === null ? 'Required for this job' : held ? 'On your profile' : 'Not on your profile. Work with an authorized colleague.',
      warn: permits !== null && !held,
    })
  }
  for (const id of ppeIds) rows.push({ id, group: 'ppe', label: items.get(id)?.name ?? 'PPE item' })
  for (const id of hazardIds) rows.push({ id, group: 'hazard', label: items.get(id)?.name ?? 'Hazard' })
  return rows
}

/** The safety gate's lines. Ticks live with the step, which owns the confirm action. */
export function SafetyCard({
  wo,
  rows,
  ticked,
  onToggle,
}: {
  wo: WorkOrder
  rows: SafetyRow[]
  /** Null renders the read-only list: already confirmed, or viewed by someone not on the job. */
  ticked: ReadonlySet<string> | null
  onToggle: (id: string) => void
}) {
  const { personName } = useMobileScope()
  const confirmedBy = wo.safety.confirmedBy
  const interactive = ticked !== null

  return (
    <Card>
      <CardHeader
        action={
          <IconTile tone={confirmedBy ? 'success' : 'warning'} size="sm">
            {confirmedBy ? <ShieldCheck aria-hidden="true" /> : <ShieldAlert aria-hidden="true" />}
          </IconTile>
        }
      >
        <CardTitle>{interactive ? 'Before you touch the machine' : 'Safety requirements'}</CardTitle>
        <CardDescription>
          {interactive ? 'Tick each line as you do it. The work starts once every line is confirmed.' : 'Confirmed once, before the work starts.'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {confirmedBy && wo.safety.confirmedAt && (
          <p className="rounded-2xl bg-success-soft px-4 py-3 text-sm font-semibold text-success">
            Confirmed by {personName(confirmedBy)} · {fmtWhen(wo.safety.confirmedAt)}
          </p>
        )}
        {wo.safety.notes && <p className="rounded-2xl bg-warning-soft px-4 py-3 text-sm text-body">{wo.safety.notes}</p>}
        {GROUPS.map((group) => {
          const list = rows.filter((r) => r.group === group.id)
          if (!list.length) return null
          return (
            <div key={group.id} className="space-y-2">
              <Kicker>{group.label}</Kicker>
              {list.map((row) => {
                const hint = row.hint && <span className={cn(row.warn && 'font-semibold text-warning')}>{row.hint}</span>
                return ticked ? (
                  <CheckRow key={row.id} checked={ticked.has(row.id)} onToggle={() => onToggle(row.id)} label={row.label} hint={hint || undefined} />
                ) : (
                  <div key={row.id} className="flex items-center gap-3 rounded-2xl bg-surface-2 px-3.5 py-3">
                    {confirmedBy && <Check aria-hidden="true" className="size-4 shrink-0 text-success" strokeWidth={3} />}
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold">{row.label}</span>
                      {hint && <span className="mt-0.5 block text-xs text-muted">{hint}</span>}
                    </span>
                  </div>
                )
              })}
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}
