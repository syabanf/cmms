import { fmtDate, plural, toMs } from '@cmms/fixtures'
import { Button, Input, PageHeader, PillTabs, StatCard } from '@cmms/ui'
import { CircleAlert, Factory, Network, Plus, Rows3, Search, ShieldAlert, ShieldCheck } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { useAuth } from '../../auth/auth'
import { paths } from '../../components/links'
import { useHistoryState } from '../../lib/history-state'
import { usePersistentState } from '../../lib/storage'
import { useNow, useScoped } from '../../state/scoped'
import { AssetDialog } from './AssetDialog'
import { AssetHierarchy } from './AssetHierarchy'
import { AssetRegistry } from './AssetRegistry'
import { NO_FILTERS, type RegistryFilters, underWarranty } from './lib'

type View = 'registry' | 'hierarchy'

export function AssetsPage() {
  const { assets, site } = useScoped()
  const { can } = useAuth()
  const navigate = useNavigate()
  const now = useNow(60_000)
  const [params, setParams] = useSearchParams()
  const [storedView, setView] = usePersistentState<View>('cmms.admin.assets.view', 'registry')
  const view: View = storedView === 'hierarchy' ? 'hierarchy' : 'registry'
  const [query, setQuery] = useHistoryState('query', '')
  const [filters, setFilters] = useHistoryState<RegistryFilters>('filters', NO_FILTERS)
  const [adding, setAdding] = useState(false)
  const canManage = can('asset.manage')
  const fromLink = params.get('new') === '1'

  const stats = useMemo(() => {
    const components = assets.filter((a) => a.parentId).length
    const down = assets.filter((a) => a.status === 'down')
    const critical = assets.filter((a) => a.criticality === 'A')
    const covered = assets.filter((a) => underWarranty(a, now))
    const nextEnd = Math.min(...covered.flatMap((a) => (a.warranty ? [toMs(a.warranty.end)] : [])))
    return { components, down, critical, covered, nextEnd }
  }, [assets, now])

  const showRegistry = (next: RegistryFilters) => {
    setFilters(next)
    setView('registry')
  }
  const closeDialog = () => {
    setAdding(false)
    if (!fromLink) return
    setParams(
      (p) => {
        p.delete('new')
        return p
      },
      { replace: true },
    )
  }

  return (
    <>
      <PageHeader
        title="Assets"
        description={`Every machine and component in ${site.name}, each with its passport, history and parts list.`}
        className="[&>div:last-child]:w-full sm:[&>div:last-child]:w-auto"
        actions={
          <>
            <Input
              variant="pill"
              aria-label="Search assets"
              leftIcon={<Search />}
              placeholder="Search code, name, serial"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="min-w-0 flex-1 sm:w-72 sm:flex-none"
            />
            {canManage && (
              <Button onClick={() => setAdding(true)}>
                <Plus />
                Add asset
              </Button>
            )}
          </>
        }
      />

      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
          <StatCard
            label="Total assets"
            value={assets.length}
            hint={`${plural(assets.length - stats.components, 'machine')} · ${plural(stats.components, 'component')}`}
            icon={<Factory />}
            tone="ink"
            onClick={() => showRegistry(NO_FILTERS)}
          />
          <StatCard
            label="Down now"
            value={stats.down.length}
            hint={stats.down.length ? stats.down.map((a) => a.code).join(', ') : 'No breakdowns right now'}
            icon={<CircleAlert />}
            tone={stats.down.length ? 'danger' : 'success'}
            onClick={() => showRegistry({ ...NO_FILTERS, status: 'down' })}
          />
          <StatCard
            label="Critical class A"
            value={stats.critical.length}
            hint={`${assets.length ? Math.round((stats.critical.length / assets.length) * 100) : 0}% of the register`}
            icon={<ShieldAlert />}
            onClick={() => showRegistry({ ...NO_FILTERS, classes: ['A'] })}
          />
          <StatCard
            label="Under warranty"
            value={stats.covered.length}
            hint={stats.covered.length ? `Next one ends ${fmtDate(stats.nextEnd)}` : 'No active warranties'}
            icon={<ShieldCheck />}
            tone="info"
            onClick={() => showRegistry({ ...NO_FILTERS, underWarranty: true })}
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <PillTabs
            items={[
              { value: 'registry', label: 'Registry', icon: <Rows3 /> },
              { value: 'hierarchy', label: 'Hierarchy', icon: <Network /> },
            ]}
            value={view}
            onValueChange={(v) => setView(v === 'hierarchy' ? 'hierarchy' : 'registry')}
          />
          {query.trim() && (
            <Button variant="ghost" size="sm" onClick={() => setQuery('')}>
              Clear search
            </Button>
          )}
        </div>

        {view === 'registry' ? (
          <AssetRegistry
            query={query}
            filters={filters}
            onFiltersChange={setFilters}
            now={now}
            onReset={() => {
              setQuery('')
              setFilters(NO_FILTERS)
            }}
            onAdd={canManage ? () => setAdding(true) : undefined}
          />
        ) : (
          <AssetHierarchy key={site.id} query={query} />
        )}
      </div>

      <AssetDialog
        open={canManage && (adding || fromLink)}
        onOpenChange={(open) => {
          if (!open) closeDialog()
        }}
        onSaved={(asset, created) => {
          // Replace the ?new=1 entry so Back does not reopen the form.
          if (created) navigate(paths.asset(asset.id), { replace: fromLink })
        }}
      />
    </>
  )
}
