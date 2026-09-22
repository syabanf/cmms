import { calibrationState, fmtDate } from '@cmms/fixtures'
import type { WorkOrder } from '@cmms/types'
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, EmptyState, toast } from '@cmms/ui'
import { Undo2, Wrench } from 'lucide-react'
import { Link } from 'react-router'
import { CalibrationBadge } from '../../../components/badges'
import { paths } from '../../../components/links'
import { ToolPicker } from '../../../components/pickers'
import { useScoped } from '../../../state/scoped'
import type { WoAccess } from './useWoAccess'

export function ToolsCard({ wo, access }: { wo: WorkOrder; access: WoAccess }) {
  const { dispatch, maps, personName } = useScoped()
  const assigned = wo.toolIds.map((id) => maps.tool.get(id)).filter((t) => !!t)
  const categories = [...new Set([...wo.requiredTools, ...assigned.map((t) => t.category)])]
  const canChange = access.execute && !['completed', 'verified', 'closed', 'cancelled'].includes(wo.status)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Tools</CardTitle>
        <p className="text-sm text-muted">Tools with an expired calibration cannot be checked out.</p>
      </CardHeader>
      <CardContent className="space-y-2">
        {categories.length === 0 ? (
          <EmptyState compact icon={<Wrench />} title="No tools required" description="Job plans list the tool types a job needs." />
        ) : (
          categories.map((category) => {
            const tools = assigned.filter((t) => t.category === category)
            return (
              <div key={category} className="rounded-2xl bg-surface-2 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold">{category}</p>
                  {wo.requiredTools.includes(category) && !tools.length && <Badge variant="warning">Not assigned</Badge>}
                </div>
                {tools.map((t) => (
                  <div key={t.id} className="mt-2 flex flex-wrap items-center gap-3 rounded-xl bg-card p-2.5 shadow-card">
                    <div className="min-w-0 flex-1">
                      <Link to={paths.tool(t.id)} className="block truncate text-sm font-medium hover:text-accent">
                        <span className="font-mono text-xs text-muted">{t.code}</span> {t.name}
                      </Link>
                      <p className="text-xs text-muted">
                        {t.holderId ? `With ${personName(t.holderId)}` : t.location}
                        {t.calibration ? ` · calibration due ${fmtDate(t.calibration.due)}` : ''}
                      </p>
                    </div>
                    {t.calibration && <CalibrationBadge state={calibrationState(t.calibration)} />}
                    {canChange && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          dispatch({ type: 'workOrders/releaseTool', id: wo.id, toolId: t.id })
                          toast(`${t.code} returned to ${t.location}`)
                        }}
                      >
                        <Undo2 />
                        Return
                      </Button>
                    )}
                  </div>
                ))}
                {canChange && (
                  <ToolPicker
                    className="mt-2"
                    variant="soft"
                    category={category}
                    placeholder={tools.length ? `Add another ${category.toLowerCase()}` : `Check out a ${category.toLowerCase()}`}
                    value={null}
                    onChange={(toolId) => {
                      if (!toolId) return
                      dispatch({ type: 'workOrders/assignTool', id: wo.id, toolId })
                      toast(`${maps.tool.get(toolId)?.code} checked out to ${wo.code}`, { tone: 'success' })
                    }}
                  />
                )}
              </div>
            )
          })
        )}
      </CardContent>
    </Card>
  )
}
