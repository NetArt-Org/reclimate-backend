import 'server-only'

import config from '@payload-config'
import { headers } from 'next/headers'
import { getPayload } from 'payload'

export const db = () => getPayload({ config })

/** The signed-in admin, or an error. Every server action calls this first. */
export async function requireAdmin() {
  const payload = await db()
  const { user } = await payload.auth({ headers: await headers() })
  if (!user || user.role !== 'admin') throw new Error('Not signed in as an admin')
  return { payload, user }
}

/** Id of a relationship value, populated or not. */
export const relId = (v: unknown): string | undefined => {
  if (v == null) return undefined
  if (typeof v === 'object') return String((v as { id: string | number }).id)
  return String(v)
}
export const relIds = (v: unknown): string[] => (Array.isArray(v) ? v.map(relId).filter((x): x is string => !!x) : [])

/** Postgres numerics come back as strings from raw SQL. */
export const n = (v: unknown) => (v == null ? 0 : Number(v))
