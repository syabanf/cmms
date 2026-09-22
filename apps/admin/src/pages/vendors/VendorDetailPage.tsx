import { isActive, plural } from '@cmms/fixtures'
import { Button, Card, ConfirmDialog, EmptyState, PageHeader, toast } from '@cmms/ui'
import { Building2, Pencil, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { useAuth } from '../../auth/auth'
import { BackButton } from '../../components/BackButton'
import { useNow, useScoped } from '../../state/scoped'
import { ContractBadge, Rating } from './badges'
import { ContactCard, ContractCard, PerformanceCard, SuppliedPartsCard, VendorJobsCard } from './VendorDetailCards'
import { VendorDialog } from './VendorDialog'
import { vendorJobs, vendorStats } from './lib'

/** "A", "A and B", "A, B, C and 3 more" */
function shortList(items: string[], max = 3): string {
  if (items.length <= 1) return items[0] ?? ''
  if (items.length > max) return `${items.slice(0, max).join(', ')} and ${items.length - max} more`
  return `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`
}

export function VendorDetailPage() {
  const { id = '' } = useParams()
  const { maps, workOrders, state, dispatch } = useScoped()
  const { can } = useAuth()
  const navigate = useNavigate()
  const canManage = can('masterdata.manage') || can('inventory.manage')
  const now = useNow(60_000)
  const [editing, setEditing] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const vendor = maps.vendor.get(id)
  const jobs = useMemo(() => vendorJobs(workOrders, id), [workOrders, id])

  if (!vendor) {
    return (
      <Card>
        <EmptyState
          icon={<Building2 />}
          title="Vendor not found"
          description="It may have been deleted, or the link points to a vendor that never existed."
          action={
            <Button asChild variant="outline">
              <Link to="/people/vendors">Back to vendors</Link>
            </Button>
          }
        />
      </Card>
    )
  }

  // Vendors are shared by every site, so the delete check looks at all of them.
  const suppliedParts = state.parts.filter((p) => p.vendorId === vendor.id)
  const openJobs = state.workOrders.filter((w) => w.vendorId === vendor.id && isActive(w))
  const blockers = [
    suppliedParts.length > 0 && `supplies ${plural(suppliedParts.length, 'part')} (${shortList(suppliedParts.map((p) => p.code))})`,
    openJobs.length > 0 && `holds ${plural(openJobs.length, 'open work order')} (${shortList(openJobs.map((w) => w.code))})`,
  ].filter((x): x is string => !!x)

  return (
    <>
      <BackButton fallback="/people/vendors" className="mb-3" />

      <PageHeader
        title={
          <span className="inline-flex flex-wrap items-center gap-x-3 gap-y-1.5">
            {vendor.name}
            <ContractBadge vendor={vendor} now={now} />
          </span>
        }
        description={
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <Rating value={vendor.rating} />
            <span>{vendor.serviceTypes.join(' · ') || 'No service types set'}</span>
          </span>
        }
        actions={
          canManage ? (
            <>
              <Button variant="outline" onClick={() => setEditing(true)}>
                <Pencil />
                Edit vendor
              </Button>
              <Button variant="ghost" className="text-accent" onClick={() => setDeleting(true)}>
                <Trash2 />
                Delete
              </Button>
            </>
          ) : undefined
        }
      />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-4">
          <PerformanceCard stats={vendorStats(jobs, now)} />
          <VendorJobsCard jobs={jobs} now={now} />
          <SuppliedPartsCard vendor={vendor} />
        </div>
        <div className="grid grid-cols-1 content-start gap-4 md:grid-cols-2 xl:grid-cols-1">
          <ContactCard vendor={vendor} />
          <ContractCard vendor={vendor} now={now} />
        </div>
      </div>

      <VendorDialog open={editing} onOpenChange={setEditing} editing={vendor} onSaved={(saved) => toast(`${saved.name} updated`, { tone: 'success' })} />
      <ConfirmDialog
        open={deleting}
        onOpenChange={setDeleting}
        title={blockers.length ? `${vendor.name} is in use` : `Delete ${vendor.name}?`}
        description={
          blockers.length
            ? `${vendor.name} ${blockers.join(' and ')}. Move the parts to another vendor and finish or reassign the work first.`
            : `${vendor.name} leaves the vendor list for every site. Closed work orders keep their history.`
        }
        confirmLabel="Delete vendor"
        destructive
        confirmDisabled={blockers.length > 0}
        onConfirm={() => {
          dispatch({ type: 'vendors/remove', id: vendor.id })
          toast(`${vendor.name} deleted`, { tone: 'success' })
          navigate('/people/vendors', { replace: true })
        }}
      />
    </>
  )
}
