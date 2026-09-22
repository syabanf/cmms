import { emptyLocation, fmtNumber, newId, plural, subtreeIds } from '@cmms/fixtures'
import type { Location, LocationKind, Site } from '@cmms/types'
import { LOCATION_KIND_LABEL } from '@cmms/types'
import { Badge, Card, Combobox, type Column, DataTable, FormField, IconTile, Input, toast } from '@cmms/ui'
import { Building, Factory, Layers, MapPin, Plus, Rows3 } from 'lucide-react'
import { type CSSProperties, type ReactNode, useMemo } from 'react'
import { useHistoryState, useTableHistory } from '../../../lib/history-state'
import { useScoped } from '../../../state/scoped'
import { PARENT_KIND, canHoldChildren, isTaken, kindUnder, matches, searchTerms, tally } from './lib'
import {
  DeleteDialog,
  EntityForm,
  FormDialog,
  IconAction,
  ListEmpty,
  ListHeader,
  RowActions,
  useDraft,
  useEditor,
  useUserSites,
} from './shared'

const KIND_ICON: Record<LocationKind, ReactNode> = { plant: <Factory />, area: <Layers />, line: <Rows3 /> }

type Row =
  | { type: 'site'; site: Site; assets: number }
  | { type: 'location'; location: Location; depth: number; assets: number }
type Preset = { siteId: string; parentId: string | null }

const kindLabel = (kind: LocationKind) => LOCATION_KIND_LABEL[kind].toLowerCase()
const withArticle = (kind: LocationKind) => `${kind === 'area' ? 'an' : 'a'} ${kindLabel(kind)}`

export function LocationsTab({ canEdit }: { canEdit: boolean }) {
  const { state, siteId, dispatch, locationPath } = useScoped()
  const { sites } = useUserSites()
  const [query, setQuery] = useHistoryState('locations.query', '')
  const table = useTableHistory('locations')
  const editor = useEditor<Location, Preset>()

  const assetsUnder = useMemo(() => {
    const at = tally(state.assets.map((a) => a.locationId))
    return (id: string) => [...subtreeIds(state.locations, id)].reduce((sum, x) => sum + (at.get(x) ?? 0), 0)
  }, [state.assets, state.locations])

  // Each site the user works at, current site first, with its plants, areas and lines in tree order.
  const rows = useMemo(() => {
    const terms = searchTerms(query)
    return sites.flatMap((site): Row[] => {
      const inSite = state.locations.filter((l) => l.siteId === site.id)
      const tree: Row[] = []
      const walk = (parentId: string | null, depth: number) => {
        for (const location of inSite.filter((l) => l.parentId === parentId)) {
          if (matches(terms, location.name, location.code, locationPath(location.id))) {
            tree.push({ type: 'location', location, depth, assets: assetsUnder(location.id) })
          }
          walk(location.id, depth + 1)
        }
      }
      walk(null, 0)
      if (terms.length && !tree.length) return []
      return [
        { type: 'site', site, assets: state.assets.filter((a) => a.siteId === site.id).length },
        ...tree,
      ]
    })
  }, [sites, state.locations, state.assets, assetsUnder, query, locationPath])

  const columns: Column<Row>[] = [
    {
      id: 'name',
      header: 'Location',
      cell: (row) =>
        row.type === 'site' ? (
          <div className="gap-3 flex items-center">
            <IconTile size="sm" tone="ink">
              <Building />
            </IconTile>
            <div className="min-w-0">
              <p className="font-semibold">{row.site.name}</p>
              <p className="text-xs text-muted">
                Site {row.site.code} · {row.site.city}
                <span className="sm:hidden"> · {plural(row.assets, 'asset')}</span>
              </p>
            </div>
          </div>
        ) : (
          <div
            className="gap-3 sm:pl-[calc(var(--indent)*18px)] flex items-center pl-[calc(var(--indent)*10px)]"
            style={{ '--indent': row.depth + 1 } as CSSProperties}
          >
            <IconTile size="sm" className="sm:flex hidden">
              {KIND_ICON[row.location.kind]}
            </IconTile>
            <div className="min-w-0">
              <p className="font-semibold">
                {row.location.name}{' '}
                <span className="font-normal font-mono text-[11px] text-muted">{row.location.code}</span>
              </p>
              <p className="text-xs text-muted">{locationPath(row.location.id)}</p>
              <div className="mt-1.5 gap-1.5 sm:hidden flex flex-wrap items-center">
                <Badge>{LOCATION_KIND_LABEL[row.location.kind]}</Badge>
                <span className="text-xs text-muted">{plural(row.assets, 'asset')}</span>
              </div>
            </div>
          </div>
        ),
    },
    {
      id: 'kind',
      header: 'Kind',
      hideBelow: 'sm',
      cell: (row) =>
        row.type === 'site' ? (
          <Badge variant="ink">Site</Badge>
        ) : (
          <Badge>{LOCATION_KIND_LABEL[row.location.kind]}</Badge>
        ),
    },
    {
      id: 'assets',
      header: 'Assets',
      hideBelow: 'sm',
      align: 'right',
      cell: (row) => <span className="tabular-nums">{fmtNumber(row.assets)}</span>,
    },
  ]
  if (canEdit) {
    columns.push({
      id: 'actions',
      header: '',
      align: 'right',
      cell: (row) => {
        if (row.type === 'site') {
          return (
            <div className="flex justify-end">
              <IconAction
                label={`Add a plant to ${row.site.name}`}
                onClick={() => editor.create({ siteId: row.site.id, parentId: null })}
              >
                <Plus />
              </IconAction>
            </div>
          )
        }
        const { location } = row
        const addChild = {
          label: `Add ${kindLabel(kindUnder(location))} in ${location.name}`,
          icon: <Plus />,
          onSelect: () => editor.create({ siteId: location.siteId, parentId: location.id }),
        }
        return (
          <RowActions
            name={location.name}
            onEdit={() => editor.edit(location)}
            onDelete={() => editor.remove(location)}
            extra={canHoldChildren(location.kind) ? [addChild] : []}
          />
        )
      },
    })
  }

  const target = editor.removal.item
  const below = target ? subtreeIds(state.locations, target.id).size - 1 : 0
  const targetAssets = target ? assetsUnder(target.id) : 0
  const add = canEdit ? () => editor.create({ siteId, parentId: null }) : undefined

  return (
    <Card>
      <ListHeader
        title="Locations"
        usedIn="Requesters and technicians filter by area on the phone."
        query={query}
        onQuery={setQuery}
        searchLabel="Search locations"
        addLabel="Add location"
        onAdd={add}
      />
      <DataTable
        columns={columns}
        rows={rows}
        getRowKey={(row) => (row.type === 'site' ? `site:${row.site.id}` : row.location.id)}
        pageSize={0}
        {...table}
        empty={
          <ListEmpty
            query={query}
            noun="locations"
            onClear={() => setQuery('')}
            onAdd={add}
            icon={<MapPin />}
          />
        }
      />

      <FormDialog open={editor.dialog.open} onOpenChange={editor.setDialogOpen}>
        <LocationForm
          editing={editor.dialog.editing}
          preset={editor.dialog.preset ?? { siteId, parentId: null }}
          onDone={(saved) => {
            editor.setDialogOpen(false)
            if (saved)
              toast(editor.dialog.editing ? `${saved.name} updated` : `${saved.name} added`, {
                tone: 'success',
                description: `${LOCATION_KIND_LABEL[saved.kind]} ${saved.code}`,
              })
          }}
        />
      </FormDialog>
      <DeleteDialog
        open={editor.removal.open}
        onOpenChange={editor.setRemovalOpen}
        name={target?.name ?? 'Location'}
        noun="location"
        usage={targetAssets ? [`${plural(targetAssets, 'asset')} in it or below it`] : []}
        consequence={
          below ? `The ${plural(below, 'location')} inside it go too.` : 'No other location sits inside it.'
        }
        onConfirm={() => {
          if (!target) return
          dispatch({ type: 'locations/remove', id: target.id })
          toast(`${target.name} deleted`, { tone: 'success' })
        }}
      />
    </Card>
  )
}

function LocationForm({
  editing,
  preset,
  onDone,
}: {
  editing: Location | null
  preset: Preset
  onDone: (saved: Location | null) => void
}) {
  const { state, dispatch, locationPath } = useScoped()
  const siteId = editing?.siteId ?? preset.siteId
  const siteName = state.sites.find((s) => s.id === siteId)?.name ?? 'this site'
  const inSite = state.locations.filter((l) => l.siteId === siteId)
  // A location with children keeps its kind, so only parents one level up fit.
  const fixedKind = editing && inSite.some((l) => l.parentId === editing.id) ? editing.kind : null
  const parents = inSite.filter(
    (l) => l.id !== editing?.id && (fixedKind ? l.kind === PARENT_KIND[fixedKind] : canHoldChildren(l.kind)),
  )

  const { draft, set, attempt, show } = useDraft(() => ({
    name: editing?.name ?? '',
    code: editing?.code ?? '',
    parentId: editing ? editing.parentId : preset.parentId,
  }))
  const parent = inSite.find((l) => l.id === draft.parentId)
  const kind = fixedKind ?? kindUnder(parent)
  const code = draft.code.trim().toUpperCase()
  const errors = {
    name: draft.name.trim() ? undefined : 'Enter a name, such as Polishing Area.',
    code: !code
      ? 'Enter a short code, such as POL.'
      : isTaken(
            code,
            inSite.filter((l) => l.id !== editing?.id).map((l) => l.code),
          )
        ? `${code} is already used at ${siteName}.`
        : undefined,
  }

  const submit = () => {
    if (!attempt(errors)) return
    const item: Location = {
      ...(editing ?? emptyLocation(siteId, draft.parentId)),
      id: editing?.id ?? newId('loc'),
      parentId: draft.parentId,
      kind,
      name: draft.name.trim(),
      code,
    }
    dispatch({ type: 'locations/upsert', item })
    onDone(item)
  }

  return (
    <EntityForm
      title={editing ? `Edit ${editing.name}` : `Add ${kindLabel(kind)}`}
      description={`${siteName}. Plants sit at the top, areas in a plant and lines in an area.`}
      submitLabel={editing ? 'Save changes' : `Add ${kindLabel(kind)}`}
      onSubmit={submit}
      onCancel={() => onDone(null)}
    >
      <FormField
        label="Inside"
        htmlFor="loc-parent"
        className="sm:col-span-2"
        hint={
          fixedKind
            ? `It holds other locations, so it stays ${withArticle(fixedKind)}.`
            : `Makes it ${withArticle(kind)}. Leave empty for a plant.`
        }
      >
        <Combobox
          id="loc-parent"
          items={parents}
          value={draft.parentId}
          onChange={(parentId) => set({ parentId })}
          clearable={!fixedKind}
          disabled={parents.length === 0}
          getKey={(l) => l.id}
          getLabel={(l) => locationPath(l.id)}
          getDescription={(l) => `${LOCATION_KIND_LABEL[l.kind]} · ${l.code}`}
          placeholder={`Top level of ${siteName}`}
          searchPlaceholder="Search plants and areas"
        />
      </FormField>
      <FormField label="Name" required htmlFor="loc-name" error={show(errors.name)}>
        <Input
          id="loc-name"
          value={draft.name}
          placeholder="Polishing Area"
          onChange={(e) => set({ name: e.target.value })}
        />
      </FormField>
      <FormField
        label="Code"
        required
        htmlFor="loc-code"
        error={show(errors.code)}
        hint="Unique within the site."
      >
        <Input
          id="loc-code"
          value={draft.code}
          inputClassName="font-mono uppercase"
          placeholder="POL"
          onChange={(e) => set({ code: e.target.value })}
        />
      </FormField>
    </EntityForm>
  )
}
