import { calibrationState, criticalityFromScores, criticalityTotal, fmtDate } from '@cmms/fixtures'
import type { Asset } from '@cmms/types'
import { ASSET_CATEGORY_LABEL } from '@cmms/types'
import { Button, KeyValue, type KeyValueItem, ProgressBar } from '@cmms/ui'
import { Pencil } from 'lucide-react'
import { AssetStatusBadge, CalibrationBadge, CriticalityBadge } from '../../components/badges'
import { AssetLink } from '../../components/links'
import { useScoped } from '../../state/scoped'
import { CLASS_RULE, SCORE_FACTORS, serviceAge, warrantyStatus } from './lib'
import { SectionTitle, WarrantyBadge } from './ui'

const missing = (text = 'Not recorded') => <span className="text-muted">{text}</span>

/** Passport fields (brainstorm 5.1), criticality breakdown, specs and notes. */
export function OverviewTab({ asset, now, onEdit }: { asset: Asset; now: number; onEdit?: () => void }) {
  const { maps, locationPath } = useScoped()
  const type = maps.assetType.get(asset.typeId)
  const team = maps.team.get(asset.teamId)
  const costCenter = maps.costCenter.get(asset.costCenterId)
  const warranty = warrantyStatus(asset.warranty, now)
  const total = criticalityTotal(asset.scores)
  const scored = criticalityFromScores(asset.scores)

  const passport: KeyValueItem[] = [
    { label: 'Asset ID', value: <span className="font-mono text-xs font-semibold">{asset.code}</span> },
    { label: 'Name', value: asset.name },
    { label: 'Type', value: type?.name ?? missing('Unknown type') },
    { label: 'Category', value: type ? ASSET_CATEGORY_LABEL[type.category] : missing() },
    { label: 'Location', value: locationPath(asset.locationId) || missing('No location') },
    {
      label: 'Part of',
      value: asset.parentId ? <AssetLink assetId={asset.parentId} /> : null,
      hidden: !asset.parentId,
    },
    { label: 'Manufacturer', value: asset.manufacturer || missing() },
    { label: 'Model', value: asset.model || missing() },
    {
      label: 'Serial number',
      value: asset.serialNumber ? <span className="font-mono text-xs">{asset.serialNumber}</span> : missing(),
    },
    {
      label: 'Installed',
      value: (
        <>
          {fmtDate(asset.installedAt)}
          <span className="block text-xs text-muted">{serviceAge(asset.installedAt, now)}</span>
        </>
      ),
    },
    {
      label: 'Warranty until',
      value:
        asset.warranty && warranty ? (
          <span className="inline-flex flex-wrap items-center gap-2">
            {fmtDate(asset.warranty.end)}
            <WarrantyBadge state={warranty.state} />
          </span>
        ) : (
          missing('No warranty')
        ),
    },
    {
      label: 'Calibration due',
      value: asset.calibration ? (
        <span className="inline-flex flex-wrap items-center gap-2">
          {fmtDate(asset.calibration.due)}
          <CalibrationBadge state={calibrationState(asset.calibration, now)} />
        </span>
      ) : null,
      hidden: !asset.calibration,
    },
    {
      label: 'Criticality',
      value: (
        <span className="inline-flex flex-wrap items-center gap-2">
          <CriticalityBadge criticality={asset.criticality} long />
          <span className="text-xs text-muted">Score {total} of 25</span>
        </span>
      ),
    },
    {
      label: 'Cost center',
      value: costCenter ? `${costCenter.name} · ${costCenter.code}` : missing('No cost center'),
    },
    { label: 'Status', value: <AssetStatusBadge status={asset.status} /> },
    { label: 'Responsible team', value: team?.name ?? missing('No team') },
  ]

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
      <section>
        <SectionTitle>Asset passport</SectionTitle>
        <KeyValue bare labelWidth="md" items={passport} />
      </section>

      <div className="space-y-8">
        <section>
          <SectionTitle>Criticality breakdown</SectionTitle>
          <div className="space-y-3">
            {SCORE_FACTORS.map((factor) => {
              const score = asset.scores[factor.key]
              return (
                <div key={factor.key}>
                  <div className="mb-1.5 flex items-baseline justify-between gap-2 text-sm">
                    <span className="font-medium">{factor.label}</span>
                    <span className="text-muted tabular-nums">
                      <span className="font-semibold text-foreground">{score}</span>/5
                    </span>
                  </div>
                  <ProgressBar value={score / 5} aria-label={`${factor.label}: ${score} of 5`} />
                  {factor.key === 'redundancy' && <p className="mt-1 text-xs text-muted">{factor.hint}.</p>}
                </div>
              )
            })}
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-surface-2 px-4 py-3">
            <span className="flex items-baseline gap-1 text-sm">
              Total <span className="text-lg font-bold tabular-nums">{total}</span>
              <span className="text-muted">/25</span>
            </span>
            <CriticalityBadge criticality={asset.criticality} long />
          </div>
          <p className="mt-2 text-xs text-muted">
            {scored === asset.criticality
              ? CLASS_RULE
              : `These scores give class ${scored}. Open Edit and save to apply it.`}
          </p>
        </section>

        <section>
          <SectionTitle
            action={
              onEdit && (
                <Button variant="ghost" size="sm" onClick={onEdit}>
                  <Pencil />
                  Edit
                </Button>
              )
            }
          >
            Specifications
          </SectionTitle>
          {asset.specs.length ? (
            <KeyValue
              bare
              labelWidth="md"
              items={asset.specs.map((s) => ({ label: s.label, value: s.value }))}
            />
          ) : (
            <p className="text-sm text-muted">
              No specifications recorded.{' '}
              {onEdit ? 'Use Edit to add power, speed, supply and weight.' : 'A planner can add them.'}
            </p>
          )}
        </section>

        <section>
          <SectionTitle>Notes</SectionTitle>
          {asset.notes ? (
            <p className="text-sm whitespace-pre-line text-body">{asset.notes}</p>
          ) : (
            <p className="text-sm text-muted">No notes yet.</p>
          )}
        </section>
      </div>
    </div>
  )
}
