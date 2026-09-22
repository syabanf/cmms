import { Button, Input, Textarea, cn } from '@cmms/ui'
import { type ChangeEvent, type KeyboardEvent, useRef, useState } from 'react'

/**
 * A text field that saves when it loses focus. Escape drops the change. The draft follows the
 * saved value whenever that changes from outside (an undo, a reorder).
 */
export function EditableText({
  value,
  onCommit,
  onDone,
  label,
  placeholder,
  rows,
  submitOnEnter = rows === undefined,
  showSave = false,
  autoFocus,
  className,
}: {
  value: string
  /** Called with the trimmed text when it differs from `value`. */
  onCommit: (next: string) => void
  /** Called after every blur, saved or not. */
  onDone?: () => void
  label: string
  placeholder?: string
  /** A textarea with this many rows; a single-line input without it. */
  rows?: number
  /** Enter saves. Shift+Enter still adds a line in a textarea. */
  submitOnEnter?: boolean
  /** A Save button while the text differs from the saved value. */
  showSave?: boolean
  autoFocus?: boolean
  className?: string
}) {
  const [draft, setDraft] = useState(value)
  const [saved, setSaved] = useState(value)
  const cancelled = useRef(false)
  if (saved !== value) {
    setSaved(value)
    setDraft(value)
  }

  const commit = () => {
    const next = draft.trim()
    if (next !== value) onCommit(next)
    // Show the saved text until the parent stores a new one. A parent may decline the change.
    setDraft(value)
  }

  const onBlur = () => {
    if (cancelled.current) cancelled.current = false
    else commit()
    onDone?.()
  }

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (e.key === 'Escape') {
      cancelled.current = true
      setDraft(value)
      e.currentTarget.blur()
    } else if (e.key === 'Enter' && submitOnEnter && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault()
      e.currentTarget.blur()
    }
  }

  const field = {
    value: draft,
    'aria-label': label,
    placeholder,
    autoFocus,
    onChange: (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setDraft(e.target.value),
    onBlur,
    onKeyDown,
  }

  return (
    <>
      {rows === undefined ? (
        <Input variant="soft" inputClassName={className} {...field} />
      ) : (
        <Textarea variant="soft" rows={rows} className={cn('min-h-0', className)} {...field} />
      )}
      {showSave && draft.trim() !== value && (
        <div className="mt-2 flex flex-wrap items-center justify-end gap-2">
          <span className="text-xs text-muted">Esc discards the change</span>
          {/* Keeps focus in the field so the click saves instead of the blur. */}
          <Button type="button" size="sm" onMouseDown={(e) => e.preventDefault()} onClick={commit}>
            Save
          </Button>
        </div>
      )}
    </>
  )
}
