import 'server-only'

import { LATEST_APP_VERSION } from '@/dashboard/data/catalog'
import { versionLess } from '@/dashboard/lib/utils'
import { FieldError } from './auth'

/**
 * App versions. LATEST_APP_VERSION (catalog) is the newest release: older phones see an "update available" note.
 * MIN_APP_VERSION (environment, e.g. "2.7.0") is the oldest version the API still serves: anything older gets
 * 426 `update_required` and the app shows a blocking "Update the app" screen. Raise it when an old build is broken
 * or unsafe (no app release needed; change the env var and roll out the backend).
 */
const VERSION = /^\d{1,4}(\.\d{1,4}){0,3}$/

export const minAppVersion = () => {
  const v = (process.env.MIN_APP_VERSION || '').trim()
  return VERSION.test(v) ? v : null
}

export const appVersions = () => ({
  latestAppVersion: LATEST_APP_VERSION,
  minAppVersion: minAppVersion(),
  /** Where the app sends people to update (the Play Store listing). */
  storeUrl: process.env.APP_STORE_URL || 'https://play.google.com/store/apps/details?id=ai.reclimate.artisanpro',
})

/** Refuse app builds older than MIN_APP_VERSION. Requests without a version (a browser, tests) are let through. */
export function checkAppVersion(req: Request) {
  const min = minAppVersion()
  const v = req.headers.get('x-app-version')?.trim()
  if (!min || !v) return
  if (!VERSION.test(v) || versionLess(v, min))
    throw new FieldError(426, 'This version of the app is no longer supported. Please update it from the Play Store.', 'update_required')
}
