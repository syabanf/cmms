import type { Rca } from '@cmms/types'
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Kicker, toast } from '@cmms/ui'
import { ArrowDown, ArrowUp, Plus, Target, X } from 'lucide-react'
import { type ReactNode, useState } from 'react'
import { EditableText } from './EditableText'
import { type RcaUpdate, insertAt, moveItem } from './lib'

/** The 5 Why chain from the problem down to the root cause, one card per answer. */
export function WhyChainCard({ rca, editable, update }: { rca: Rca; editable: boolean; update: RcaUpdate }) {
  const [adding, setAdding] = useState(false)
  const { whys } = rca

  const remove = (index: number) => {
    const text = whys[index] ?? ''
    update((r) => ({ ...r, whys: r.whys.filter((_, i) => i !== index) }))
    toast(`Why ${index + 1} removed`, { action: { label: 'Undo', onClick: () => update((r) => ({ ...r, whys: insertAt(r.whys, index, text) })) } })
  }

  const save = (index: number, text: string) => {
    if (!text) return remove(index)
    update((r) => ({ ...r, whys: r.whys.map((w, i) => (i === index ? text : w)) }))
    toast(`Why ${index + 1} saved`, { tone: 'success' })
  }

  const add = (text: string) => {
    if (!text) return
    update((r) => ({ ...r, whys: [...r.whys, text] }))
    toast(`Why ${whys.length + 1} added`, { tone: 'success' })
  }

  const move = (index: number, to: number) => update((r) => ({ ...r, whys: moveItem(r.whys, index, to) }))

  return (
    <Card>
      <CardHeader
        action={
          editable && !adding ? (
            <Button variant="outline" size="sm" onClick={() => setAdding(true)}>
              <Plus />
              Add why
            </Button>
          ) : undefined
        }
      >
        <CardTitle>5 Why</CardTitle>
        <CardDescription>Ask why until the answer is a cause you can act on. Each answer explains the one above it.</CardDescription>
      </CardHeader>
      <CardContent>
        <ol>
          <Step label={<Kicker>Problem</Kicker>}>
            <p className="text-sm font-semibold">{rca.title}</p>
          </Step>

          {whys.map((why, index) => (
            <Step
              key={index}
              label={<WhyLabel number={index + 1} />}
              actions={
                editable && (
                  <>
                    <Button variant="ghost" size="icon-sm" aria-label={`Move why ${index + 1} up`} disabled={index === 0} onClick={() => move(index, index - 1)}>
                      <ArrowUp />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Move why ${index + 1} down`}
                      disabled={index === whys.length - 1}
                      onClick={() => move(index, index + 1)}
                    >
                      <ArrowDown />
                    </Button>
                    <Button variant="ghost" size="icon-sm" aria-label={`Remove why ${index + 1}`} onClick={() => remove(index)}>
                      <X />
                    </Button>
                  </>
                )
              }
            >
              {editable ? (
                <EditableText rows={2} label={`Why ${index + 1}`} value={why} className="bg-card" onCommit={(text) => save(index, text)} />
              ) : (
                <p className="text-sm">{why}</p>
              )}
            </Step>
          ))}

          {adding && (
            <Step label={<WhyLabel number={whys.length + 1} />}>
              <EditableText
                autoFocus
                rows={2}
                label={`Why ${whys.length + 1}`}
                value=""
                placeholder="Why did that happen?"
                className="bg-card"
                onCommit={add}
                onDone={() => setAdding(false)}
              />
            </Step>
          )}

          {!whys.length && !adding && (
            <li className="rounded-2xl border border-dashed border-border p-4 text-center text-sm text-muted">
              {editable ? (
                <>
                  No answers yet.{' '}
                  <button type="button" className="font-semibold text-accent hover:underline" onClick={() => setAdding(true)}>
                    Ask the first why
                  </button>
                </>
              ) : (
                'No answers recorded yet.'
              )}
              <ArrowDown aria-hidden className="mx-auto mt-3 size-4 text-silver" />
            </li>
          )}

          <li className="rounded-2xl bg-ink p-4 text-on-ink">
            <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-on-ink-muted">
              <Target aria-hidden className="size-4 text-accent" />
              Root cause
            </p>
            {editable ? (
              <div className="mt-2">
                <EditableText
                  rows={2}
                  label="Root cause"
                  value={rca.rootCause}
                  placeholder="The cause that, once removed, stops the failure from coming back"
                  className="bg-white/10 text-on-ink placeholder:text-on-ink-muted focus:ring-white/25"
                  onCommit={(rootCause) => {
                    update((r) => ({ ...r, rootCause }))
                    toast(rootCause ? 'Root cause saved' : 'Root cause cleared', { tone: 'success' })
                  }}
                />
              </div>
            ) : (
              <p className="mt-2 text-sm font-semibold">{rca.rootCause || 'Not found yet'}</p>
            )}
          </li>
        </ol>
      </CardContent>
    </Card>
  )
}

function WhyLabel({ number }: { number: number }) {
  return (
    <div className="flex items-center gap-2">
      <span className="flex size-6 items-center justify-center rounded-full bg-card text-[11px] font-bold tabular-nums shadow-card">{number}</span>
      <Kicker>Why?</Kicker>
    </div>
  )
}

/** One card in the chain with the arrow to the next one. */
function Step({ label, actions, children }: { label: ReactNode; actions?: ReactNode; children: ReactNode }) {
  return (
    <li>
      <div className="rounded-2xl bg-surface-2 p-3">
        <div className="flex min-h-8 items-center justify-between gap-2">
          {label}
          {actions && <div className="flex items-center">{actions}</div>}
        </div>
        <div className="mt-1.5">{children}</div>
      </div>
      <ArrowDown aria-hidden className="mx-auto my-1 size-4 text-silver" />
    </li>
  )
}
