import { fmtDate, fmtIdrShort, fmtNumber, fmtPercent } from '@cmms/fixtures'
import type { Vendor } from '@cmms/types'
import { Badge, Card, IconTile, SplitStats } from '@cmms/ui'
import { Building2, Clock, FileText, Mail, Phone, UserRound } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { paths } from '../../components/links'
import { ContractBadge, Rating } from './badges'
import { type VendorStats, telHref } from './lib'

function Detail({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <li className="flex min-w-0 items-center gap-2.5">
      <span className="shrink-0 text-muted [&_svg]:size-4">{icon}</span>
      <span className="min-w-0 truncate">{children}</span>
    </li>
  )
}

/** Contact links sit above the full-card link to the vendor page. */
const innerLink = 'relative z-10 hover:text-accent'

export function VendorCard({ vendor, stats, now }: { vendor: Vendor; stats: VendorStats; now: number }) {
  return (
    <Card className="relative flex flex-col p-5 transition-colors hover:bg-surface-2">
      <div className="flex items-start gap-3">
        <IconTile>
          <Building2 />
        </IconTile>
        <div className="min-w-0 flex-1">
          <Link
            to={paths.vendor(vendor.id)}
            className="block max-w-full truncate text-base font-semibold leading-tight after:absolute after:inset-0 after:rounded-card focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-accent/40"
          >
            {vendor.name}
          </Link>
          <Rating value={vendor.rating} className="mt-1.5" />
        </div>
        <ContractBadge vendor={vendor} now={now} />
      </div>

      {vendor.serviceTypes.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-1.5">
          {vendor.serviceTypes.map((type) => (
            <Badge key={type}>{type}</Badge>
          ))}
        </div>
      )}

      <ul className="mt-4 space-y-2 text-sm">
        <Detail icon={<UserRound />}>{vendor.pic || <span className="text-muted">No PIC set</span>}</Detail>
        <Detail icon={<Phone />}>
          {vendor.phone ? (
            <a href={telHref(vendor.phone)} className={innerLink}>
              {vendor.phone}
            </a>
          ) : (
            <span className="text-muted">No phone</span>
          )}
        </Detail>
        <Detail icon={<Mail />}>
          {vendor.email ? (
            <a href={`mailto:${vendor.email}`} className={innerLink}>
              {vendor.email}
            </a>
          ) : (
            <span className="text-muted">No email</span>
          )}
        </Detail>
        <Detail icon={<FileText />}>
          <span className="font-mono text-xs">{vendor.contractNo || 'No contract'}</span>
          <span className="text-muted">
            {' '}
            · {fmtDate(vendor.contractStart)} to {fmtDate(vendor.contractEnd)}
          </span>
        </Detail>
        <Detail icon={<Clock />}>SLA {fmtNumber(vendor.slaHours)} h</Detail>
      </ul>

      <SplitStats
        className="mt-5"
        items={[
          { label: 'Work orders, 12 mo', value: fmtNumber(stats.jobs) },
          { label: 'On time', value: stats.completed ? fmtPercent(stats.onTime / stats.completed) : '-' },
          { label: 'Spend', value: fmtIdrShort(stats.spend) },
        ]}
      />
    </Card>
  )
}
