import { toMs } from '@cmms/fixtures'
import type { WorkOrder } from '@cmms/types'
import { Button, Card, Chip, EmptyState, LazySentinel, SegmentedTabs, useLazyList } from '@cmms/ui'
import { CircleCheck, ClipboardList, Hourglass, ScanLine } from 'lucide-react'
import { type ReactNode, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { WoCard } from '../../components/WoCard'
import { ScreenHeader } from '../../layouts/ScreenHeader'
import { paths } from '../../lib/paths'
import { TYPE_FILTERS, type TypeFilter, WORK_TABS, type WorkTab, byUrgency, isTypeFilter, matchesType, workTab } from '../../lib/work'
import { useMobileScope, useNow } from '../../state/scope'

export function WorkListPage() {
  const { myWork, site } = useMobileScope()
  const now = useNow()
  const [params, setParams] = useSearchParams()
  const typeParam = params.get('type')
  const filter: TypeFilter = isTypeFilter(typeParam) ? typeParam : 'all'
  const setFilter = (next: TypeFilter) => setParams(next === 'all' ? {} : { type: next }, { replace: true })

  const groups = useMemo(() => {
    const out: Record<WorkTab, WorkOrder[]> = { todo: [], doing: [], done: [] }
    for (const wo of myWork) {
      const tab = workTab(wo, now)
      if (tab && matchesType(wo, filter)) out[tab].push(wo)
    }
    out.todo.sort(byUrgency(now))
    out.doing.sort(byUrgency(now))
    out.done.sort((a, b) => toMs(b.completedAt ?? b.dueAt) - toMs(a.completedAt ?? a.dueAt))
    return out
  }, [myWork, filter, now])

  const [tab, setTab] = useState<WorkTab>(() => (groups.todo.length || !groups.doing.length ? 'todo' : 'doing'))
  const lazy = useLazyList(groups[tab], { resetKey: [tab, filter] })
  const open = groups.todo.length + groups.doing.length
  // Mid-sentence the filter reads in lower case, except the PM abbreviation.
  const filterWord = filter === 'preventive' ? 'PM' : filter

  const empty: Record<WorkTab, { icon: ReactNode; title: string; description: string; action: ReactNode }> = {
    todo: {
      icon: <CircleCheck />,
      title: filter === 'all' ? 'Nothing waiting for you' : `No ${filterWord} work to start`,
      description: 'New assignments from your supervisor land here.',
      action: groups.doing.length ? (
        <Button variant="outline" className="h-11" onClick={() => setTab('doing')}>
          Open Doing
        </Button>
      ) : (
        <ScanAction />
      ),
    },
    doing: {
      icon: <Hourglass />,
      title: 'No work in progress',
      description: 'Start a job from To do and it moves here while you work on it.',
      action: groups.todo.length ? (
        <Button variant="outline" className="h-11" onClick={() => setTab('todo')}>
          Open To do
        </Button>
      ) : (
        <ScanAction />
      ),
    },
    done: {
      icon: <ClipboardList />,
      title: 'Nothing finished in the last 14 days',
      description: 'Completed work stays here for two weeks so you can look back at readings and parts.',
      action: (
        <Button variant="outline" className="h-11" onClick={() => setTab('todo')}>
          Open To do
        </Button>
      ),
    },
  }

  return (
    <div className="space-y-5">
      <ScreenHeader greeting={`${open} open · ${site.name}`} title="My work" />

      <div role="group" aria-label="Work type" className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5 pb-1">
        {TYPE_FILTERS.map((f) => (
          <Chip key={f.value} variant="filter" active={filter === f.value} onClick={() => setFilter(f.value)} className="h-11">
            {f.label}
          </Chip>
        ))}
      </div>

      <SegmentedTabs
        items={WORK_TABS.map((t) => ({ ...t, count: groups[t.value].length }))}
        value={tab}
        onValueChange={(v) => setTab(v as WorkTab)}
        urgentValue={groups.todo.some((w) => w.priority === 'P1') ? 'todo' : undefined}
        className="[&>[role=tab]]:h-11"
      />

      {groups[tab].length ? (
        <div className="space-y-3">
          {lazy.visible.map((wo) => (
            <WoCard key={wo.id} wo={wo} now={now} />
          ))}
          <LazySentinel remaining={lazy.remaining} onLoad={lazy.loadMore} sentinelRef={lazy.sentinelRef} />
        </div>
      ) : (
        <Card>
          <EmptyState icon={empty[tab].icon} title={empty[tab].title} description={empty[tab].description} action={empty[tab].action} />
        </Card>
      )}
    </div>
  )
}

function ScanAction() {
  return (
    <Button asChild variant="outline" className="h-11">
      <Link to={paths.scan}>
        <ScanLine />
        Scan an asset
      </Link>
    </Button>
  )
}
