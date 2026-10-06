import config from '@payload-config'
import { cookies } from 'next/headers'
import { getPayload, type Where } from 'payload'

/** Firebase Admin is loaded on first use, so a load problem surfaces as a logged, readable error. */
const firebase = () => import('@/lib/firebase/admin')

/** Emails that become admins on their first Google sign-in (comma separated), so the first account can get in. */
const bootstrapAdmins = () =>
  (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)

const json = (body: unknown, status = 200) => Response.json(body, { status })

/** Sign-in and sign-out must come from this site (login CSRF). */
function sameOrigin(req: Request) {
  const origin = req.headers.get('origin')
  return !!origin && origin === new URL(req.url).origin
}

/**
 * Sign in. The browser signs in with Firebase — Google, or email + password — and posts the ID token here.
 *  - The users row is found by the linked Firebase account. An invited row (no account linked yet) is linked
 *    on first sign-in only when Firebase has verified the email, so nobody can claim an invite by typing an address.
 *  - Google works only for people who have "Allow Google sign-in" switched on; everyone else uses email + password.
 */
export async function POST(req: Request) {
  try {
    return await signIn(req)
  } catch (err) {
    console.error('[session] sign-in failed', err)
    // TEMPORARY diagnostics for the Netlify deploy: error type and first line only, key-like text removed.
    const e = err as { name?: string; code?: string; message?: string }
    const detail = `${e.name ?? 'Error'}${e.code ? ` ${e.code}` : ''}: ${String(e.message ?? '').split('\n')[0].slice(0, 300)}`
      .replace(/-----BEGIN[\s\S]*?-----END[^-]*-----/g, '[key]')
      .replace(/[A-Za-z0-9+/=_-]{40,}/g, '[redacted]')
    return json({ error: 'Sign-in is temporarily unavailable. Please try again shortly.', detail }, 500)
  }
}

async function signIn(req: Request) {
  if (!sameOrigin(req)) return json({ error: 'Bad request' }, 403)
  const { firebaseAuth, isFirebaseConfigured, SESSION_COOKIE, SESSION_DAYS } = await firebase()
  if (!isFirebaseConfigured()) return json({ error: 'Sign-in is not configured on the server yet.' }, 503)
  const { idToken } = (await req.json().catch(() => ({}))) as { idToken?: string }
  if (typeof idToken !== 'string' || idToken.length > 4096) return json({ error: 'Missing token' }, 400)

  let decoded
  try {
    decoded = await firebaseAuth().verifyIdToken(idToken, true)
  } catch {
    return json({ error: 'Sign-in expired. Please try again.' }, 401)
  }
  // A long session can only start from a sign-in made in the last 5 minutes.
  if (Date.now() / 1000 - decoded.auth_time > 5 * 60) return json({ error: 'Please sign in again.' }, 401)
  const provider = decoded.firebase?.sign_in_provider
  if (provider !== 'google.com' && provider !== 'password') return json({ error: 'Use Google or your email and password.' }, 403)
  const email = decoded.email?.toLowerCase()
  if (!email) return json({ error: 'This account has no email address.' }, 403)

  const payload = await getPayload({ config })
  const find = async (where: Where) =>
    (await payload.find({ collection: 'users', where, limit: 1, depth: 0, overrideAccess: true })).docs[0]

  let user = await find({ firebaseUid: { equals: decoded.uid } })
  if (!user && decoded.email_verified) {
    // An invited admin signing in for the first time. Google proves the address, so it may also re-link a row.
    user = await find(
      provider === 'google.com'
        ? { email: { equals: email } }
        : { and: [{ email: { equals: email } }, { firebaseUid: { exists: false } }] },
    )
  }
  if (!user && provider === 'google.com' && decoded.email_verified && bootstrapAdmins().includes(email)) {
    user = await payload.create({
      collection: 'users',
      data: { name: decoded.name || email.split('@')[0], email, role: 'admin', firebaseUid: decoded.uid, googleSignIn: true },
      overrideAccess: true,
    })
  }
  if (!user) {
    if (provider === 'password' && !decoded.email_verified) {
      return json({ error: 'Please verify your email first — we have sent you a link.', code: 'verify-email' }, 403)
    }
    return json({ error: 'This account does not have access. Ask an admin to invite you.' }, 403)
  }
  if (user.disabled) return json({ error: 'This account is disabled.' }, 403)
  if (user.role !== 'admin') return json({ error: 'Only admins can use this panel.' }, 403)
  if (provider === 'google.com' && !user.googleSignIn) {
    return json({ error: 'Google sign-in is off for this account. Sign in with your email and password.' }, 403)
  }

  await payload.update({
    collection: 'users',
    id: user.id,
    data: { firebaseUid: decoded.uid, lastSignInAt: new Date().toISOString(), ...(decoded.picture ? { photoUrl: decoded.picture } : {}) },
    overrideAccess: true,
  })

  const expiresIn = SESSION_DAYS * 24 * 60 * 60 * 1000
  const session = await firebaseAuth().createSessionCookie(idToken, { expiresIn })
  ;(await cookies()).set(SESSION_COOKIE, session, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: expiresIn / 1000,
  })
  return json({ ok: true })
}

/** Sign out: drop the cookie and revoke the Firebase refresh tokens. */
export async function DELETE(req: Request) {
  if (!sameOrigin(req)) return json({ error: 'Bad request' }, 403)
  const { firebaseAuth, isFirebaseConfigured, SESSION_COOKIE } = await firebase().catch((err) => {
    console.error('[session] firebase admin failed to load', err)
    return { firebaseAuth: null, isFirebaseConfigured: () => false, SESSION_COOKIE: '__session' }
  })
  const jar = await cookies()
  const value = jar.get(SESSION_COOKIE)?.value
  jar.delete(SESSION_COOKIE)
  if (value && firebaseAuth && isFirebaseConfigured()) {
    try {
      const decoded = await firebaseAuth().verifySessionCookie(value)
      await firebaseAuth().revokeRefreshTokens(decoded.sub)
    } catch {
      /* already invalid */
    }
  }
  return json({ ok: true })
}
