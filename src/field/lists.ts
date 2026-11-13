import 'server-only'

import type { Where } from 'payload'

import type { Person } from '@/payload-types'
import { FieldError, relId, relIds, type FieldContext } from './auth'
import { memo, TTL } from './cache'
import { cleanDimensions, isShape, volumeLitresMm, type ShapeKind } from '@/lib/shape-volume'
import { all, claimFiles, emptyPage, lat, lng, mediaIds, num, PAGE_SIZE, qty, requireSite, siteNetwork, text, type Page } from './common'
import { ddmmyyyy } from './map'

/* ------------------------------------------------------------------ */
/* Site setup lists                                                     */
/* ------------------------------------------------------------------ */

export type Item = { id: string; name: string; sub: string; pending?: boolean }
export const SETUP_KEYS = ['kilns', 'sources', 'farmers', 'vehicles', 'bioref', 'measure', 'sample', 'bags', 'crops', 'buyers'] as const
export type SetupKey = (typeof SETUP_KEYS)[number]
export const isSetupKey = (k: string): k is SetupKey => (SETUP_KEYS as readonly string[]).includes(k)

export interface FeedstockInfo {
  name: string
  /** kg/m³ — the network's lab reference where it has one, else the feedstock's. */
  bulkDensity: number | null
  /** % of dry biochar mass. */
  carbonContent: number | null
  /** Estimated credits (t CO₂e) per litre of biochar, for showing an estimate before an assessor's figure. */
  creditsPerL: number | null
}

/** One page of a setup list for the current site (cached briefly; a change through the app clears it). */
export const setupPage = (ctx: FieldContext, key: SetupKey, page = 1, limit = 100, feedstocks: FeedstockInfo[] = []): Promise<Page<Item>> =>
  key === 'bioref' ? loadSetupPage(ctx, key, page, limit, feedstocks) : memo(`setup:${ctx.siteId ?? '-'}:${key}:${page}:${limit}`, TTL.setup, () => loadSetupPage(ctx, key, page, limit))

async function loadSetupPage(ctx: FieldContext, key: SetupKey, page = 1, limit = 100, feedstocks: FeedstockInfo[] = []): Promise<Page<Item>> {
  const { payload, siteId, networkIds } = ctx
  if (!siteId) return emptyPage()
  const atSite: Where = { site: { equals: siteId } }
  const atSiteOrNet: Where = { or: [{ site: { equals: siteId } }, { network: { in: networkIds } }] }
  const q = { ...all, page, limit, sort: 'name' } as const
  switch (key) {
    case 'kilns': {
      const r = await payload.find({ collection: 'kilns', where: { and: [atSite, { active: { equals: true } }] }, ...q, select: { name: true, type: true, volumeM3: true } })
      return pageOf(r, (k) => ({ id: k.id, name: k.name, sub: [k.type === 'pit' ? 'Pit' : 'Kon-Tiki', k.volumeM3 ? `${Math.round(k.volumeM3 * 1000)} L` : ''].filter(Boolean).join(' · ') }))
    }
    case 'sources': {
      const r = await payload.find({ collection: 'biomass-sources', where: { and: [atSiteOrNet, { active: { equals: true } }] }, ...q, select: { name: true, address: true } })
      return pageOf(r, (s) => ({ id: s.id, name: s.name, sub: s.address ?? '' }))
    }
    case 'farmers': {
      const r = await payload.find({
        collection: 'people',
        where: { and: [{ role: { equals: 'farmer' } }, { active: { equals: true } }, { or: [{ sites: { in: [siteId] } }, { networks: { in: networkIds } }] }] },
        ...q,
        select: { name: true, phone: true },
      })
      return pageOf(r, (p) => ({ id: p.id, name: p.name, sub: p.phone ?? '' }))
    }
    case 'vehicles': {
      const r = await payload.find({ collection: 'vehicles', where: atSiteOrNet, ...q, sort: 'plate', select: { name: true, plate: true, type: true } })
      return pageOf(r, (x) => ({ id: x.id, name: x.name || x.type || 'Vehicle', sub: x.plate }))
    }
    case 'measure':
    case 'sample': {
      const r = await payload.find({ collection: 'containers', where: { and: [atSite, { kind: { equals: key === 'measure' ? 'measuring' : 'sampling' } }] }, ...q, sort: 'code', select: { name: true, code: true, volumeL: true } })
      return pageOf(r, (c) => ({ id: c.id, name: c.name || c.code || 'Container', sub: c.volumeL ? `${c.volumeL} L` : '' }))
    }
    case 'bioref': {
      const start = (page - 1) * limit
      const items = feedstocks.slice(start, start + limit).map((f) => ({ id: `feedstock:${f.name}`, name: f.name, sub: f.bulkDensity ? `${f.bulkDensity} kg/m³` : '' }))
      return { items, page, hasMore: start + limit < feedstocks.length, total: feedstocks.length }
    }
    default: {
      const r = await payload.find({ collection: 'site-lists', where: { and: [atSite, { category: { equals: key } }] }, ...q })
      return pageOf(r, (l) => ({ id: l.id, name: l.name, sub: l.detail ?? '' }))
    }
  }
}

const pageOf = <D, T>(r: { docs: D[]; page?: number; hasNextPage: boolean; totalDocs: number }, map: (d: D) => T): Page<T> => ({
  items: r.docs.map(map),
  page: r.page ?? 1,
  hasMore: r.hasNextPage,
  total: r.totalDocs,
})

/** Kilns asked for at the current site that an admin has not decided on yet. */
export async function kilnRequests(ctx: FieldContext): Promise<Item[]> {
  if (!ctx.siteId) return []
  const rows = await ctx.payload.find({ collection: 'alerts', where: { and: [{ kind: { equals: 'kiln' } }, { status: { equals: 'open' } }] }, ...all, limit: 100, sort: '-createdAt' })
  return rows.docs
    .map((a) => ({ a, r: a.request as { kiln?: string; volumeL?: number | null; siteId?: string } | null }))
    .filter(({ r }) => r?.kiln && r.siteId === ctx.siteId)
    .map(({ a, r }) => ({ id: `request:${a.id}`, name: r!.kiln!, sub: r!.volumeL ? `${r!.volumeL} L` : '', pending: true }))
}

/** Structured details the app sends with a new item (all optional, so older app versions keep working). */
export interface SetupDetails {
  /** Kilns: kontiki | pit. */
  kilnType?: unknown
  /** Kilns and containers: shape and dimensions in millimetres (see lib/shape-volume). */
  shape?: unknown
  dimensions?: unknown
  /** Biomass sources: where it is. */
  lat?: unknown
  lng?: unknown
  /** Packaging bags. */
  bagType?: unknown
  measure?: unknown
  capacity?: unknown
}

const BAG_MEASURES = ['weight', 'volume'] as const
const KILN_TYPES = ['kontiki', 'pit'] as const
const litres = (l: number | null) => (l == null ? null : l >= 100 ? Math.round(l) : +l.toFixed(1))

/**
 * POST setup/<key> — add to a site list. A kiln and a biomass reference (bulk density) are requests the admin
 * approves in the Action Center; the other lists change straight away. Kilns and containers come with their shape,
 * dimensions and a photo of the measuring (the volume is worked out here); sources with their location; bags with
 * their type and capacity.
 */
export async function addSetupItem(ctx: FieldContext, key: string, body: { name?: string; sub?: string; details?: SetupDetails; photoIds?: unknown }) {
  if (!isSetupKey(key)) throw new FieldError(404, 'Unknown list.')
  const name = text(body.name, 120)
  if (!name) throw new FieldError(400, 'Please enter a name.')
  const sub = text(body.sub, 120)
  const d: SetupDetails = body.details && typeof body.details === 'object' ? body.details : {}
  const photos = mediaIds(body.photoIds).slice(0, 5)
  const siteId = requireSite(ctx)
  const { network, site } = await siteNetwork(ctx, siteId)
  const { payload } = ctx
  const subNum = num(sub)

  // Shape → dimensions (mm) → volume. A shape with incomplete dimensions is refused rather than stored half-done.
  const measured = (kind: ShapeKind) => {
    if (d.shape == null || d.shape === '') return null
    if (!isShape(kind, d.shape)) throw new FieldError(400, 'Unknown shape.')
    const dimensions = cleanDimensions(kind, d.shape, d.dimensions)
    if (!dimensions) throw new FieldError(400, 'Please enter every dimension.')
    const volumeL = volumeLitresMm(kind, d.shape, dimensions)
    if (!volumeL) throw new FieldError(400, 'Please enter every dimension.')
    return { shape: d.shape, dimensions, volumeL: litres(volumeL)! }
  }

  let id: string
  let shown = sub
  switch (key) {
    case 'kilns': {
      const m = measured('kiln')
      const kilnType = (KILN_TYPES as readonly string[]).includes(String(d.kilnType)) ? (d.kilnType as (typeof KILN_TYPES)[number]) : 'kontiki'
      const volumeL = m?.volumeL ?? subNum
      const a = await payload.create({
        collection: 'alerts',
        data: {
          kind: 'kiln',
          message: `${ctx.person.name} asks to add kiln "${name}" at ${site.name}`,
          network,
          status: 'open',
          request: { kiln: name, volumeL, siteId, site: site.name, by: ctx.person.name, kilnType, shape: m?.shape ?? null, dimensions: m?.dimensions ?? null, photoIds: photos },
        },
        ...all,
      })
      // The measuring photo stays with the request until the admin decides; approving moves it to the kiln.
      await claimFiles(ctx, photos, 'alerts', a.id, 'kiln')
      return { item: { id: `request:${a.id}`, name, sub: [kilnType === 'pit' ? 'Pit' : 'Kon-Tiki', volumeL ? `${volumeL} L` : ''].filter(Boolean).join(' · '), pending: true } }
    }
    case 'bioref': {
      if (!subNum || subNum <= 0) throw new FieldError(400, 'Please enter the bulk density (kg/m³).')
      const a = await payload.create({
        collection: 'alerts',
        data: { kind: 'bulk-density', message: `Bulk density change requested for ${name} at ${site.name}`, network, status: 'open', request: { feedstock: name, bulkDensity: subNum, by: ctx.person.name } },
        ...all,
      })
      return { item: { id: `request:${a.id}`, name, sub: `${subNum} kg/m³`, pending: true } }
    }
    case 'sources':
      id = (await payload.create({ collection: 'biomass-sources', data: { site: siteId, network, name, address: sub || null, lat: lat(d.lat), lng: lng(d.lng) } as never, ...all })).id
      break
    case 'farmers': {
      const net = await payload.findByID({ collection: 'networks', id: network, ...all, select: { organization: true } })
      id = (await payload.create({ collection: 'people', data: { name, role: 'farmer', phone: sub || null, sites: [siteId], networks: [network], organization: relId(net.organization), appAccess: false } as never, ...all })).id
      break
    }
    case 'vehicles':
      id = (await payload.create({ collection: 'vehicles', data: { site: siteId, network, name, plate: sub || '—' } as never, ...all })).id
      break
    case 'measure':
    case 'sample': {
      const m = measured('container')
      const volumeL = m?.volumeL ?? subNum
      id = (
        await payload.create({
          collection: 'containers',
          data: { kind: key === 'measure' ? 'measuring' : 'sampling', site: siteId, network, name, volumeL, shape: m?.shape ?? null, dimensions: m?.dimensions ?? null, addedAt: new Date().toISOString() } as never,
          ...all,
        })
      ).id
      await claimFiles(ctx, photos, 'containers', id, key === 'measure' ? 'measuring_container' : 'sampling_container')
      shown = volumeL ? `${volumeL} L` : ''
      break
    }
    case 'bags': {
      const measure = (BAG_MEASURES as readonly string[]).includes(String(d.measure)) ? String(d.measure) : 'weight'
      const capacity = qty(d.capacity ?? sub, 100_000)
      const unit = measure === 'volume' ? 'L' : 'kg'
      const bagType = text(d.bagType, 60)
      const detail = [capacity ? `${capacity} ${unit}` : '', bagType].filter(Boolean).join(' · ') || sub
      id = (
        await payload.create({
          collection: 'site-lists',
          data: { site: siteId, category: key, name, detail: detail || null, data: { bagType: bagType || null, measure, capacity, unit }, createdBy: ctx.person.id } as never,
          ...all,
        })
      ).id
      await claimFiles(ctx, photos, 'site-lists', id, 'packaging')
      shown = detail
      break
    }
    default:
      id = (await payload.create({ collection: 'site-lists', data: { site: siteId, category: key, name, detail: sub || null, createdBy: ctx.person.id } as never, ...all })).id
  }
  return { item: { id, name, sub: shown } }
}

/** DELETE setup/<key>/<id> — remove from a site list. Kilns, sources and farmers are switched off (batches still refer to them). */
export async function removeSetupItem(ctx: FieldContext, key: string, id: string) {
  if (!isSetupKey(key) || key === 'bioref') throw new FieldError(403, 'This list cannot be changed here.')
  if (id.startsWith('request:')) throw new FieldError(409, 'This request is waiting for your admin.')
  const coll = ({ kilns: 'kilns', sources: 'biomass-sources', farmers: 'people', vehicles: 'vehicles', measure: 'containers', sample: 'containers', bags: 'site-lists', crops: 'site-lists', buyers: 'site-lists' } as const)[key]
  const row = (await ctx.payload.findByID({ collection: coll, id, ...all }).catch(() => null)) as { site?: unknown; sites?: unknown; role?: string } | null
  // `farmers` lists people: only a farmer may be switched off here, never a colleague's login.
  if (!row || (coll === 'people' && row.role !== 'farmer')) throw new FieldError(404, 'Not found.')
  const atMySite = ctx.siteIds.includes(relId(row.site) ?? '') || relIds(row.sites).some((s) => ctx.siteIds.includes(s))
  if (!atMySite) throw new FieldError(404, 'Not found.')
  if (coll === 'kilns' || coll === 'biomass-sources' || coll === 'people') await ctx.payload.update({ collection: coll, id, data: { active: false } as never, ...all })
  else await ctx.payload.delete({ collection: coll, id, ...all })
  return { ok: true }
}

/* ------------------------------------------------------------------ */
/* Supervisors                                                          */
/* ------------------------------------------------------------------ */

export async function supervisorPage(ctx: FieldContext, page = 1, limit = PAGE_SIZE) {
  const { payload, person, siteId, networkIds } = ctx
  const r = await payload.find({
    collection: 'people',
    where: {
      and: [
        { role: { in: ['supervisor', 'manager'] } },
        { active: { equals: true } },
        { id: { not_equals: person.id } },
        { or: [{ sites: { in: [siteId ?? '-'] } }, { networks: { in: networkIds.length ? networkIds : ['-'] } }] },
      ],
    },
    ...all,
    page,
    limit,
    sort: 'name',
    select: { name: true, phone: true, role: true, photo: true },
  })
  return pageOf(r, (p: Pick<Person, 'id' | 'name' | 'phone' | 'role'>) => ({ id: p.id, name: p.name, role: p.role === 'manager' ? 'Manager' : 'Supervisor', phone: p.phone ?? '' }))
}

/* ------------------------------------------------------------------ */
/* Credits                                                              */
/* ------------------------------------------------------------------ */

export interface HistoryEntry {
  kind: 'earned' | 'sold' | 'requested' | 'declined'
  title: string
  date: string
  amount: number
}

/**
 * The person's credits: batches the admin approved (recorded under them), and their sell requests.
 * Plain English titles: the app translates its own labels, not the data.
 */
export async function loadCredits(ctx: FieldContext, page = 1, limit = PAGE_SIZE) {
  const { payload, person, siteIds } = ctx
  const name = person.name.trim().toLowerCase()
  const [approved, requests] = await Promise.all([
    siteIds.length
      ? payload.find({
          collection: 'batches',
          where: { and: [{ site: { in: siteIds } }, { status: { equals: 'admin_approved' } }, { or: [{ operator: { equals: person.id } }, { operatorName: { like: person.name } }] }] },
          ...all,
          pagination: false,
          sort: '-assessedAt',
          select: { code: true, feedstock: true, csinkT: true, assessedAt: true, date: true, operator: true, operatorName: true },
        })
      : null,
    payload.find({ collection: 'sell-requests', where: { person: { equals: person.id } }, ...all, pagination: false, sort: '-createdAt' }),
  ])
  // `like` matches words; credits only count batches recorded under exactly this person.
  const mine = (approved?.docs ?? []).filter((b) => relId(b.operator) === person.id || (b.operatorName ?? '').trim().toLowerCase() === name)
  const earned = mine.reduce((a, b) => a + (num(b.csinkT) ?? 0), 0)
  const sold = requests.docs.filter((r) => r.status === 'paid').reduce((a, r) => a + r.creditsT, 0)
  const pending = requests.docs.filter((r) => r.status === 'pending').reduce((a, r) => a + r.creditsT, 0)
  const all_ = [
    ...mine.map((b) => ({ at: b.assessedAt ?? b.date, e: { kind: 'earned' as const, title: `${b.feedstock || 'Biochar'} batch approved · ${b.code}`, date: ddmmyyyy(b.assessedAt ?? b.date), amount: +(num(b.csinkT) ?? 0).toFixed(3) } })),
    ...requests.docs.map((r) => ({
      at: r.decidedAt ?? r.createdAt,
      e: {
        kind: (r.status === 'paid' ? 'sold' : r.status === 'pending' ? 'requested' : 'declined') as HistoryEntry['kind'],
        title: r.status === 'paid' ? `Sold${r.buyer ? ` to ${r.buyer}` : ''}` : r.status === 'pending' ? `Sell request sent (${r.creditsT} credits)` : 'Sell request declined',
        date: ddmmyyyy(r.decidedAt ?? r.createdAt),
        amount: r.status === 'paid' ? -r.creditsT : 0,
      },
    })),
  ].sort((a, b) => String(b.at).localeCompare(String(a.at)))
  const start = (page - 1) * limit
  return {
    credits: { earned: +earned.toFixed(3), sold: +sold.toFixed(3), pending: +pending.toFixed(3) },
    history: { items: all_.slice(start, start + limit).map((x) => x.e), page, hasMore: start + limit < all_.length, total: all_.length } as Page<HistoryEntry>,
  }
}

/** POST sell-requests — ask to sell all unsold credits. An admin settles it. */
export async function createSellRequest(ctx: FieldContext) {
  // One request at a time: a repeated tap or a resent request does not ask twice.
  const open = await ctx.payload.find({ collection: 'sell-requests', where: { and: [{ person: { equals: ctx.person.id } }, { status: { equals: 'pending' } }] }, limit: 1, ...all })
  if (open.docs.length) throw new FieldError(409, 'Your sell request is already with the admin.', 'duplicate')
  const { credits } = await loadCredits(ctx)
  const available = +(credits.earned - credits.sold - credits.pending).toFixed(3)
  if (available <= 0) throw new FieldError(409, 'There are no unsold credits to sell yet.')
  const siteId = ctx.siteId ?? undefined
  const network = siteId ? (await siteNetwork(ctx, siteId)).network : undefined
  const company = await ctx.payload.findGlobal({ slug: 'company', ...all })
  const buyer = ((company.profile ?? {}) as { defaultBuyer?: string }).defaultBuyer ?? null
  await ctx.payload.create({ collection: 'sell-requests', data: { person: ctx.person.id, network, site: siteId, creditsT: available, buyer, status: 'pending' } as never, ...all })
  return { ok: true, creditsT: available }
}
