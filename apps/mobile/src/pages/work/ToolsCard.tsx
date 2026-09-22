import { toolBlockReason } from '@cmms/fixtures'
import type { Tool, WorkOrder } from '@cmms/types'
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  EmptyState,
  IconTile,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  cn,
  toast,
} from '@cmms/ui'
import { ChevronRight, Wrench } from 'lucide-react'
import { useState } from 'react'
import { useMobileScope } from '../../state/scope'

type Block = { reason: string; className: string }

export function ToolsCard({ wo, editable }: { wo: WorkOrder; editable: boolean }) {
  const { maps, dispatch } = useMobileScope()
  // Kept after close so the sheet does not go blank while it slides away.
  const [category, setCategory] = useState('')
  const [picking, setPicking] = useState(false)
  const held = wo.toolIds.map((id) => maps.tool.get(id)).filter((t) => !!t)
  const missing = wo.requiredTools.filter((c) => !held.some((t) => t.category === c))
  if (!held.length && !missing.length) return null

  const release = (tool: Tool) => {
    dispatch({ type: 'workOrders/releaseTool', id: wo.id, toolId: tool.id })
    toast(`${tool.code} returned`, { tone: 'success', description: `Put it back at ${tool.location}.` })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Tools</CardTitle>
        <CardDescription>
          {missing.length ? `${missing.length} of ${wo.requiredTools.length} required tools not checked out` : 'Every required tool is checked out'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {held.map((tool) => (
          <div key={tool.id} className="flex items-center gap-3 rounded-2xl bg-surface-2 p-3.5">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-muted">{tool.category}</p>
              <p className="truncate text-sm font-semibold">{tool.name}</p>
              <p className="font-mono text-[11px] text-muted">{tool.code}</p>
            </div>
            {editable && (
              <Button variant="outline" className="h-11" onClick={() => release(tool)}>
                Return
              </Button>
            )}
          </div>
        ))}
        {missing.map((c) => (
          <div key={c} className="flex items-center gap-3 rounded-2xl bg-surface-2 p-3.5">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">{c}</p>
              <p className="text-xs text-muted">Not checked out</p>
            </div>
            {editable && (
              <Button
                variant="secondary"
                className="h-11"
                onClick={() => {
                  setCategory(c)
                  setPicking(true)
                }}
              >
                Assign
              </Button>
            )}
          </div>
        ))}
      </CardContent>
      {editable && <ToolSheet wo={wo} category={category} open={picking} onOpenChange={setPicking} />}
    </Card>
  )
}

function ToolSheet({
  wo,
  category,
  open,
  onOpenChange,
}: {
  wo: WorkOrder
  category: string
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { tools, dispatch, personName } = useMobileScope()
  const options = tools.filter((t) => t.category === category)

  // Lost, in repair or out of calibration first; then tools someone else holds.
  const blockOf = (tool: Tool): Block | null => {
    const reason = toolBlockReason(tool)
    if (reason) return { reason, className: reason === 'In repair' ? 'text-warning' : 'text-accent' }
    if (tool.status === 'in_use') return { reason: `In use by ${personName(tool.holderId)}`, className: 'text-info' }
    return null
  }

  const assign = (tool: Tool) => {
    dispatch({ type: 'workOrders/assignTool', id: wo.id, toolId: tool.id })
    toast(`${tool.code} checked out`, { tone: 'success', description: `Collect it at ${tool.location}.` })
    onOpenChange(false)
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom">
        <SheetHeader>
          <SheetTitle>{category}</SheetTitle>
          <SheetDescription>Pick the one you take from the tool crib.</SheetDescription>
        </SheetHeader>
        <div className="space-y-1 px-3 pb-2">
          {options.map((tool) => {
            const block = blockOf(tool)
            return (
              <button
                key={tool.id}
                type="button"
                disabled={!!block}
                onClick={() => assign(tool)}
                className="flex min-h-14 w-full items-center gap-3 rounded-2xl px-3 py-2 text-left transition-colors hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 disabled:cursor-not-allowed disabled:hover:bg-transparent"
              >
                <IconTile size="sm" tone={block ? 'default' : 'success'} className={cn(block && 'text-muted')}>
                  <Wrench aria-hidden="true" />
                </IconTile>
                <span className="min-w-0 flex-1">
                  <span className={cn('block truncate text-sm font-semibold', block && 'text-muted')}>{tool.name}</span>
                  <span className="block truncate text-xs text-muted">
                    <span className="font-mono">{tool.code}</span> · {tool.location}
                  </span>
                  {block && <span className={cn('block text-xs font-semibold', block.className)}>{block.reason}</span>}
                </span>
                {!block && <ChevronRight aria-hidden="true" className="size-4 shrink-0 text-muted" />}
              </button>
            )
          })}
          {!options.length && (
            <EmptyState
              compact
              icon={<Wrench />}
              title="No tool of this kind at the site"
              description="Ask the tool crib to transfer one, then assign it here."
            />
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
