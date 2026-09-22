import type { Vendor } from '@cmms/types'
import { Button, Card, Chip, ChipRow, EmptyState, Input, PageHeader, toast } from '@cmms/ui'
import { Building2, Plus, Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import { useAuth } from '../../auth/auth'
import { paths } from '../../components/links'
import { useHistoryState } from '../../lib/history-state'
import { useNow, useScoped } from '../../state/scoped'
import { serviceTypesOf, vendorJobs, vendorStats } from './lib'
import { VendorCard } from './VendorCard'
import { VendorDialog } from './VendorDialog'

const matchesQuery = (v: Vendor, q: string) => !q || [v.name, v.pic, v.email, v.contractNo, ...v.serviceTypes].some((field) => field.toLowerCase().includes(q))

export function VendorsPage() {
  const { vendors, workOrders, site } = useScoped()
  const { can } = useAuth()
  const navigate = useNavigate()
  const canManage = can('masterdata.manage') || can('inventory.manage')
  const now = useNow(60_000)
  const [query, setQuery] = useHistoryState('query', '')
  const [type, setType] = useHistoryState<string | null>('type', null)
  const [creating, setCreating] = useState(false)

  const types = useMemo(() => serviceTypesOf(vendors), [vendors])

  const q = query.trim().toLowerCase()
  const searched = vendors.filter((v) => matchesQuery(v, q))
  const visible = (type ? searched.filter((v) => v.serviceTypes.includes(type)) : searched).sort((a, b) => a.name.localeCompare(b.name))

  const clearFilters = () => {
    setQuery('')
    setType(null)
  }

  return (
    <>
      <PageHeader
        title="Vendors"
        description={`Service partners and suppliers, their contracts, and how they perform on work at ${site.name}.`}
        actions={
          <>
            <Input
              variant="pill"
              className="w-full sm:w-72"
              leftIcon={<Search />}
              value={query}
              placeholder="Search vendor, PIC or service"
              aria-label="Search vendors"
              onChange={(e) => setQuery(e.target.value)}
            />
            {canManage && (
              <Button onClick={() => setCreating(true)}>
                <Plus />
                Add vendor
              </Button>
            )}
          </>
        }
      />

      {types.length > 0 && (
        <ChipRow className="mb-4" aria-label="Filter by service type">
          <Chip variant="filter" active={type === null} count={searched.length} onClick={() => setType(null)}>
            All services
          </Chip>
          {types.map((t) => {
            const count = searched.filter((v) => v.serviceTypes.includes(t)).length
            if (!count && type !== t) return null
            return (
              <Chip key={t} variant="filter" active={type === t} count={count} onClick={() => setType(type === t ? null : t)}>
                {t}
              </Chip>
            )
          })}
        </ChipRow>
      )}

      {visible.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {visible.map((v) => (
            <VendorCard key={v.id} vendor={v} now={now} stats={vendorStats(vendorJobs(workOrders, v.id), now)} />
          ))}
        </div>
      ) : (
        <Card>
          {vendors.length === 0 ? (
            <EmptyState
              icon={<Building2 />}
              title="No vendors yet"
              description="Add the service partners and suppliers you work with. Work orders and parts pick them from this list."
              action={
                canManage ? (
                  <Button onClick={() => setCreating(true)}>
                    <Plus />
                    Add vendor
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <EmptyState
              icon={<Search />}
              title={q ? `No vendors match "${query.trim()}"` : 'No vendors offer this service'}
              description="Search by name, PIC, contract number or service type."
              action={
                <Button variant="outline" onClick={clearFilters}>
                  Clear filters
                </Button>
              }
            />
          )}
        </Card>
      )}

      <VendorDialog
        open={creating}
        onOpenChange={setCreating}
        editing={null}
        onSaved={(v) => {
          toast(`${v.name} added`, { tone: 'success', description: 'Pick it on parts and on vendor work orders.' })
          navigate(paths.vendor(v.id))
        }}
      />
    </>
  )
}
