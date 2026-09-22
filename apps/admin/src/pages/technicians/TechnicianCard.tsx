import { type TechnicianLoad, fmtHours, fmtNumber, fmtPercent } from '@cmms/fixtures'
import type { Person, TechnicianProfile } from '@cmms/types'
import { SHIFT_LABEL } from '@cmms/types'
import { Avatar, Badge, Card, SplitStats, cn } from '@cmms/ui'
import { TriangleAlert } from 'lucide-react'
import { Link } from 'react-router'
import { paths } from '../../components/links'
import { PresenceBadge } from './badges'
import { type CertAlert, type HeldSkill, type Presence, certAlertText } from './lib'

export interface TechnicianRow {
  person: Person
  profile: TechnicianProfile
  presence: Presence
  load: TechnicianLoad | undefined
  teamName: string
  skills: HeldSkill[]
  alert: CertAlert | null
}

const TOP_SKILLS = 3

export function TechnicianCard({ row }: { row: TechnicianRow }) {
  const { person, profile, presence, load, teamName, skills, alert } = row
  return (
    <Card className="p-5 relative flex flex-col transition-colors hover:bg-surface-2">
      <div className="flex-1">
        <div className="gap-3 flex items-start">
          <Avatar name={person.name} color={person.color} size="lg" />
          <div className="min-w-0 flex-1">
            <Link
              to={paths.technician(person.id)}
              className="text-base font-semibold leading-tight after:inset-0 block truncate after:absolute after:rounded-card focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-accent/40"
            >
              {person.name}
            </Link>
            <p className="mt-0.5 text-sm truncate text-muted">{person.title}</p>
          </div>
          <PresenceBadge presence={presence} />
        </div>

        <p className="mt-3 text-xs text-muted">
          <span className="font-semibold text-body">{teamName}</span> · {SHIFT_LABEL[profile.shift]}
        </p>

        <div className="mt-3 gap-1.5 flex flex-wrap">
          {skills.length === 0 && <span className="text-xs text-muted">No skills recorded yet</span>}
          {skills.slice(0, TOP_SKILLS).map(({ skill, level }) => (
            <Badge key={skill.id}>
              {skill.name} <span className="font-bold">L{level}</span>
            </Badge>
          ))}
          {skills.length > TOP_SKILLS && <Badge variant="muted">+{skills.length - TOP_SKILLS}</Badge>}
        </div>

        {alert && (
          <p
            className={cn(
              'mt-3 gap-2 rounded-2xl px-3 py-2 text-xs font-medium flex items-center',
              alert.daysLeft < 0 ? 'bg-danger-soft text-danger' : 'bg-warning-soft text-warning',
            )}
          >
            <TriangleAlert aria-hidden="true" className="size-3.5 shrink-0" />
            <span className="min-w-0">{certAlertText(alert)}</span>
          </p>
        )}
      </div>

      <SplitStats
        className="mt-5"
        items={[
          { label: 'Open jobs', value: fmtNumber(load?.openJobs ?? 0) },
          { label: 'Hours this week', value: `${fmtHours(load?.loggedMinutes ?? 0)} h` },
          { label: 'Utilization', value: fmtPercent(load?.utilization ?? 0) },
        ]}
      />
    </Card>
  )
}
