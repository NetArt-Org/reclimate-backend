'use server'

import { revalidatePath } from 'next/cache'

import { firebaseAuth, isFirebaseConfigured } from '@/lib/firebase/admin'

import { requireAdmin } from './payload'
import { guard, UserError } from './result'

export type AdminRole = 'admin' | 'viewer'

export interface AdminAccount {
  id: string
  name: string
  email: string
  role: AdminRole
  disabled: boolean
  lastSignInAt: string | null
  /** Has signed in through Firebase at least once. */
  linked: boolean
  /** May sign in with Google (otherwise email + password only). */
  googleSignIn: boolean
  photoUrl: string | null
  createdAt: string
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** People who may open the admin, plus the id of the signed-in admin. */
export async function listAdminAccounts() {
  return guard(async (): Promise<{ accounts: AdminAccount[]; currentUserId: string }> => {
    const { payload, user } = await requireAdmin()
    const res = await payload.find({ collection: 'users', pagination: false, depth: 0, sort: 'name', overrideAccess: true })
    return {
      currentUserId: String(user.id),
      accounts: res.docs.map((u) => ({
        id: String(u.id),
        name: u.name,
        email: u.email,
        role: u.role,
        disabled: !!u.disabled,
        lastSignInAt: u.lastSignInAt ?? null,
        linked: !!u.lastSignInAt,
        googleSignIn: !!u.googleSignIn,
        photoUrl: u.photoUrl ?? null,
        createdAt: u.createdAt,
      })),
    }
  })()
}

/** Add someone who may sign in. Firebase then emails them a link to set their password. */
export async function inviteAdmin(input: { name: string; email: string; role: AdminRole; googleSignIn?: boolean }) {
  return guard(async () => {
    const { payload } = await requireAdmin()
    const name = String(input?.name ?? '').trim()
    const email = String(input?.email ?? '').trim().toLowerCase()
    const role: AdminRole = input?.role === 'viewer' ? 'viewer' : 'admin'
    if (!name) throw new UserError('Enter a name')
    if (name.length > 120) throw new UserError('Names can be at most 120 characters')
    if (email.length > 254 || !EMAIL.test(email)) throw new UserError('Enter a valid email address')

    const existing = await payload.find({ collection: 'users', where: { email: { equals: email } }, limit: 1, depth: 0, overrideAccess: true })
    if (existing.docs.length) throw new UserError(`${email} already has access`)

    // Create (or reuse) the Firebase account and link it now, so only this account can ever sign in as the invite.
    // The browser then has Firebase email a "set your password" link (traditional email sign-in).
    let firebaseUid: string | undefined
    if (isFirebaseConfigured()) {
      const auth = firebaseAuth()
      const account = (await auth.getUserByEmail(email).catch(() => null)) ?? (await auth.createUser({ email, displayName: name }))
      firebaseUid = account.uid
    }
    try {
      await payload.create({
        collection: 'users',
        data: { name, email, role, disabled: false, googleSignIn: !!input?.googleSignIn, ...(firebaseUid ? { firebaseUid } : {}) },
        overrideAccess: true,
      })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      if (/unique|duplicate|already/i.test(msg)) throw new UserError(`${email} already has access`)
      throw err
    }
    revalidatePath('/admin/settings')
    return { email }
  })()
}

/** Allow or stop Google sign-in for one admin (they can also change it themselves in their profile). */
export async function setGoogleSignIn(id: string, enabled: boolean) {
  return guard(async () => {
    const { payload } = await requireAdmin()
    if (typeof id !== 'string' || typeof enabled !== 'boolean') throw new UserError('Invalid request')
    const user = await payload.update({ collection: 'users', id, data: { googleSignIn: enabled }, overrideAccess: true })
    // Turning Google off ends sessions that were started with Google.
    if (!enabled) await revokeSessions(user.firebaseUid)
    revalidatePath('/admin/settings')
  })()
}

/**
 * Sign someone out everywhere: revoke their Firebase refresh tokens so existing session cookies
 * stop working (the session check verifies revocation). Best effort — the role/disabled change
 * already blocks the admin on its own.
 */
async function revokeSessions(firebaseUid: string | null | undefined) {
  if (!firebaseUid || !isFirebaseConfigured()) return
  try {
    await firebaseAuth().revokeRefreshTokens(firebaseUid)
  } catch (err) {
    console.warn('[admin-access] could not revoke Firebase sessions', err)
  }
}

/** Guard against an admin locking themselves out. */
function assertNotSelf(currentId: string | number, id: string, what: string) {
  if (String(currentId) === String(id)) throw new UserError(`You cannot ${what} your own account`)
}

export async function setAdminRole(id: string, role: AdminRole) {
  return guard(async () => {
    const { payload, user } = await requireAdmin()
    if (role !== 'admin' && role !== 'viewer') throw new UserError('Unknown role')
    if (role !== 'admin') assertNotSelf(user.id, id, 'demote')
    const doc = await payload.update({ collection: 'users', id, data: { role }, depth: 0, overrideAccess: true })
    if (role !== 'admin') await revokeSessions(doc.firebaseUid)
    revalidatePath('/admin/settings')
  })()
}

export async function setAdminDisabled(id: string, disabled: boolean) {
  return guard(async () => {
    const { payload, user } = await requireAdmin()
    if (disabled) assertNotSelf(user.id, id, 'disable')
    if (typeof disabled !== 'boolean') throw new UserError('Unknown setting')
    const doc = await payload.update({ collection: 'users', id, data: { disabled }, depth: 0, overrideAccess: true })
    if (disabled) await revokeSessions(doc.firebaseUid)
    revalidatePath('/admin/settings')
  })()
}

export async function removeAdmin(id: string) {
  return guard(async () => {
    const { payload, user } = await requireAdmin()
    assertNotSelf(user.id, id, 'remove')
    const doc = await payload.delete({ collection: 'users', id, depth: 0, overrideAccess: true })
    await revokeSessions(doc.firebaseUid)
    revalidatePath('/admin/settings')
  })()
}
