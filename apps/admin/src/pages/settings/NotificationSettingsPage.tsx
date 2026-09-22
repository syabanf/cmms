import { plural } from '@cmms/fixtures'
import type { NotificationChannel, NotificationEvent, NotificationRule } from '@cmms/types'
import {
  NOTIFICATION_CHANNEL_LABEL,
  NOTIFICATION_CHANNELS,
  NOTIFICATION_EVENT_LABEL,
  ROLE_LABEL,
  ROLES,
} from '@cmms/types'
import {
  Badge,
  Banner,
  Button,
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
  MultiCombobox,
  PageHeader,
  Switch,
  toast,
} from '@cmms/ui'
import { Lock, RotateCcw, Save } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useAuth } from '../../auth/auth'
import { useNotifications } from '../../layouts/notifications'
import { useScoped } from '../../state/scoped'
import { NOTIFICATION_EVENT_HINT, orderedRoles, ruleRows } from './lib'

const sameRule = (a: NotificationRule, b: NotificationRule) => JSON.stringify(a) === JSON.stringify(b)
const reaches = (rule: NotificationRule) =>
  rule.roles.length > 0 && NOTIFICATION_CHANNELS.some((c) => rule.channels[c])

interface RowProps {
  rule: NotificationRule
  firing: number
  canEdit: boolean
  onChannel: (channel: NotificationChannel, on: boolean) => void
  onRoles: (roles: string[]) => void
}

function EventText({ rule }: { rule: NotificationRule }) {
  return (
    <>
      <p className="text-sm font-semibold">{NOTIFICATION_EVENT_LABEL[rule.event]}</p>
      <p className="mt-0.5 text-xs text-muted">{NOTIFICATION_EVENT_HINT[rule.event]}</p>
      {!reaches(rule) && <p className="mt-1 text-xs font-medium text-warning">Nobody receives this alert.</p>}
    </>
  )
}

function RolesPicker({ rule, canEdit, onRoles }: Pick<RowProps, 'rule' | 'canEdit' | 'onRoles'>) {
  return (
    <MultiCombobox
      aria-label={`Roles for ${NOTIFICATION_EVENT_LABEL[rule.event]}`}
      items={ROLES}
      values={rule.roles}
      onChange={onRoles}
      getKey={(r) => r}
      getLabel={(r) => ROLE_LABEL[r]}
      placeholder="No roles"
      searchPlaceholder="Search roles"
      disabled={!canEdit}
    />
  )
}

const FiringBadge = ({ count, long = false }: { count: number; long?: boolean }) => (
  <Badge variant={count ? 'info' : 'muted'}>{long ? `${count} firing now` : count}</Badge>
)

function TableRow({ rule, firing, canEdit, onChannel, onRoles }: RowProps) {
  return (
    <tr>
      <td className="px-5 py-3 border-b border-border align-top">
        <EventText rule={rule} />
      </td>
      <td className="px-3 py-3 border-b border-border align-top">
        <FiringBadge count={firing} />
      </td>
      {NOTIFICATION_CHANNELS.map((channel) => (
        <td key={channel} className="px-3 py-3 border-b border-border text-center align-top">
          <Switch
            size="sm"
            checked={rule.channels[channel]}
            onCheckedChange={(on) => onChannel(channel, on)}
            disabled={!canEdit}
            aria-label={`${NOTIFICATION_EVENT_LABEL[rule.event]} by ${NOTIFICATION_CHANNEL_LABEL[channel]}`}
          />
        </td>
      ))}
      <td className="w-60 px-5 py-3 border-b border-border align-top">
        <RolesPicker rule={rule} canEdit={canEdit} onRoles={onRoles} />
      </td>
    </tr>
  )
}

function EventCard({ rule, firing, canEdit, onChannel, onRoles }: RowProps) {
  return (
    <li className="rounded-2xl p-4 bg-surface-2">
      <div className="gap-2 flex flex-wrap items-start justify-between">
        <div className="min-w-0 flex-1">
          <EventText rule={rule} />
        </div>
        <FiringBadge count={firing} long />
      </div>
      <div className="mt-3 gap-2 sm:grid-cols-4 grid grid-cols-2">
        {NOTIFICATION_CHANNELS.map((channel) => (
          <label
            key={channel}
            className="gap-2 rounded-xl px-3 py-2 text-sm flex items-center justify-between bg-card"
          >
            <span className="min-w-0 truncate">{NOTIFICATION_CHANNEL_LABEL[channel]}</span>
            <Switch
              size="sm"
              checked={rule.channels[channel]}
              onCheckedChange={(on) => onChannel(channel, on)}
              disabled={!canEdit}
            />
          </label>
        ))}
      </div>
      <div className="mt-3">
        <RolesPicker rule={rule} canEdit={canEdit} onRoles={onRoles} />
      </div>
    </li>
  )
}

export function NotificationSettingsPage() {
  const { settings, site, dispatch } = useScoped()
  const { can } = useAuth()
  const canEdit = can('settings.manage')
  const alerts = useNotifications()
  const firing = useMemo(() => {
    const counts = new Map<NotificationEvent, number>()
    for (const a of alerts) counts.set(a.event, (counts.get(a.event) ?? 0) + 1)
    return counts
  }, [alerts])

  const saved = useMemo(() => ruleRows(settings.notificationRules), [settings.notificationRules])
  const [draft, setDraft] = useState(saved)
  const changed = draft.filter((rule, i) => !sameRule(rule, saved[i])).length

  const patchRule = (event: NotificationEvent, fn: (rule: NotificationRule) => NotificationRule) =>
    setDraft((rules) => rules.map((r) => (r.event === event ? fn(r) : r)))
  const rowProps = (rule: NotificationRule): RowProps => ({
    rule,
    firing: firing.get(rule.event) ?? 0,
    canEdit,
    onChannel: (channel, on) =>
      patchRule(rule.event, (r) => ({ ...r, channels: { ...r.channels, [channel]: on } })),
    onRoles: (roles) => patchRule(rule.event, (r) => ({ ...r, roles: orderedRoles(roles) })),
  })

  const save = () => {
    dispatch({ type: 'settings/update', patch: { notificationRules: draft } })
    toast('Notification rules saved', {
      tone: 'success',
      description: `${plural(changed, 'event')} changed.`,
    })
  }

  return (
    <>
      <PageHeader
        title="Notifications"
        description="Who hears about each event, and on which channel."
        actions={
          canEdit ? (
            <>
              {changed > 0 && <Badge variant="warning">{plural(changed, 'unsaved change')}</Badge>}
              <Button variant="outline" disabled={!changed} onClick={() => setDraft(saved)}>
                <RotateCcw />
                Reset changes
              </Button>
              <Button disabled={!changed} onClick={save}>
                <Save />
                Save
              </Button>
            </>
          ) : undefined
        }
      />

      {!canEdit && (
        <Banner tone="neutral" icon={<Lock />} title="View only" className="mb-4">
          Administrators and maintenance managers change notification rules.
        </Banner>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Rules by event</CardTitle>
          <CardDescription>
            {plural(alerts.length, 'alert')} firing at {site.name} now. In-app alerts also show under the
            bell.
          </CardDescription>
        </CardHeader>

        <div className="xl:block relative hidden overflow-x-auto">
          <table className="border-spacing-0 text-sm w-full border-separate">
            <thead>
              <tr className="text-xs font-semibold text-muted">
                <th scope="col" className="px-5 py-3 border-b border-border text-left">
                  Event
                </th>
                <th scope="col" className="px-3 py-3 border-b border-border text-left whitespace-nowrap">
                  Firing now
                </th>
                {NOTIFICATION_CHANNELS.map((channel) => (
                  <th key={channel} scope="col" className="px-3 py-3 border-b border-border text-center">
                    {NOTIFICATION_CHANNEL_LABEL[channel]}
                  </th>
                ))}
                <th scope="col" className="px-5 py-3 border-b border-border text-left">
                  Roles
                </th>
              </tr>
            </thead>
            <tbody>
              {draft.map((rule) => (
                <TableRow key={rule.event} {...rowProps(rule)} />
              ))}
            </tbody>
          </table>
        </div>

        <ul className="space-y-3 px-5 pb-5 xl:hidden">
          {draft.map((rule) => (
            <EventCard key={rule.event} {...rowProps(rule)} />
          ))}
        </ul>
      </Card>
    </>
  )
}
