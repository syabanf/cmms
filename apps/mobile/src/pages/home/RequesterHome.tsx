import { Button, Card, EmptyState, LazySentinel, useLazyList } from '@cmms/ui'
import { Inbox, Plus, ScanLine } from 'lucide-react'
import { Link } from 'react-router'
import { RequestCard } from '../../components/RequestCard'
import { Section } from '../../components/Section'
import { ScreenHeader } from '../../layouts/ScreenHeader'
import { paths } from '../../lib/paths'
import { greeting } from '../../lib/time'
import { useMobileScope, useNow } from '../../state/scope'

export function RequesterHome() {
  const { user, myRequests } = useMobileScope()
  const now = useNow()
  const lazy = useLazyList(myRequests)

  return (
    <div className="space-y-6">
      <ScreenHeader greeting={greeting(user.name, now)} title="Report it early" />

      <Button asChild size="lg" className="w-full">
        <Link to={paths.newRequest()}>
          <Plus />
          Report a problem
        </Link>
      </Button>

      <Section title="Your requests" count={myRequests.length}>
        {myRequests.length ? (
          <div className="space-y-3">
            {lazy.visible.map((r) => (
              <RequestCard key={r.id} request={r} now={now} />
            ))}
            <LazySentinel remaining={lazy.remaining} onLoad={lazy.loadMore} sentinelRef={lazy.sentinelRef} />
          </div>
        ) : (
          <Card>
            <EmptyState
              compact
              icon={<Inbox />}
              title="Nothing reported yet"
              description="Noticed a noise, a leak or a machine that stopped? Report it and follow the fix here."
              action={
                <Button asChild variant="outline" className="h-11">
                  <Link to={paths.newRequest()}>Report a problem</Link>
                </Button>
              }
            />
          </Card>
        )}
      </Section>

      <section className="rounded-[24px] bg-info-soft p-5">
        <h2 className="text-base font-bold">What happens after you report</h2>
        <p className="mt-1 text-sm text-body/70">
          A supervisor reviews every report. It becomes a work order for a technician, stays on watch, or gets closed with a note.
          Each step shows on the request. Scanning the tag on the machine fills in the asset for you.
        </p>
        <Button asChild variant="card" className="mt-4 h-11">
          <Link to={paths.scan}>
            <ScanLine />
            Scan a machine tag
          </Link>
        </Button>
      </section>
    </div>
  )
}
