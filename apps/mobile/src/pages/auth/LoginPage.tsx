import type { Person } from '@cmms/types'
import { Avatar, Button, FormField, Input, Kicker } from '@cmms/ui'
import { ArrowRight, ChevronRight, Mail } from 'lucide-react'
import { type FormEvent, useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router'
import { canUseMobile, useAuth } from '../../auth/auth'
import { useStore } from '../../state/store'

const TECHNICIANS = ['per-budi', 'per-andi', 'per-rizky', 'per-wahyu', 'per-taufik', 'per-lina', 'per-galih']
const REQUESTERS = ['per-asep', 'per-dewi', 'per-rudi', 'per-nina']

export function LoginPage() {
  const { state } = useStore()
  const { user, signIn } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const from = (location.state as { from?: string } | null)?.from ?? '/'
  if (user) return <Navigate to={from} replace />

  const accounts = (ids: string[]) =>
    ids.map((id) => state.people.find((p) => p.id === id)).filter((p) => !!p)
  const siteName = (person: Person) => state.sites.find((s) => s.id === person.siteIds[0])?.name ?? ''
  const budi = state.people.find((p) => p.id === 'per-budi')

  const enter = (personId: string) => {
    signIn(personId)
    navigate(from, { replace: true })
  }

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const person = state.people.find((p) => p.email.toLowerCase() === email.trim().toLowerCase())
    if (!person) setError('No account uses that email. Pick a demo account below.')
    else if (!canUseMobile(person))
      setError(`${person.name} works in the maintenance console. This app is for technicians and requesters.`)
    else enter(person.id)
  }

  return (
    <div className="max-w-md px-6 pb-10 pt-16 mx-auto min-h-dvh w-full bg-surface">
      <div className="gap-3 flex items-center">
        <span className="size-11 rounded-2xl text-white flex items-center justify-center bg-ink shadow-float">
          <svg viewBox="0 0 64 64" aria-hidden="true" className="size-7">
            <path
              d="M14 42l9-18 7 11 5-7 8 14"
              fill="none"
              stroke="currentColor"
              strokeWidth="5.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <circle cx="49" cy="17" r="5.5" fill="var(--color-accent)" />
          </svg>
        </span>
        <div>
          <p className="font-bold leading-tight text-[15px]">CMMS</p>
          <p className="text-xs text-muted">PT Nusa Presisi Manufaktur</p>
        </div>
      </div>

      <h1 className="mt-10 text-3xl font-bold tracking-tight">
        Sign in<span className="text-accent">.</span>
      </h1>
      <p className="mt-1 text-sm text-muted">Enter your work email, or use a demo account below.</p>

      <form onSubmit={submit} className="mt-8 space-y-4">
        <FormField label="Work email" htmlFor="login-email" error={error || undefined}>
          <Input
            id="login-email"
            type="email"
            inputMode="email"
            autoComplete="username"
            leftIcon={<Mail />}
            inputClassName="h-12"
            placeholder="name@nusapresisi.co.id"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value)
              setError('')
            }}
          />
        </FormField>
        <Button type="submit" size="lg" className="w-full" disabled={!email.trim()}>
          Sign in
          <ArrowRight />
        </Button>
      </form>

      {budi && (
        <section className="mt-8">
          <Kicker className="mb-2">Demo mode</Kicker>
          <button
            type="button"
            onClick={() => enter(budi.id)}
            className="gap-3 p-3 text-white flex w-full items-center rounded-[20px] bg-ink text-left shadow-float transition-transform focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:outline-none active:scale-[0.98]"
          >
            <Avatar name={budi.name} color={budi.color} size="md" />
            <span className="min-w-0 flex-1">
              <span className="text-sm font-semibold block">Continue as {budi.name}</span>
              <span className="text-xs block truncate text-on-ink-muted">
                {budi.title} · {siteName(budi)}
              </span>
            </span>
            <ArrowRight aria-hidden="true" className="size-4 shrink-0" />
          </button>
        </section>
      )}
      <details className="mt-4 rounded-[20px] bg-card shadow-card">
        <summary className="px-4 py-3 text-sm font-semibold cursor-pointer list-none text-center text-body focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:outline-none">
          Choose another demo account
        </summary>
        <div className="px-3 pb-4 border-t border-border">
          <AccountGroup
            title="Technicians"
            people={accounts(TECHNICIANS).filter((p) => p.id !== 'per-budi')}
            siteName={siteName}
            onPick={enter}
          />
          <AccountGroup title="Requesters" people={accounts(REQUESTERS)} siteName={siteName} onPick={enter} />
        </div>
      </details>
      <p className="mt-8 text-xs text-muted">
        Demo accounts, no password. Data for Factory Bandung and Factory Cikarang, Tuesday 22 September 2026.
      </p>
    </div>
  )
}

function AccountGroup({
  title,
  people,
  siteName,
  onPick,
}: {
  title: string
  people: Person[]
  siteName: (person: Person) => string
  onPick: (personId: string) => void
}) {
  return (
    <section className="mt-8">
      <Kicker className="mb-2">{title}</Kicker>
      <div className="space-y-2">
        {people.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => onPick(p.id)}
            className="gap-3 p-3 flex w-full items-center rounded-[20px] bg-card text-left shadow-card transition-transform focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:outline-none active:scale-[0.98]"
          >
            <Avatar name={p.name} color={p.color} size="md" />
            <span className="min-w-0 flex-1">
              <span className="text-sm font-semibold block truncate">{p.name}</span>
              <span className="text-xs block truncate text-muted">
                {p.title} · {siteName(p)}
              </span>
            </span>
            <ChevronRight aria-hidden="true" className="size-4 shrink-0 text-muted" />
          </button>
        ))}
      </div>
    </section>
  )
}
