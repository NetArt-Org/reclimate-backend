'use client'

import { Check, Copy, KeyRound, Loader2, RefreshCw, Smartphone } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState, type FormEvent } from 'react'
import { toast } from 'sonner'

import { Badge, Button, Field, Input, Modal, Switch } from '../components/ui'
import type { User } from '../data/types'
import { day } from '../lib/utils'
import { createAppLogin, resetAppPassword, setAppAccess } from '../server/app-logins'

/** A readable temporary password: no look-alike characters (0/O, 1/l/I). */
function tempPassword() {
  const letters = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ'
  const digits = '23456789'
  const pick = (set: string, n: number) => Array.from(crypto.getRandomValues(new Uint32Array(n)), (x) => set[x % set.length]).join('')
  return `${pick(letters, 6)}${pick(digits, 4)}`
}

/**
 * The person's field-app login: create it (email + temporary password to hand over), reset the
 * password, or switch access off. The app asks for a new password on first sign-in.
 */
export function AppLoginSection({ user: u }: { user: User }) {
  const router = useRouter()
  const [dialog, setDialog] = useState<null | 'create' | 'reset'>(null)
  const [busy, setBusy] = useState(false)
  const login = u.appLogin

  const toggle = async (on: boolean) => {
    setBusy(true)
    const r = await setAppAccess(u.id, on)
    setBusy(false)
    if (!r.ok) return toast.error(r.error)
    toast.success(on ? 'App access switched on' : 'App access switched off — they are signed out')
    router.refresh()
  }

  return (
    <section className="rounded-card border border-line">
      <div className="flex items-center gap-2.5 border-b border-line px-4 py-3">
        <Smartphone className="size-4 text-info" />
        <span className="text-sm font-bold tracking-wide uppercase">App login</span>
        {login.hasAccount && (
          <Badge tone={login.enabled ? 'success' : 'neutral'} className="ml-auto">
            {login.enabled ? 'Active' : 'Off'}
          </Badge>
        )}
      </div>
      <div className="flex flex-col gap-3 p-4 text-sm">
        {!login.hasAccount ? (
          <>
            <p className="text-ink-muted">No login yet. Create one and give the email and temporary password to {u.name.split(' ')[0]}.</p>
            <Button variant="primary" className="w-fit rounded-xl" onClick={() => setDialog('create')}>
              <KeyRound /> Create app login
            </Button>
          </>
        ) : (
          <>
            <div className="flex flex-col gap-1">
              <div>
                Signs in as <b>{u.email}</b>
              </div>
              <div className="text-xs text-ink-muted">
                {login.lastSignInAt ? `Last used ${day(login.lastSignInAt)}` : 'Not signed in yet'}
                {login.mustChangePassword && ' · will choose a new password on first sign-in'}
              </div>
              <div className="text-xs text-ink-muted">They can also use “Continue with Google” if their Google account uses this email.</div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button size="sm" className="rounded-lg" onClick={() => setDialog('reset')}>
                <RefreshCw /> Reset password
              </Button>
              <Button size="sm" variant="ghost" className="rounded-lg" onClick={() => setDialog('create')}>
                Change email
              </Button>
              <label className="ml-auto flex cursor-pointer items-center gap-2 text-xs font-semibold text-ink-muted">
                Access
                <Switch checked={login.enabled} disabled={busy} onCheckedChange={(on) => void toggle(on)} aria-label="App access" />
              </label>
            </div>
          </>
        )}
      </div>

      <LoginDialog
        user={u}
        mode={dialog}
        onClose={() => setDialog(null)}
        onDone={() => router.refresh()}
      />
    </section>
  )
}

function LoginDialog({ user: u, mode, onClose, onDone }: { user: User; mode: null | 'create' | 'reset'; onClose: () => void; onDone: () => void }) {
  return (
    <Modal open={!!mode} onOpenChange={(o) => !o && onClose()} title={mode === 'reset' ? 'Reset app password' : u.appLogin.hasAccount ? 'Change login email' : 'Create app login'}>
      {mode && <LoginForm user={u} mode={mode} onClose={onClose} onDone={onDone} />}
    </Modal>
  )
}

function LoginForm({ user: u, mode, onClose, onDone }: { user: User; mode: 'create' | 'reset'; onClose: () => void; onDone: () => void }) {
  const [email, setEmail] = useState(u.email ?? '')
  const [password, setPassword] = useState(tempPassword)
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState<{ email: string } | null>(null)
  const [copied, setCopied] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    const r = mode === 'reset' ? await resetAppPassword(u.id, password) : await createAppLogin(u.id, email, password)
    setBusy(false)
    if (!r.ok) return toast.error(r.error)
    setDone({ email: r.data.email })
    onDone()
  }

  if (done) {
    const text = `Artisan Pro login\nEmail: ${done.email}\nTemporary password: ${password}\nYou will be asked to choose your own password when you first sign in.`
    return (
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-2 rounded-xl bg-success-soft px-3.5 py-3 text-sm font-semibold text-success">
          <Check className="size-4" /> {mode === 'reset' ? 'Password reset. They have been signed out.' : 'Login ready.'}
        </div>
        <div className="rounded-xl border border-line p-4 text-sm">
          <div className="text-xs text-ink-muted">Email</div>
          <div className="font-semibold">{done.email}</div>
          <div className="mt-3 text-xs text-ink-muted">Temporary password</div>
          <div className="font-mono text-base font-semibold tracking-wide">{password}</div>
        </div>
        <p className="text-xs text-ink-muted">Give these to {u.name} privately. This password is not shown again; they choose their own when they first sign in.</p>
        <div className="flex justify-end gap-2">
          <Button
            onClick={() => {
              void navigator.clipboard.writeText(text).then(() => setCopied(true))
            }}
          >
            {copied ? <Check /> : <Copy />} {copied ? 'Copied' : 'Copy login details'}
          </Button>
          <Button variant="primary" onClick={onClose}>
            Done
          </Button>
        </div>
      </div>
    )
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      {mode === 'create' && (
        <Field label="Email" hint="What they type to sign in. One email per person.">
          <Input type="email" required autoFocus value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
      )}
      <Field label="Temporary password" hint="At least 8 characters with letters and numbers. They change it on first sign-in.">
        <div className="flex gap-2">
          <Input required value={password} onChange={(e) => setPassword(e.target.value)} className="font-mono" autoComplete="off" />
          <Button onClick={() => setPassword(tempPassword())} aria-label="New suggestion">
            <RefreshCw />
          </Button>
        </div>
      </Field>
      <div className="flex justify-end gap-2 pt-1">
        <Button onClick={onClose}>Cancel</Button>
        <Button type="submit" variant="primary" disabled={busy}>
          {busy ? <Loader2 className="animate-spin" /> : mode === 'reset' ? 'Reset password' : 'Create login'}
        </Button>
      </div>
    </form>
  )
}
