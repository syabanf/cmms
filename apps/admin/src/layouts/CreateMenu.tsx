import { ActionMenu, type ActionMenuItem } from '@cmms/ui'
import { CalendarClock, ClipboardList, Factory, Inbox, ListChecks, PackagePlus } from 'lucide-react'
import type { ReactElement } from 'react'
import { useNavigate } from 'react-router'
import { useAuth } from '../auth/auth'
import { useCreate } from '../components/create'

/** The one create menu behind the rail button, the header button and the phone bar. */
export function CreateMenu({ trigger, side, align }: { trigger: ReactElement; side?: 'top' | 'right' | 'bottom' | 'left'; align?: 'start' | 'center' | 'end' }) {
  const create = useCreate()
  const navigate = useNavigate()
  const { can } = useAuth()
  const options: (ActionMenuItem | false)[] = [
    can('wo.create') && {
      key: 'wo',
      label: 'Work order',
      description: 'Planned or corrective work',
      icon: <ClipboardList />,
      onSelect: () => create.workOrder(),
    },
    can('request.create') && {
      key: 'mr',
      label: 'Maintenance request',
      description: 'Report a problem for triage',
      icon: <Inbox />,
      onSelect: () => create.request(),
    },
    can('asset.manage') && {
      key: 'asset',
      label: 'Asset',
      description: 'Machine or component',
      icon: <Factory />,
      onSelect: () => navigate('/assets?new=1'),
    },
    can('pm.manage') && {
      key: 'pm',
      label: 'PM schedule',
      description: 'Calendar or meter trigger',
      icon: <CalendarClock />,
      onSelect: () => navigate('/preventive/pm?new=1'),
    },
    can('jobplan.manage') && {
      key: 'jp',
      label: 'Job plan',
      description: 'Reusable checklist template',
      icon: <ListChecks />,
      onSelect: () => navigate('/preventive/job-plans/new'),
    },
    can('inventory.manage') && {
      key: 'stock',
      label: 'Stock receipt',
      description: 'Book parts into a warehouse',
      icon: <PackagePlus />,
      onSelect: () => navigate('/inventory/stock?receive=1'),
    },
  ]
  const items = options.filter((x): x is ActionMenuItem => !!x)

  if (!items.length) return null
  return <ActionMenu trigger={trigger} items={items} title="Create" side={side} align={align} />
}
