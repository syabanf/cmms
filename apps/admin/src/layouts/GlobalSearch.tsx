import { WO_STATUS_LABEL } from '@cmms/types'
import { Input, cn } from '@cmms/ui'
import { Search } from 'lucide-react'
import { type KeyboardEvent, useId, useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import { paths } from '../components/links'
import { type Scoped, useScoped } from '../state/scoped'

interface Hit {
  id: string
  label: string
  hint: string
  to: string
}

const LIMIT = 5

function searchAll(s: Scoped, query: string): { group: string; hits: Hit[] }[] {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean)
  if (!terms.length) return []
  const match = (...fields: (string | undefined)[]) => {
    const text = fields.join(' ').toLowerCase()
    return terms.every((t) => text.includes(t))
  }
  const groups = [
    {
      group: 'Assets',
      hits: s.assets
        .filter((a) => match(a.code, a.name, a.serialNumber, a.model))
        .map((a) => ({ id: a.id, label: `${a.code} · ${a.name}`, hint: s.locationPath(a.locationId), to: paths.asset(a.id) })),
    },
    {
      group: 'Work orders',
      hits: [...s.workOrders]
        .reverse()
        .filter((w) => match(w.code, w.title, s.maps.asset.get(w.assetId)?.code))
        .map((w) => ({ id: w.id, label: `${w.code} · ${w.title}`, hint: `${WO_STATUS_LABEL[w.status]} · ${s.maps.asset.get(w.assetId)?.name ?? ''}`, to: paths.workOrder(w.id) })),
    },
    {
      group: 'Requests',
      hits: [...s.requests]
        .reverse()
        .filter((r) => match(r.code, r.title))
        .map((r) => ({ id: r.id, label: `${r.code} · ${r.title}`, hint: s.maps.asset.get(r.assetId)?.name ?? '', to: paths.request(r.id) })),
    },
    {
      group: 'Spare parts',
      hits: s.parts
        .filter((p) => match(p.code, p.name, p.manufacturer, p.spec))
        .map((p) => ({ id: p.id, label: `${p.code} · ${p.name}`, hint: p.manufacturer, to: paths.part(p.id) })),
    },
    {
      group: 'Job plans',
      hits: s.jobPlans
        .filter((j) => match(j.code, j.name))
        .map((j) => ({ id: j.id, label: `${j.code} · ${j.name}`, hint: `${j.durationMin} min`, to: paths.jobPlan(j.id) })),
    },
    {
      group: 'People',
      hits: s.technicians
        .filter((p) => match(p.name, p.title))
        .map((p) => ({ id: p.id, label: p.name, hint: p.title, to: paths.technician(p.id) })),
    },
    {
      group: 'Tools',
      hits: s.tools
        .filter((t) => match(t.code, t.name, t.category))
        .map((t) => ({ id: t.id, label: `${t.code} · ${t.name}`, hint: t.location, to: paths.tool(t.id) })),
    },
  ]
  return groups.map((g) => ({ ...g, hits: g.hits.slice(0, LIMIT) })).filter((g) => g.hits.length)
}

export function GlobalSearch({ className, autoFocus, onNavigate }: { className?: string; autoFocus?: boolean; onNavigate?: () => void }) {
  const scoped = useScoped()
  const navigate = useNavigate()
  const listId = useId()
  const [query, setQuery] = useState('')
  const [focused, setFocused] = useState(false)
  const [active, setActive] = useState(0)
  const groups = useMemo(() => searchAll(scoped, query), [scoped, query])
  const flat = groups.flatMap((g) => g.hits)
  const showPanel = focused && query.trim().length > 0

  const go = (hit: Hit) => {
    navigate(hit.to)
    setQuery('')
    setFocused(false)
    onNavigate?.()
  }

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive((i) => Math.min(i + 1, flat.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter' && flat[active]) {
      e.preventDefault()
      go(flat[active])
    } else if (e.key === 'Escape') {
      setQuery('')
      e.currentTarget.blur()
    }
  }

  let index = -1
  return (
    <div className={cn('relative', className)}>
      <Input
        variant="pill"
        type="search"
        leftIcon={<Search />}
        placeholder="Search assets, work orders, parts"
        value={query}
        autoFocus={autoFocus}
        role="combobox"
        aria-expanded={showPanel}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={showPanel && flat[active] ? `${listId}-${active}` : undefined}
        onChange={(e) => {
          setQuery(e.target.value)
          setActive(0)
        }}
        onFocus={() => setFocused(true)}
        onBlur={() => window.setTimeout(() => setFocused(false), 150)}
        onKeyDown={onKeyDown}
      />
      {showPanel && (
        <div id={listId} role="listbox" className="absolute inset-x-0 top-full z-40 mt-2 max-h-[60dvh] overflow-y-auto rounded-2xl border border-border bg-card p-1 shadow-float">
          {groups.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-muted">No matches for "{query.trim()}"</p>
          ) : (
            groups.map((g) => (
              <div key={g.group} className="py-1">
                <p className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wider text-muted">{g.group}</p>
                {g.hits.map((hit) => {
                  index++
                  const i = index
                  return (
                    <button
                      key={hit.id}
                      id={`${listId}-${i}`}
                      type="button"
                      role="option"
                      aria-selected={i === active}
                      onMouseDown={(e) => e.preventDefault()}
                      onMouseEnter={() => setActive(i)}
                      onClick={() => go(hit)}
                      className="flex w-full flex-col items-start rounded-xl px-3 py-2 text-left hover:bg-surface aria-selected:bg-surface"
                    >
                      <span className="w-full truncate text-sm font-medium">{hit.label}</span>
                      {hit.hint && <span className="w-full truncate text-xs text-muted">{hit.hint}</span>}
                    </button>
                  )
                })}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}
