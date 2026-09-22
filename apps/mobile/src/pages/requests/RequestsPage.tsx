import { Button, Card, EmptyState, LazySentinel, SegmentedTabs, useLazyList } from '@cmms/ui'
import { Inbox, Plus, ScanLine } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { RequestCard } from '../../components/RequestCard'
import { ScreenHeader } from '../../layouts/ScreenHeader'
import { paths } from '../../lib/paths'
import { useMobileScope, useNow } from '../../state/scope'

type RequestTab = 'mine' | 'area'

export function RequestsPage() {
  const { isTechnician, myRequests, areaRequests, site, user, maps } = useMobileScope()
  const now = useNow()
  const [tab, setTab] = useState<RequestTab>('mine')
  const lists = { mine: myRequests, area: areaRequests }
  const current: RequestTab = isTechnician ? tab : 'mine'
  const items = lists[current]
  const lazy = useLazyList(items, { resetKey: current })
  const teamName = user.technician ? maps.team.get(user.technician.teamId)?.name : undefined

  return (
    <div className="space-y-5 pb-16">
      <ScreenHeader greeting={site.name} title="Requests" />

      {isTechnician && (
        <SegmentedTabs
          items={[
            { value: 'mine', label: 'Mine', count: lists.mine.length },
            { value: 'area', label: 'Open in my area', count: lists.area.length },
          ]}
          value={tab}
          onValueChange={(v) => setTab(v as RequestTab)}
          urgentValue={lists.area.some((r) => r.status === 'new') ? 'area' : undefined}
          className="[&>[role=tab]]:h-11"
        />
      )}

      {items.length ? (
        <div className="space-y-3">
          {lazy.visible.map((r) => (
            <RequestCard key={r.id} request={r} now={now} showReporter={current === 'area'} />
          ))}
          <LazySentinel remaining={lazy.remaining} onLoad={lazy.loadMore} sentinelRef={lazy.sentinelRef} />
        </div>
      ) : current === 'mine' ? (
        <Card>
          <EmptyState
            icon={<Inbox />}
            title="You have not reported anything yet"
            description="Report noises, leaks or stoppages here and follow each one until it is fixed."
            action={
              <Button asChild variant="outline" className="h-11">
                <Link to={paths.newRequest()}>Report a problem</Link>
              </Button>
            }
          />
        </Card>
      ) : (
        <Card>
          <EmptyState
            icon={<Inbox />}
            title="No open requests in your area"
            description={`New reports on ${teamName ? `machines the ${teamName} team maintains` : "your team's machines"} show up here until the supervisor decides on them.`}
            action={
              <Button asChild variant="outline" className="h-11">
                <Link to={paths.scan}>
                  <ScanLine />
                  Scan an asset
                </Link>
              </Button>
            }
          />
        </Card>
      )}

      <div className="pointer-events-none fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+5.5rem)] z-30 mx-auto flex w-full max-w-md justify-end px-5">
        <Button asChild size="lg" className="pointer-events-auto">
          <Link to={paths.newRequest()}>
            <Plus />
            Report a problem
          </Link>
        </Button>
      </div>
    </div>
  )
}
