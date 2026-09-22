import { nowMs } from '@cmms/fixtures'
import { Button, toast } from '@cmms/ui'
import { Download } from 'lucide-react'
import type { ReactNode } from 'react'
import { useScoped } from '../../state/scoped'
import { type ReportTable, csvFileName, downloadCsv } from './table'

export const sectionId = (key: string) => `report-${key}`

/** A titled report section whose Export CSV writes the section's tables. */
export function ReportSection({
  sectionKey,
  title,
  question,
  tables,
  children,
}: {
  sectionKey: string
  title: string
  question: string
  tables: ReportTable[]
  children: ReactNode
}) {
  const { site } = useScoped()
  const id = sectionId(sectionKey)

  const exportCsv = () => {
    const fileName = csvFileName(site.code, sectionKey, nowMs())
    downloadCsv(fileName, tables)
    toast(`${title} CSV downloaded`, { tone: 'success', description: fileName })
  }

  return (
    <section id={id} aria-labelledby={`${id}-title`} className="scroll-mt-4 space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div className="min-w-0">
          <h2 id={`${id}-title`} className="text-lg font-bold tracking-tight">
            {title}
          </h2>
          <p className="text-sm text-muted">{question}</p>
        </div>
        <Button variant="outline" size="sm" onClick={exportCsv}>
          <Download />
          Export CSV
        </Button>
      </div>
      {children}
    </section>
  )
}
