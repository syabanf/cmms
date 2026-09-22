import { calibrationDaysLeft, calibrationState, fmtDateShort } from '@cmms/fixtures'
import type { Tool } from '@cmms/types'
import { TOOL_CONDITION_LABEL } from '@cmms/types'
import { Card, IconTile, SplitStats, cn } from '@cmms/ui'
import { Link } from 'react-router'
import { CalibrationBadge, ToolStatusBadge } from '../../components/badges'
import { PersonChip, WoLink, paths } from '../../components/links'
import { daysLeftText } from '../calibration/lib'
import { ToolIcon } from './ToolIcon'

export function ToolCard({ tool, now }: { tool: Tool; now: number }) {
  const plan = tool.calibration
  const days = plan ? calibrationDaysLeft(plan, now) : 0

  return (
    <Card className="relative flex flex-col p-5 transition-colors hover:bg-surface-2">
      <div className="flex items-start gap-3">
        <IconTile>
          <ToolIcon category={tool.category} />
        </IconTile>
        <div className="min-w-0 flex-1">
          <p className="font-mono text-[11px] text-muted">{tool.code}</p>
          <Link
            to={paths.tool(tool.id)}
            className="block max-w-full truncate text-base font-semibold leading-tight after:absolute after:inset-0 after:rounded-card focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-accent/40"
          >
            {tool.name}
          </Link>
          <p className="mt-0.5 truncate text-xs text-muted">
            {tool.category} · {tool.location || 'No location set'}
          </p>
        </div>
        <ToolStatusBadge status={tool.status} />
      </div>

      {plan && (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <CalibrationBadge state={calibrationState(plan, now)} />
          <span className={cn('text-xs', days < 0 ? 'font-semibold text-accent' : 'text-muted')}>{daysLeftText(days)}</span>
        </div>
      )}

      {tool.status === 'in_use' && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-surface px-3 py-2 text-sm">
          <PersonChip personId={tool.holderId} />
          {tool.woId ? <WoLink woId={tool.woId} className="relative z-10" /> : <span className="text-xs text-muted">No work order</span>}
        </div>
      )}

      <div className="mt-auto pt-5">
        <SplitStats
          items={[
            { label: 'Calibration due', value: plan ? fmtDateShort(plan.due) : 'Not needed' },
            { label: 'Condition', value: TOOL_CONDITION_LABEL[tool.condition] },
            { label: 'Last calibrated', value: plan ? (plan.lastAt ? fmtDateShort(plan.lastAt) : 'Never') : 'Not needed' },
          ]}
        />
      </div>
    </Card>
  )
}
