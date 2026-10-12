import 'server-only'

/**
 * A small in-memory cache for data many phones ask for and that changes rarely (network rules, site totals,
 * setup lists). Each server instance keeps its own copy for a short time; a write through the field API clears
 * the affected keys on that instance, and every entry expires within its TTL anyway, so an admin's change reaches
 * the phones within a minute. Bounded, so memory stays flat.
 */
const MAX_ENTRIES = 2000
const store = new Map<string, { at: number; ttl: number; value: Promise<unknown> }>()

export function memo<T>(key: string, ttlMs: number, load: () => Promise<T>): Promise<T> {
  const hit = store.get(key)
  if (hit && Date.now() - hit.at < hit.ttl) return hit.value as Promise<T>
  const value = load()
  store.set(key, { at: Date.now(), ttl: ttlMs, value })
  // A failed load is not kept.
  value.catch(() => store.get(key)?.value === value && store.delete(key))
  if (store.size > MAX_ENTRIES) store.delete(store.keys().next().value!)
  return value
}

/** Forget every entry whose key starts with one of the prefixes. */
export function bust(...prefixes: string[]) {
  for (const key of store.keys()) if (prefixes.some((p) => key.startsWith(p))) store.delete(key)
}

/** Cache lifetimes (milliseconds). */
export const TTL = {
  settings: 60_000,
  stats: 30_000,
  setup: 60_000,
  person: 20_000,
} as const
