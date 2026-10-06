import config from '@payload-config'
import { cookies } from 'next/headers'
import { after } from 'next/server'
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

/**
 * Sign-in and sign-out must come from this site (login CSRF). Behind a proxy or serverless host (Netlify)
 * the request URL can carry an internal host, so the site's public address is also taken from the
 * configured SERVER_URL / Netlify's URL and from the forwarded host header.
 */
function sameOrigin(req: Request) {
  const origin = req.headers.get('origin')
  if (!origin) return false
  const allowed = new Set<string>([new URL(req.url).origin])
  for (const url of [process.env.SERVER_URL, process.env.URL, process.env.DEPLOY_PRIME_URL]) {
    if (url) allowed.add(url.replace(/\/$/, ''))
  }
  const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host')
  if (host) allowed.add(`${req.headers.get('x-forwarded-proto') ?? 'https'}://${host}`)
  return allowed.has(origin)
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
    return json({ error: 'Sign-in is temporarily unavailable. Please try again shortly.' }, 500)
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

  const signedIn = () =>
    payload.update({
      collection: 'users',
      id: user.id,
      data: { firebaseUid: decoded.uid, lastSignInAt: new Date().toISOString(), ...(decoded.picture ? { photoUrl: decoded.picture } : {}) },
      overrideAccess: true,
    })
  // First sign-in links the Firebase account, which the next request needs: do it now.
  // Otherwise "last signed in" is only bookkeeping — write it after the response (one less round trip).
  if (user.firebaseUid !== decoded.uid) await signedIn()
  else after(() => signedIn().catch((err) => console.warn('[session] could not record sign-in time', err)))

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
