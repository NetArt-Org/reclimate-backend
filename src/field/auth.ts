import 'server-only'

import config from '@payload-config'
import { getPayload, type Payload } from 'payload'

import type { Person } from '@/payload-types'
import { bust, memo, TTL } from './cache'

/**
 * Sign-in for the field app (Artisan Pro on phones). People get a login from an admin (Networks & people →
 * person → App login), or sign up in the app (Register now) and wait for an admin to approve them. The app
 * signs in with Firebase — email + password or Google — and sends the Firebase ID token in `X-Field-Token`
 * (older builds: `Authorization: Bearer`). Here the token is verified and matched to the `people` row, which
 * decides role, network and sites.
 */

/** The Firebase ID token of a request: `X-Field-Token`, or `Authorization: Bearer` from older app builds. */
export function tokenFrom(req: Request): string | undefined {
  const raw = req.headers.get('x-field-token') ?? req.headers.get('authorization')?.match(/^Bearer (.*)$/)?.[1]
  return raw && /^[\w.-]{20,4096}$/.test(raw) ? raw : undefined
}

export type FieldRole = 'worker' | 'sup'

export interface FieldContext {
  payload: Payload
  person: Person
  role: FieldRole
  /** Sites the person works at. */
  siteIds: string[]
  networkIds: string[]
  /** The site this request works on (chosen in the app, one of `siteIds`); null when none is assigned. */
  siteId: string | null
}

/** Why the app cannot open — lets it show the right screen rather than a generic error. */
export type FieldErrorCode =
  | 'signed_out' | 'not_registered' | 'pending' | 'rejected' | 'access_off' | 'no_site' | 'not_configured'
  | 'rate_limited' | 'email_unverified' | 'duplicate' | 'update_required'

/** An error with an HTTP status and a message meant for the person using the app. */
export class FieldError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly code?: FieldErrorCode,
  ) {
    super(message)
  }
}

/** Managers and supervisors review batches; kiln operators and farmers record them. */
export const roleOf = (r: Person['role']): FieldRole => (r === 'manager' || r === 'supervisor' ? 'sup' : 'worker')

export const relId = (v: unknown): string | undefined => {
  if (v == null) return undefined
  if (typeof v === 'object') return String((v as { id: string | number }).id)
  return String(v)
}
export const relIds = (v: unknown): string[] => (Array.isArray(v) ? v.map(relId).filter((x): x is string => !!x) : [])

export interface VerifiedToken {
  uid: string
  email?: string
  emailVerified: boolean
  name?: string
  provider: string
}

/** Verify the Firebase ID token only (used by Register now, before a person exists). */
export async function verifyToken(req: Request): Promise<VerifiedToken> {
  const token = tokenFrom(req)
  if (!token) throw new FieldError(401, 'Please sign in again.', 'signed_out')
  const { firebaseAuth, isFirebaseConfigured } = await import('@/lib/firebase/admin')
  if (!isFirebaseConfigured()) throw new FieldError(503, 'Sign-in is not set up on the server yet.', 'not_configured')
  let decoded
  try {
    // ID tokens live for an hour; a removed or switched-off person is also refused, on every request.
    decoded = await firebaseAuth().verifyIdToken(token)
  } catch {
    throw new FieldError(401, 'Please sign in again.', 'signed_out')
  }
  const provider = decoded.firebase?.sign_in_provider ?? ''
  if (provider !== 'password' && provider !== 'google.com') throw new FieldError(403, 'Sign in with your email and password, or Google.', 'signed_out')
  return { uid: decoded.uid, email: decoded.email?.toLowerCase(), emailVerified: !!decoded.email_verified, name: decoded.name as string | undefined, provider }
}

async function checkNotRevoked(req: Request) {
  const token = tokenFrom(req) ?? ''
  const { firebaseAuth } = await import('@/lib/firebase/admin')
  try {
    await firebaseAuth().verifyIdToken(token, true)
  } catch (e) {
    const code = (e as { code?: string }).code ?? ''
    // Only a definite "revoked/disabled" answer signs the person out; a Google hiccup must not.
    if (code === 'auth/id-token-revoked' || code === 'auth/user-disabled' || code === 'auth/user-not-found')
      throw new FieldError(401, 'Please sign in again.', 'signed_out')
  }
}

const people = async (payload: Payload, where: object) =>
  (await payload.find({ collection: 'people', where: where as never, limit: 2, depth: 0, overrideAccess: true, select: { raw: false } })).docs as Person[]

/** The person behind a verified token, linking an admin-created login by verified email the first time. */
export async function personFor(payload: Payload, t: VerifiedToken): Promise<Person | undefined> {
  const linked = (await people(payload, { firebaseUid: { equals: t.uid } }))[0]
  if (linked || !t.emailVerified || !t.email) return linked
  // The admin gave this email app access but the Firebase account was (re)created separately: link it once.
  const matches = (await people(payload, { and: [{ email: { like: t.email } }, { appAccess: { equals: true } }, { firebaseUid: { exists: false } }] })).filter(
    (p) => p.email?.toLowerCase() === t.email,
  )
  if (matches.length !== 1) return undefined
  return (await payload.update({ collection: 'people', id: matches[0].id, data: { firebaseUid: t.uid }, overrideAccess: true, depth: 0 })) as Person
}

/** What the phone reports about itself (headers), kept on the person for the admin's "older app version" alert. */
function deviceFrom(req: Request) {
  const version = req.headers.get('x-app-version')?.slice(0, 20)
  if (!version) return null
  return {
    version,
    model: (req.headers.get('x-device-model') ?? 'Unknown device').slice(0, 80),
    app: req.headers.get('x-app-mode') === 'offline' ? 'offline' : 'online',
    lastSeen: new Date().toISOString(),
  }
}

export async function authenticate(req: Request, wantedSite?: string | null): Promise<FieldContext> {
  const t = await verifyToken(req)
  const payload = await getPayload({ config })
  // The person and their sites are looked up at most every few seconds per account (each phone polls).
  // That lookup also asks Firebase whether the sign-in was revoked (an admin reset the password, e.g. for a lost
  // phone), so a revoked token stops working within seconds instead of at its expiry (up to an hour).
  const ctx = await memo(`person:${t.uid}`, TTL.person, async () => {
    await checkNotRevoked(req)
    return contextFor(payload, await personFor(payload, t), null, req)
  })
  const siteId = wantedSite && ctx.siteIds.includes(wantedSite) ? wantedSite : (ctx.siteIds[0] ?? null)
  return { ...ctx, siteId }
}

/** Forget a person's cached sign-in check (after their profile, access or account changed). */
export const forgetPerson = (uid?: string | null) => uid && bust(`person:${uid}`)

/** Whether this person may use the app, and the sites they work on. */
export async function contextFor(payload: Payload, person: Person | undefined, wantedSite?: string | null, req?: Request): Promise<FieldContext> {
  if (!person) throw new FieldError(403, 'This account is not registered for the app yet.', 'not_registered')
  if (person.registrationStatus === 'pending') throw new FieldError(403, 'Your registration is waiting for approval by your admin.', 'pending')
  if (person.registrationStatus === 'rejected' && !person.appAccess)
    throw new FieldError(403, person.registrationNote || 'Your registration was not approved. Contact your admin.', 'rejected')
  if (!person.active || !person.appAccess) throw new FieldError(403, 'Your access to the app is switched off. Ask your admin.', 'access_off')

  const siteIds = relIds(person.sites)
  const networkIds = new Set(relIds(person.networks))
  if (siteIds.length) {
    const sites = await payload.find({ collection: 'sites', where: { id: { in: siteIds } }, depth: 0, limit: 100, overrideAccess: true, select: { network: true } })
    sites.docs.forEach((s) => s.network && networkIds.add(String(relId(s.network))))
  }

  // Bookkeeping: the sign-in time (hourly) and the phone's app version.
  const last = person.lastAppSignInAt ? new Date(person.lastAppSignInAt).getTime() : 0
  const device = req ? deviceFrom(req) : null
  const prev = person.device as { version?: string } | null
  if (Date.now() - last > 3600_000 || (device && device.version !== prev?.version)) {
    payload
      .update({ collection: 'people', id: person.id, data: { lastAppSignInAt: new Date().toISOString(), ...(device ? { device } : {}) }, overrideAccess: true, depth: 0 })
      .catch(() => {})
  }

  const siteId = wantedSite && siteIds.includes(wantedSite) ? wantedSite : (siteIds[0] ?? null)
  return { payload, person, role: roleOf(person.role), siteIds, networkIds: [...networkIds], siteId }
}
