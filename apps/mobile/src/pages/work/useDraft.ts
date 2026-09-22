import { useState } from 'react'

/** Local text for a field that saves on blur. Adopts a value saved elsewhere (a clear, another device) without an effect. */
export function useDraft(stored: string) {
  const [draft, setDraft] = useState(stored)
  const [synced, setSynced] = useState(stored)
  if (synced !== stored) {
    setSynced(stored)
    setDraft(stored)
  }
  return [draft, setDraft] as const
}
