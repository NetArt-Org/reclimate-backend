import 'server-only'

import { sql } from '@payloadcms/db-postgres'
import type { Payload } from 'payload'

import { FieldError } from './auth'

/**
 * Rate limits for the field API, so a broken or abused client cannot flood the backend:
 *  - every request first passes a per-instance counter (cheap, no database);
 *  - writes, uploads, sign-ups and other costly actions are also counted in Postgres, so the limit holds across
 *    all server instances.
 * A request over the limit gets 429 with Retry-After; the app waits and tries again.
 */

export type LimitName = keyof typeof LIMITS

/** Requests allowed per window (seconds), per signed-in person (or per address before sign-in). */
export const LIMITS = {
  /** Any request from an address that is not signed in (stops token-guessing and floods). */
  anonymous: { max: 60, window: 60, shared: false },
  /** Reads of a signed-in person. */
  read: { max: 240, window: 60, shared: false },
  /** Saves (batches, records, profile, setup lists). */
  write: { max: 90, window: 60, shared: true },
  /** Photo/video uploads (a batch has about 15 files). */
  upload: { max: 120, window: 600, shared: true },
  /** Bytes uploaded per person per day (keeps Firebase Storage inside its free quota even if one login is abused). */
  uploadBytes: { max: 600 * 1024 * 1024, window: 86400, shared: true },
  /** Register now, per account and per address. */
  register: { max: 5, window: 3600, shared: true },
  registerIp: { max: 30, window: 3600, shared: true },
  /** Admin panel sign-ins, per address (stops password/token guessing on /admin/session). */
  adminSignIn: { max: 20, window: 900, shared: true },
  /** Sell requests and account deletion. */
  sell: { max: 10, window: 86400, shared: true },
  deleteAccount: { max: 3, window: 86400, shared: true },
} as const

const local = new Map<string, { start: number; count: number }>()

function hitLocal(key: string, window: number, cost: number) {
  const now = Date.now()
  const start = now - (now % (window * 1000))
  const cur = local.get(key)
  const entry = cur && cur.start === start ? cur : { start, count: 0 }
  entry.count += cost
  local.set(key, entry)
  if (local.size > 50_000) local.clear()
  return { count: entry.count, resetIn: Math.ceil((start + window * 1000 - now) / 1000) }
}

let tableReady: Promise<unknown> | null = null
/** The counters' table (created once if the migration has not run yet). */
const ensureTable = (payload: Payload) =>
  (tableReady ??= payload.db.drizzle
    .execute(sql`create table if not exists field_rate_limits (key text primary key, window_start timestamptz not null, count integer not null)`)
    .catch((e) => {
      tableReady = null
      throw e
    }))

async function hitShared(payload: Payload, key: string, window: number, cost: number) {
  await ensureTable(payload)
  const res = await payload.db.drizzle.execute(sql`
    insert into field_rate_limits (key, window_start, count)
    values (${key}, to_timestamp(floor(extract(epoch from now()) / ${window}) * ${window}), ${cost})
    on conflict (key) do update set
      count = case when field_rate_limits.window_start = excluded.window_start then field_rate_limits.count + excluded.count else excluded.count end,
      window_start = excluded.window_start
    returning count, extract(epoch from (window_start + make_interval(secs => ${window}) - now()))::int as reset_in`)
  // Now and then, drop counters of windows long past.
  if (Math.random() < 0.01) void payload.db.drizzle.execute(sql`delete from field_rate_limits where window_start < now() - interval '2 days'`).catch(() => {})
  const row = res.rows[0] as { count: number; reset_in: number }
  return { count: Number(row.count), resetIn: Math.max(1, Number(row.reset_in)) }
}

/** Count a request (or `cost` units of it, e.g. bytes) against a limit; throws 429 when it is over. */
export async function limit(payload: Payload | null, name: LimitName, who: string, cost = 1) {
  const l = LIMITS[name]
  const key = `${name}:${who}`
  const r = l.shared && payload ? await hitShared(payload, key, l.window, cost) : hitLocal(key, l.window, cost)
  if (r.count > l.max) throw new RateLimited(r.resetIn)
}

export class RateLimited extends FieldError {
  constructor(readonly retryAfter: number) {
    super(429, 'Too many requests. Please wait a moment and try again.', 'rate_limited')
  }
}

export { clientIp } from '@/lib/client-ip'

/**
 * At most `max` of a heavy task at once on this instance (uploads hold the whole file in memory). Others wait
 * up to `waitMs` for a turn, then get 503 + Retry-After, so a burst cannot exhaust the instance's memory and crash it.
 */
export function gate(max: number, waitMs: number) {
  let active = 0
  const queue: (() => void)[] = []
  return async function run<T>(task: () => Promise<T>): Promise<T> {
    if (active >= max) {
      if (queue.length >= max * 4) throw new Busy()
      await new Promise<void>((ok, fail) => {
        const go = () => (clearTimeout(t), ok())
        const t = setTimeout(() => {
          const i = queue.indexOf(go)
          if (i >= 0) queue.splice(i, 1)
          fail(new Busy())
        }, waitMs)
        queue.push(go)
      })
    } else active++
    try {
      return await task()
    } finally {
      const next = queue.shift()
      if (next) next()
      else active--
    }
  }
}

export class Busy extends RateLimited {
  constructor() {
    super(10)
    this.message = 'The server is busy. Please try again in a moment.'
  }
}
