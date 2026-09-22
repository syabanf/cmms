import { fmtTime } from '@cmms/fixtures'
import { Popover, PopoverContent, PopoverTrigger, Sheet, SheetContent, SheetTitle, SheetTrigger, cn, useIsPhone } from '@cmms/ui'
import { type ComponentProps, type ReactElement, useState } from 'react'
import { EntryDetails } from './EntryDetails'
import { type CalendarEntry, TONE_CLASS, entryText, overdueDotClass } from './lib'

/** Opens an entry's details: an anchored popover from `md` up, a bottom sheet on phones. */
export function EntryOverlay({ entry, children }: { entry: CalendarEntry; children: ReactElement }) {
  const isPhone = useIsPhone()
  const [open, setOpen] = useState(false)
  const close = () => setOpen(false)

  if (isPhone) {
    return (
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>{children}</SheetTrigger>
        <SheetContent side="bottom" hideClose aria-describedby={undefined}>
          <SheetTitle className="sr-only">
            {entry.code} {entry.label}
          </SheetTitle>
          <div className="px-5 pb-2 pt-4">
            <EntryDetails entry={entry} onDone={close} />
          </div>
        </SheetContent>
      </Sheet>
    )
  }
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent align="start" className="w-[22rem] max-w-[calc(100vw-1.5rem)] p-4">
        <EntryDetails entry={entry} onDone={close} />
      </PopoverContent>
    </Popover>
  )
}

type EntryChipProps = ComponentProps<'button'> & {
  entry: CalendarEntry
  /** compact: month cell · block: week column · row: phone agenda */
  variant: 'compact' | 'block' | 'row'
}

export function EntryChip({ entry, variant, className, ...props }: EntryChipProps) {
  const { item, tone, code, label } = entry
  const dot = item.overdue && <span aria-hidden="true" className={cn('size-1.5 shrink-0 rounded-full', overdueDotClass(tone))} />
  const classes = cn(
    'min-w-0 text-left transition-[filter] hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40',
    TONE_CLASS[tone],
    props.draggable && 'cursor-grab active:cursor-grabbing',
    variant === 'compact' && 'flex h-6 w-full items-center gap-1 rounded-full px-2 text-[11px] font-medium',
    variant === 'block' && 'flex w-full flex-col gap-0.5 rounded-xl px-2 py-1.5 text-xs',
    variant === 'row' && 'flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-sm',
    className,
  )

  return (
    <button type="button" aria-label={entryText(entry)} className={classes} {...props}>
      {variant === 'compact' && (
        <>
          {dot}
          <span className="truncate">
            <span className="font-semibold">{code}</span> {label}
          </span>
        </>
      )}
      {variant === 'block' && (
        <>
          <span className="flex min-w-0 items-center gap-1 font-semibold tabular-nums">
            {dot}
            {fmtTime(item.at)}
            <span className="truncate">{code}</span>
          </span>
          <span className="line-clamp-2 break-words">{label}</span>
        </>
      )}
      {variant === 'row' && (
        <>
          <span className="w-11 shrink-0 text-xs font-semibold tabular-nums">{fmtTime(item.at)}</span>
          <span className="min-w-0 flex-1">
            <span className="block truncate font-medium">{label}</span>
            <span className="block truncate text-xs opacity-80">{code}</span>
          </span>
          {dot}
        </>
      )}
    </button>
  )
}
