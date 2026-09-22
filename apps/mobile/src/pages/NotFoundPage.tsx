import { Button, Card, EmptyState } from '@cmms/ui'
import { SearchX } from 'lucide-react'
import { Link } from 'react-router'
import { DetailHeader } from '../layouts/DetailHeader'
import { paths } from '../lib/paths'

/** A detail route whose record does not exist here: header with a way back, and the reason. */
export function NotFound({
  title,
  heading,
  description,
  back,
  backLabel,
}: {
  title: string
  heading: string
  description: string
  back: string
  backLabel: string
}) {
  return (
    <div className="space-y-6">
      <DetailHeader title={title} fallback={back} />
      <Card>
        <EmptyState
          icon={<SearchX />}
          title={heading}
          description={description}
          action={
            <Button asChild variant="outline" className="h-11">
              <Link to={back}>{backLabel}</Link>
            </Button>
          }
        />
      </Card>
    </div>
  )
}

export function NotFoundPage() {
  return (
    <NotFound
      title="Page not found"
      heading="This screen does not exist"
      description="The link may be old. Your work and requests are one tap away."
      back={paths.home}
      backLabel="Go home"
    />
  )
}
