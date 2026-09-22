import { fmtNumber, fmtWhen, isOverdue, plural } from '@cmms/fixtures'
import type { WorkOrder } from '@cmms/types'
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, EmptyState, cn, toast } from '@cmms/ui'
import { PackageCheck, PackagePlus } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { useAuth } from '../../auth/auth'
import { PriorityBadge, WoStatusBadge } from '../../components/badges'
import { AssetLink, WoLink, paths } from '../../components/links'
import { useScoped } from '../../state/scoped'
import { type PickGroup, type PickLine, issuableLines, issueBlock } from './lib'

function Figure({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className={cn('w-24 shrink-0', className)}>
      <p className="text-[11px] font-medium text-muted">{label}</p>
      <div className="text-sm font-semibold tabular-nums">{children}</div>
    </div>
  )
}

export function PickList({ groups, onReceive }: { groups: PickGroup[]; onReceive: (partId: string) => void }) {
  const { maps, dispatch } = useScoped()
  const { can } = useAuth()
  const canIssue = can('inventory.issue')
  const canReceive = can('inventory.manage')

  const issue = (wo: WorkOrder, picks: PickLine[]) => {
    for (const { line } of picks) dispatch({ type: 'workOrders/partStatus', id: wo.id, lineId: line.id, status: 'issued' })
    return picks.length
  }

  const issueOne = (wo: WorkOrder, pick: PickLine) => {
    issue(wo, [pick])
    const unit = pick.part?.unit ?? ''
    const left = (pick.stock?.onHand ?? 0) - pick.line.qty
    toast(`Issued ${fmtNumber(pick.line.qty)} ${unit} ${pick.part?.code ?? 'part'}`, {
      tone: 'success',
      description: `To ${wo.code}. ${fmtNumber(left)} ${unit} left${pick.stock?.bin ? ` in ${pick.stock.bin}` : ''}.`,
    })
  }

  const issueAll = (group: PickGroup) => {
    const picks = issuableLines(group)
    const skipped = group.lines.filter((l) => !picks.includes(l))
    issue(group.wo, picks)
    toast(`Issued ${plural(picks.length, 'line')} to ${group.wo.code}`, {
      tone: 'success',
      description: skipped.length ? `Still to pick: ${skipped.map((l) => l.part?.code ?? 'removed part').join(', ')}.` : 'Every reserved part is with the technician.',
    })
  }

  if (groups.length === 0) {
    return (
      <Card>
        <EmptyState
          icon={<PackageCheck />}
          title="Nothing to pick"
          description="Parts reserved on open work orders appear here. Planners reserve them when they add parts or a job plan to a work order."
          action={
            <Button asChild variant="outline" size="sm">
              <Link to="/work/orders">Open work orders</Link>
            </Button>
          }
        />
      </Card>
    )
  }

  const lineCount = groups.reduce((sum, g) => sum + g.lines.length, 0)
  const shortCount = groups.reduce((sum, g) => sum + g.lines.filter((l) => l.free < 0).length, 0)

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted">
        {plural(lineCount, 'line')} on {plural(groups.length, 'work order')}, most urgent first.
        {shortCount > 0 && <span className="font-medium text-accent"> {plural(shortCount, 'line')} short.</span>}
        {!canIssue && ' Warehouse staff issue the parts.'}
      </p>
      {groups.map((group) => {
        const { wo, lines } = group
        const ready = issuableLines(group)
        const pending = wo.approval?.status === 'pending'
        return (
          <Card key={wo.id}>
            <CardHeader
              action={
                canIssue ? (
                  <Button size="sm" variant="secondary" disabled={ready.length === 0} onClick={() => issueAll(group)}>
                    <PackageCheck />
                    Issue all
                  </Button>
                ) : undefined
              }
            >
              <div className="flex flex-wrap items-center gap-2">
                <WoLink woId={wo.id} />
                <PriorityBadge priority={wo.priority} />
                <WoStatusBadge status={wo.status} waitingReason={wo.waitingReason} />
                {pending && <Badge variant="warning">Awaiting approval</Badge>}
              </div>
              <CardTitle className="mt-1">{wo.title}</CardTitle>
              <div className="mt-1 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
                <AssetLink assetId={wo.assetId} className="max-w-full" />
                <span className={cn('whitespace-nowrap', isOverdue(wo) ? 'font-medium text-accent' : 'text-muted')}>Due {fmtWhen(wo.dueAt)}</span>
              </div>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {lines.map((pick) => {
                  const { line, part, stock, free } = pick
                  const onHand = stock?.onHand ?? 0
                  const block = issueBlock(wo, line, onHand)
                  return (
                    <li key={line.id} className="flex flex-wrap items-center gap-x-6 gap-y-3 rounded-2xl bg-surface-2 p-3">
                      <div className="min-w-48 flex-1">
                        {part ? (
                          <Link to={paths.part(part.id)} className="hover:text-accent">
                            <span className="font-mono text-xs font-medium">{part.code}</span> <span className="font-medium">{part.name}</span>
                          </Link>
                        ) : (
                          <span className="text-muted">Removed part</span>
                        )}
                        <p className="text-xs text-muted">
                          {stock?.bin ? `Bin ${stock.bin}` : 'No bin'} · {maps.warehouse.get(line.warehouseId)?.name ?? 'Removed warehouse'}
                        </p>
                      </div>
                      <Figure label="Pick">
                        {fmtNumber(line.qty)} <span className="text-xs font-normal text-muted">{part?.unit}</span>
                      </Figure>
                      <Figure label="On hand">{fmtNumber(onHand)}</Figure>
                      <Figure label="Free after issue" className="w-32">
                        <span className="inline-flex items-center gap-2">
                          <span className={cn(free < 0 && 'text-accent')}>{fmtNumber(free)}</span>
                          {free < 0 && <Badge variant="danger">Short</Badge>}
                        </span>
                      </Figure>
                      {(canIssue || (free < 0 && canReceive)) && (
                        <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
                          {canIssue && block && <span className="text-xs text-muted">{block}</span>}
                          {free < 0 && canReceive && part && (
                            <Button size="sm" variant="ghost" onClick={() => onReceive(part.id)}>
                              <PackagePlus />
                              Receive
                            </Button>
                          )}
                          {canIssue && (
                            <Button size="sm" variant="outline" disabled={!!block} onClick={() => issueOne(wo, pick)}>
                              <PackageCheck />
                              Issue
                            </Button>
                          )}
                        </div>
                      )}
                    </li>
                  )
                })}
              </ul>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
