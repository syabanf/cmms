import { ROLE_PERMISSIONS, ROLE_SUMMARY } from '@cmms/fixtures'
import type { Person, Role } from '@cmms/types'
import { ROLE_LABEL, ROLES } from '@cmms/types'
import {
  AvatarStack,
  Badge,
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
  Combobox,
  IconTile,
  Kicker,
  PageHeader,
  SplitStats,
  cn,
} from '@cmms/ui'
import {
  BriefcaseBusiness,
  CalendarClock,
  Check,
  Eye,
  HardHat,
  Inbox,
  KeyRound,
  Lock,
  Minus,
  UserCheck,
  Warehouse,
} from 'lucide-react'
import { Fragment, type ReactNode, useMemo } from 'react'
import { useHistoryState } from '../../lib/history-state'
import { useScoped } from '../../state/scoped'
import { PERMISSION_COUNT, PERMISSION_GROUPS, permissionLabel, permissionsIn } from './lib'

const ROLE_ICON: Record<Role, ReactNode> = {
  manager: <BriefcaseBusiness />,
  planner: <CalendarClock />,
  supervisor: <UserCheck />,
  technician: <HardHat />,
  warehouse: <Warehouse />,
  requester: <Inbox />,
  admin: <KeyRound />,
  viewer: <Eye />,
}

function RoleCard({ role, people, mine }: { role: Role; people: Person[]; mine: boolean }) {
  return (
    <Card className="p-5 flex flex-col">
      <div className="gap-3 flex items-start justify-between">
        <IconTile tone={mine ? 'ink' : 'default'}>{ROLE_ICON[role]}</IconTile>
        {mine && <Badge variant="info">Your role</Badge>}
      </div>
      <h2 className="mt-4 text-base font-semibold leading-tight">{ROLE_LABEL[role]}</h2>
      <p className="mt-1 text-sm flex-1 text-muted">{ROLE_SUMMARY[role]}</p>
      <div className="mt-4 min-h-7 flex items-center">
        {people.length ? (
          <AvatarStack people={people.map((p) => ({ name: p.name, color: p.color }))} max={5} />
        ) : (
          <span className="text-xs text-muted">Nobody holds this role yet</span>
        )}
      </div>
      <SplitStats
        className="mt-5"
        items={[
          { label: 'Members', value: people.length },
          { label: 'Permissions', value: `${ROLE_PERMISSIONS[role].length} of ${PERMISSION_COUNT}` },
        ]}
      />
    </Card>
  )
}

const sticky = 'sticky left-0 z-10'
const rowBorder = 'border-b border-border'

function PermissionMatrix({ currentRole }: { currentRole: Role }) {
  return (
    <Card className="mt-4">
      <CardHeader
        action={
          <Badge variant="muted">
            <Lock />
            Read only
          </Badge>
        }
      >
        <CardTitle>Permissions by role</CardTitle>
        <CardDescription>
          Role permissions are defined in code for this release, so this matrix is for reference.
        </CardDescription>
      </CardHeader>
      <RoleList currentRole={currentRole} />
      {/* Eight role columns outgrow a tablet: the table scrolls inside the card. `relative` keeps the sr-only text inside the scroll box. */}
      <div className="md:block relative hidden overflow-x-auto">
        <table className="border-spacing-0 text-sm w-full border-separate">
          <thead>
            <tr>
              <th
                scope="col"
                className={cn(
                  sticky,
                  rowBorder,
                  'min-w-44 px-5 py-3 text-xs font-semibold bg-card text-left text-muted',
                )}
              >
                Permission
              </th>
              {ROLES.map((role) => (
                <th
                  key={role}
                  scope="col"
                  className={cn(
                    rowBorder,
                    'min-w-20 px-1.5 py-3 text-xs font-semibold text-center align-bottom text-muted',
                  )}
                >
                  <span className={cn('block', role === currentRole && 'text-foreground')}>
                    {ROLE_LABEL[role]}
                  </span>
                  {role === currentRole && (
                    <Badge variant="info" className="mt-1">
                      You
                    </Badge>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {PERMISSION_GROUPS.map((group) => (
              <Fragment key={group}>
                <tr>
                  <th
                    scope="rowgroup"
                    className={cn(
                      sticky,
                      'px-5 py-2 font-semibold tracking-wider bg-surface-2 text-left text-[11px] text-muted uppercase',
                    )}
                  >
                    {group}
                  </th>
                  <td colSpan={ROLES.length} className="bg-surface-2" />
                </tr>
                {permissionsIn(group).map((permission) => (
                  <tr key={permission}>
                    <th
                      scope="row"
                      className={cn(sticky, rowBorder, 'px-5 py-2.5 font-medium bg-card text-left')}
                    >
                      {permissionLabel(permission)}
                    </th>
                    {ROLES.map((role) => (
                      <td key={role} className={cn(rowBorder, 'px-1.5 py-2.5 text-center')}>
                        {ROLE_PERMISSIONS[role].includes(permission) ? (
                          <>
                            <Check aria-hidden="true" className="size-4 mx-auto text-success" />
                            <span className="sr-only">Allowed</span>
                          </>
                        ) : (
                          <>
                            <span
                              aria-hidden="true"
                              className="size-1.5 mx-auto block rounded-full bg-border"
                            />
                            <span className="sr-only">Not allowed</span>
                          </>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  )
}

/** Phones get one role at a time instead of eight columns. */
function RoleList({ currentRole }: { currentRole: Role }) {
  const [role, setRole] = useHistoryState<Role>('role', currentRole)
  return (
    <div className="px-5 pb-5 md:hidden">
      <Combobox
        aria-label="Role"
        items={ROLES}
        value={role}
        onChange={(value) => {
          const next = ROLES.find((r) => r === value)
          if (next) setRole(next)
        }}
        getKey={(r) => r}
        getLabel={(r) => ROLE_LABEL[r]}
        getDescription={(r) =>
          `${ROLE_PERMISSIONS[r].length} of ${PERMISSION_COUNT} permissions${r === currentRole ? ' · your role' : ''}`
        }
      />
      <div className="mt-4 space-y-4">
        {PERMISSION_GROUPS.map((group) => (
          <section key={group}>
            <Kicker>{group}</Kicker>
            <ul className="mt-2 space-y-1.5">
              {permissionsIn(group).map((permission) => {
                const allowed = ROLE_PERMISSIONS[role].includes(permission)
                return (
                  <li
                    key={permission}
                    className={cn('gap-2 text-sm flex items-center', !allowed && 'text-muted')}
                  >
                    {allowed ? (
                      <Check aria-hidden="true" className="size-4 shrink-0 text-success" />
                    ) : (
                      <Minus aria-hidden="true" className="size-4 shrink-0 text-silver" />
                    )}
                    {permissionLabel(permission)}
                    <span className="sr-only">{allowed ? 'allowed' : 'not allowed'}</span>
                  </li>
                )
              })}
            </ul>
          </section>
        ))}
      </div>
    </div>
  )
}

export function RolesPage() {
  const { state, user } = useScoped()
  const members = useMemo(
    () => new Map(ROLES.map((role) => [role, state.people.filter((p) => p.role === role)])),
    [state.people],
  )

  return (
    <>
      <PageHeader
        title="Roles & access"
        description="What each role can do in the CMMS, and who holds it across all sites."
      />
      <div className="gap-4 sm:grid-cols-2 xl:grid-cols-4 grid grid-cols-1">
        {ROLES.map((role) => (
          <RoleCard key={role} role={role} people={members.get(role) ?? []} mine={role === user.role} />
        ))}
      </div>
      <PermissionMatrix currentRole={user.role} />
    </>
  )
}
