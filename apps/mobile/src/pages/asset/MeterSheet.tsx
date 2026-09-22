import type { Meter } from '@cmms/types'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@cmms/ui'
import { MeterReadingForm } from '../../components/MeterReadingForm'

export function MeterSheet({
  meters,
  meterId,
  assetCode,
  open,
  onOpenChange,
}: {
  meters: Meter[]
  meterId: string
  assetCode: string
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom">
        <SheetHeader>
          <SheetTitle>Record meter reading</SheetTitle>
          <SheetDescription>Read the counter on the machine panel and type it as shown.</SheetDescription>
        </SheetHeader>
        <div className="px-5 pb-2">
          <MeterReadingForm meters={meters} initialId={meterId} assetCode={assetCode} autoFocus onSaved={() => onOpenChange(false)} />
        </div>
      </SheetContent>
    </Sheet>
  )
}
