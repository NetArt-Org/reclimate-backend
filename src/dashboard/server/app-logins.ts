'use server'

import { firebaseAuth, isFirebaseConfigured } from '@/lib/firebase/admin'
import { invalidateDashboard, requireAdmin } from './payload'
import { guard, UserError } from './result'

/**
 * Field-app logins. An admin creates the login (email + a temporary password) and hands it to the person;
 * the app asks them to choose their own password on first sign-in. The account lives in Firebase Auth
 * (same project as the admin sign-in); the `people` row holds the link and whether access is on.
 */

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function checkPassword(p: string) {
  if (p.length < 8) throw new UserError('The temporary password needs at least 8 characters.')
  if (!/[a-z]/i.test(p) || !/\d/.test(p)) throw new UserError('Use letters and numbers in the temporary password.')
}

async function setup() {
  const ctx = await requireAdmin()
  if (!isFirebaseConfigured()) throw new UserError('Firebase is not configured on the server, so logins cannot be created yet.')
  return ctx
}

async function log(payload: Awaited<ReturnType<typeof setup>>['payload'], by: string, message: string) {
  await payload.create({ collection: 'activity-logs', data: { message, by, actionType: 'app-login', at: new Date().toISOString() }, overrideAccess: true } as never)
}

/** Create (or re-create) a person's app login with a temporary password. */
export async function createAppLogin(personId: string, emailIn: string, password: string) {
  return guard(async () => {
    const { payload, user } = await setup()
    const email = emailIn.trim().toLowerCase()
    if (!EMAIL.test(email)) throw new UserError('Enter a valid email address.')
    checkPassword(password)
    const person = await payload.findByID({ collection: 'people', id: personId, depth: 0, overrideAccess: true })

    // One email, one person: never an admin's login, never someone else's.
    const admins = await payload.find({ collection: 'users', where: { email: { equals: email } }, limit: 1, depth: 0, overrideAccess: true })
    if (admins.docs.length) throw new UserError('This email is an admin login. Use a different email for the app.')
    const others = await payload.find({ collection: 'people', where: { and: [{ email: { like: email } }, { id: { not_equals: personId } }] }, depth: 0, overrideAccess: true, select: { email: true, name: true } })
    const clash = others.docs.find((o) => o.email?.toLowerCase() === email)
    if (clash) throw new UserError(`${clash.name} already uses this email.`)

    const auth = firebaseAuth()
    let account = await auth.getUserByEmail(email).catch(() => null)
    if (account) {
      const linked = await payload.find({ collection: 'people', where: { and: [{ firebaseUid: { equals: account.uid } }, { id: { not_equals: personId } }] }, limit: 1, depth: 0, overrideAccess: true })
      const adminLinked = await payload.find({ collection: 'users', where: { firebaseUid: { equals: account.uid } }, limit: 1, depth: 0, overrideAccess: true })
      if (linked.docs.length || adminLinked.docs.length) throw new UserError('This email already has a login for someone else.')
      account = await auth.updateUser(account.uid, { password, emailVerified: true, disabled: false, displayName: person.name })
    } else {
      account = await auth.createUser({ email, password, emailVerified: true, displayName: person.name })
    }
    // A previous account of this person (different email) stops working.
    if (person.firebaseUid && person.firebaseUid !== account.uid) await auth.revokeRefreshTokens(person.firebaseUid).catch(() => {})

    await payload.update({
      collection: 'people',
      id: personId,
      data: { email, appAccess: true, firebaseUid: account.uid, mustChangePassword: true },
      overrideAccess: true,
    })
    await log(payload, user.name, `App login created for ${person.name} (${email})`)
    invalidateDashboard()
    return { email }
  })()
}

/** Set a new temporary password (forgotten password, or a lost phone). Signs them out everywhere. */
export async function resetAppPassword(personId: string, password: string) {
  return guard(async () => {
    const { payload, user } = await setup()
    checkPassword(password)
    const person = await payload.findByID({ collection: 'people', id: personId, depth: 0, overrideAccess: true })
    if (!person.firebaseUid) throw new UserError('This person has no app login yet.')
    const auth = firebaseAuth()
    await auth.updateUser(person.firebaseUid, { password })
    await auth.revokeRefreshTokens(person.firebaseUid)
    await payload.update({ collection: 'people', id: personId, data: { mustChangePassword: true }, overrideAccess: true })
    await log(payload, user.name, `App password reset for ${person.name}`)
    invalidateDashboard()
    return { email: person.email ?? '' }
  })()
}

/** Switch a person's app access off (signed out at once) or back on. */
export async function setAppAccess(personId: string, enabled: boolean) {
  return guard(async () => {
    const { payload, user } = await setup()
    const person = await payload.findByID({ collection: 'people', id: personId, depth: 0, overrideAccess: true })
    if (enabled && !person.firebaseUid) throw new UserError('Create an app login first.')
    if (!enabled && person.firebaseUid) await firebaseAuth().revokeRefreshTokens(person.firebaseUid).catch(() => {})
    await payload.update({ collection: 'people', id: personId, data: { appAccess: enabled }, overrideAccess: true })
    await log(payload, user.name, `App access ${enabled ? 'switched on' : 'switched off'} for ${person.name}`)
    invalidateDashboard()
  })()
}
