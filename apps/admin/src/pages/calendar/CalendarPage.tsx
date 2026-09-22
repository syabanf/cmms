import { areaOf, calendarItems, fmtNumber, isSameDay, plannedAt, plural, toMs } from '@cmms/fixtures'
import type { CalendarItemKind } from '@cmms/fixtures'
import type { WoType } from '@cmms/types'
import { WO_TYPES, WO_TYPE_LABEL } from '@cmms/types'
import {
  Button,
  Card,
  Chip,
  Combobox,
  PageHeader,
  PillTabs,
  Sheet,
  SheetBody,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  Switch,
  cn,
  useIsPhone,
} from '@cmms/ui'
import { ChevronLeft, ChevronRight, Funnel } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { useAuth } from '../../auth/auth'
import { PersonPicker } from '../../components/pickers'
import { useHistoryState } from '../../lib/history-state'
import { usePersistentState } from '../../lib/storage'
import { useNow, useScoped } from '../../state/scoped'
import { DayAgenda, Legend, MonthAgenda, MonthGrid, WeekGrid, useDayDrop } from './CalendarViews'
import {
  CALENDAR_VIEWS,
  type CalendarEntry,
  type CalendarView,
  entryTone,
  gridRange,
  groupByDay,
  onDay,
  periodRange,
  periodTitle,
  shiftAnchor,
} from './lib'
import { useReschedule } from './useReschedule'

interface Filters {
  areaId: string | null
  types: WoType[]
  technicianId: string | null
  forecast: boolean
}

interface Area {
  id: string
  name: string
  plant: string
}

const DEFAULT_FILTERS: Filters = { areaId: null, types: [], technicianId: null, forecast: true }
const VIEW_LABEL: Record<CalendarView, string> = { month: 'Month', week: 'Week', day: 'Day' }

export function CalendarPage() {
  const s = useScoped()
  const { can } = useAuth()
  const now = useNow(60_000)
  const isPhone = useIsPhone()
  const reschedule = useReschedule()
  const [storedView, setView] = usePersistentState<CalendarView>('cmms.admin.calendar.view', 'month')
  const view = CALENDAR_VIEWS.includes(storedView) ? storedView : 'month'
  const [anchor, setAnchor] = useHistoryState('anchor', now)
  const [filters, setFilters] = useHistoryState<Filters>('filters', DEFAULT_FILTERS)
  const [filtersOpen, setFiltersOpen] = useState(false)

  const grid = gridRange(view, anchor)
  const period = periodRange(view, anchor)

  const areas = useMemo<Area[]>(
    () =>
      s.locations
        .filter((l) => l.kind === 'area')
        .map((l) => ({ id: l.id, name: l.name, plant: (l.parentId && s.maps.location.get(l.parentId)?.name) || '' }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [s.locations, s.maps.location],
  )
  const areaByAsset = useMemo(
    () => new Map(s.assets.map((a) => [a.id, areaOf(s.locations, a.locationId)?.id ?? null])),
    [s.assets, s.locations],
  )

  const entries = useMemo<CalendarEntry[]>(() => {
    const items = calendarItems(
      {
        workOrders: s.workOrders,
        pmSchedules: s.pmSchedules,
        meters: s.maps.meter,
        assets: s.assets,
        tools: s.tools,
        jobPlanDuration: (id) => s.maps.jobPlan.get(id)?.durationMin ?? 60,
        pmTitle: (pm) => s.maps.jobPlan.get(pm.jobPlanId)?.name ?? pm.name,
      },
      grid.from,
      grid.to,
      now,
    )
    return items.map((raw) => {
      // A forecast becomes whatever work type its job plan generates, so weekly inspections read as inspections.
      const pm = raw.kind === 'pm_forecast' && raw.pmId ? s.maps.pm.get(raw.pmId) : undefined
      const planType = pm ? s.maps.jobPlan.get(pm.jobPlanId)?.woType : undefined
      const item = planType ? { ...raw, woType: planType } : raw
      const asset = item.assetId ? s.maps.asset.get(item.assetId) : undefined
      const tool = item.toolId ? s.maps.tool.get(item.toolId) : undefined
      return {
        item,
        code: asset?.code ?? tool?.code ?? '',
        label: item.kind === 'calibration' ? 'Calibration due' : item.title,
        areaId: asset ? (areaByAsset.get(asset.id) ?? null) : null,
        tone: entryTone(item),
      }
    })
  }, [s.workOrders, s.pmSchedules, s.maps, s.assets, s.tools, areaByAsset, grid.from, grid.to, now])

  const visible = useMemo(
    () =>
      entries.filter(
        (e) =>
          (filters.forecast || e.item.kind !== 'pm_forecast') &&
          (!filters.types.length || filters.types.includes(e.item.woType)) &&
          (!filters.areaId || e.areaId === filters.areaId) &&
          (!filters.technicianId || e.item.assigneeIds.includes(filters.technicianId)),
      ),
    [entries, filters],
  )
  const byDay = useMemo(() => groupByDay(visible), [visible])

  const summary = useMemo(() => {
    const inPeriod = visible.filter((e) => e.item.at >= period.from && e.item.at < period.to)
    const count = (kind: CalendarItemKind) => inPeriod.filter((e) => e.item.kind === kind).length
    const minutes = inPeriod.filter((e) => e.item.kind === 'work_order' && e.tone !== 'done').reduce((sum, e) => sum + e.item.durationMin, 0)
    const parts = [
      count('work_order') ? plural(count('work_order'), 'work order') : null,
      count('pm_forecast') ? plural(count('pm_forecast'), 'PM forecast') : null,
      count('calibration') ? plural(count('calibration'), 'calibration') : null,
      minutes ? `${fmtNumber(minutes / 60, minutes % 60 ? 1 : 0)} h of open work` : null,
    ].filter(Boolean)
    return parts.length ? parts.join(' · ') : 'Nothing planned in this period'
  }, [visible, period.from, period.to])

  const canMove = can('wo.assign')
  const move = (woId: string, day: number) => {
    const wo = s.maps.workOrder.get(woId)
    if (!wo) return
    const at = toMs(plannedAt(wo))
    const next = onDay(at, day)
    if (!isSameDay(at, next)) reschedule(wo.id, next)
  }
  const drop = useDayDrop(canMove, now, move)

  const openDay = (day: number) => {
    setAnchor(day)
    setView('day')
  }
  const periodName = VIEW_LABEL[view].toLowerCase()
  const activeFilterCount =
    (filters.areaId ? 1 : 0) + filters.types.length + (filters.technicianId ? 1 : 0) + (filters.forecast ? 0 : 1)
  const clearFilters = activeFilterCount ? (
    <Button variant="outline" size="sm" onClick={() => setFilters(DEFAULT_FILTERS)}>
      Clear filters
    </Button>
  ) : undefined
  const filterControls = <FilterControls filters={filters} areas={areas} stacked={isPhone} onChange={setFilters} />

  return (
    <>
      <PageHeader
        title="Maintenance calendar"
        description="Scheduled work, PM forecasts and calibration due dates in one plan. Open an item to reschedule, assign or generate it."
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1.5">
          <Button variant="card" size="icon" aria-label={`Previous ${periodName}`} onClick={() => setAnchor((a) => shiftAnchor(view, a, -1))}>
            <ChevronLeft />
          </Button>
          <Button variant="card" onClick={() => setAnchor(now)}>
            Today
          </Button>
          <Button variant="card" size="icon" aria-label={`Next ${periodName}`} onClick={() => setAnchor((a) => shiftAnchor(view, a, 1))}>
            <ChevronRight />
          </Button>
        </div>
        <h2 className="min-w-0 px-1 text-lg font-bold tracking-tight" aria-live="polite">
          {periodTitle(view, anchor)}
        </h2>
        <PillTabs
          className="ml-auto"
          items={CALENDAR_VIEWS.map((v) => ({ value: v, label: VIEW_LABEL[v] }))}
          value={view}
          onValueChange={(value) => {
            const next = CALENDAR_VIEWS.find((v) => v === value)
            if (next) setView(next)
          }}
        />
      </div>

      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center gap-3 border-b border-border px-5 py-3">
          {isPhone ? (
            <Button variant="outline" size="sm" onClick={() => setFiltersOpen(true)}>
              <Funnel />
              Filters{activeFilterCount ? ` · ${activeFilterCount}` : ''}
            </Button>
          ) : (
            filterControls
          )}
          <p className="min-w-0 text-xs text-muted md:ml-auto">{summary}</p>
        </div>

        {view === 'month' &&
          (isPhone ? (
            <MonthAgenda
              period={period}
              byDay={byDay}
              now={now}
              onOpenDay={openDay}
              emptyAction={
                clearFilters ?? (
                  <Button asChild variant="outline" size="sm">
                    <Link to="/preventive/pm">Open PM schedules</Link>
                  </Button>
                )
              }
            />
          ) : (
            <MonthGrid grid={grid} period={period} byDay={byDay} now={now} drop={drop} onOpenDay={openDay} />
          ))}
        {view === 'week' && <WeekGrid grid={grid} byDay={byDay} now={now} drop={drop} onOpenDay={openDay} />}
        {view === 'day' && (
          <DayAgenda
            entries={visible}
            emptyAction={
              clearFilters ?? (
                <Button variant="outline" size="sm" onClick={() => setView('week')}>
                  Show the whole week
                </Button>
              )
            }
          />
        )}

        <Legend hint={canMove && !isPhone && view !== 'day' ? 'Drag a work order onto another day to move it.' : undefined} />
      </Card>

      <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
        <SheetContent side="bottom">
          <SheetHeader>
            <SheetTitle>Filters</SheetTitle>
          </SheetHeader>
          <SheetBody>{filterControls}</SheetBody>
          <SheetFooter>
            <Button variant="outline" onClick={() => setFilters(DEFAULT_FILTERS)}>
              Clear
            </Button>
            <Button onClick={() => setFiltersOpen(false)}>Show calendar</Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </>
  )
}

function FilterControls({
  filters,
  areas,
  stacked,
  onChange,
}: {
  filters: Filters
  areas: Area[]
  stacked: boolean
  onChange: (f: Filters) => void
}) {
  const toggleType = (type: WoType) =>
    onChange({ ...filters, types: filters.types.includes(type) ? filters.types.filter((t) => t !== type) : [...filters.types, type] })
  return (
    <div className={cn('flex gap-2', stacked ? 'flex-col items-stretch' : 'flex-wrap items-center')}>
      <Combobox
        variant="inline"
        clearable
        aria-label="Area"
        placeholder="All areas"
        searchPlaceholder="Search areas"
        items={areas}
        value={filters.areaId}
        getKey={(a) => a.id}
        getLabel={(a) => a.name}
        getDescription={(a) => a.plant}
        onChange={(areaId) => onChange({ ...filters, areaId })}
      />
      <div className="flex flex-wrap gap-2">
        {WO_TYPES.map((type) => (
          <Chip key={type} active={filters.types.includes(type)} onClick={() => toggleType(type)}>
            {WO_TYPE_LABEL[type]}
          </Chip>
        ))}
      </div>
      <PersonPicker
        allowOnLeave
        variant="inline"
        clearable
        placeholder="Any technician"
        value={filters.technicianId}
        onChange={(technicianId) => onChange({ ...filters, technicianId })}
      />
      <label className="inline-flex h-10 items-center gap-2.5 rounded-full px-3 text-sm font-medium">
        <Switch size="sm" checked={filters.forecast} onCheckedChange={(forecast) => onChange({ ...filters, forecast })} />
        Show PM forecast
      </label>
    </div>
  )
}
