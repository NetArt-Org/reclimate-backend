'use client'

import { sendPasswordResetEmail } from 'firebase/auth'
import { Check, Loader2 } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { toast } from 'sonner'

import { useSession } from '../components/shell/session'
import { Button, Field, Input, NativeSelect, Sheet, Switch } from '../components/ui'
import { clientAuth } from '@/lib/firebase/client'

/** The signed-in admin's own profile (saved to Neon) and password (managed by Firebase). */

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

async function patchMe(id: number | string, body: object) {
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
  const [googleSignIn, setGoogleSignIn] = useState(!!user.googleSignIn)
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
        phone: phone || null,
        googleSignIn,
      })
      setUser({
        ...user,
        name: doc.name,
        phone: doc.phone ?? undefined,
        googleSignIn: !!doc.googleSignIn,
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
      <Field label="Email" hint="Your sign-in address. Ask another admin to change it.">
        <Input type="email" value={user.email ?? ''} disabled className="bg-muted text-ink-muted" />
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
      <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-line p-3.5">
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold">Allow Google sign-in</span>
          <span className="mt-0.5 block text-xs text-ink-muted">
            Sign in with the Google account for {user.email ?? 'this email'}. When off, only your email and password work.
          </span>
        </span>
        <Switch checked={googleSignIn} onCheckedChange={setGoogleSignIn} aria-label="Allow Google sign-in" />
      </label>
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

/** Passwords belong to Firebase: the admin gets a reset link by email instead of typing one here. */
function ChangePasswordForm({ onDone }: { onDone: () => void }) {
  const { user } = useSession()
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)

  const send = async () => {
    if (!user.email) return
    setBusy(true)
    try {
      await sendPasswordResetEmail(clientAuth(), user.email)
      setSent(true)
      toast.success('Reset link sent')
    } catch {
      toast.error('Could not send the reset link. Try again in a minute.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-ink-2">
        We&apos;ll email a link to <span className="font-semibold">{user.email}</span> where you can choose a new password.
        If you sign in with Google or Microsoft, change the password with that provider instead.
      </p>
      {sent && (
        <div role="status" className="flex items-center gap-2 rounded-xl bg-success-soft px-3 py-2.5 text-sm font-semibold text-success">
          <Check className="size-4" /> Check your inbox for the link.
        </div>
      )}
      <div className="mt-2 flex gap-2">
        <Button className="flex-1 rounded-xl" onClick={onDone}>
          Close
        </Button>
        <Button variant="primary" className="flex-1 rounded-xl" disabled={busy || !user.email} onClick={() => void send()}>
          {busy ? <Loader2 className="animate-spin" /> : sent ? 'Send again' : 'Email me a reset link'}
        </Button>
      </div>
    </div>
  )
}
