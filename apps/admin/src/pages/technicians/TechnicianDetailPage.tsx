import { DAY, isActive, plural, startOfDay, urgency } from '@cmms/fixtures'
import type { Availability, Certification, Person } from '@cmms/types'
import { AVAILABILITY_LABEL, SHIFT_LABEL } from '@cmms/types'
import {
  ActionMenu,
  Avatar,
  Badge,
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  PageHeader,
  toast,
} from '@cmms/ui'
import { Building, CalendarX, Clock, Pencil, Trash, TriangleAlert, UserCheck, UserX } from 'lucide-react'
import { type ReactNode, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { useAuth } from '../../auth/auth'
import { BackButton } from '../../components/BackButton'
import { useNow, useScoped } from '../../state/scoped'
import { PresenceBadge } from './badges'
import { CertificationDialog } from './CertificationDialog'
import {
  AVAILABILITIES,
  certAlert,
  certAlertText,
  hoursPerDay,
  inShiftHours,
  laborSince,
  loadThisWeek,
  presenceOf,
  shiftStart,
} from './lib'
import { LaborCard, WorkCard } from './TechnicianDetailCards'
import { TechnicianDialog } from './TechnicianDialog'
import { AuthorizationsCard, CertificatesCard, ProfileCard, SkillsCard } from './TechnicianSidebar'

const LABOR_DAYS = 14
const LIST = '/people/technicians'

const AVAILABILITY_ICON: Record<Availability, ReactNode> = {
  on_shift: <UserCheck />,
  off_shift: <Clock />,
  leave: <CalendarX />,
}

export function TechnicianDetailPage() {
  const { id = '' } = useParams()
  const { maps, workOrders, settings, siteId, state, dispatch } = useScoped()
  const { can, sites, switchSite } = useAuth()
  const navigate = useNavigate()
  const now = useNow(30_000)
  const canManage = can('people.manage')
  const [editing, setEditing] = useState(false)
  const [removing, setRemoving] = useState(false)
  const [addingCert, setAddingCert] = useState(false)
  // The certificate stays set while the confirm dialog animates closed.
  const [certRemoval, setCertRemoval] = useState<{ open: boolean; cert: Certification | null }>({
    open: false,
    cert: null,
  })

  const person = maps.person.get(id)
  const here = !!person?.technician && person.siteIds.includes(siteId)

  const work = useMemo(
    () =>
      here
        ? workOrders
            .filter((w) => isActive(w) && w.assigneeIds.includes(id))
            .sort((a, b) => urgency(a, now) - urgency(b, now))
        : [],
    [here, workOrders, id, now],
  )
  const labor = useMemo(
    () => (here ? laborSince(workOrders, id, startOfDay(now) - (LABOR_DAYS - 1) * DAY, now) : []),
    [here, workOrders, id, now],
  )
  const daily = useMemo(() => hoursPerDay(labor, LABOR_DAYS, now), [labor, now])
  const load = useMemo(
    () => (person && here ? loadThisWeek([person], workOrders, settings, now).get(person.id) : undefined),
    [person, here, workOrders, settings, now],
  )

  if (!person?.technician) {
    return (
      <Card>
        <EmptyState
          icon={<UserX />}
          title="Technician not found"
          description="They may have been removed, or the link points to someone who is not a technician."
          action={
            <Button asChild variant="outline">
              <Link to={LIST}>Back to technicians</Link>
            </Button>
          }
        />
      </Card>
    )
  }

  if (!here) {
    const reachable = sites.find((s) => person.siteIds.includes(s.id))
    const siteNames = state.sites.filter((s) => person.siteIds.includes(s.id)).map((s) => s.name)
    return (
      <Card>
        <EmptyState
          icon={<Building />}
          title={`${person.name} works at ${siteNames.join(' and ')}`}
          description={
            reachable
              ? `Switch to ${reachable.name} to see their work, labor and skills.`
              : 'You do not have access to that site.'
          }
          action={
            reachable ? (
              <Button onClick={() => switchSite(reachable.id)}>Switch to {reachable.name}</Button>
            ) : (
              <Button asChild variant="outline">
                <Link to={LIST}>Back to technicians</Link>
              </Button>
            )
          }
        />
      </Card>
    )
  }

  const profile = person.technician
  const firstName = person.name.split(' ')[0]
  const team = maps.team.get(profile.teamId)
  const running = labor.filter((r) => !r.entry.end)
  const presence = presenceOf(profile, running.length > 0, now)
  const alert = certAlert(profile.certifications, now)
  const availabilityHint: Record<Availability, string> = {
    on_shift: SHIFT_LABEL[profile.shift],
    off_shift: 'Not taking work today',
    leave: 'Hidden from assignment pickers',
  }

  const save = (next: Person) => dispatch({ type: 'people/upsert', item: next })

  const setAvailability = (availability: Availability) => {
    save({ ...person, technician: { ...profile, availability } })
    const later = availability === 'on_shift' && !inShiftHours(profile.shift, now)
    toast(`${person.name}: ${AVAILABILITY_LABEL[availability].toLowerCase()}`, {
      tone: 'success',
      description: later ? `Shows as on shift from ${shiftStart(profile.shift)}.` : undefined,
    })
  }

  const removeCert = (cert: Certification) => {
    save({
      ...person,
      technician: { ...profile, certifications: profile.certifications.filter((c) => c.id !== cert.id) },
    })
    toast(`${cert.name} removed`, {
      tone: 'success',
      description: `${firstName}'s profile no longer tracks it.`,
    })
  }

  const remove = () => {
    for (const r of running)
      dispatch({ type: 'workOrders/clock', id: r.wo.id, personId: person.id, running: false })
    dispatch({ type: 'people/remove', id: person.id })
    toast(`${person.name} removed`, { tone: 'success' })
    navigate(LIST, { replace: true })
  }

  const removeDescription = [
    `${firstName} leaves the technician list, the skill matrix and the assignment pickers.`,
    work.length > 0 && `${plural(work.length, 'active work order')} lose ${firstName} as an assignee.`,
    running.length > 0 && `The running clock on ${running.map((r) => r.wo.code).join(', ')} stops now.`,
    'Labor already logged stays on the work orders.',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <>
      <BackButton fallback={LIST} className="mb-3" />

      <div className="mb-6 gap-4 flex items-start">
        <Avatar
          name={person.name}
          color={person.color}
          size="xl"
          ring
          className="size-14 text-lg sm:size-20 sm:text-2xl"
        />
        <PageHeader
          className="mb-0 min-w-0 flex-1"
          title={
            <span className="gap-x-3 gap-y-1.5 inline-flex flex-wrap items-center">
              {person.name}
              <PresenceBadge presence={presence} />
            </span>
          }
          description={
            <>
              {person.title} · {team ? `${team.name} team` : 'No team'}
              <span className="mt-2 gap-1.5 flex flex-wrap">
                <Badge variant="outline">{SHIFT_LABEL[profile.shift]}</Badge>
                {alert && (
                  <Badge variant={alert.daysLeft < 0 ? 'danger' : 'warning'} className="whitespace-normal">
                    <TriangleAlert />
                    {certAlertText(alert)}
                  </Badge>
                )}
              </span>
            </>
          }
          actions={
            canManage ? (
              <>
                <Button variant="outline" onClick={() => setEditing(true)}>
                  <Pencil />
                  Edit
                </Button>
                <ActionMenu
                  title="Set availability"
                  trigger={
                    <Button variant="outline">
                      <UserCheck />
                      Set availability
                    </Button>
                  }
                  items={AVAILABILITIES.map((a) => ({
                    key: a,
                    label: AVAILABILITY_LABEL[a],
                    icon: AVAILABILITY_ICON[a],
                    disabled: profile.availability === a,
                    description: profile.availability === a ? 'Current setting' : availabilityHint[a],
                    onSelect: () => setAvailability(a),
                  }))}
                />
                <Button variant="danger" onClick={() => setRemoving(true)}>
                  <Trash />
                  Remove
                </Button>
              </>
            ) : undefined
          }
        />
      </div>

      <div className="gap-4 xl:grid-cols-[minmax(0,1fr)_340px] grid grid-cols-1">
        <div className="min-w-0 space-y-4">
          <WorkCard firstName={firstName} work={work} now={now} />
          <LaborCard firstName={firstName} rows={labor} daily={daily} now={now} />
        </div>
        <div className="gap-4 md:grid-cols-2 xl:grid-cols-1 grid grid-cols-1 content-start">
          <ProfileCard person={person} profile={profile} load={load} />
          <SkillsCard person={person} profile={profile} canManage={canManage} />
          <CertificatesCard
            certifications={profile.certifications}
            now={now}
            canManage={canManage}
            onAdd={() => setAddingCert(true)}
            onRemove={(cert) => setCertRemoval({ open: true, cert })}
          />
          <AuthorizationsCard
            authorizations={profile.authorizations}
            canManage={canManage}
            onEdit={() => setEditing(true)}
          />
        </div>
      </div>

      <TechnicianDialog
        open={editing}
        onOpenChange={setEditing}
        editing={person}
        onSaved={(p) => toast(`${p.name} updated`, { tone: 'success' })}
      />
      <CertificationDialog
        open={addingCert}
        onOpenChange={setAddingCert}
        person={person}
        onSaved={(cert) =>
          toast(`${cert.name} added`, { tone: 'success', description: `On ${firstName}'s profile.` })
        }
      />
      <ConfirmDialog
        open={removing}
        onOpenChange={setRemoving}
        title={`Remove ${person.name}?`}
        description={removeDescription}
        confirmLabel="Remove technician"
        destructive
        onConfirm={remove}
      />
      <ConfirmDialog
        open={certRemoval.open}
        onOpenChange={(open) => setCertRemoval((c) => ({ ...c, open }))}
        title={`Remove ${certRemoval.cert?.name ?? 'certificate'}?`}
        description={`${firstName}'s profile stops tracking this certificate and its expiry. Add it again after a renewal.`}
        confirmLabel="Remove certificate"
        destructive
        onConfirm={() => certRemoval.cert && removeCert(certRemoval.cert)}
      />
    </>
  )
}
