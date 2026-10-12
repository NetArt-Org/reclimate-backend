import 'server-only'

import { sql } from '@payloadcms/db-postgres'
import type { Payload } from 'payload'

import { FieldError } from './auth'

/**
 * Once-only writes. The app names each write with its own id (`clientId`); when the reply is lost on a bad
 * connection, the app sends it again. The first request claims the id in Postgres (shared by every server
 * instance) and stores its reply; a repeat gets that reply back instead of creating a second copy. A repeat that
 * arrives while the first is still running gets 503, and the app tries again a moment later (as for any 503).
 */
let tableReady: Promise<unknown> | null = null
const ensureTable = (payload: Payload) =>
  (tableReady ??= payload.db.drizzle
    .execute(sql`create table if not exists field_idempotency (key text primary key, reply jsonb, at timestamptz not null default now())`)
    .catch((e) => {
      tableReady = null
      throw e
    }))

export async function once<T>(payload: Payload, scope: string, clientId: unknown, run: () => Promise<T>): Promise<T> {
  const id = typeof clientId === 'string' ? clientId.replace(/[^\w-]/g, '').slice(0, 64) : ''
  if (!id) return run()
  const key = `${scope}:${id}`
  const db = payload.db.drizzle
  await ensureTable(payload)
  const claimed = await db.execute(sql`insert into field_idempotency (key) values (${key}) on conflict (key) do nothing returning key`)
  if (!claimed.rows.length) {
    const prev = (await db.execute(sql`select reply from field_idempotency where key = ${key}`)).rows[0] as { reply: T | null } | undefined
    if (prev?.reply != null) return prev.reply
    throw new FieldError(503, 'Still saving. Please try again in a moment.')
  }
  try {
    const reply = await run()
    await db.execute(sql`update field_idempotency set reply = ${JSON.stringify(reply)}::jsonb where key = ${key}`)
    if (Math.random() < 0.01) void db.execute(sql`delete from field_idempotency where at < now() - interval '30 days'`).catch(() => {})
    return reply
  } catch (e) {
    // It did not happen: free the id so a retry can run it.
    await db.execute(sql`delete from field_idempotency where key = ${key}`).catch(() => {})
    throw e
  }
}
