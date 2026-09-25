import { calibrationState } from '@cmms/fixtures'
import type { Tool, ToolStatus } from '@cmms/types'
import { TOOL_STATUS_LABEL } from '@cmms/types'
import { Button, Card, Chip, ChipRow, EmptyState, Input, PageHeader, StatCard } from '@cmms/ui'
import { CalendarX, CircleCheck, Construction, HardHat, Plus, Search, Wrench } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import { useAuth } from '../../auth/auth'
import { paths } from '../../components/links'
import { useHistoryState } from '../../lib/history-state'
import { useNow, useScoped } from '../../state/scoped'
import { distinct } from './lib'
import { ToolCard } from './ToolCard'
import { ToolDialog } from './ToolDialog'

const STATUSES: ToolStatus[] = ['available', 'in_use', 'calibration', 'maintenance', 'lost']

export function ToolsPage() {
  const { tools, site, personName } = useScoped()
  const { can } = useAuth()
  const navigate = useNavigate()
  const now = useNow(60_000)
  const canManage = can('tool.manage')
  const [query, setQuery] = useHistoryState('query', '')
  const [status, setStatus] = useHistoryState<ToolStatus | null>('status', null)
  const [category, setCategory] = useHistoryState<string | null>('category', null)
  const [creating, setCreating] = useState(false)

  const categories = useMemo(() => distinct(tools.map((t) => t.category)), [tools])
  const countOf = (s: ToolStatus) => tools.filter((t) => t.status === s).length
  const expired = tools.filter((t) => calibrationState(t.calibration, now) === 'expired')
  const out = countOf('calibration') + countOf('maintenance') + countOf('lost')

  const q = query.trim().toLowerCase()
  const searched = q
    ? tools.filter((t) => [t.code, t.name, t.category, t.location, t.serialNumber, t.holderId ? personName(t.holderId) : ''].some((f) => f.toLowerCase().includes(q)))
    : tools
  const inCategory = category ? searched.filter((t) => t.category === category) : searched
  const inStatus = (t: Tool) => !status || t.status === status
  const visible = inCategory.filter(inStatus).sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }))

  const filtering = q !== '' || status !== null || category !== null
  const clearFilters = () => {
    setQuery('')
    setStatus(null)
    setCategory(null)
  }

  return (
    <>
      <PageHeader
        title="Tools"
        description={`Tool crib at ${site.name}: who holds each tool, its condition and its calibration.`}
        actions={
          <>
            <Input
              variant="pill"
              className="w-full sm:w-72"
              leftIcon={<Search />}
              value={query}
              placeholder="Search code, name, serial or holder"
              aria-label="Search tools"
              onChange={(e) => setQuery(e.target.value)}
            />
            {canManage && (
              <Button onClick={() => setCreating(true)}>
                <Plus />
                Add tool
              </Button>
            )}
          </>
        }
      />

      <div className="no-scrollbar mb-4 flex snap-x snap-mandatory gap-3 overflow-x-auto pb-1 [&>*]:min-w-[72%] [&>*]:snap-start sm:grid sm:grid-cols-2 sm:gap-4 sm:overflow-visible sm:pb-0 sm:[&>*]:min-w-0 xl:grid-cols-4">
        <StatCard label="Available" value={countOf('available')} hint={`Of ${tools.length} tools in the register`} icon={<CircleCheck />} tone="success" />
        <StatCard
          label="In use"
          value={countOf('in_use')}
          hint={`${tools.filter((t) => t.status === 'in_use' && t.woId).length} on work orders`}
          icon={<HardHat />}
          tone="info"
        />
        <StatCard
          label="Out of service"
          value={out}
          hint={`${countOf('calibration')} at calibration, ${countOf('maintenance')} in repair, ${countOf('lost')} missing`}
          icon={<Construction />}
          tone="warning"
        />
        <StatCard
          label="Calibration expired"
          value={expired.length}
          hint={expired.length ? `${expired.map((t) => t.code).join(', ')} blocked from work orders` : 'Every calibration is current'}
          icon={<CalendarX />}
          tone={expired.length ? 'danger' : 'default'}
        />
      </div>

      <div className="mb-4 space-y-2">
        <ChipRow aria-label="Filter by status">
          <Chip variant="filter" active={status === null} count={inCategory.length} onClick={() => setStatus(null)}>
            All statuses
          </Chip>
          {STATUSES.map((s) => (
            <Chip key={s} variant="filter" active={status === s} count={inCategory.filter((t) => t.status === s).length} onClick={() => setStatus(status === s ? null : s)}>
              {TOOL_STATUS_LABEL[s]}
            </Chip>
          ))}
        </ChipRow>
        <ChipRow aria-label="Filter by category">
          <Chip variant="filter" active={category === null} count={searched.filter(inStatus).length} onClick={() => setCategory(null)}>
            All categories
          </Chip>
          {categories.map((c) => (
            <Chip
              key={c}
              variant="filter"
              active={category === c}
              count={searched.filter((t) => t.category === c && inStatus(t)).length}
              onClick={() => setCategory(category === c ? null : c)}
            >
              {c}
            </Chip>
          ))}
        </ChipRow>
      </div>

      {visible.length ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {visible.map((tool) => (
            <ToolCard key={tool.id} tool={tool} now={now} />
          ))}
        </div>
      ) : (
        <Card>
          {filtering ? (
            <EmptyState
              icon={<Search />}
              title="No tools match these filters"
              description="Clear the search and filters to see the whole register."
              action={
                <Button variant="outline" size="sm" onClick={clearFilters}>
                  Clear filters
                </Button>
              }
            />
          ) : (
            <EmptyState
              icon={<Wrench />}
              title="No tools registered yet"
              description={
                canManage
                  ? 'Add the tools in your crib so technicians can check them out on work orders.'
                  : 'Ask the tool crib or a planner to register the tools here.'
              }
              action={
                canManage ? (
                  <Button size="sm" onClick={() => setCreating(true)}>
                    <Plus />
                    Add tool
                  </Button>
                ) : undefined
              }
            />
          )}
        </Card>
      )}

      <ToolDialog open={creating} onOpenChange={setCreating} editing={null} onSaved={(tool) => navigate(paths.tool(tool.id))} />
    </>
  )
}
