import { type TechnicianLoad, fmtIdrShort, fmtNumber, fmtPercent, plural } from '@cmms/fixtures'
import { Card, CardContent, CardDescription, CardHeader, CardTitle, IconTile, type Tone } from '@cmms/ui'
import type { LucideIcon } from 'lucide-react'
import { CalendarCheck, ChevronRight, Factory, Microscope, Repeat, Target, TriangleAlert, Users, Wallet } from 'lucide-react'
import { useScoped } from '../../state/scoped'
import { sectionId } from './ReportSection'
import { type CostReport, OVERLOAD, type OperationalReport, type Range, type ReliabilityReport } from './data'

interface Answer {
  question: string
  answer: string
  detail: string
  section: string
  icon: LucideIcon
  tone?: Tone
}

/** The questions from the product brief, each answered in one line and linked to its section. */
export function AtAGlance({
  operational,
  reliability,
  cost,
  load,
  range,
}: {
  operational: OperationalReport
  reliability: ReliabilityReport
  cost: CostReport
  load: TechnicianLoad[]
  range: Range
}) {
  const { maps, site } = useScoped()
  const worst = reliability.bad[0]
  const worstName = worst ? (maps.asset.get(worst.assetId)?.name ?? 'Removed asset') : undefined
  const mode = reliability.modes[0]
  const cause = reliability.causes[0]
  const coded = reliability.modes.reduce((sum, m) => sum + m.count, 0)
  const overloaded = load.filter((l) => l.utilization > OVERLOAD).length
  const { pm, shares, backlog } = operational

  const answers: Answer[] = [
    {
      question: 'Which asset gives the most trouble?',
      answer: worstName ?? 'No failures recorded',
      detail: worst ? `${plural(worst.failures, 'failure')}, ${fmtNumber(worst.downtimeHours, 1)} h down` : 'Nothing broke in this period',
      section: 'reliability',
      icon: Factory,
    },
    {
      question: 'Which failure happens most often?',
      answer: mode ? (maps.failureCode.get(mode.key)?.name ?? 'Unknown code') : 'No coded failures',
      detail: mode ? `${fmtPercent(mode.share)} of ${plural(coded, 'coded failure')}` : 'Failure modes come from completed corrective work',
      section: 'reliability',
      icon: TriangleAlert,
    },
    {
      question: 'Why does it happen?',
      answer: cause ? `Mostly ${(maps.failureCode.get(cause.key)?.name ?? 'unknown causes').toLowerCase()}` : 'No causes coded',
      detail: `${plural(reliability.openRcas, 'root cause analysis', 'root cause analyses')} open`,
      section: 'reliability',
      icon: Microscope,
    },
    {
      question: 'What does maintenance cost for that asset?',
      answer: worst && worstName ? `${fmtIdrShort(worst.cost)} on ${worstName}` : fmtIdrShort(cost.total.total),
      detail: `${fmtIdrShort(cost.total.total)} for all of ${site.name}`,
      section: 'cost',
      icon: Wallet,
    },
    {
      question: 'Does the same problem keep coming back?',
      answer: reliability.repeats ? plural(reliability.repeats, 'repeat failure') : 'No repeat failures',
      detail: reliability.chains ? `In ${plural(reliability.chains, 'chain')} of the same asset and failure mode` : 'Nothing failed twice the same way',
      section: 'reliability',
      icon: Repeat,
      tone: reliability.repeats ? 'danger' : undefined,
    },
    {
      question: 'Is our PM effective?',
      answer: `${fmtPercent(pm.ratio)} PM compliance`,
      detail: `${fmtPercent(shares.plannedShare)} of work planned, ${fmtPercent(shares.emergencyShare)} emergency`,
      section: 'operational',
      icon: CalendarCheck,
    },
    {
      question: 'Is the maintenance team overloaded?',
      answer: `${fmtNumber(backlog.weeks, 1)} weeks of backlog`,
      detail: overloaded ? `${plural(overloaded, 'technician')} above 90% utilization` : 'Nobody above 90% utilization',
      section: 'resource',
      icon: Users,
      tone: overloaded ? 'warning' : undefined,
    },
    {
      question: 'Are we fixing root causes or symptoms?',
      answer: reliability.chains ? `${reliability.covered} of ${plural(reliability.chains, 'repeat chain')} have an RCA` : 'No repeat chains to explain',
      detail: `${reliability.actionsDone} of ${plural(reliability.actionsTotal, 'RCA action')} done`,
      section: 'reliability',
      icon: Target,
      tone: reliability.covered < reliability.chains ? 'warning' : undefined,
    },
  ]

  return (
    <Card>
      <CardHeader>
        <CardTitle>At a glance</CardTitle>
        <CardDescription>The questions a maintenance review has to answer, for {range.label}. Select one to jump to the numbers behind it.</CardDescription>
      </CardHeader>
      <CardContent className="grid grid-cols-1 gap-2 md:grid-cols-2">
        {answers.map(({ question, answer, detail, section, icon: Icon, tone }) => (
          <button
            key={question}
            type="button"
            onClick={() => document.getElementById(sectionId(section))?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
            className="flex items-start gap-3 rounded-2xl bg-surface-2 p-3 text-left transition-colors hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 active:scale-[0.98]"
          >
            <IconTile size="sm" tone={tone}>
              <Icon />
            </IconTile>
            <span className="min-w-0 flex-1">
              <span className="block text-xs text-muted">{question}</span>
              <span className="mt-0.5 block text-sm font-semibold">{answer}</span>
              <span className="block text-xs text-muted">{detail}</span>
            </span>
            <ChevronRight aria-hidden className="mt-2 size-4 shrink-0 text-muted" />
          </button>
        ))}
      </CardContent>
    </Card>
  )
}
