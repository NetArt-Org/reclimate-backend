import 'server-only'

import { FieldError } from './auth'

/**
 * Firebase App Check: proof that a request comes from the genuine Artisan Pro app on a real phone (Play Integrity
 * on Android), not from a script replaying a stolen sign-in. The app sends the token as `X-Firebase-AppCheck`.
 *   APP_CHECK=off      (default) not checked
 *   APP_CHECK=monitor  checked and logged, never refused — use this until every phone runs an app that sends it
 *   APP_CHECK=enforce  requests without a valid token get 401
 */
const mode = () => (['monitor', 'enforce'].includes(process.env.APP_CHECK ?? '') ? (process.env.APP_CHECK as 'monitor' | 'enforce') : 'off')

/** Valid tokens seen recently (a token lives about an hour; checking each one once per instance is enough). */
const seen = new Map<string, number>()

export async function checkAppCheck(req: Request) {
  const m = mode()
  if (m === 'off') return
  const token = req.headers.get('x-firebase-appcheck')
  let ok = false
  if (token && token.length < 4096) {
    const until = seen.get(token)
    if (until && until > Date.now()) ok = true
    else {
      try {
        const { appCheck } = await import('@/lib/firebase/admin')
        const res = await appCheck().verifyToken(token)
        if (seen.size > 20_000) seen.clear()
        seen.set(token, res.token.exp * 1000)
        ok = true
      } catch {
        /* invalid or expired */
      }
    }
  }
  if (ok) return
  if (m === 'monitor') return void console.warn('[app check] request without a valid token', new URL(req.url).pathname)
  throw new FieldError(401, 'Please update the app or try again.', 'signed_out')
}
