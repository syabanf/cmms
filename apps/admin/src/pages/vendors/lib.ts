import { DAY, addMonths, slaState, toMs } from '@cmms/fixtures'
import type { Vendor, WorkOrder } from '@cmms/types'

type ContractState = 'active' | 'ending' | 'ended' | 'upcoming'

/** Contracts ending within this window get a warning. */
const CONTRACT_WARNING_DAYS = 60

export function contractState(vendor: Vendor, now: number): ContractState {
  const end = toMs(vendor.contractEnd)
  if (end < now) return 'ended'
  if (toMs(vendor.contractStart) > now) return 'upcoming'
  return end - now <= CONTRACT_WARNING_DAYS * DAY ? 'ending' : 'active'
}

export const contractDaysLeft = (vendor: Vendor, now: number) => Math.ceil((toMs(vendor.contractEnd) - now) / DAY)

/** Work the vendor handled or holds, cancelled work left out, newest first. */
export function vendorJobs(workOrders: readonly WorkOrder[], vendorId: string): WorkOrder[] {
  return workOrders
    .filter((w) => w.vendorId === vendorId && w.status !== 'cancelled')
    .sort((a, b) => toMs(b.requestedAt) - toMs(a.requestedAt))
}

export interface VendorStats {
  jobs: number
  completed: number
  onTime: number
  late: number
  spend: number
}

/** Finished after its due time, or still open past it. */
export function isLate(wo: WorkOrder, now: number): boolean {
  const state = slaState(wo, now)
  return state === 'missed' || state === 'overdue'
}

/** The last 12 months: jobs requested, completions finished by their due time, late jobs and vendor cost. */
export function vendorStats(jobs: readonly WorkOrder[], now: number): VendorStats {
  const since = addMonths(now, -12)
  const recent = jobs.filter((w) => toMs(w.requestedAt) >= since)
  const completed = recent.filter((w) => w.completedAt !== null)
  return {
    jobs: recent.length,
    completed: completed.length,
    onTime: completed.filter((w) => slaState(w, now) === 'met').length,
    late: recent.filter((w) => isLate(w, now)).length,
    spend: recent.reduce((sum, w) => sum + w.vendorCost, 0),
  }
}

/** Dial link for a phone number typed with spaces, such as +62 22 7301 884. */
export const telHref = (phone: string) => `tel:${phone.replace(/\s/g, '')}`

export const serviceTypesOf = (vendors: readonly Vendor[]) =>
  [...new Set(vendors.flatMap((v) => v.serviceTypes))].sort((a, b) => a.localeCompare(b))
