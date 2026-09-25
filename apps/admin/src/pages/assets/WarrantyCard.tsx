import {
  dayKey,
  fmtDate,
  fmtIdr,
  fromInput,
  newId,
  nowMs,
  plural,
  subtreeIds,
  toMs,
  woCost,
} from '@cmms/fixtures'
import type { Asset, WarrantyClaim, WarrantyClaimStatus } from '@cmms/types'
import { WARRANTY_CLAIM_STATUS_LABEL, WO_TYPE_LABEL } from '@cmms/types'
import {
  ActionMenu,
  Badge,
  type BadgeProps,
  Button,
  Combobox,
  ConfirmDialog,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  FormField,
  Input,
  KeyValue,
  Textarea,
  toast,
} from '@cmms/ui'
import { Ellipsis, Plus, Trash2 } from 'lucide-react'
import { type FormEvent, useMemo, useState } from 'react'
import { Link } from 'react-router'
import { useAuth } from '../../auth/auth'
import { WoLink, paths } from '../../components/links'
import { VendorPicker } from '../../components/pickers'
import { useScoped } from '../../state/scoped'
import { warrantyStatus } from './lib'
import { SideCard, WarrantyBadge } from './ui'

const CLAIM_VARIANT: Record<WarrantyClaimStatus, NonNullable<BadgeProps['variant']>> = {
  submitted: 'warning',
  approved: 'success',
  rejected: 'muted',
}

/** Coverage, terms and the claim history, with a form for new claims. */
export function WarrantyCard({ asset, now, onEdit }: { asset: Asset; now: number; onEdit?: () => void }) {
  const { warrantyClaims, maps, dispatch } = useScoped()
  const { can } = useAuth()
  const canManage = can('asset.manage')
  const [claiming, setClaiming] = useState(false)
  // Kept after closing so the dialog text survives its exit animation.
  const [removing, setRemoving] = useState<{ claim: WarrantyClaim; open: boolean } | null>(null)
  const warranty = asset.warranty
  const status = warrantyStatus(warranty, now)
  const claims = useMemo(
    () => warrantyClaims.filter((c) => c.assetId === asset.id).sort((a, b) => toMs(b.date) - toMs(a.date)),
    [warrantyClaims, asset.id],
  )

  const decide = (claim: WarrantyClaim, next: WarrantyClaimStatus) => {
    dispatch({ type: 'warrantyClaims/upsert', item: { ...claim, status: next } })
    toast(`Claim marked ${WARRANTY_CLAIM_STATUS_LABEL[next].toLowerCase()}`, {
      tone: 'success',
      description: fmtIdr(claim.amount),
    })
  }
  const vendorLink = (vendorId: string | null) => {
    const vendor = vendorId ? maps.vendor.get(vendorId) : undefined
    if (!vendor) return <span className="text-muted">No vendor</span>
    return (
      <Link to={paths.vendor(vendor.id)} className="font-medium hover:text-accent">
        {vendor.name}
      </Link>
    )
  }

  return (
    <SideCard
      title="Warranty"
      action={
        canManage &&
        warranty && (
          <Button variant="outline" size="sm" onClick={() => setClaiming(true)}>
            <Plus />
            New claim
          </Button>
        )
      }
    >
      {warranty && status ? (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <WarrantyBadge state={status.state} />
            <span className="text-xs text-muted">
              {status.state === 'expired'
                ? `Ended ${fmtDate(warranty.end)}`
                : `${plural(status.daysLeft, 'day')} left`}
            </span>
          </div>
          <KeyValue
            bare
            className="mt-2"
            items={[
              { label: 'Vendor', value: vendorLink(warranty.vendorId) },
              { label: 'Covers', value: `${fmtDate(warranty.start)} to ${fmtDate(warranty.end)}` },
              { label: 'Terms', value: warranty.terms || <span className="text-muted">Not recorded</span> },
            ]}
          />
        </>
      ) : (
        <div>
          <p className="text-sm text-muted">No warranty on record for this asset.</p>
          {canManage && onEdit && (
            <Button variant="outline" size="sm" className="mt-3" onClick={onEdit}>
              Add warranty details
            </Button>
          )}
        </div>
      )}

      {(warranty || claims.length > 0) && (
        <div className="mt-4">
          <p className="mb-2 text-xs font-semibold text-muted">Claims</p>
          {claims.length ? (
            <ul className="space-y-2">
              {claims.map((claim) => (
                <li key={claim.id} className="rounded-2xl bg-surface-2 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <Badge variant={CLAIM_VARIANT[claim.status]}>
                      {WARRANTY_CLAIM_STATUS_LABEL[claim.status]}
                    </Badge>
                    <span className="flex items-center gap-1">
                      <span className="text-sm font-semibold tabular-nums">{fmtIdr(claim.amount)}</span>
                      {canManage && (
                        <ActionMenu
                          title={`${fmtIdr(claim.amount)} claim`}
                          trigger={
                            <Button variant="ghost" size="icon-sm" aria-label={`Actions for the ${fmtIdr(claim.amount)} claim`}>
                              <Ellipsis />
                            </Button>
                          }
                          items={[
                            {
                              key: 'delete',
                              label: 'Delete claim',
                              icon: <Trash2 />,
                              destructive: true,
                              onSelect: () => setRemoving({ claim, open: true }),
                            },
                          ]}
                        />
                      )}
                    </span>
                  </div>
                  <p className="mt-2 text-sm">{claim.description}</p>
                  <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted">
                    <span>{fmtDate(claim.date)}</span>
                    {claim.woId && <WoLink woId={claim.woId} />}
                    {vendorLink(claim.vendorId)}
                  </p>
                  {canManage && claim.status === 'submitted' && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      <Button variant="outline" size="sm" onClick={() => decide(claim, 'approved')}>
                        Mark approved
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => decide(claim, 'rejected')}>
                        Mark rejected
                      </Button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-muted">No claims yet. Raise one when a covered part fails.</p>
          )}
        </div>
      )}

      <Dialog open={claiming} onOpenChange={setClaiming}>
        <DialogContent size="md">
          {claiming && <ClaimForm asset={asset} onDone={() => setClaiming(false)} />}
        </DialogContent>
      </Dialog>
      <ConfirmDialog
        open={!!removing?.open}
        onOpenChange={(open) => setRemoving((r) => r && { ...r, open })}
        destructive
        confirmLabel="Delete claim"
        title="Delete this claim?"
        description={
          removing
            ? `The ${fmtIdr(removing.claim.amount)} claim from ${fmtDate(removing.claim.date)} leaves the warranty history of ${asset.code}.`
            : undefined
        }
        onConfirm={() => {
          if (!removing) return
          dispatch({ type: 'warrantyClaims/remove', id: removing.claim.id })
          toast('Warranty claim deleted', { tone: 'success', description: `${fmtIdr(removing.claim.amount)} on ${asset.code}` })
        }}
      />
    </SideCard>
  )
}

function ClaimForm({ asset, onDone }: { asset: Asset; onDone: () => void }) {
  const { assets, workOrders, maps, dispatch } = useScoped()
  const [woId, setWoId] = useState<string | null>(null)
  const [vendorId, setVendorId] = useState<string | null>(asset.warranty?.vendorId ?? null)
  const [date, setDate] = useState(() => dayKey(nowMs()))
  const [amount, setAmount] = useState(0)
  const [description, setDescription] = useState('')
  const [tried, setTried] = useState(false)

  const candidates = useMemo(() => {
    const ids = subtreeIds(assets, asset.id)
    return workOrders
      .filter((w) => ids.has(w.assetId))
      .sort((a, b) => toMs(b.requestedAt) - toMs(a.requestedAt))
  }, [assets, workOrders, asset.id])

  const submit = (e: FormEvent) => {
    e.preventDefault()
    setTried(true)
    if (!description.trim() || !date) return
    dispatch({
      type: 'warrantyClaims/upsert',
      item: {
        id: newId('wc'),
        assetId: asset.id,
        vendorId,
        woId,
        date: fromInput(date),
        status: 'submitted',
        description: description.trim(),
        amount,
      },
    })
    toast('Warranty claim submitted', { tone: 'success', description: `${fmtIdr(amount)} on ${asset.code}` })
    onDone()
  }

  return (
    <form onSubmit={submit}>
      <DialogHeader>
        <DialogTitle>New warranty claim</DialogTitle>
        <DialogDescription>
          Link the work order that found the fault so the vendor sees the repair record.
        </DialogDescription>
      </DialogHeader>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FormField label="Work order" htmlFor="claim-wo" hint="Optional" className="sm:col-span-2">
          <Combobox
            id="claim-wo"
            items={candidates}
            value={woId}
            clearable
            placeholder="Select work order"
            searchPlaceholder="Search code or title"
            getKey={(w) => w.id}
            getLabel={(w) => `${w.code} · ${w.title}`}
            getDescription={(w) => `${WO_TYPE_LABEL[w.type]} · ${fmtDate(w.requestedAt)}`}
            onChange={(next) => {
              setWoId(next)
              const wo = next ? maps.workOrder.get(next) : undefined
              if (!wo) return
              if (!description.trim()) setDescription(wo.title)
              if (!amount) setAmount(Math.round(woCost(wo, maps.person).total))
            }}
          />
        </FormField>
        <FormField label="Vendor" htmlFor="claim-vendor">
          <VendorPicker id="claim-vendor" value={vendorId} clearable onChange={setVendorId} />
        </FormField>
        <FormField label="Claim date" required htmlFor="claim-date">
          <Input id="claim-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </FormField>
        <FormField label="Amount claimed (Rp)" htmlFor="claim-amount" className="sm:col-span-2">
          <Input
            id="claim-amount"
            type="number"
            min={0}
            step={50000}
            value={amount}
            onChange={(e) => setAmount(Math.max(0, Math.round(Number(e.target.value) || 0)))}
          />
        </FormField>
        <FormField
          label="What failed"
          required
          htmlFor="claim-desc"
          className="sm:col-span-2"
          error={tried && !description.trim() ? 'Describe the fault the vendor should cover.' : undefined}
        >
          <Textarea
            id="claim-desc"
            className="min-h-24"
            value={description}
            placeholder="Third drive bearing failure in 34 days. Requesting an OEM check of the bearing fits."
            onChange={(e) => setDescription(e.target.value)}
          />
        </FormField>
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit">Submit claim</Button>
      </DialogFooter>
    </form>
  )
}
