import 'server-only'

import type { Application, BiomassCollection, File as FileRow, Mixing, Packaging } from '@/payload-types'
import { FieldError, type FieldContext } from './auth'
import { all, atSite, claimFiles, emptyPage, isoOr, lat, lng, mediaIds, PAGE_SIZE, qty, siteNetwork, siteOf, text, type Page } from './common'
import { applicationToApp, collectionToApp, mixingToApp, packagingToApp } from './map'
import { bust } from './cache'
import { siteStats } from './stats'

/**
 * Biomass collections, mixings, packagings and applications as records of their own — what the Classic app
 * lists on its Biomass Collection, Mixing & Packing and Distribution tabs. They are the same Neon records the
 * step-by-step app creates through its batches, so both apps and the admin see one set of data.
 */

export type RecordKind = 'collections' | 'mixings' | 'packagings' | 'applications'
const COLLECTION = { collections: 'biomass-collections', mixings: 'mixings', packagings: 'packagings', applications: 'applications' } as const
export const isRecordKind = (k: string): k is RecordKind => Object.hasOwn(COLLECTION, k)

async function filesFor(ctx: FieldContext, collection: string, ids: string[]) {
  if (!ids.length) return new Map<string, FileRow[]>()
  const files = (
    await ctx.payload.find({
      collection: 'files',
      where: { and: [{ ownerCollection: { equals: collection } }, { ownerId: { in: ids } }, { status: { equals: 'stored' } }] },
      ...all,
      pagination: false,
      sort: 'createdAt',
      select: { mimeType: true, ownerId: true, category: true },
    })
  ).docs as FileRow[]
  const by = new Map<string, FileRow[]>()
  for (const f of files) by.set(String(f.ownerId), [...(by.get(String(f.ownerId)) ?? []), f])
  return by
}

/** GET page/<kind> — a page of the current site's records, newest first. */
export async function recordPage(ctx: FieldContext, kind: RecordKind, page = 1, limit = PAGE_SIZE, filter?: string | null): Promise<Page<unknown>> {
  if (!ctx.siteId) return emptyPage()
  const collection = COLLECTION[kind]
  const where = kind === 'applications' && (filter === 'application' || filter === 'distribution')
    ? { and: [atSite(ctx), filter === 'distribution' ? { kind: { equals: 'distribution' } } : { kind: { not_equals: 'distribution' } }] }
    : atSite(ctx)
  const res = (await ctx.payload.find({ collection, where, sort: '-date', page, limit, ...all })) as unknown as { docs: { id: string }[]; page?: number; hasNextPage: boolean; totalDocs: number }
  const files = await filesFor(ctx, collection, res.docs.map((d) => String(d.id)))
  const map = (d: unknown) => {
    const id = String((d as { id: string }).id)
    const f = files.get(id) ?? []
    switch (kind) {
      case 'collections':
        return collectionToApp(d as BiomassCollection, f)
      case 'mixings':
        return mixingToApp(d as Mixing, f)
      case 'packagings':
        return packagingToApp(d as Packaging, f)
      case 'applications':
        return applicationToApp(d as Application, f)
    }
  }
  return { items: res.docs.map(map), page: res.page ?? page, hasMore: res.hasNextPage, total: res.totalDocs }
}

async function attach(ctx: FieldContext, collection: string, id: string, slot: string, body: { photos?: unknown; videos?: unknown }) {
  await claimFiles(ctx, mediaIds(body.photos), collection, id, `field:${slot}`)
  await claimFiles(ctx, mediaIds(body.videos), collection, id, `field:${slot}Video`)
}

/**
 * The phone gives each record its own id (`clientId`). A record sent again — because the reply was lost — is
 * found by that id and not stored twice.
 */
async function already(ctx: FieldContext, collection: (typeof COLLECTION)[RecordKind], body: Record<string, unknown>) {
  const clientId = text(body.clientId, 40)
  if (!clientId) return null
  const found = (await ctx.payload.find({ collection, where: { 'raw.clientId': { equals: clientId } } as never, limit: 1, ...all, select: { site: true } as never })).docs[0] as { id: string } | undefined
  return found ? { ok: true as const, id: found.id, duplicate: true } : null
}
const rawOf = (body: Record<string, unknown>) => ({ clientId: text(body.clientId, 40) || null, source: 'field-app' })

const required = (v: string, what: string) => {
  if (!v) throw new FieldError(400, `Please enter ${what}.`)
  return v
}

async function minPhotos(ctx: FieldContext, body: { photos?: unknown }, need: number) {
  if (mediaIds(body.photos).length < need) throw new FieldError(400, `Add at least ${need} photo${need === 1 ? '' : 's'}.`)
}

/** POST collections — biomass brought to the site. */
export async function createCollection(ctx: FieldContext, body: Record<string, unknown>, photosNeeded: number) {
  const dup = await already(ctx, 'biomass-collections', body)
  if (dup) return dup
  const siteId = siteOf(ctx, body)
  const { network } = await siteNetwork(ctx, siteId)
  const source = required(text(body.source, 120), 'the biomass source')
  const feedstock = required(text(body.feedstock, 120), 'the biomass type')
  const amount = qty(body.qty, body.unit === 'ton' ? 10_000 : 10_000_000)
  if (!amount) throw new FieldError(400, 'Please enter the biomass quantity.')
  await minPhotos(ctx, body, photosNeeded)
  const kg = Math.round(amount * (body.unit === 'ton' ? 1000 : 1))
  const vehicleName = text(body.vehicle, 120)
  const [sourceRow, vehicleRow] = await Promise.all([
    ctx.payload.find({ collection: 'biomass-sources', where: { and: [{ name: { equals: source } }, { or: [{ site: { equals: siteId } }, { network: { equals: network } }] }] }, limit: 1, ...all }),
    vehicleName ? ctx.payload.find({ collection: 'vehicles', where: { and: [{ or: [{ name: { equals: vehicleName } }, { plate: { equals: vehicleName } }] }, { or: [{ site: { equals: siteId } }, { network: { equals: network } }] }] }, limit: 1, ...all }) : null,
  ])
  const farmer = await ctx.payload.find({ collection: 'people', where: { and: [{ role: { equals: 'farmer' } }, { name: { equals: source } }, { sites: { in: [siteId] } }] }, limit: 1, ...all })
  const doc = await ctx.payload.create({
    collection: 'biomass-collections',
    data: {
      date: isoOr(body.date),
      network,
      site: siteId,
      source,
      biomassSource: sourceRow.docs[0]?.id ?? null,
      farmer: farmer.docs[0]?.id ?? null,
      feedstock,
      quantityKg: kg,
      transport: body.transport === 'Vehicle' ? 'vehicle' : 'manual',
      vehicle: vehicleRow?.docs[0]?.id ?? null,
      vehicleDetails: vehicleName || null,
      raw: rawOf(body),
    },
    ...all,
  })
  await attach(ctx, 'biomass-collections', doc.id, 'bphoto', body)
  return { ok: true, id: doc.id }
}

/** POST mixings — biochar mixed with compost/manure, from the site's approved biochar. */
export async function createMixing(ctx: FieldContext, body: Record<string, unknown>, photosNeeded: number) {
  const dup = await already(ctx, 'mixings', body)
  if (dup) return dup
  const siteId = siteOf(ctx, body)
  const { network } = await siteNetwork(ctx, siteId)
  const mixType = required(text(body.mixType, 120), 'the mix type')
  const biocharL = qty(body.biocharL)
  if (!biocharL || biocharL <= 0) throw new FieldError(400, 'Please enter how much biochar was used.')
  // The record's own site (it may differ from the one selected now), read fresh: the cached totals may be stale.
  bust(`stats:${siteId}`)
  const stats = await siteStats({ ...ctx, siteId })
  if (biocharL > stats.available.biocharL + 0.001) throw new FieldError(400, `Only ${Math.floor(stats.available.biocharL)} L of approved biochar is available.`)
  await minPhotos(ctx, body, photosNeeded)
  const otherKg = qty(body.otherKg) ?? 0
  const doc = await ctx.payload.create({
    collection: 'mixings',
    data: {
      date: isoOr(body.date),
      network,
      site: siteId,
      mixingType: mixType,
      feedstock: text(body.feedstock, 120) || null,
      biocharL,
      otherMaterialKg: otherKg,
      totalKg: qty(body.totalKg) ?? null,
      description: text(body.note, 500) || null,
      raw: rawOf(body),
    },
    ...all,
  })
  await attach(ctx, 'mixings', doc.id, 'mixPh', body)
  return { ok: true, id: doc.id }
}

/** POST packagings — biochar (on its own or mixed) packed into bags. */
export async function createPackaging(ctx: FieldContext, body: Record<string, unknown>, photosNeeded: number) {
  const dup = await already(ctx, 'packagings', body)
  if (dup) return dup
  const siteId = siteOf(ctx, body)
  const { network } = await siteNetwork(ctx, siteId)
  const packagingType = required(text(body.packagingType, 120), 'what is packed')
  const bag = required(text(body.bag, 120), 'the bag type')
  const bags = qty(body.bags, 100_000)
  if (!bags) throw new FieldError(400, 'Please enter the number of bags.')
  await minPhotos(ctx, body, photosNeeded)
  const kg = qty(body.quantityKg)
  const onlyBiochar = /biochar[\s-]*only/i.test(packagingType)
  const doc = await ctx.payload.create({
    collection: 'packagings',
    data: {
      date: isoOr(body.date),
      network,
      site: siteId,
      packagingType,
      bagDetails: bag,
      bagsCreated: bags,
      bagsRemaining: bags,
      bagsDistributed: 0,
      biocharKg: onlyBiochar ? kg : null,
      mixKg: onlyBiochar ? null : kg,
      description: text(body.note, 500) || null,
      raw: rawOf(body),
    },
    ...all,
  })
  await attach(ctx, 'packagings', doc.id, 'packPh', body)
  return { ok: true, id: doc.id }
}

/** POST applications — biochar put on a field (application) or handed to a farmer/buyer (distribution). */
export async function createApplication(ctx: FieldContext, body: Record<string, unknown>, photosNeeded: number, canApplyOpen: boolean) {
  const dup = await already(ctx, 'applications', body)
  if (dup) return dup
  const siteId = siteOf(ctx, body)
  const { network } = await siteNetwork(ctx, siteId)
  const recipient = required(text(body.recipient, 120), 'who receives the biochar')
  const mixType = required(text(body.mixType, 120), 'the product')
  if (!canApplyOpen && /biochar[\s-]*only|^open$/i.test(mixType)) throw new FieldError(400, 'Open (unmixed) biochar cannot be applied in this network.')
  const quantity = qty(body.quantity)
  const bags = qty(body.bags, 100_000)
  if (!(quantity && quantity > 0) && !(bags && bags > 0)) throw new FieldError(400, 'Please enter the quantity or the number of bags.')
  await minPhotos(ctx, body, photosNeeded)
  const kind = body.kind === 'distribution' ? 'distribution' : 'application'
  const doc = await ctx.payload.create({
    collection: 'applications',
    data: {
      date: isoOr(body.date),
      network,
      site: siteId,
      kind,
      recipientName: recipient,
      recipientPhone: text(body.phone, 40) || null,
      recipientAddress: text(body.address, 200) || null,
      lat: lat(body.lat),
      lng: lng(body.lng),
      mixTypes: [mixType],
      quantity,
      quantityUnit: quantity ? text(body.unit, 10) || 'kg' : null,
      bags,
      bagType: text(body.bagType, 120) || null,
      mode: body.mode === 'Vehicle' ? 'vehicle' : 'manual',
      vehicle: text(body.vehicle, 120) || null,
      open: /biochar[\s-]*only|^open$/i.test(mixType),
      raw: rawOf(body),
    },
    ...all,
  })
  // Bags handed out leave the packed stock.
  if (bags && text(body.bagType)) {
    const pack = (await ctx.payload.find({ collection: 'packagings', where: { and: [atSite({ ...ctx, siteId }), { bagDetails: { equals: text(body.bagType) } }, { bagsRemaining: { greater_than: 0 } }] }, sort: 'date', limit: 20, ...all })).docs
    let left = bags
    for (const p of pack) {
      if (left <= 0) break
      const take = Math.min(left, Number(p.bagsRemaining) || 0)
      left -= take
      await ctx.payload.update({ collection: 'packagings', id: p.id, data: { bagsRemaining: (Number(p.bagsRemaining) || 0) - take, bagsDistributed: (Number(p.bagsDistributed) || 0) + take }, ...all })
    }
  }
  await attach(ctx, 'applications', doc.id, 'applyPh', body)
  return { ok: true, id: doc.id }
}
