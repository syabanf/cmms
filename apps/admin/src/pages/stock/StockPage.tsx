import { nowMs } from '@cmms/fixtures'
import { Button, PageHeader, PillTabs, type TabItem } from '@cmms/ui'
import { ClipboardList, PackagePlus } from 'lucide-react'
import { useMemo } from 'react'
import { useSearchParams } from 'react-router'
import { useAuth } from '../../auth/auth'
import { useScoped } from '../../state/scoped'
import { pickList } from './lib'
import { Movements } from './Movements'
import { PickList } from './PickList'
import { StockMoveDialog } from './StockMoveDialog'
import { StockTake } from './StockTake'

type Tab = 'pick' | 'movements' | 'take'

export function StockPage() {
  const { workOrders, stock, maps, site } = useScoped()
  const { can } = useAuth()
  const canManage = can('inventory.manage')
  const [params, setParams] = useSearchParams()

  const groups = useMemo(() => pickList(workOrders, stock, maps.part, nowMs()), [workOrders, stock, maps.part])
  const lineCount = groups.reduce((sum, g) => sum + g.lines.length, 0)

  const param = params.get('tab')
  const tab: Tab = param === 'movements' || (param === 'take' && canManage) ? param : 'pick'
  const receiving = canManage && params.get('receive') === '1'

  const update = (change: (next: URLSearchParams) => void) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        change(next)
        return next
      },
      { replace: true },
    )
  const openReceipt = (partId?: string) =>
    update((p) => {
      p.set('receive', '1')
      if (partId) p.set('part', partId)
      else p.delete('part')
    })

  const tabs: TabItem[] = [
    { value: 'pick', label: 'Pick list', count: lineCount },
    { value: 'movements', label: 'Movements' },
    ...(canManage ? [{ value: 'take', label: 'Stock take' }] : []),
  ]

  return (
    <>
      <PageHeader
        title="Stock"
        description={`Pick parts for work orders, trace every movement and count the shelves at ${site.name}.`}
        actions={
          canManage ? (
            <>
              <Button onClick={() => openReceipt()}>
                <PackagePlus />
                Receive stock
              </Button>
              <Button variant="outline" onClick={() => update((p) => p.set('tab', 'take'))}>
                <ClipboardList />
                Stock take
              </Button>
            </>
          ) : undefined
        }
      />
      <PillTabs className="mb-4" items={tabs} value={tab} onValueChange={(value) => update((p) => p.set('tab', value))} />

      {tab === 'pick' && <PickList groups={groups} onReceive={openReceipt} />}
      {tab === 'movements' && <Movements />}
      {tab === 'take' && <StockTake />}

      <StockMoveDialog
        kind="receive"
        open={receiving}
        partId={params.get('part')}
        onOpenChange={(open) => {
          if (open) return
          update((p) => {
            p.delete('receive')
            p.delete('part')
          })
        }}
      />
    </>
  )
}
