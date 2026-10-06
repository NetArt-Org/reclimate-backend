import 'server-only'

import config from '@payload-config'
import { updateTag } from 'next/cache'
import { headers } from 'next/headers'
import { getPayload } from 'payload'
import { cache } from 'react'

export const db = () => getPayload({ config })

/** The signed-in user (or null). Cached per request, so layout, page and actions share one check. */
export const sessionUser = cache(async () => {
  const payload = await db()
  const { user } = await payload.auth({ headers: await headers() })
  return user
})

/** The signed-in admin, or an error. Every server action calls this first. */
export async function requireAdmin() {
  const user = await sessionUser()
  if (!user || user.role !== 'admin') throw new Error('Not signed in as an admin')
  return { payload: await db(), user }
}

/** Tag of the cached shared dashboard data (see load.ts). */
export const DASHBOARD_TAG = 'dashboard'

/** After a write that changes the shared dashboard data: drop the cache so the next read is fresh. */
export const invalidateDashboard = () => updateTag(DASHBOARD_TAG)

/** Id of a relationship value, populated or not. */
export const relId = (v: unknown): string | undefined => {
  if (v == null) return undefined
  if (typeof v === 'object') return String((v as { id: string | number }).id)
  return String(v)
}
export const relIds = (v: unknown): string[] => (Array.isArray(v) ? v.map(relId).filter((x): x is string => !!x) : [])

/** Postgres numerics come back as strings from raw SQL. */
export const n = (v: unknown) => (v == null ? 0 : Number(v))
