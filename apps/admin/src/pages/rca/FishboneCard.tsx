import type { FishboneCategory, Rca } from '@cmms/types'
import { FISHBONE_CATEGORIES, FISHBONE_LABEL } from '@cmms/types'
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, IconTile, Input, cn, toast } from '@cmms/ui'
import type { LucideIcon } from 'lucide-react'
import { CloudSun, Cog, ListChecks, Package, Plus, Ruler, UserRound, X } from 'lucide-react'
import { type FormEvent, useState } from 'react'
import { type RcaUpdate, insertAt } from './lib'

const CATEGORY_ICON: Record<FishboneCategory, LucideIcon> = {
  man: UserRound,
  machine: Cog,
  method: ListChecks,
  material: Package,
  measurement: Ruler,
  environment: CloudSun,
}

/** Possible causes grouped into the six fishbone categories. */
export function FishboneCard({ rca, editable, update }: { rca: Rca; editable: boolean; update: RcaUpdate }) {
  const total = FISHBONE_CATEGORIES.reduce((sum, c) => sum + rca.fishbone[c].length, 0)

  const setCauses = (category: FishboneCategory, change: (causes: string[]) => string[]) =>
    update((r) => ({ ...r, fishbone: { ...r.fishbone, [category]: change(r.fishbone[category]) } }))

  const add = (category: FishboneCategory, text: string) => {
    if (rca.fishbone[category].some((c) => c.toLowerCase() === text.toLowerCase())) {
      toast(`Already listed under ${FISHBONE_LABEL[category]}`)
      return false
    }
    setCauses(category, (causes) => [...causes, text])
    toast(`Cause added under ${FISHBONE_LABEL[category]}`, { tone: 'success' })
    return true
  }

  const remove = (category: FishboneCategory, index: number) => {
    const text = rca.fishbone[category][index] ?? ''
    setCauses(category, (causes) => causes.filter((_, i) => i !== index))
    toast('Cause removed', { action: { label: 'Undo', onClick: () => setCauses(category, (causes) => insertAt(causes, index, text)) } })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Fishbone</CardTitle>
        <CardDescription>
          {total
            ? `${total} possible ${total === 1 ? 'cause' : 'causes'} across the six categories. Keep the ones the evidence supports.`
            : 'List possible causes under each category, then test them against the evidence.'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {FISHBONE_CATEGORIES.map((category) => (
            <Category
              key={category}
              category={category}
              causes={rca.fishbone[category]}
              editable={editable}
              onAdd={(text) => add(category, text)}
              onRemove={(index) => remove(category, index)}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

function Category({
  category,
  causes,
  editable,
  onAdd,
  onRemove,
}: {
  category: FishboneCategory
  causes: string[]
  editable: boolean
  /** Returns false when the cause was not added. */
  onAdd: (text: string) => boolean
  onRemove: (index: number) => void
}) {
  const [draft, setDraft] = useState('')
  const Icon = CATEGORY_ICON[category]
  const label = FISHBONE_LABEL[category]

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const text = draft.trim()
    if (text && onAdd(text)) setDraft('')
  }

  return (
    <section aria-label={label} className="flex flex-col rounded-2xl bg-surface-2 p-4">
      <div className="flex items-center gap-2">
        <IconTile size="sm">
          <Icon />
        </IconTile>
        <h4 className="text-sm font-semibold">{label}</h4>
        <span className="ml-auto text-xs tabular-nums text-muted">{causes.length}</span>
      </div>
      {causes.length ? (
        <ul className="mt-3 flex flex-wrap gap-1.5">
          {causes.map((cause, index) => (
            <li
              key={`${index}:${cause}`}
              className={cn('inline-flex max-w-full items-center gap-1 rounded-full bg-card py-1 pl-3 text-xs font-medium shadow-card', editable ? 'pr-1' : 'pr-3')}
            >
              <span className="min-w-0 break-words">{cause}</span>
              {editable && (
                <button
                  type="button"
                  aria-label={`Remove ${cause}`}
                  onClick={() => onRemove(index)}
                  className="flex size-5 shrink-0 items-center justify-center rounded-full text-muted transition-colors hover:bg-surface hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
                >
                  <X aria-hidden className="size-3" />
                </button>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-xs text-muted">No causes listed</p>
      )}
      {editable && (
        <form onSubmit={submit} className="mt-auto pt-3">
          <Input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            aria-label={`Add a cause under ${label}`}
            placeholder="Add a cause"
            inputClassName="h-9 rounded-full pl-3.5 text-[13px]"
            rightSlot={
              <Button type="submit" variant="ghost" size="icon-sm" aria-label={`Add cause under ${label}`} disabled={!draft.trim()}>
                <Plus />
              </Button>
            }
          />
        </form>
      )}
    </section>
  )
}
