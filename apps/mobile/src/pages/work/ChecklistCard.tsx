import { plural, taskProgress } from '@cmms/fixtures'
import type { WorkOrder } from '@cmms/types'
import { Card, CardContent, CardDescription, CardHeader, CardTitle, EmptyState, ProgressBar } from '@cmms/ui'
import { ListChecks } from 'lucide-react'
import { TaskField } from './TaskField'

export function ChecklistCard({ wo, editable, hint }: { wo: WorkOrder; editable: boolean; hint: string | null }) {
  const progress = taskProgress(wo.tasks)
  const status = progress.missingRequired
    ? `${plural(progress.missingRequired, 'required check')} left`
    : 'Every required check is recorded'
  return (
    <Card>
      <CardHeader
        action={
          <span className="text-sm font-bold tabular-nums">
            {progress.done}/{progress.total}
          </span>
        }
      >
        <CardTitle>Checklist</CardTitle>
        <CardDescription>{hint ?? status}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {wo.tasks.length ? (
          <>
            <ProgressBar value={progress.ratio} tone="success" aria-label="Checklist progress" />
            {wo.tasks.map((task) => (
              <TaskField key={task.id} woId={wo.id} task={task} editable={editable} inspection={wo.type === 'inspection'} />
            ))}
          </>
        ) : (
          <EmptyState
            compact
            icon={<ListChecks />}
            title="No checklist on this job"
            description="Describe what you did in the completion note when you finish."
          />
        )}
      </CardContent>
    </Card>
  )
}
