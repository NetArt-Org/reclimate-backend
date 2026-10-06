'use client'

import {
  GoogleAuthProvider,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth'
import { Eye, EyeOff, Leaf, Loader2, MailCheck, TriangleAlert } from 'lucide-react'
import { useState, type FormEvent, type ReactNode } from 'react'

import Image from 'next/image'

import { clientAuth, firebaseReady } from '@/lib/firebase/client'
import { Button, Input } from '../ui'

/** Firebase error codes → plain messages. */
const MESSAGES: Record<string, string> = {
  'auth/invalid-credential': 'Wrong email or password.',
  'auth/wrong-password': 'Wrong email or password.',
  'auth/user-not-found': 'Wrong email or password.',
  'auth/too-many-requests': 'Too many attempts. Wait a few minutes and try again.',
  'auth/popup-closed-by-user': 'The sign-in window was closed before finishing.',
  'auth/popup-blocked': 'Your browser blocked the sign-in window. Allow pop-ups for this site.',
  'auth/network-request-failed': 'Cannot reach the sign-in service. Check your connection.',
  'auth/account-exists-with-different-credential': 'This email signs in with a password. Use your email and password.',
}
const message = (err: unknown) => {
  const code = (err as { code?: string })?.code ?? ''
  return MESSAGES[code] ?? 'Sign-in failed. Please try again.'
}

/** Admin sign-in through Firebase: email + password, or Google for people who have switched it on. */
export function LoginForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  /** Swap the Firebase sign-in for a server session (only invited admins get one). */
  const startSession = async (user: User) => {
    const res = await fetch('/admin/session', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken: await user.getIdToken() }),
    })
    const data = (await res.json().catch(() => ({}))) as { error?: string; code?: string }
    // An invited address that has not been confirmed yet: send the confirmation link while still signed in.
    if (data.code === 'verify-email') await sendEmailVerification(user).catch(() => {})
    // The server keeps its own session cookie; the browser-side Firebase sign-in is not needed after this.
    await signOut(clientAuth()).catch(() => {})
    if (!res.ok) throw Object.assign(new Error(data.error ?? 'Sign-in failed.'), { server: true })
    window.location.replace(new URL('/admin', window.location.origin).href)
  }

  const run = async (key: string, fn: () => Promise<void>) => {
    setBusy(key)
    setError(null)
    setNotice(null)
    try {
      await fn()
    } catch (err) {
      setError((err as { server?: boolean }).server ? (err as Error).message : message(err))
    } finally {
      setBusy(null)
    }
  }

  const google = () =>
    run('google', async () => {
      const provider = new GoogleAuthProvider()
      provider.setCustomParameters({ prompt: 'select_account' })
      const { user } = await signInWithPopup(clientAuth(), provider)
      await startSession(user)
    })

  const submit = (e: FormEvent) => {
    e.preventDefault()
    void run('email', async () => {
      const { user } = await signInWithEmailAndPassword(clientAuth(), email.trim(), password)
      await startSession(user)
    })
  }

  const reset = () =>
    run('reset', async () => {
      if (!email.trim()) throw Object.assign(new Error('Enter your email first, then choose “Forgot password”.'), { server: true })
      await sendPasswordResetEmail(clientAuth(), email.trim())
      setNotice(`If ${email.trim()} has an account, a reset link is on its way.`)
    })

  return (
    <div className="grid grid-cols-1 min-h-screen lg:grid-cols-[1.1fr_1fr]">
      <div className="relative hidden overflow-hidden bg-brand-dark p-12 text-white lg:flex lg:flex-col">
        {/* Biochar from one of the networks, ready for the field. Metadata (GPS) stripped from the file. */}
        <Image
          src="/images/login-biochar.webp"
          alt="Fresh biochar in buckets on a farm field"
          fill
          priority
          sizes="55vw"
          className="object-cover"
        />
        {/* Light tint over the whole photo, then darker bands at the top (logo) and bottom (headline) for legibility. */}
        <div className="absolute inset-0 bg-brand-dark/25" aria-hidden />
        <div className="absolute inset-x-0 top-0 h-56 bg-gradient-to-b from-black/70 via-black/35 to-transparent" aria-hidden />
        <div className="absolute inset-x-0 bottom-0 h-3/5 bg-gradient-to-t from-brand-dark via-brand-dark/80 to-transparent" aria-hidden />
        <div className="relative flex items-center gap-3 [text-shadow:0_1px_8px_rgb(0_0_0/0.45)]">
          <div className="flex size-11 items-center justify-center rounded-2xl bg-lime text-brand-dark">
            <Leaf className="size-5" />
          </div>
          <span className="text-lg font-bold">Reclimate dMRV</span>
        </div>
        <div className="relative mt-auto max-w-md [text-shadow:0_1px_10px_rgb(0_0_0/0.35)]">
          <h1 className="text-4xl leading-tight font-bold">Every batch of biochar, measured and verified.</h1>
          <p className="mt-4 text-base text-white/80">
            From farm waste to carbon locked in the soil — review field batches, manage networks and track the credits they earn.
          </p>
        </div>
      </div>

      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <div className="relative -mx-6 -mt-6 mb-6 h-36 overflow-hidden lg:hidden">
            <Image src="/images/login-biochar.webp" alt="" fill priority sizes="100vw" className="object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-page via-page/10 to-transparent" aria-hidden />
          </div>
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <div className="flex size-11 items-center justify-center rounded-2xl bg-brand text-lime">
              <Leaf className="size-5" />
            </div>
            <span className="text-lg font-bold">Reclimate dMRV</span>
          </div>
          <h2 className="text-2xl font-bold tracking-tight">Sign in to admin</h2>
          <p className="mt-1 text-sm text-ink-muted">Use your work account. Only invited admins can sign in.</p>

          {!firebaseReady ? (
            <div role="alert" className="mt-8 flex gap-2 rounded-xl bg-warn-soft px-3 py-3 text-sm text-warn">
              <TriangleAlert className="mt-0.5 size-4 shrink-0" />
              <span>Sign-in is not set up yet: the NEXT_PUBLIC_FIREBASE_* values are missing from the server configuration.</span>
            </div>
          ) : (
            <>
              <div className="mt-8">
                <SsoButton onClick={google} busy={busy === 'google'} disabled={!!busy} icon={<GoogleIcon />}>
                  Continue with Google
                </SsoButton>
                <p className="mt-2 text-xs text-ink-subtle">Google sign-in works once it is switched on in your profile.</p>
              </div>

              <div className="my-6 flex items-center gap-3 text-xs font-semibold text-ink-subtle uppercase">
                <span className="h-px flex-1 bg-line" /> or with email <span className="h-px flex-1 bg-line" />
              </div>

              <form onSubmit={submit}>
                <label className="block">
                  <span className="text-sm font-semibold">Email</span>
                  <Input className="mt-1.5 h-11" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
                </label>
                <label className="mt-4 block">
                  <span className="flex items-center justify-between text-sm font-semibold">
                    Password
                    <button type="button" onClick={() => void reset()} className="cursor-pointer text-xs font-semibold text-brand hover:underline">
                      Forgot password?
                    </button>
                  </span>
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
                  <div role="alert" className="mt-4 flex items-start gap-2 rounded-xl bg-danger-soft px-3 py-2.5 text-sm font-semibold text-danger">
                    <TriangleAlert className="mt-0.5 size-4 shrink-0" /> {error}
                  </div>
                )}
                {notice && (
                  <div role="status" className="mt-4 flex items-start gap-2 rounded-xl bg-success-soft px-3 py-2.5 text-sm font-semibold text-success">
                    <MailCheck className="mt-0.5 size-4 shrink-0" /> {notice}
                  </div>
                )}

                <Button type="submit" variant="primary" size="lg" className="mt-6 w-full rounded-xl" disabled={!!busy}>
                  {busy === 'email' ? <Loader2 className="animate-spin" /> : 'Sign in'}
                </Button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function SsoButton({ onClick, busy, disabled, icon, children }: { onClick: () => void; busy: boolean; disabled: boolean; icon: ReactNode; children: ReactNode }) {
  return (
    <Button size="lg" className="w-full rounded-xl" onClick={onClick} disabled={disabled}>
      {busy ? <Loader2 className="animate-spin" /> : icon}
      {children}
    </Button>
  )
}

const GoogleIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden>
    <path fill="#4285F4" d="M22.6 12.2c0-.8-.1-1.5-.2-2.2H12v4.2h5.9a5 5 0 0 1-2.2 3.3v2.7h3.6c2.1-1.9 3.3-4.8 3.3-8Z" />
    <path fill="#34A853" d="M12 23c3 0 5.5-1 7.3-2.7l-3.6-2.8c-1 .7-2.2 1.1-3.7 1.1-2.9 0-5.3-1.9-6.2-4.5H2.1v2.8A11 11 0 0 0 12 23Z" />
    <path fill="#FBBC05" d="M5.8 14.1a6.6 6.6 0 0 1 0-4.2V7.1H2.1a11 11 0 0 0 0 9.8l3.7-2.8Z" />
    <path fill="#EA4335" d="M12 5.4c1.6 0 3.1.6 4.2 1.7l3.2-3.2A11 11 0 0 0 2.1 7.1l3.7 2.8C6.7 7.3 9.1 5.4 12 5.4Z" />
  </svg>
)
