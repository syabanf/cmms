import { fmtAgo, fmtIdrShort, toMs, urgency } from '@cmms/fixtures'
import { PRIORITIES } from '@cmms/types'
import { Banner, Button, Card, CardDescription, CardHeader, CardTitle, CountBadge, EmptyState, PageHeader } from '@cmms/ui'
import { BadgeCheck, Workflow } from 'lucide-react'
import { useMemo } from 'react'
import { Link } from 'react-router'
import { useAuth } from '../../auth/auth'
import { useNow, useScoped } from '../../state/scoped'
import { ApprovalCard } from './ApprovalCard'
import { DecidedTable } from './DecidedTable'
import { approvalRules, hasApproval, joinList } from './lib'

export function ApprovalsPage() {
  const { workOrders, settings } = useScoped()
  const now = useNow()
  const { can } = useAuth()

  const withApproval = useMemo(() => workOrders.filter(hasApproval), [workOrders])
  const pending = useMemo(
    () => withApproval.filter((wo) => wo.approval.status === 'pending').sort((a, b) => urgency(a, now) - urgency(b, now)),
    [withApproval, now],
  )
  const decided = useMemo(() => withApproval.filter((wo) => wo.approval.status !== 'pending'), [withApproval])
  const oldestRequest = Math.min(...pending.map((wo) => toMs(wo.requestedAt)))
  const gated = PRIORITIES.filter((p) => settings.approvalByPriority[p] !== 'auto')

  return (
    <>
      <PageHeader
        title="Approvals"
        description="Not every work order needs approval. These rules decide which ones wait here before work can start."
      />

      <Banner
        tone="info"
        icon={<Workflow />}
        title="Current rules"
        action={
          <Button asChild size="sm" variant="secondary">
            <Link to="/settings/rules">{can('settings.manage') ? 'Edit rules' : 'View rules'}</Link>
          </Button>
        }
      >
        <ul className="mt-1 grid grid-cols-1 gap-x-6 gap-y-1 md:grid-cols-2">
          {approvalRules(settings).map((rule) => (
            <li key={rule} className="flex items-start gap-2">
              <span aria-hidden="true" className="mt-[7px] size-1.5 shrink-0 rounded-full bg-info" />
              {rule}
            </li>
          ))}
        </ul>
      </Banner>

      <section aria-labelledby="approvals-pending" className="mt-6">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 id="approvals-pending" className="flex items-center gap-2 text-base font-semibold">
            Waiting for a decision
            <CountBadge count={pending.length} />
          </h2>
          {pending.length > 0 && <p className="text-xs text-muted">Oldest requested {fmtAgo(oldestRequest, now)}</p>}
        </div>
        {pending.length ? (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {pending.map((wo) => (
              <ApprovalCard key={wo.id} wo={wo} now={now} />
            ))}
          </div>
        ) : (
          <Card>
            <EmptyState
              icon={<BadgeCheck />}
              title="Nothing waiting for approval"
              description={`${gated.length ? `${joinList(gated, 'and')} work and anything` : 'Anything'} estimated above ${fmtIdrShort(settings.managerApprovalAbove)} lands here before work starts.`}
              action={
                <Button asChild variant="outline">
                  <Link to="/work/orders">View work orders</Link>
                </Button>
              }
            />
          </Card>
        )}
      </section>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Decided</CardTitle>
          <CardDescription>Approvals and rejections, newest first. Open a row for the full work order.</CardDescription>
        </CardHeader>
        <DecidedTable rows={decided} />
      </Card>
    </>
  )
}
