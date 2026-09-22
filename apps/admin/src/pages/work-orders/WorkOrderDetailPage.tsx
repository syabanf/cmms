import { failureEvents, fmtDate, isActive, isOverdue, recentFailures, toMs } from '@cmms/fixtures'
import { Banner, Button, Card, EmptyState } from '@cmms/ui'
import { ClipboardList, Repeat, ShieldCheck, Siren, TriangleAlert } from 'lucide-react'
import { useMemo } from 'react'
import { Link, useParams } from 'react-router'
import { paths } from '../../components/links'
import { useNow, useScoped } from '../../state/scoped'
import { ActivityCard, AttachmentsCard } from './detail/ActivityCard'
import { ChecklistCard } from './detail/ChecklistCard'
import { FailureCard } from './detail/FailureCard'
import { LaborCard } from './detail/LaborCard'
import { PartsCard } from './detail/PartsCard'
import { ApprovalCard, CostCard, DetailsCard, SafetyCard } from './detail/SidePanel'
import { ToolsCard } from './detail/ToolsCard'
import { useWoAccess } from './detail/useWoAccess'
import { WoHeader } from './detail/WoHeader'

export function WorkOrderDetailPage() {
  const { id } = useParams()
  const { maps } = useScoped()
  const wo = id ? maps.workOrder.get(id) : undefined
  if (!wo) {
    return (
      <Card className="mt-10 max-w-lg mx-auto">
        <EmptyState
          icon={<ClipboardList />}
          title="Work order not found"
          description="It may belong to another site, or the link is old."
          action={
            <Button asChild variant="outline">
              <Link to="/work/orders">All work orders</Link>
            </Button>
          }
        />
      </Card>
    )
  }
  return <WorkOrderView key={wo.id} woId={wo.id} />
}

function WorkOrderView({ woId }: { woId: string }) {
  const s = useScoped()
  const now = useNow(30_000)
  const wo = s.maps.workOrder.get(woId)!
  const access = useWoAccess(wo)
  const asset = s.maps.asset.get(wo.assetId)
  const recent = useMemo(
    () =>
      recentFailures(wo.assetId, failureEvents(s.workOrders), s.settings.repeatWindowDays * 2, now).filter(
        (e) => e.wo.id !== wo.id,
      ),
    [wo.assetId, wo.id, s.workOrders, s.settings.repeatWindowDays, now],
  )
  const rca = s.rcas.find((r) => r.assetId === wo.assetId && r.status !== 'closed')
  const warrantyActive = !!asset?.warranty && toMs(asset.warranty.end) > now
  const active = isActive(wo)

  return (
    <>
      <WoHeader wo={wo} access={access} />

      <div className="mb-4 space-y-3 empty:hidden">
        {wo.downtime && active && (
          <Banner tone="danger" icon={<Siren />} title="Production is stopped on this asset.">
            {asset?.name} stays marked as down until this work order is completed.
          </Banner>
        )}
        {isOverdue(wo, now) && (
          <Banner tone="warning" icon={<TriangleAlert />} title={`Past due since ${fmtDate(wo.dueAt)}.`}>
            {wo.status === 'waiting'
              ? 'The waiting reason explains the delay on the backlog.'
              : 'Reschedule it or raise it with the planner.'}
          </Banner>
        )}
        {active && recent.length >= 2 && (
          <Banner
            tone="danger"
            icon={<Repeat />}
            title={`${recent.length} failures on ${asset?.code} in the last ${s.settings.repeatWindowDays * 2} days.`}
            action={
              rca ? (
                <Button asChild size="sm" variant="outline">
                  <Link to={paths.rca(rca.id)}>{rca.code}</Link>
                </Button>
              ) : undefined
            }
          >
            Most recent: {recent[0]!.wo.title}, {fmtDate(recent[0]!.at)}. Check the RCA before repeating the
            same repair.
          </Banner>
        )}
        {active && warrantyActive && (
          <Banner tone="info" icon={<ShieldCheck />} title="This asset is still covered by warranty.">
            Coverage runs until {fmtDate(asset!.warranty!.end)}
            {asset!.warranty!.vendorId ? ` with ${s.maps.vendor.get(asset!.warranty!.vendorId)?.name}` : ''}.
            Raise a claim before paying for parts.
          </Banner>
        )}
      </div>

      <nav
        aria-label="Work order sections"
        className="top-0 mb-4 py-2 backdrop-blur sticky z-20 no-scrollbar overflow-x-auto bg-surface/95 print:hidden"
      >
        <div className="gap-1 p-1 inline-flex min-w-max rounded-full bg-card shadow-card">
          {[
            ['overview', 'Overview'],
            ['execution', 'Execution'],
            ['resources', 'Resources'],
            ['findings', 'Findings'],
            ['activity', 'Activity'],
          ].map(([id, label]) => (
            <a
              key={id}
              href={`#${id}`}
              className="px-4 py-2 text-sm font-semibold rounded-full text-muted transition-colors hover:bg-surface hover:text-foreground focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:outline-none"
            >
              {label}
            </a>
          ))}
        </div>
      </nav>

      <div className="gap-4 xl:grid-cols-[minmax(0,1fr)_340px] grid grid-cols-1">
        <div className="min-w-0 space-y-4">
          <section id="execution" className="scroll-mt-16" aria-label="Execution">
            <ChecklistCard wo={wo} access={access} />
          </section>
          <section id="resources" className="scroll-mt-16 space-y-4" aria-label="Resources">
            <div className="gap-4 2xl:grid-cols-2 grid grid-cols-1">
              <LaborCard wo={wo} access={access} />
              <PartsCard wo={wo} access={access} />
            </div>
            <ToolsCard wo={wo} access={access} />
            <AttachmentsCard wo={wo} canAdd={access.execute} />
          </section>
          <section id="findings" className="scroll-mt-16" aria-label="Findings">
            <FailureCard key={`${wo.id}-${wo.failure ? 'coded' : 'blank'}`} wo={wo} access={access} />
          </section>
          <section id="activity" className="scroll-mt-16" aria-label="Activity">
            <ActivityCard wo={wo} />
          </section>
        </div>
        <aside id="overview" className="min-w-0 scroll-mt-16 space-y-4" aria-label="Overview">
          <DetailsCard wo={wo} />
          <SafetyCard wo={wo} />
          <CostCard wo={wo} access={access} />
          <ApprovalCard wo={wo} />
        </aside>
      </div>
    </>
  )
}
