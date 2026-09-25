import { type AppState, type Envelope, loadLocalState, nowIso, reduce, saveLocalState } from '@cmms/fixtures'
import {
  type Dispatch,
  type ReactNode,
  createContext,
  useContext,
  useEffect,
  useMemo,
  useReducer,
} from 'react'

const StoreContext = createContext<{ state: AppState; send: Dispatch<Envelope> } | null>(null)

const STORAGE_KEY = 'cmms.mobile.state.v1'

/** Holds the CMMS dataset in one reducer and keeps demo changes across reloads. */
export function AppStateProvider({ children }: { children: ReactNode }) {
  const [state, send] = useReducer(reduce, undefined, () => loadLocalState(STORAGE_KEY))
  useEffect(() => saveLocalState(STORAGE_KEY, state), [state])
  // The PM scheduler: a work order appears once a schedule's lead time starts, as a backend job would do.
  useEffect(() => {
    const tick = () => send({ action: { type: 'pm/autoGenerate' }, meta: { by: 'system', at: nowIso() } })
    tick()
    const timer = setInterval(tick, 60_000)
    return () => clearInterval(timer)
  }, [])
  const value = useMemo(() => ({ state, send }), [state])
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

export function useStore() {
  const ctx = useContext(StoreContext)
  if (!ctx) throw new Error('useStore must be used inside AppStateProvider')
  return ctx
}
