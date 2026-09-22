import { Button, Card, EmptyState } from '@cmms/ui'
import { Compass } from 'lucide-react'
import { Link } from 'react-router'

export function NotFoundPage() {
  return (
    <Card className="mx-auto mt-10 max-w-lg">
      <EmptyState
        icon={<Compass />}
        title="Page not found"
        description="The link may be old or the record was removed."
        action={
          <Button asChild variant="outline">
            <Link to="/">Back to dashboard</Link>
          </Button>
        }
      />
    </Card>
  )
}
