import 'server-only'

import type { Where } from 'payload'

import { REJECT_REASONS } from '@/dashboard/data/catalog'
import type { Batch, File as FileRow } from '@/payload-types'
import { FieldError, relId, relIds, type FieldContext } from './auth'
import { networkSettings } from './settings'
import { all, atSite, claimFiles, lat, lng, PAGE_SIZE, qty as amount, siteNetwork, siteOf, text, type Page } from './common'
import { appDateToIso, appState, batchToApp, estimateCsink, mediaBySlot, num, ownerOfSlot, workerStatus, type AppBatch, type AppState, type Related } from './map'

/* ------------------------------------------------------------------ */
/* Reading                                                              */
/* ------------------------------------------------------------------ */

/** Batches with everything the app shows for them (kiln name, linked records, stored photos/videos). */
async function withRelated(ctx: FieldContext, batches: Batch[]): Promise<AppBatch[]> {
  const { payload } = ctx
  if (!batches.length) return []
  const ids = batches.map((b) => b.id)
  const states = new Map(batches.map((b) => [b.id, appState(b)]))
  const pick = (k: 'collectionId' | 'applicationId' | 'packagingId') => [...states.values()].map((s) => s[k]).filter((x): x is string => !!x)
  const colIds = pick('collectionId'), appIds = pick('applicationId'), packIds = pick('packagingId')
  const kilnIds = [...new Set(batches.map((b) => relId(b.kiln)).filter((x): x is string => !!x))]

  const q = { ...all, pagination: false } as const
  const [kilns, mixings, collections, applications] = await Promise.all([
    kilnIds.length ? payload.find({ collection: 'kilns', where: { id: { in: kilnIds } }, ...q, select: { name: true } }) : null,
    payload.find({ collection: 'mixings', where: { batches: { in: ids } }, ...q, select: { raw: false } }),
    colIds.length ? payload.find({ collection: 'biomass-collections', where: { id: { in: colIds } }, ...q, select: { raw: false } }) : null,
    appIds.length ? payload.find({ collection: 'applications', where: { id: { in: appIds } }, ...q, select: { raw: false } }) : null,
  ])
  const kilnName = new Map((kilns?.docs ?? []).map((k) => [k.id, k.name]))
  const mixFor = new Map<string, (typeof mixings.docs)[number]>()
  for (const m of mixings.docs) for (const b of relIds(m.batches)) if (!mixFor.has(b)) mixFor.set(b, m)
  const colById = new Map((collections?.docs ?? []).map((c) => [c.id, c]))
  const appById = new Map((applications?.docs ?? []).map((a) => [a.id, a]))

  const owners: Where[] = [{ and: [{ ownerCollection: { equals: 'batches' } }, { ownerId: { in: ids } }] }]
  const add = (coll: string, list: string[]) => list.length && owners.push({ and: [{ ownerCollection: { equals: coll } }, { ownerId: { in: list } }] })
  add('biomass-collections', colIds)
  add('mixings', [...new Set([...mixFor.values()].map((m) => m.id))])
  add('packagings', packIds)
  add('applications', appIds)
  // Only stored files (migrated ones still waiting to be copied would not load).
  const files = (
    await payload.find({
      collection: 'files',
      where: { and: [{ or: owners }, { status: { equals: 'stored' } }] },
      ...q,
      select: { name: true, mimeType: true, category: true, ownerCollection: true, ownerId: true, createdAt: true },
    })
  ).docs as FileRow[]

  return batches.map((b) => {
    const st = states.get(b.id)!
    const mix = mixFor.get(b.id)
    const col = st.collectionId ? colById.get(st.collectionId) : undefined
    const app = st.applicationId ? appById.get(st.applicationId) : undefined
    const owned = (coll: string, id?: string) => (f: FileRow) => !!id && f.ownerCollection === coll && f.ownerId === id
    const mine = files.filter(
      (f) => owned('batches', b.id)(f) || owned('biomass-collections', col?.id)(f) || owned('mixings', mix?.id)(f) || owned('packagings', st.packagingId)(f) || owned('applications', app?.id)(f),
    )
    const related: Related = { kilnName: kilnName.get(relId(b.kiln) ?? ''), collection: col, mixing: mix as Related['mixing'], application: app as Related['application'], files: mine }
    return batchToApp(b, related)
  })
}

/** Which batches a list shows: waiting for review, still burning, finished burning, or already reviewed. */
export type BatchFilter = 'waiting' | 'ongoing' | 'completed' | 'reviewed'
const FILTER: Record<BatchFilter, Where> = {
  waiting: { status: { equals: 'not_assessed' } },
  ongoing: { status: { equals: 'started' } },
  completed: { status: { not_equals: 'started' } },
  reviewed: { status: { in: ['approved', 'rejected', 'admin_approved', 'admin_rejected'] } },
}
export const isBatchFilter = (f: string | null | undefined): f is BatchFilter => !!f && Object.hasOwn(FILTER, f)

/** A page of the current site's batches, newest first (optionally only one kind). */
export async function batchPage(ctx: FieldContext, page = 1, limit = PAGE_SIZE, filter?: BatchFilter): Promise<Page<AppBatch>> {
  if (!ctx.siteId) return { items: [], page: 1, hasMore: false, total: 0 }
  const where = filter ? { and: [atSite(ctx), FILTER[filter]] } : atSite(ctx)
  const res = await ctx.payload.find({ collection: 'batches', where, sort: '-date', page, limit, ...all })
  return { items: await withRelated(ctx, res.docs as Batch[]), page: res.page ?? page, hasMore: res.hasNextPage, total: res.totalDocs }
}

async function one(ctx: FieldContext, id: string) {
  const b = (await ctx.payload.findByID({ collection: 'batches', id, ...all })) as Batch
  return (await withRelated(ctx, [b]))[0]
}

async function batchByCode(ctx: FieldContext, code: string) {
  const found = (await ctx.payload.find({ collection: 'batches', where: { code: { equals: code } }, limit: 1, ...all })).docs[0] as Batch | undefined
  if (found && !ctx.siteIds.includes(relId(found.site) ?? '')) throw new FieldError(404, 'Batch not found.')
  return found
}

/* ------------------------------------------------------------------ */
/* Saving                                                               */
/* ------------------------------------------------------------------ */

/** A record at the site, chosen in the app by its name. */
async function byName(ctx: FieldContext, collection: 'kilns' | 'vehicles' | 'containers' | 'biomass-sources', siteId: string, name: string) {
  if (!name) return undefined
  const field: Where = collection === 'vehicles' ? { or: [{ name: { equals: name } }, { plate: { equals: name } }] } : { name: { equals: name } }
  const where: Where = collection === 'kilns' || collection === 'containers' ? { and: [{ site: { equals: siteId } }, field] } : { and: [{ or: [{ site: { equals: siteId } }, { site: { exists: false } }] }, field] }
  return (await ctx.payload.find({ collection, where, limit: 1, ...all })).docs[0] as { id: string } | undefined
}

/** Temperature readings from the app: `temp`, `temp2`, `temp3`… */
const tempsOf = (v: AppBatch['v']) =>
  Object.keys(v)
    .filter((k) => /^temp\d*$/.test(k))
    .sort((a, b) => (Number(a.slice(4)) || 1) - (Number(b.slice(4)) || 1))
    .map((k) => amount(v[k], 2000))
    .filter((x): x is number => x != null)

/**
 * PUT /api/field/batches/<code> — save the app's batch (create or update). Both app layouts save through here:
 * the step-by-step app sends the whole batch, the Classic app sends what its screen captured.
 * One batch is spread across the Neon collections the admin works with: the batch itself, plus the biomass
 * collection (Day 1, when a source is given), the mixing and packaging (Day 3) and the application (Day 4).
 */
export async function saveBatch(ctx: FieldContext, code: string, body: Partial<AppBatch> & { siteId?: string }) {
  const { payload, person, role } = ctx
  if (!/^[\w-]{1,40}$/.test(code)) throw new FieldError(400, 'Invalid batch id.')
  const v = (body.v ?? {}) as AppBatch['v']
  const existing = await batchByCode(ctx, code)
  const siteId = existing ? relId(existing.site)! : siteOf(ctx, body)
  const { network } = await siteNetwork(ctx, siteId)
  const prev = existing ? appState(existing) : {}

  const kilnRow = await byName(ctx, 'kilns', siteId, text(v.kiln))
  const kiln = kilnRow?.id ?? (existing ? relId(existing.kiln) : undefined)
  const sampleRow = await byName(ctx, 'containers', siteId, text(v.sample))

  const unit = v.unit === 'ton' ? 'ton' : 'kg'
  const qty = amount(v.qty, unit === 'ton' ? 10_000 : 10_000_000)
  const biomassKg = qty != null ? Math.round(qty * (unit === 'ton' ? 1000 : 1)) : existing?.biomassKg
  const biocharL = amount(v.litres) ?? existing?.biocharL ?? null
  const feedstock = text(v.btype) || existing?.feedstock || null
  const moist = Array.isArray(v.moist) ? (v.moist as { val?: string }[]).slice(0, 20).map((r) => amount(r?.val, 100)) : null
  const temps = tempsOf(v)

  // Credits: keep an assessor's figure; otherwise estimate from litres with the feedstock's lab values.
  let csinkT = existing?.csinkT ?? null
  let csinkEstimated = prev.csinkEstimated ?? false
  if (biocharL && feedstock && (csinkT == null || csinkEstimated)) {
    // The network's lab reference where it has one (as the app shows), else the feedstock's own values.
    const f = (await networkSettings(ctx)).feedstocks.find((x) => x.name === feedstock)
    const est = estimateCsink(biocharL, f?.bulkDensity, f?.carbonContent)
    if (est != null) {
      csinkT = est
      csinkEstimated = true
    }
  }

  const state: AppState = {
    ...prev,
    day: Math.max(1, Math.min(5, Number(body.day) || prev.day || 1)),
    step: Math.max(0, Number(body.step) || 0),
    unit,
    qty: qty ?? prev.qty,
    transport: text(v.transport) || prev.transport,
    vehicle: text(v.vehicle) || prev.vehicle,
    measure: text(v.measure) || prev.measure,
    sample: text(v.sample) || prev.sample,
    bag: text(v.bag) || prev.bag,
    bags: num(v.bags) ?? prev.bags,
    giveBags: num(v.giveBags) ?? prev.giveBags,
    to: text(v.to) || prev.to,
    loc: text(v.loc) || prev.loc,
    lat: lat(v.lat) ?? prev.lat,
    lng: lng(v.lng) ?? prev.lng,
    temps: temps.length ? temps : prev.temps,
    fixing: !!body.fixing,
    csinkEstimated,
  }
  const status = workerStatus(existing?.status, body.status ?? 'progress')
  // A resubmitted batch clears the previous decision.
  const resubmitted = existing && status === 'not_assessed' && existing.status !== 'not_assessed'

  const data = {
    code,
    date: existing?.date ?? appDateToIso(body.date),
    network,
    site: siteId,
    kiln: kiln ?? null,
    feedstock,
    biomassKg: biomassKg ?? null,
    biocharL,
    temperatureC: temps.length ? Math.max(...temps) : (existing?.temperatureC ?? null),
    moistureReadings: moist ?? existing?.moistureReadings ?? null,
    startDate: v.burn ? new Date(Number(v.burn)).toISOString() : (existing?.startDate ?? null),
    endedAt: v.burnEnd ? new Date(Number(v.burnEnd)).toISOString() : (existing?.endedAt ?? null),
    samplingContainer: sampleRow?.id ?? existing?.samplingContainer ?? null,
    csinkT,
    status,
    operator: existing ? (relId(existing.operator) ?? null) : role === 'worker' ? person.id : null,
    operatorName: existing?.operatorName || (role === 'worker' ? person.name : ''),
    ...(resubmitted ? { rejectionReason: null, assessedBy: null, assessedAt: null } : {}),
    raw: { ...((existing?.raw as object) ?? {}), app: state },
  }
  const batch = (
    existing
      ? await payload.update({ collection: 'batches', id: existing.id, data: data as never, ...all })
      : await payload.create({ collection: 'batches', data: data as never, ...all })
  ) as Batch

  const date = batch.date
  // Day 1 — the biomass collection (only the step-by-step app records the source with the batch).
  if (text(v.source)) {
    const vehicleRow = await byName(ctx, 'vehicles', siteId, text(v.vehicle))
    const sourceRow = await byName(ctx, 'biomass-sources', siteId, text(v.source))
    const col = {
      date,
      network,
      site: siteId,
      feedstock,
      source: text(v.source),
      biomassSource: sourceRow?.id ?? null,
      quantityKg: biomassKg ?? null,
      transport: text(v.transport).toLowerCase() === 'vehicle' ? 'vehicle' : 'manual',
      vehicle: vehicleRow?.id ?? null,
      vehicleDetails: text(v.vehicle) || null,
    }
    state.collectionId = state.collectionId
      ? (await payload.update({ collection: 'biomass-collections', id: state.collectionId, data: col as never, ...all })).id
      : (await payload.create({ collection: 'biomass-collections', data: col as never, ...all })).id
  }
  // Day 3 — mixing, then packing into bags.
  if (text(v.mixType)) {
    const mix = { date: new Date().toISOString(), batches: [batch.id], network, site: siteId, mixingType: text(v.mixType), feedstock, biocharL: num(v.mixL) }
    const current = (await payload.find({ collection: 'mixings', where: { batches: { in: [batch.id] } }, limit: 1, ...all })).docs[0]
    state.mixingId = current
      ? (await payload.update({ collection: 'mixings', id: current.id, data: { ...mix, date: current.date } as never, ...all })).id
      : (await payload.create({ collection: 'mixings', data: mix as never, ...all })).id
  }
  if (text(v.bag) && num(v.bags) != null) {
    const pack = {
      date: new Date().toISOString(),
      batches: [batch.id],
      network,
      site: siteId,
      packagingType: text(v.mixType) || 'Biochar only',
      bagDetails: text(v.bag),
      bagsCreated: num(v.bags),
      bagsRemaining: Math.max(0, (num(v.bags) ?? 0) - (num(v.giveBags) ?? 0)),
      bagsDistributed: num(v.giveBags) ?? 0,
    }
    state.packagingId = state.packagingId
      ? (await payload.update({ collection: 'packagings', id: state.packagingId, data: pack as never, ...all })).id
      : (await payload.create({ collection: 'packagings', data: pack as never, ...all })).id
  }
  // Day 4 — the application.
  if (text(v.to)) {
    const app = {
      date: new Date().toISOString(),
      network,
      site: siteId,
      recipientName: text(v.to),
      recipientAddress: text(v.loc) || null,
      lat: lat(v.lat),
      lng: lng(v.lng),
      mixTypes: text(v.mixType) ? [text(v.mixType)] : [],
      kind: 'application',
      bags: num(v.giveBags),
      bagType: text(v.bag) || null,
    }
    state.applicationId = state.applicationId
      ? (await payload.update({ collection: 'applications', id: state.applicationId, data: app as never, ...all })).id
      : (await payload.create({ collection: 'applications', data: app as never, ...all })).id
  }
  if (['collectionId', 'mixingId', 'packagingId', 'applicationId'].some((k) => state[k as keyof AppState] !== prev[k as keyof AppState])) {
    await payload.update({ collection: 'batches', id: batch.id, data: { raw: { ...((batch.raw as object) ?? {}), app: state } } as never, ...all })
  }

  // Attach the photos/videos this save references to the record each belongs to.
  const owners = { batch: batch.id, collection: state.collectionId, mixing: state.mixingId, packaging: state.packagingId, application: state.applicationId }
  const collectionOf = { batch: 'batches', collection: 'biomass-collections', mixing: 'mixings', packaging: 'packagings', application: 'applications' } as const
  for (const [slot, ids] of mediaBySlot(v)) {
    const owner = ownerOfSlot(slot)
    const ownerId = owners[owner] ?? (owner === 'collection' ? undefined : batch.id)
    if (ownerId) await claimFiles(ctx, ids, owners[owner] ? collectionOf[owner] : 'batches', ownerId, `field:${slot}`)
  }

  return { batch: await one(ctx, batch.id) }
}

/**
 * POST /api/field/batches/<code>/review — a supervisor accepts or rejects. This is the network review; the admin
 * then gives the final decision in the admin panel, which the app shows on its next sync.
 */
export async function reviewBatch(ctx: FieldContext, code: string, body: { decision?: string; reasonKey?: string; reasonText?: string; note?: string }) {
  if (ctx.role !== 'sup') throw new FieldError(403, 'Only supervisors can review batches.')
  const batch = await batchByCode(ctx, code)
  if (!batch) throw new FieldError(404, 'Batch not found.')
  if (batch.status === 'admin_approved' || batch.status === 'admin_rejected') throw new FieldError(409, 'This batch has already been decided by the admin.')
  if (batch.status === 'started') throw new FieldError(409, 'This batch is still in progress.')
  const approve = body.decision === 'approve'
  if (!approve && body.decision !== 'reject') throw new FieldError(400, 'Choose accept or reject.')
  const note = text(body.note, 500)
  const key = text(body.reasonKey, 40)
  const reason = REJECT_REASONS.find((r) => r.key === key)?.label ?? text(body.reasonText, 200)
  if (!approve && !reason) throw new FieldError(400, 'Pick a reason for rejecting.')
  const prev = appState(batch)
  await ctx.payload.update({
    collection: 'batches',
    id: batch.id,
    data: {
      status: approve ? 'approved' : 'rejected',
      assessedBy: ctx.person.name,
      assessorEmail: ctx.person.email ?? null,
      assessedAt: new Date().toISOString(),
      rejectionReason: approve ? null : [reason, note].filter(Boolean).join(' · '),
      raw: { ...((batch.raw as object) ?? {}), app: { ...prev, rejectKey: approve ? null : key || null, rejectNote: approve ? '' : note } },
    } as never,
    ...all,
  })
  await ctx.payload.create({
    collection: 'activity-logs',
    data: { message: `Batch ${code} ${approve ? 'accepted' : 'rejected'} by ${ctx.person.name} in the field app`, network: relId(batch.network), by: ctx.person.name, actionType: 'field-review', at: new Date().toISOString() },
    ...all,
  } as never)
  return { batch: await one(ctx, batch.id) }
}
