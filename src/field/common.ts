import 'server-only'

import type { Where } from 'payload'

import { FieldError, type FieldContext } from './auth'

/** Every field-API read and write runs as the server (access is checked in auth.ts and per handler). */
export const all = { depth: 0, overrideAccess: true } as const

/** Default page size of every list the app pages through. */
export const PAGE_SIZE = 30
/**
 * Largest photo/video the app may upload. The app resizes photos before sending; videos are recorded at a modest
 * bitrate. Both stay well under the host's request limit (Cloud Run: 32 MB).
 */
export const UPLOAD_LIMITS = { photo: 10 * 1024 * 1024, video: 30 * 1024 * 1024 } as const
/** Latitude/longitude that make sense. */
export const lat = (v: unknown) => {
  const n = num(v)
  return n != null && n >= -90 && n <= 90 ? n : null
}
export const lng = (v: unknown) => {
  const n = num(v)
  return n != null && n >= -180 && n <= 180 ? n : null
}
/** A quantity the field could really record (no negative or absurd numbers). */
export const qty = (v: unknown, max = 1_000_000) => {
  const n = num(v)
  return n != null && n >= 0 && n <= max ? n : null
}

export const text = (v: unknown, max = 200) => (typeof v === 'string' ? v.trim().slice(0, max) : '')

export const num = (v: unknown): number | null => {
  const n = parseFloat(String(v ?? ''))
  return Number.isFinite(n) ? n : null
}

/** A page of a list: the app asks for the next page while `hasMore` is true. */
export interface Page<T> {
  items: T[]
  page: number
  hasMore: boolean
  total: number
}

export const pageParam = (v: string | null | undefined) => Math.max(1, Math.min(10_000, Number(v) || 1))
export const limitParam = (v: string | null | undefined) => Math.max(1, Math.min(100, Number(v) || PAGE_SIZE))

export function toPage<D, T>(res: { docs: D[]; page?: number; hasNextPage: boolean; totalDocs: number }, map: (d: D) => T): Page<T> {
  return { items: res.docs.map(map), page: res.page ?? 1, hasMore: res.hasNextPage, total: res.totalDocs }
}

export const emptyPage = <T>(): Page<T> => ({ items: [], page: 1, hasMore: false, total: 0 })

/** The site this request works on: the one the app selected (if it is theirs), else their first. */
export function requireSite(ctx: FieldContext) {
  if (!ctx.siteId) throw new FieldError(409, 'You are not assigned to a site yet. Ask your admin.', 'no_site')
  return ctx.siteId
}

/** The site a write goes to: the one the work was started at (if it is theirs), else the current one. */
export function siteOf(ctx: FieldContext, body: { siteId?: unknown } | null | undefined) {
  const wanted = body?.siteId
  return typeof wanted === 'string' && ctx.siteIds.includes(wanted) ? wanted : requireSite(ctx)
}

/** Records at the current site. */
export const atSite = (ctx: FieldContext): Where => ({ site: { equals: ctx.siteId ?? '-' } })

export async function siteNetwork(ctx: FieldContext, siteId: string) {
  const site = await ctx.payload.findByID({ collection: 'sites', id: siteId, ...all, select: { network: true, name: true } })
  const network = site.network ? String(typeof site.network === 'object' ? site.network.id : site.network) : ''
  if (!network) throw new FieldError(409, 'This site has no network.')
  return { site, network }
}

/** File ids from the app's media items ({ remoteId }) — only ones already uploaded. */
export const mediaIds = (v: unknown): string[] =>
  Array.isArray(v) ? v.map((m) => (m && typeof m === 'object' ? (m as { remoteId?: unknown }).remoteId : m)).filter((x): x is string => typeof x === 'string' && /^[\w-]{1,64}$/.test(x)) : []

/**
 * Attach the person's fresh uploads to a record. Only files they uploaded and that nothing else owns yet can be
 * claimed, so nobody can pull someone else's evidence into their record.
 */
export async function claimFiles(ctx: FieldContext, ids: string[], ownerCollection: string, ownerId: string, category: string) {
  if (!ids.length) return
  await ctx.payload.update({
    collection: 'files',
    where: { and: [{ id: { in: ids } }, { ownerCollection: { equals: 'people' } }, { ownerId: { equals: ctx.person.id } }] },
    data: { ownerCollection, ownerId, category },
    ...all,
  })
}

export const isoOr = (v: unknown, fallback = new Date().toISOString()) => {
  if (typeof v === 'number' && Number.isFinite(v)) return new Date(v).toISOString()
  if (typeof v === 'string' && !Number.isNaN(Date.parse(v))) return new Date(v).toISOString()
  return fallback
}
