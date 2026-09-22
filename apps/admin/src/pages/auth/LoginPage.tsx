import { ROLE_LABEL } from '@cmms/types'
import { Avatar, Button, Card, FormField, Input } from '@cmms/ui'
import { ArrowRight, ClipboardList, ClockFading, Factory, Lock, Mail } from 'lucide-react'
import { type FormEvent, useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router'
import { useAuth } from '../../auth/auth'
import { LogoMark } from '../../layouts/LogoMark'
import { useStore } from '../../state/store'

const DEMO_ACCOUNTS = ['per-rina', 'per-dimas', 'per-hendra', 'per-yusuf', 'per-sari', 'per-fajar', 'per-bambang', 'per-irfan']

const PILLARS = [
  { title: 'Asset', text: 'Every machine, component and instrument with its passport.', Icon: Factory },
  { title: 'Work order', text: 'Requests, planning, execution, approval and closure.', Icon: ClipboardList },
  { title: 'History', text: 'Failures, parts, cost and measurements you can trace.', Icon: ClockFading },
]

export function LoginPage() {
  const { state } = useStore()
  const { user, signIn } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const from = (location.state as { from?: string } | null)?.from ?? '/'
  if (user) return <Navigate to={from} replace />

  const accounts = DEMO_ACCOUNTS.map((id) => state.people.find((p) => p.id === id)).filter((p) => !!p)

  const enter = (personId: string) => {
    signIn(personId)
    navigate(from, { replace: true })
  }

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const person = state.people.find((p) => p.email.toLowerCase() === email.trim().toLowerCase())
    if (!person || !password) {
      setError('Use one of the demo accounts below. Any password works.')
      return
    }
    enter(person.id)
  }

  return (
    <div className="relative min-h-dvh overflow-hidden bg-surface px-4 py-8 sm:py-12">
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <div
          className="absolute -right-[10%] -top-[20%] h-[80%] w-[70%] opacity-70 blur-xl"
          style={{ background: 'radial-gradient(40% 40% at 70% 30%, rgb(237 28 36 / 0.10), transparent 70%)' }}
        />
      </div>
      <div className="relative mx-auto grid w-full max-w-5xl grid-cols-1 gap-4 lg:grid-cols-[1fr_1.1fr]">
        <Card variant="ink" className="flex flex-col justify-between gap-10 p-8">
          <div className="flex items-center gap-3">
            <span className="flex size-11 items-center justify-center rounded-2xl bg-white/5">
              <LogoMark className="size-7" />
            </span>
            <div>
              <p className="text-[15px] font-bold leading-tight">CMMS</p>
              <p className="text-xs text-on-ink-muted">PT Nusa Presisi Manufaktur</p>
            </div>
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-on-ink-muted">Maintenance operating system</p>
            <h1 className="mt-2 text-3xl font-bold leading-tight tracking-tight sm:text-4xl">
              Know what failed, why, and what it cost<span className="text-accent">.</span>
            </h1>
            <div className="mt-8 space-y-3">
              {PILLARS.map(({ title, text, Icon }) => (
                <div key={title} className="flex items-start gap-3 rounded-2xl bg-white/5 p-3">
                  <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-xl bg-white/10">
                    <Icon className="size-4" />
                  </span>
                  <span>
                    <span className="block text-sm font-semibold">{title}</span>
                    <span className="block text-xs text-on-ink-muted">{text}</span>
                  </span>
                </div>
              ))}
            </div>
          </div>
          <p className="text-xs text-on-ink-muted">Demo data: Factory Bandung and Factory Cikarang, Tuesday 22 September 2026.</p>
        </Card>

        <Card className="p-6 sm:p-8">
          <h2 className="text-3xl font-bold tracking-tight">
            Sign in<span className="text-accent">.</span>
          </h2>
          <p className="mt-1 text-sm text-muted">Pick a demo account to see the console from that role.</p>

          <form onSubmit={submit} className="mt-6 grid grid-cols-1 gap-4">
            <FormField label="Email" htmlFor="login-email" error={error || undefined}>
              <Input id="login-email" type="email" autoComplete="username" leftIcon={<Mail />} inputClassName="h-12" placeholder="rina@nusapresisi.co.id" value={email} onChange={(e) => setEmail(e.target.value)} />
            </FormField>
            <FormField label="Password" htmlFor="login-password">
              <Input id="login-password" type="password" autoComplete="current-password" leftIcon={<Lock />} inputClassName="h-12" placeholder="Any password" value={password} onChange={(e) => setPassword(e.target.value)} />
            </FormField>
            <Button type="submit" size="lg" className="w-full">
              Sign in
              <ArrowRight />
            </Button>
          </form>

          <p className="mb-2 mt-8 text-[11px] font-semibold uppercase tracking-wider text-muted">Demo accounts</p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {accounts.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => enter(p.id)}
                className="flex items-center gap-3 rounded-2xl bg-surface-2 p-3 text-left transition-colors hover:bg-surface active:scale-[0.98]"
              >
                <Avatar name={p.name} color={p.color} size="md" />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold">{p.name}</span>
                  <span className="block truncate text-xs text-muted">
                    {ROLE_LABEL[p.role]} · {p.siteIds.length > 1 ? 'Both sites' : state.sites.find((s) => s.id === p.siteIds[0])?.name}
                  </span>
                </span>
              </button>
            ))}
          </div>
        </Card>
      </div>
    </div>
  )
}
