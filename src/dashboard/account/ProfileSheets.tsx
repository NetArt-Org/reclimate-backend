'use client'

import { Check, Eye, EyeOff, Loader2, X } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { toast } from 'sonner'

import { useSession } from '../components/shell/session'
import { Button, Field, Input, NativeSelect, Sheet } from '../components/ui'
import { cn } from '../lib/utils'

/**
 * These two panels change the signed-in admin's real account in the backend —
 * unlike the rest of the panel, which still uses demo data.
 */

const COUNTRIES = [
  { code: '+62', label: 'Indonesia +62' },
  { code: '+60', label: 'Malaysia +60' },
  { code: '+65', label: 'Singapore +65' },
  { code: '+91', label: 'India +91' },
  { code: '+63', label: 'Philippines +63' },
  { code: '+66', label: 'Thailand +66' },
  { code: '+84', label: 'Vietnam +84' },
  { code: '+61', label: 'Australia +61' },
  { code: '+44', label: 'United Kingdom +44' },
  { code: '+1', label: 'United States / Canada +1' },
]

/** "+62 812-555-0109" → { code: "+62", rest: "812-555-0109" } */
function splitPhone(phone?: string) {
  const p = (phone ?? '').trim()
  const c = [...COUNTRIES]
    .sort((a, b) => b.code.length - a.code.length)
    .find((x) => p.startsWith(x.code))
  return c ? { code: c.code, rest: p.slice(c.code.length).trim() } : { code: '+62', rest: p }
}

async function patchMe(id: number, body: object) {
  const res = await fetch(`/api/users/${id}?depth=0`, {
    method: 'PATCH',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok)
    throw new Error(
      data?.errors?.[0]?.data?.errors?.[0]?.message ??
        data?.errors?.[0]?.message ??
        'Could not save',
    )
  return data.doc
}

export function EditProfileSheet({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title="Edit profile" className="max-w-md">
      {open && <EditProfileForm onDone={() => onOpenChange(false)} />}
    </Sheet>
  )
}

function EditProfileForm({ onDone }: { onDone: () => void }) {
  const { user, setUser } = useSession()
  const initial = splitPhone(user.phone)
  const [name, setName] = useState(user.name)
  const [email, setEmail] = useState(user.email ?? '')
  const [code, setCode] = useState(initial.code)
  const [rest, setRest] = useState(initial.rest)
  const [busy, setBusy] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const digits = rest.replace(/\D/g, '')
    if (rest && digits.length < 6) return toast.error('Enter the full phone number')
    setBusy(true)
    try {
      const phone = digits ? `${code} ${rest.trim()}` : ''
      const doc = await patchMe(user.id, {
        name: name.trim(),
        email: email.trim() || null,
        phone: phone || null,
      })
      setUser({
        ...user,
        name: doc.name,
        email: doc.email ?? undefined,
        phone: doc.phone ?? undefined,
      })
      toast.success('Profile saved')
      onDone()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not save')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <Field label="Full name">
        <Input
          required
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoComplete="name"
        />
      </Field>
      <Field label="Email" hint="Used to sign in and for password resets.">
        <Input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
        />
      </Field>
      <Field label="Phone">
        <div className="flex gap-2">
          <NativeSelect
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className="w-44"
            aria-label="Country code"
          >
            {COUNTRIES.map((c) => (
              <option key={c.code + c.label} value={c.code}>
                {c.label}
              </option>
            ))}
          </NativeSelect>
          <Input
            type="tel"
            inputMode="tel"
            value={rest}
            onChange={(e) => setRest(e.target.value)}
            placeholder="812 555 0109"
            autoComplete="tel-national"
          />
        </div>
      </Field>
      {user.username && (
        <div className="rounded-xl bg-muted px-3.5 py-3 text-sm text-ink-muted">
          Username <span className="font-semibold text-ink">{user.username}</span> stays the same.
        </div>
      )}
      <div className="mt-2 flex gap-2">
        <Button className="flex-1 rounded-xl" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" className="flex-1 rounded-xl" disabled={busy}>
          {busy ? <Loader2 className="animate-spin" /> : 'Save changes'}
        </Button>
      </div>
    </form>
  )
}

export function ChangePasswordSheet({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title="Change password" className="max-w-md">
      {open && <ChangePasswordForm onDone={() => onOpenChange(false)} />}
    </Sheet>
  )
}

const RULES = [
  { test: (p: string) => p.length >= 10, label: 'At least 10 characters' },
  { test: (p: string) => /[a-z]/i.test(p) && /\d/.test(p), label: 'Letters and numbers' },
  {
    test: (p: string) =>
      !/^(.)\1+$/.test(p) &&
      !['password', '1234567890', 'qwertyuiop'].some((w) => p.toLowerCase().includes(w)),
    label: 'Not a common password',
  },
]

function ChangePasswordForm({ onDone }: { onDone: () => void }) {
  const { user } = useSession()
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [show, setShow] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const passes = RULES.every((r) => r.test(next))
  const matches = next.length > 0 && next === confirm

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!passes || !matches) return
    if (next === current)
      return setError('The new password must be different from the current one.')
    setBusy(true)
    setError(null)
    try {
      // Confirm the current password first: signing in again with it proves it is right.
      const login = user.email
        ? { email: user.email, password: current }
        : { username: user.username, password: current }
      const check = await fetch('/api/users/login', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(login),
      })
      if (!check.ok) {
        setError('Current password is not right.')
        return
      }
      await patchMe(user.id, { password: next })
      toast.success('Password changed')
      onDone()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not change the password')
    } finally {
      setBusy(false)
    }
  }

  const type = show ? 'text' : 'password'
  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <Field label="Account">
        <Input
          value={user.email ?? user.username ?? ''}
          disabled
          className="bg-muted text-ink-muted"
        />
      </Field>
      <Field label="Current password">
        <Input
          type={type}
          required
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
          autoComplete="current-password"
        />
      </Field>
      <Field label="New password">
        <Input
          type={type}
          required
          value={next}
          onChange={(e) => setNext(e.target.value)}
          autoComplete="new-password"
        />
      </Field>
      <ul className="-mt-1 flex flex-col gap-1">
        {RULES.map((r) => {
          const ok = r.test(next)
          return (
            <li
              key={r.label}
              className={cn(
                'flex items-center gap-1.5 text-xs',
                ok ? 'text-success' : 'text-ink-muted',
              )}
            >
              {ok ? <Check className="size-3.5" /> : <X className="size-3.5" />} {r.label}
            </li>
          )
        })}
      </ul>
      <Field label="Confirm new password">
        <Input
          type={type}
          required
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          autoComplete="new-password"
          aria-invalid={confirm.length > 0 && !matches}
        />
      </Field>
      {confirm.length > 0 && !matches && (
        <div className="-mt-2 text-xs text-danger">The two new passwords don&apos;t match.</div>
      )}
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        className="flex w-fit cursor-pointer items-center gap-1.5 text-sm font-medium text-ink-muted hover:text-ink"
      >
        {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}{' '}
        {show ? 'Hide passwords' : 'Show passwords'}
      </button>
      {error && (
        <div className="rounded-xl bg-danger-soft px-3 py-2.5 text-sm font-semibold text-danger">
          {error}
        </div>
      )}
      <div className="mt-2 flex gap-2">
        <Button className="flex-1 rounded-xl" onClick={onDone}>
          Cancel
        </Button>
        <Button
          type="submit"
          variant="primary"
          className="flex-1 rounded-xl"
          disabled={busy || !passes || !matches || !current}
        >
          {busy ? <Loader2 className="animate-spin" /> : 'Change password'}
        </Button>
      </div>
    </form>
  )
}
