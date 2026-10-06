'use client'

import { Ban, CheckCircle2, MoreHorizontal, RotateCcw, ShieldCheck, Trash2, UserPlus, Users } from 'lucide-react'
import { sendPasswordResetEmail } from 'firebase/auth'
import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'

import { useSession } from '../components/shell/session'
import {
  Avatar,
  Badge,
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  Field,
  Input,
  Menu,
  MenuContent,
  MenuItem,
  MenuTrigger,
  NativeSelect,
  Sheet,
  Spinner,
  Switch,
} from '../components/ui'
import { clientAuth } from '@/lib/firebase/client'
import { unwrap } from '../lib/unwrap'
import { cn } from '../lib/utils'
import {
  inviteAdmin,
  listAdminAccounts,
  removeAdmin,
  setAdminDisabled,
  setAdminRole,
  setGoogleSignIn,
  type AdminAccount,
  type AdminRole,
} from '../server/admin-access'
import type { ActionResult } from '../server/result'

const ROLE_LABEL: Record<AdminRole, string> = { admin: 'Admin', viewer: 'Viewer' }

const errMsg = (err: unknown) => (err instanceof Error ? err.message : String(err))

const dateTime = (iso: string) =>
  new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })

const COLS = 'md:grid-cols-[minmax(200px,2fr)_90px_100px_minmax(130px,1fr)_120px_40px]'

/** Settings → Admin access: who may sign in to this admin. */
export function AdminAccessSection({ inviteOpen, onInviteOpenChange }: { inviteOpen: boolean; onInviteOpenChange: (o: boolean) => void }) {
  const { user } = useSession()
  const [accounts, setAccounts] = useState<AdminAccount[] | null>(null)
  const [currentUserId, setCurrentUserId] = useState(String(user.id))
  const [loadError, setLoadError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [removing, setRemoving] = useState<AdminAccount | null>(null)

  const load = useCallback(() => {
    return listAdminAccounts()
      .then(unwrap)
      .then((r) => {
        setAccounts(r.accounts)
        setCurrentUserId(r.currentUserId)
        setLoadError(null)
      })
      .catch((err) => setLoadError(errMsg(err)))
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const run = async (a: AdminAccount, fn: () => Promise<ActionResult<void>>, done: string) => {
    setBusyId(a.id)
    try {
      unwrap(await fn())
      toast.success(done)
      await load()
    } catch (err) {
      toast.error(errMsg(err))
    } finally {
      setBusyId(null)
    }
  }

  const activeAdmins = accounts?.filter((a) => a.role === 'admin' && !a.disabled).length ?? 0

  return (
    <Card className="overflow-hidden">
      <div className="flex items-start gap-3 border-b border-line bg-muted/60 px-4 py-3">
        <ShieldCheck className="mt-0.5 size-4 shrink-0 text-brand" aria-hidden />
        <p className="text-sm text-ink-2">
          People sign in with their email and password, or with Google when it is switched on for them. Only people listed here can open the admin.
        </p>
      </div>

      {accounts === null ? (
        loadError ? (
          <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
            <p className="text-sm text-danger" role="alert">
              {loadError}
            </p>
            <Button size="sm" onClick={() => void load()}>
              <RotateCcw /> Try again
            </Button>
          </div>
        ) : (
          <div className="flex items-center justify-center gap-2 py-12 text-sm text-ink-muted">
            <Spinner /> Loading accounts…
          </div>
        )
      ) : accounts.length === 0 ? (
        <EmptyState icon={<Users />} title="No accounts yet" sub="Invite an admin so they can sign in." />
      ) : (
        <div>
          <div role="table" aria-label="Admin accounts">
            <div role="row" className={cn('hidden items-center gap-4 border-b border-line bg-muted px-4 py-2 text-xs font-semibold text-ink-muted md:grid', COLS)}>
              <span role="columnheader">Person</span>
              <span role="columnheader">Role</span>
              <span role="columnheader">Status</span>
              <span role="columnheader">Last sign-in</span>
              <span role="columnheader">Google sign-in</span>
              <span role="columnheader" className="sr-only">
                Actions
              </span>
            </div>
            {accounts.map((a) => {
              const self = a.id === currentUserId
              const busy = busyId === a.id
              return (
                <div
                  key={a.id}
                  role="row"
                  className={cn(
                    // Phones: a compact card (person + menu, then role · status · Google). Tablet up: a table row.
                    'flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-line px-4 py-3 text-[13px] transition-colors last:border-0 hover:bg-muted/70 md:grid md:gap-4 md:py-2.5',
                    COLS,
                  )}
                >
                  <span role="cell" className="order-1 flex min-w-0 flex-[1_1_calc(100%-3rem)] items-center gap-3 md:order-none md:flex-none">
                    <Avatar name={a.name} src={a.photoUrl ?? undefined} size={32} />
                    <span className="min-w-0">
                      <span className="flex items-center gap-1.5 font-semibold">
                        <span className="truncate" title={a.name}>
                          {a.name}
                        </span>
                        {self && <span className="shrink-0 text-xs font-medium text-ink-muted">(you)</span>}
                      </span>
                      <span className="block truncate text-xs text-ink-muted" title={a.email}>
                        {a.email}
                      </span>
                    </span>
                  </span>
                  <span role="cell" className="order-3 md:order-none">
                    <Badge tone={a.role === 'admin' ? 'brand' : 'info'}>{ROLE_LABEL[a.role]}</Badge>
                  </span>
                  <span role="cell" className="order-3 md:order-none">
                    {a.disabled ? (
                      <Badge tone="danger">
                        <Ban /> Disabled
                      </Badge>
                    ) : (
                      <Badge tone="success">
                        <CheckCircle2 /> Active
                      </Badge>
                    )}
                  </span>
                  <span role="cell" className="hidden text-ink-2 tabular-nums md:block">
                    {a.lastSignInAt ? dateTime(a.lastSignInAt) : <span className="text-ink-subtle">Never</span>}
                  </span>
                  <span role="cell" className="order-3 flex items-center gap-2 text-ink-2 md:order-none">
                    <Switch
                      checked={a.googleSignIn}
                      disabled={busy}
                      onCheckedChange={(on) =>
                        void run(a, () => setGoogleSignIn(a.id, on), on ? `${a.name} can sign in with Google` : `Google sign-in off for ${a.name}`)
                      }
                      aria-label={`Google sign-in for ${a.name}`}
                    />
                    <span className="text-xs text-ink-muted">
                      <span className="md:hidden">Google sign-in </span>
                      {a.googleSignIn ? 'on' : 'off'}
                    </span>
                  </span>
                  <span role="cell" className="order-2 ml-auto flex justify-end md:order-none md:ml-0">
                    {busy ? (
                      <span className="flex size-8 items-center justify-center">
                        <Spinner />
                      </span>
                    ) : (
                      <Menu>
                        <MenuTrigger asChild>
                          <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${a.name}`}>
                            <MoreHorizontal />
                          </Button>
                        </MenuTrigger>
                        <MenuContent>
                          {a.role === 'admin' ? (
                            <MenuItem
                              disabled={self}
                              className="data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50"
                              onSelect={() => void run(a, () => setAdminRole(a.id, 'viewer'), `${a.name} is now a viewer`)}
                            >
                              <ShieldCheck /> Make viewer
                            </MenuItem>
                          ) : (
                            <MenuItem onSelect={() => void run(a, () => setAdminRole(a.id, 'admin'), `${a.name} is now an admin`)}>
                              <ShieldCheck /> Make admin
                            </MenuItem>
                          )}
                          {a.disabled ? (
                            <MenuItem onSelect={() => void run(a, () => setAdminDisabled(a.id, false), `${a.name} can sign in again`)}>
                              <CheckCircle2 /> Enable
                            </MenuItem>
                          ) : (
                            <MenuItem
                              disabled={self}
                              className="data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50"
                              onSelect={() => void run(a, () => setAdminDisabled(a.id, true), `${a.name} is disabled`)}
                            >
                              <Ban /> Disable
                            </MenuItem>
                          )}
                          <MenuItem
                            disabled={self}
                            className="text-danger data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50 [&_svg]:text-danger"
                            onSelect={() => setRemoving(a)}
                          >
                            <Trash2 /> Remove
                          </MenuItem>
                          {self && <p className="px-3 pt-1 pb-2 text-xs text-ink-muted">You cannot demote, disable or remove yourself.</p>}
                        </MenuContent>
                      </Menu>
                    )}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {accounts && accounts.length > 0 && (
        <div className="border-t border-line px-4 py-2.5 text-xs text-ink-muted">
          {accounts.length} {accounts.length === 1 ? 'account' : 'accounts'} · {activeAdmins} active {activeAdmins === 1 ? 'admin' : 'admins'}
        </div>
      )}

      <InviteSheet open={inviteOpen} onOpenChange={onInviteOpenChange} onInvited={() => void load()} />

      <ConfirmDialog
        open={!!removing}
        onOpenChange={(o) => !o && setRemoving(null)}
        title="Remove access?"
        confirmLabel="Remove"
        message={removing ? `${removing.name} (${removing.email}) will no longer be able to sign in to the admin.` : ''}
        onConfirm={() => {
          const a = removing
          if (a) void run(a, () => removeAdmin(a.id), `Removed ${a.name}`)
        }}
      />
    </Card>
  )
}

function InviteSheet({ open, onOpenChange, onInvited }: { open: boolean; onOpenChange: (o: boolean) => void; onInvited: () => void }) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title="Invite admin">
      {open && (
        <InviteForm
          onDone={() => onOpenChange(false)}
          onInvited={() => {
            onInvited()
            onOpenChange(false)
          }}
        />
      )}
    </Sheet>
  )
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function InviteForm({ onDone, onInvited }: { onDone: () => void; onInvited: () => void }) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<AdminRole>('admin')
  const [google, setGoogle] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const nameError = !name.trim() ? 'Enter a name' : null
  const emailError = !email.trim() ? 'Enter an email address' : !EMAIL.test(email.trim()) ? 'Enter a valid email address' : null

  const save = async () => {
    setSubmitted(true)
    setServerError(null)
    if (nameError || emailError) return
    setSaving(true)
    try {
      const { email: invited } = unwrap(await inviteAdmin({ name, email, role, googleSignIn: google }))
      // Firebase sends the "set your password" email.
      await sendPasswordResetEmail(clientAuth(), invited).catch(() => {})
      toast.success(`Invited ${invited}`, { description: 'They will get an email to set their password.' })
      onInvited()
    } catch (err) {
      setServerError(errMsg(err))
      setSaving(false)
    }
  }

  return (
    <form
      noValidate
      className="-mx-4 -my-3 flex min-h-full flex-col"
      onSubmit={(e) => {
        e.preventDefault()
        void save()
      }}
    >
      <div className="flex flex-1 flex-col gap-4 px-4 py-3">
        <p className="text-sm text-ink-muted">
          They get an email to set a password, then sign in with this address. Switch on Google sign-in to also let them use their Google account.
        </p>
        <div className="flex flex-col gap-1">
          <Field label="Name *">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Priya Sharma"
              autoComplete="off"
              autoFocus
              aria-invalid={submitted && !!nameError}
              aria-describedby={submitted && nameError ? 'invite-name-error' : undefined}
            />
          </Field>
          {submitted && nameError && (
            <span id="invite-name-error" className="text-xs text-danger">
              {nameError}
            </span>
          )}
        </div>
        <div className="flex flex-col gap-1">
          <Field label="Email *" hint="Their sign-in address (and their Google account, if Google sign-in is on).">
            <Input
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value)
                setServerError(null)
              }}
              placeholder="name@company.com"
              autoComplete="off"
              inputMode="email"
              aria-invalid={(submitted && !!emailError) || !!serverError}
              aria-describedby={submitted && emailError ? 'invite-email-error' : serverError ? 'invite-server-error' : undefined}
            />
          </Field>
          {submitted && emailError && (
            <span id="invite-email-error" className="text-xs text-danger">
              {emailError}
            </span>
          )}
          {serverError && !emailError && (
            <span id="invite-server-error" role="alert" className="text-xs text-danger">
              {serverError}
            </span>
          )}
        </div>
        <Field label="Role" hint={role === 'admin' ? 'Full access to the admin.' : 'Viewers cannot sign in to this panel yet; use for people you will promote later.'}>
          <NativeSelect value={role} onChange={(e) => setRole(e.target.value as AdminRole)}>
            <option value="admin">Admin</option>
            <option value="viewer">Viewer</option>
          </NativeSelect>
        </Field>
        <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-line p-3.5">
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold">Allow Google sign-in</span>
            <span className="mt-0.5 block text-xs text-ink-muted">They can switch this themselves later in their profile.</span>
          </span>
          <Switch checked={google} onCheckedChange={setGoogle} aria-label="Allow Google sign-in" />
        </label>
      </div>

      <div className="sticky bottom-0 flex justify-end gap-2 border-t border-line bg-surface px-4 py-3">
        <Button variant="outline" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" disabled={saving}>
          {saving ? <Spinner className="text-white" /> : <UserPlus />} {saving ? 'Inviting…' : 'Invite'}
        </Button>
      </div>
    </form>
  )
}
