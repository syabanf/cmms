import { Badge, PageHeader, UnderlineTabs } from '@cmms/ui'
import { Lock } from 'lucide-react'
import { useSearchParams } from 'react-router'
import { useAuth } from '../../auth/auth'
import { useScoped } from '../../state/scoped'
import { AssetTypesTab } from './master-data/AssetTypesTab'
import { CostCentersTab } from './master-data/CostCentersTab'
import { FailureCodesTab } from './master-data/FailureCodesTab'
import { LocationsTab } from './master-data/LocationsTab'
import { SafetyItemsTab } from './master-data/SafetyItemsTab'
import { useUserSites } from './master-data/shared'
import { SkillsTab } from './master-data/SkillsTab'
import { TeamsTab } from './master-data/TeamsTab'
import { WarehousesTab } from './master-data/WarehousesTab'

const TABS = [
  { value: 'locations', label: 'Locations', Panel: LocationsTab },
  { value: 'asset-types', label: 'Asset types', Panel: AssetTypesTab },
  { value: 'failure-codes', label: 'Failure codes', Panel: FailureCodesTab },
  { value: 'safety-items', label: 'Safety items', Panel: SafetyItemsTab },
  { value: 'skills', label: 'Skills', Panel: SkillsTab },
  { value: 'teams', label: 'Teams', Panel: TeamsTab },
  { value: 'cost-centers', label: 'Cost centers', Panel: CostCentersTab },
  { value: 'warehouses', label: 'Warehouses', Panel: WarehousesTab },
] as const
type Tab = (typeof TABS)[number]['value']

export function MasterDataPage() {
  const { state } = useScoped()
  const { can } = useAuth()
  const { inScope } = useUserSites()
  const canEdit = can('masterdata.manage')
  const [params, setParams] = useSearchParams()
  const active = TABS.find((t) => t.value === params.get('tab')) ?? TABS[0]

  const setTab = (next: string) =>
    setParams(
      (p) => {
        if (next === TABS[0].value) p.delete('tab')
        else p.set('tab', next)
        return p
      },
      { replace: true },
    )

  // Site-bound lists cover the sites the user works at; the rest are shared by every site.
  const counts: Record<Tab, number> = {
    locations: inScope(state.locations).length,
    'asset-types': state.assetTypes.length,
    'failure-codes': state.failureCodes.length,
    'safety-items': state.safetyItems.length,
    skills: state.skills.length,
    teams: inScope(state.teams).length,
    'cost-centers': inScope(state.costCenters).length,
    warehouses: inScope(state.warehouses).length,
  }

  return (
    <>
      <PageHeader
        title="Master data"
        description="The lists that assets, work orders, job plans and the technician app pick from."
        actions={
          canEdit ? undefined : (
            <Badge variant="muted">
              <Lock />
              View only
            </Badge>
          )
        }
      />
      <UnderlineTabs
        className="mb-4"
        value={active.value}
        onValueChange={setTab}
        items={TABS.map((t) => ({ value: t.value, label: t.label, count: counts[t.value] }))}
      />
      <active.Panel canEdit={canEdit} />
    </>
  )
}
