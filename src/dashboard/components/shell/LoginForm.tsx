'use client'

import { Eye, EyeOff, Leaf, Loader2, TriangleAlert } from 'lucide-react'
import { useState, type FormEvent } from 'react'

import { Button, Input } from '../ui'

/** Admin sign-in. Uses Payload's login endpoint, which sets an HttpOnly session cookie. */
export function LoginForm() {
  const [login, setLogin] = useState('')
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const id = login.trim()
    // Admins usually use a username or email; phone-style input is reduced to digits like the app does.
    const body = id.includes('@')
      ? { email: id, password }
      : { username: /^[\d\s+().-]+$/.test(id) ? id.replace(/\D/g, '') : id, password }
    try {
      const res = await fetch('/api/users/login', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        const msg: string = data?.errors?.[0]?.message ?? ''
        setError(/lock/i.test(msg) ? 'Too many attempts. This account is locked for 10 minutes.' : 'Wrong username or password.')
        return
      }
      if (data?.user?.role !== 'admin') {
        await fetch('/api/users/logout', { method: 'POST', credentials: 'include' }).catch(() => {})
        setError('This account is not an admin. Field staff use the mobile app.')
        return
      }
      window.location.replace(new URL('/admin', window.location.origin).href)
    } catch {
      setError('Cannot reach the server. Check your connection and try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-[1.1fr_1fr]">
      <div className="relative hidden overflow-hidden bg-brand-dark p-12 text-white lg:flex lg:flex-col">
        <div className="flex items-center gap-3">
          <div className="flex size-11 items-center justify-center rounded-2xl bg-lime text-brand-dark">
            <Leaf className="size-5" />
          </div>
          <span className="text-lg font-bold">Reclimate dMRV</span>
        </div>
        <div className="mt-auto max-w-md">
          <h1 className="text-4xl leading-tight font-bold">Every batch of biochar, measured and verified.</h1>
          <p className="mt-4 text-base text-white/70">Review field batches, manage networks and people, and track the credits they produce.</p>
        </div>
        <div className="pointer-events-none absolute -right-32 -bottom-32 size-[28rem] rounded-full bg-brand/60 blur-3xl" />
      </div>

      <div className="flex items-center justify-center p-6">
        <form onSubmit={submit} className="w-full max-w-sm">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <div className="flex size-11 items-center justify-center rounded-2xl bg-brand text-lime">
              <Leaf className="size-5" />
            </div>
            <span className="text-lg font-bold">Reclimate dMRV</span>
          </div>
          <h2 className="text-2xl font-bold tracking-tight">Sign in to admin</h2>
          <p className="mt-1 text-sm text-ink-muted">Use your admin username or email.</p>

          <label className="mt-8 block">
            <span className="text-sm font-semibold">Username or email</span>
            <Input className="mt-1.5 h-11" autoFocus autoComplete="username" required value={login} onChange={(e) => setLogin(e.target.value)} />
          </label>
          <label className="mt-4 block">
            <span className="text-sm font-semibold">Password</span>
            <div className="relative mt-1.5">
              <Input
                className="h-11 pr-11"
                type={show ? 'text' : 'password'}
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button
                type="button"
                onClick={() => setShow((s) => !s)}
                aria-label={show ? 'Hide password' : 'Show password'}
                className="absolute top-1/2 right-2 flex size-8 -translate-y-1/2 cursor-pointer items-center justify-center rounded-lg text-ink-muted hover:bg-muted"
              >
                {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
          </label>

          {error && (
            <div role="alert" className="mt-4 flex items-center gap-2 rounded-xl bg-danger-soft px-3 py-2.5 text-sm font-semibold text-danger">
              <TriangleAlert className="size-4 shrink-0" /> {error}
            </div>
          )}

          <Button type="submit" variant="primary" size="lg" className="mt-6 w-full rounded-xl" disabled={busy}>
            {busy ? <Loader2 className="animate-spin" /> : 'Sign in'}
          </Button>
        </form>
      </div>
    </div>
  )
}
