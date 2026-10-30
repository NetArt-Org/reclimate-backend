import 'server-only'

import type { requireAdmin } from './payload'

/**
 * Edit history. Every admin write records who made it, when, and each changed field's old and new value, in
 * activity-logs (entity + entityId point at the record). The record's History panel and the activity feed read it.
 */

type Admin = Awaited<ReturnType<typeof requireAdmin>>
export interface Change {
  field: string
  from: unknown
  to: unknown
}

/** Fields that are bookkeeping, not content. */
const SKIP = new Set(['id', 'createdAt', 'updatedAt', 'raw'])

/** Empty values (undefined, '', null) are all "empty"; records are read with depth 0, so relationships are ids. */
function plain(v: unknown): unknown {
  if (v === undefined || v === '' || v === null) return null
  if (Array.isArray(v)) return v.map(plain)
  return v
}

function same(a: unknown, b: unknown) {
  const x = plain(a)
  const y = plain(b)
  if (x === y) return true
  if (typeof x === 'number' || typeof y === 'number') return Number(x) === Number(y) && x != null && y != null
  // Dates come back as ISO strings; inputs may be Date objects or other ISO forms.
  if (typeof x === 'string' && typeof y === 'string' && /^\d{4}-\d\d-\d\d/.test(x) && /^\d{4}-\d\d-\d\d/.test(y)) {
    return new Date(x).getTime() === new Date(y).getTime()
  }
  return JSON.stringify(x) === JSON.stringify(y)
}

/** Keep the history readable: long values (lists, settings, files) are shortened. */
function short(v: unknown): unknown {
  const p = plain(v)
  if (p == null || typeof p === 'number' || typeof p === 'boolean') return p
  const s = typeof p === 'string' ? p : JSON.stringify(p)
  return s.length > 300 ? `${s.slice(0, 297)}…` : s
}

/** The fields of `next` whose value differs from `before`. */
export function diff(before: object | null | undefined, next: Record<string, unknown>): Change[] {
  const out: Change[] = []
  for (const [field, to] of Object.entries(next)) {
    if (SKIP.has(field)) continue
    const from = (before as Record<string, unknown> | null | undefined)?.[field]
    if (!same(from, to)) out.push({ field, from: short(from), to: short(to) })
  }
  return out
}

/** Write one history entry. `changes` is left out for actions that are not field edits (void, delete, approve). */
export async function record(
  { payload, user }: Admin,
  e: { entity: string; entityId: string; message: string; action: string; changes?: Change[]; network?: string | null },
) {
  await payload.create({
    collection: 'activity-logs',
    data: {
      message: e.message,
      network: e.network ?? undefined,
      by: user.name || user.email || 'Admin',
      byEmail: user.email ?? null,
      actionType: e.action,
      entity: e.entity,
      entityId: e.entityId,
      changes: e.changes?.length ? e.changes : null,
      at: new Date().toISOString(),
    },
    overrideAccess: true,
  } as never)
}

/** "name, code and location" — the changed field names, for the one-line message. */
export const fieldList = (changes: Change[]) => {
  const names = changes.map((c) => c.field.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase())
  return names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}` : (names[0] ?? '')
}

/** Record a create or an edit (nothing when a save changed nothing). */
export async function recordSave(
  admin: Admin,
  e: { entity: string; entityId: string; label: string; name: string; before: object | null | undefined; data: Record<string, unknown>; network?: string | null },
) {
  const changes = diff(e.before, e.data)
  if (e.before && !changes.length) return
  await record(admin, {
    entity: e.entity,
    entityId: e.entityId,
    action: e.before ? 'update' : 'create',
    message: e.before ? `${e.label} ${e.name}: ${fieldList(changes)} changed` : `${e.label} ${e.name} added`,
    changes,
    network: e.network,
  })
}
