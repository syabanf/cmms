import { type TechnicianLoad, fmtDate, fmtHours, fmtIdr, fmtPercent } from '@cmms/fixtures'
import type { Certification, Person, TechnicianProfile } from '@cmms/types'
import { SHIFT_LABEL, SKILL_LEVEL_LABEL } from '@cmms/types'
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  EmptyState,
  KeyValue,
  SegmentedControl,
  cn,
  toast,
} from '@cmms/ui'
import { Award, Pencil, Plus, ShieldCheck, Trash } from 'lucide-react'
import { useScoped } from '../../state/scoped'
import { CertExpiryBadge } from './badges'
import { SKILL_LEVELS, certDaysLeft } from './lib'

const telHref = (phone: string) => `tel:${phone.replace(/\s/g, '')}`

export function ProfileCard({
  person,
  profile,
  load,
}: {
  person: Person
  profile: TechnicianProfile
  load: TechnicianLoad | undefined
}) {
  const { maps, personName } = useScoped()
  const team = maps.team.get(profile.teamId)
  const none = (text: string) => <span className="text-muted">{text}</span>
  return (
    <Card>
      <CardHeader>
        <CardTitle>Profile</CardTitle>
      </CardHeader>
      <CardContent>
        <KeyValue
          bare
          items={[
            {
              label: 'Email',
              value: person.email ? (
                <a href={`mailto:${person.email}`} className="hover:text-accent">
                  {person.email}
                </a>
              ) : (
                none('Not set')
              ),
            },
            {
              label: 'Phone',
              value: person.phone ? (
                <a href={telHref(person.phone)} className="hover:text-accent">
                  {person.phone}
                </a>
              ) : (
                none('Not set')
              ),
            },
            {
              label: 'Team',
              value: team ? (
                <>
                  {team.name}
                  {team.supervisorId && (
                    <span className="text-xs block text-muted">
                      Supervisor {personName(team.supervisorId)}
                    </span>
                  )}
                </>
              ) : (
                none('No team')
              ),
            },
            { label: 'Shift', value: SHIFT_LABEL[profile.shift] },
            { label: 'Hourly cost', value: `${fmtIdr(profile.hourlyCost)} per hour` },
            {
              label: 'This week',
              value: `${fmtHours(load?.loggedMinutes ?? 0)} h logged, ${fmtPercent(load?.utilization ?? 0)} utilization`,
            },
          ]}
        />
      </CardContent>
    </Card>
  )
}

const LEVEL_OPTIONS = SKILL_LEVELS.map((l) => ({ value: String(l), label: l ? `L${l}` : 'None' }))

export function SkillsCard({
  person,
  profile,
  canManage,
}: {
  person: Person
  profile: TechnicianProfile
  canManage: boolean
}) {
  const { skills, dispatch } = useScoped()
  const firstName = person.name.split(' ')[0]
  return (
    <Card>
      <CardHeader>
        <CardTitle>Skills</CardTitle>
        <CardDescription>
          Job plans ask for a skill at a minimum level. L2 works alone, L3 can lead and teach.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {skills.map((skill) => {
          const level = profile.skills[skill.id] ?? 0
          return (
            <div key={skill.id}>
              <div className="mb-1.5 gap-2 text-sm flex items-baseline justify-between">
                <span className="font-medium">{skill.name}</span>
                <span className="text-xs text-muted">{SKILL_LEVEL_LABEL[level]}</span>
              </div>
              {canManage ? (
                <SegmentedControl
                  aria-label={`${skill.name} level`}
                  size="sm"
                  className="w-full"
                  options={LEVEL_OPTIONS}
                  value={String(level)}
                  onChange={(value) => {
                    const next = SKILL_LEVELS[Number(value)]
                    dispatch({ type: 'people/setSkill', id: person.id, skillId: skill.id, level: next })
                    toast(
                      next ? `${firstName}: ${skill.name} L${next}` : `${firstName}: ${skill.name} cleared`,
                      { tone: 'success' },
                    )
                  }}
                />
              ) : (
                <div className="gap-1 flex" aria-hidden="true">
                  {[1, 2, 3].map((n) => (
                    <span
                      key={n}
                      className={cn('h-1.5 flex-1 rounded-full', n <= level ? 'bg-ink' : 'bg-surface')}
                    />
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}

export function CertificatesCard({
  certifications,
  now,
  canManage,
  onAdd,
  onRemove,
}: {
  certifications: Certification[]
  now: number
  canManage: boolean
  onAdd: () => void
  onRemove: (cert: Certification) => void
}) {
  // Expired first, then by expiry; certificates without expiry last.
  const sorted = [...certifications].sort(
    (a, b) => (certDaysLeft(a, now) ?? Infinity) - (certDaysLeft(b, now) ?? Infinity),
  )
  return (
    <Card>
      <CardHeader
        action={
          canManage && certifications.length > 0 ? (
            <Button variant="outline" size="sm" onClick={onAdd}>
              <Plus />
              Add
            </Button>
          ) : undefined
        }
      >
        <CardTitle>Certificates</CardTitle>
      </CardHeader>
      <CardContent>
        {sorted.length === 0 ? (
          <EmptyState
            compact
            icon={<Award />}
            title="No certificates on file"
            description={
              canManage
                ? 'Add K3, LOTO or vendor training certificates to track when they expire.'
                : 'A supervisor or manager can add them.'
            }
            action={
              canManage ? (
                <Button size="sm" onClick={onAdd}>
                  <Plus />
                  Add certificate
                </Button>
              ) : undefined
            }
          />
        ) : (
          <ul className="space-y-2">
            {sorted.map((cert) => {
              const daysLeft = certDaysLeft(cert, now)
              return (
                <li key={cert.id} className="gap-3 rounded-2xl p-3 flex items-start bg-surface-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold">{cert.name}</p>
                    <p className="mt-0.5 text-xs text-muted">
                      {cert.issuer} · issued {fmtDate(cert.issuedAt)}
                    </p>
                    <p className="mt-2 gap-2 text-xs flex flex-wrap items-center text-muted">
                      <CertExpiryBadge daysLeft={daysLeft} />
                      {cert.expiresAt &&
                        `${daysLeft !== null && daysLeft < 0 ? 'Expired' : 'Expires'} ${fmtDate(cert.expiresAt)}`}
                    </p>
                  </div>
                  {canManage && (
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Remove ${cert.name}`}
                      onClick={() => onRemove(cert)}
                    >
                      <Trash />
                    </Button>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}

export function AuthorizationsCard({
  authorizations,
  canManage,
  onEdit,
}: {
  authorizations: string[]
  canManage: boolean
  onEdit: () => void
}) {
  return (
    <Card>
      <CardHeader
        action={
          canManage ? (
            <Button variant="outline" size="sm" onClick={onEdit}>
              <Pencil />
              Edit
            </Button>
          ) : undefined
        }
      >
        <CardTitle>Authorizations</CardTitle>
        <CardDescription>Work permits this person may sign for.</CardDescription>
      </CardHeader>
      <CardContent>
        {authorizations.length ? (
          <div className="gap-1.5 flex flex-wrap">
            {authorizations.map((a) => (
              <Badge key={a} variant="outline">
                <ShieldCheck />
                {a}
              </Badge>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted">
            None recorded. Jobs that need LOTO or hot work go to someone else.
          </p>
        )}
      </CardContent>
    </Card>
  )
}
