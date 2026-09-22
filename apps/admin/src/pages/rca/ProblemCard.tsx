import type { Rca } from '@cmms/types'
import { Card, CardContent, CardDescription, CardHeader, CardTitle, toast } from '@cmms/ui'
import { EditableText } from './EditableText'
import type { RcaUpdate } from './lib'

export function ProblemCard({ rca, editable, update }: { rca: Rca; editable: boolean; update: RcaUpdate }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Problem statement</CardTitle>
        <CardDescription>What failed, how often and what it cost. Facts only: the causes come later.</CardDescription>
      </CardHeader>
      <CardContent>
        {editable ? (
          <EditableText
            rows={5}
            showSave
            label="Problem statement"
            value={rca.problem}
            placeholder="Bearing 6204 on the drive failed three times in 34 days. Each failure stopped the machine for 3 to 8 hours."
            onCommit={(problem) => {
              update((r) => ({ ...r, problem }))
              toast('Problem statement saved', { tone: 'success' })
            }}
          />
        ) : (
          <p className="whitespace-pre-line text-sm leading-relaxed">{rca.problem || <span className="text-muted">No problem statement yet.</span>}</p>
        )}
      </CardContent>
    </Card>
  )
}
