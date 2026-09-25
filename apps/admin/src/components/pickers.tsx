import { stockLevel, toolBlockReason } from '@cmms/fixtures'
import type { Asset, FailureCodeKind, Person } from '@cmms/types'
import { FAILURE_CODE_KIND_LABEL, LOCATION_KIND_LABEL, SKILL_LEVEL_LABEL } from '@cmms/types'
import { Avatar, Combobox, MultiCombobox } from '@cmms/ui'
import { useMemo } from 'react'
import { useScoped } from '../state/scoped'
import { AssetIcon } from './icons'

type Common = {
  id?: string
  /** Name for screen readers when no visible label points at the picker (filters, inline rows). */
  'aria-label'?: string
  placeholder?: string
  clearable?: boolean
  disabled?: boolean
  invalid?: boolean
  variant?: 'default' | 'soft' | 'inline'
  className?: string
}
type Single = Common & { value: string | null; onChange: (value: string | null) => void }

export function AssetPicker({ filter, ...p }: Single & { filter?: (a: Asset) => boolean }) {
  const { assets, maps, locationPath } = useScoped()
  const items = useMemo(() => assets.filter((a) => a.status !== 'retired' && (!filter || filter(a))), [assets, filter])
  return (
    <Combobox
      {...p}
      items={items}
      placeholder={p.placeholder ?? 'Select asset'}
      searchPlaceholder="Search code, name or serial"
      getKey={(a) => a.id}
      getLabel={(a) => `${a.code} · ${a.name}`}
      getDescription={(a) => locationPath(a.locationId)}
      getKeywords={(a) => [a.serialNumber, a.model, maps.assetType.get(a.typeId)?.name ?? '']}
      renderIcon={(a) => (
        <span className="flex size-7 items-center justify-center rounded-lg bg-surface text-body">
          <AssetIcon icon={maps.assetType.get(a.typeId)?.icon} className="size-3.5" />
        </span>
      )}
    />
  )
}

function personDescription(p: Person, teamName: (id: string) => string | undefined) {
  if (!p.technician) return p.title
  return `${p.title} · ${teamName(p.technician.teamId) ?? 'No team'}`
}

/** `allowOnLeave` for filters and logging past time; pickers that hand out work grey out people on leave. */
export function PersonPicker({ people, allowOnLeave = false, ...p }: Single & { people?: Person[]; allowOnLeave?: boolean }) {
  const scoped = useScoped()
  const items = people ?? scoped.technicians
  return (
    <Combobox
      {...p}
      items={items}
      placeholder={p.placeholder ?? 'Select person'}
      searchPlaceholder="Search people"
      getKey={(x) => x.id}
      getLabel={(x) => x.name}
      getDescription={(x) => personDescription(x, (id) => scoped.maps.team.get(id)?.name)}
      getKeywords={(x) => [x.role, x.email]}
      getDisabledReason={(x) => (!allowOnLeave && x.technician?.availability === 'leave' ? 'On leave' : null)}
      renderIcon={(x) => <Avatar name={x.name} color={x.color} size="xs" />}
    />
  )
}

export function PeoplePicker({
  values,
  onChange,
  people,
  skillId,
  ...p
}: Common & { values: string[]; onChange: (values: string[]) => void; people?: Person[]; skillId?: string }) {
  const scoped = useScoped()
  const items = people ?? scoped.technicians
  return (
    <MultiCombobox
      {...p}
      values={values}
      onChange={onChange}
      items={items}
      placeholder={p.placeholder ?? 'Assign technicians'}
      searchPlaceholder="Search technicians"
      getKey={(x) => x.id}
      getLabel={(x) => x.name}
      getDescription={(x) => {
        const base = personDescription(x, (id) => scoped.maps.team.get(id)?.name)
        const level = skillId ? x.technician?.skills[skillId] : undefined
        return level ? `${base} · ${scoped.maps.skill.get(skillId!)?.name} ${SKILL_LEVEL_LABEL[level]}` : base
      }}
      getDisabledReason={(x) => (x.technician?.availability === 'leave' ? 'On leave' : null)}
      renderIcon={(x) => <Avatar name={x.name} color={x.color} size="xs" />}
    />
  )
}

export function PartPicker(p: Single) {
  const { parts, stock, warehouseIds } = useScoped()
  return (
    <Combobox
      {...p}
      items={parts}
      placeholder={p.placeholder ?? 'Select part'}
      searchPlaceholder="Search part number or name"
      getKey={(x) => x.id}
      getLabel={(x) => `${x.code} · ${x.name}`}
      getDescription={(x) => {
        const level = stockLevel(x.id, stock, warehouseIds)
        return `${level.available} ${x.unit} available · ${x.manufacturer}`
      }}
      getKeywords={(x) => [x.spec, x.manufacturer, x.category]}
    />
  )
}

export function ToolPicker({ category, ...p }: Single & { category?: string }) {
  const { tools, personName } = useScoped()
  const items = useMemo(() => tools.filter((t) => !category || t.category === category), [tools, category])
  return (
    <Combobox
      {...p}
      items={items}
      placeholder={p.placeholder ?? 'Select tool'}
      searchPlaceholder="Search tools"
      getKey={(t) => t.id}
      getLabel={(t) => `${t.code} · ${t.name}`}
      getDescription={(t) => (t.holderId ? `With ${personName(t.holderId)}` : t.location)}
      getKeywords={(t) => [t.category, t.serialNumber]}
      getDisabledReason={(t) => toolBlockReason(t) ?? (t.status === 'in_use' ? 'In use' : null)}
    />
  )
}

export function VendorPicker(p: Single) {
  const { vendors } = useScoped()
  return (
    <Combobox
      {...p}
      items={vendors}
      placeholder={p.placeholder ?? 'Select vendor'}
      searchPlaceholder="Search vendors"
      getKey={(v) => v.id}
      getLabel={(v) => v.name}
      getDescription={(v) => v.serviceTypes.join(', ')}
      getKeywords={(v) => [v.pic, v.contractNo]}
    />
  )
}

export function TeamPicker(p: Single) {
  const { teams, personName } = useScoped()
  return (
    <Combobox
      {...p}
      items={teams}
      placeholder={p.placeholder ?? 'Select team'}
      searchPlaceholder="Search teams"
      getKey={(t) => t.id}
      getLabel={(t) => t.name}
      getDescription={(t) => (t.supervisorId ? `Supervisor ${personName(t.supervisorId)}` : undefined)}
    />
  )
}

export function JobPlanPicker({ assetTypeId, ...p }: Single & { assetTypeId?: string }) {
  const { jobPlans } = useScoped()
  const items = useMemo(
    () =>
      [...jobPlans]
        .filter((j) => j.active)
        .sort((a, b) => Number(!!assetTypeId && !a.assetTypeIds.includes(assetTypeId)) - Number(!!assetTypeId && !b.assetTypeIds.includes(assetTypeId))),
    [jobPlans, assetTypeId],
  )
  return (
    <Combobox
      {...p}
      items={items}
      placeholder={p.placeholder ?? 'Select job plan'}
      searchPlaceholder="Search job plans"
      getKey={(j) => j.id}
      getLabel={(j) => `${j.code} · ${j.name}`}
      getDescription={(j) =>
        `${j.durationMin} min · ${j.tasks.length} checks${assetTypeId && j.assetTypeIds.includes(assetTypeId) ? ' · fits this asset type' : ''}`
      }
    />
  )
}

export function LocationPicker(p: Single) {
  const { locations, locationPath } = useScoped()
  return (
    <Combobox
      {...p}
      items={locations}
      placeholder={p.placeholder ?? 'Select location'}
      searchPlaceholder="Search locations"
      getKey={(l) => l.id}
      getLabel={(l) => locationPath(l.id)}
      getDescription={(l) => `${LOCATION_KIND_LABEL[l.kind]} · ${l.code}`}
    />
  )
}

export function FailureCodePicker({ kind, ...p }: Single & { kind: FailureCodeKind }) {
  const { failureCodes } = useScoped()
  const items = useMemo(() => failureCodes.filter((f) => f.kind === kind), [failureCodes, kind])
  return (
    <Combobox
      {...p}
      clearable
      items={items}
      placeholder={p.placeholder ?? `Select ${FAILURE_CODE_KIND_LABEL[kind].toLowerCase()}`}
      searchPlaceholder={`Search ${FAILURE_CODE_KIND_LABEL[kind].toLowerCase()}`}
      getKey={(f) => f.id}
      getLabel={(f) => f.name}
      getDescription={(f) => f.code}
    />
  )
}

export function AssetTypePicker(p: Single) {
  const { assetTypes } = useScoped()
  return (
    <Combobox
      {...p}
      items={assetTypes}
      placeholder={p.placeholder ?? 'Select type'}
      searchPlaceholder="Search asset types"
      getKey={(t) => t.id}
      getLabel={(t) => t.name}
      getDescription={(t) => t.category}
      renderIcon={(t) => (
        <span className="flex size-7 items-center justify-center rounded-lg bg-surface text-body">
          <AssetIcon icon={t.icon} className="size-3.5" />
        </span>
      )}
    />
  )
}
