'use server'

import type { Payload, Where } from 'payload'

import { relId, relIds, requireAdmin } from './payload'
import { clampInt, dateValue, filterValue, searchText } from './query'
import { guard, UserError } from './result'
import type { BatchRow, ProductionQuery, ProductionTab } from './production'

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export type ExtraTab = 'inventory' | 'sink' | 'tracking'
export type ViewTab = ProductionTab | ExtraTab

/** Same filters as ProductionQuery, for any Production tab. */
export interface ViewQuery extends Omit<ProductionQuery, 'tab'> {
  tab: ViewTab
}

/** A file attached to a record. Viewable at /admin/files/<id> only when status is 'stored'. */
export interface FileRef {
  id: string
  name: string
  mimeType: string
  category: string
  status: 'stored' | 'pending' | 'failed'
  size: number | null
}

export interface InventoryRow {
  id: string
  code: string
  /** packed date */
  date: string
  networkId: string | null
  siteId: string | null
  batchCodes: string[]
  packagingType: string
  bagType: string
  bagQuantity: number | null
  bagUnit: string
  actualQuantity: number | null
  status: string
}

export interface SinkRow {
  id: string
  date: string
  networkId: string | null
  siteId: string | null
  recipientName: string
  recipientPhone: string
  recipientAddress: string
  lat: number | null
  lng: number | null
  mixTypes: string[]
  mode: string
  vehicle: string
  kind: string
  open: boolean
  fullySinked: boolean
  files: FileRef[]
}

export interface TrackingRow {
  id: string
  date: string
  networkId: string
  siteId: string
  mixingType: string
  matrixCode: string
  biocharL: number
  otherMaterialKg: number
  totalKg: number
  bagsCreated: number
  bagsAvailable: number
  bagDetails: string
  composition: string[]
  batchIds: string[]
  shipments: number | null
  mediaCount: number
}

type Meta = { total: number; page: number; pages: number }

export type ExtraResult =
  | ({ tab: 'inventory'; rows: InventoryRow[] } & Meta)
  | ({ tab: 'sink'; rows: SinkRow[] } & Meta)
  | ({ tab: 'tracking'; rows: TrackingRow[] } & Meta)

/** One step of the C-sink timeline (mixing, packing, distribution). */
export interface SinkEvent {
  id: string
  at: string | null
  title: string
  detail: string
  quantity: string
  status?: string
}

export interface BatchDetail {
  batch: BatchRow & {
    assessedAt: string | null
    temperatureC: number | null
    moistureReadings: number[]
    co2EmissionKg: number | null
    methaneEmissionKg: number | null
    shortTermSinkT: number | null
    kilnVolumeL: number | null
    samplingContainer: string
  }
  /** Biomass deliveries used by the batch. */
  collections: { source: string; crop: string; quantityKg: number | null; vehicle: string; site: string }[]
  /** Biomass dropped into the kiln, with moisture readings. */
  additions: { source: string; at: string | null; quantityKg: number | null; moisture: number[] }[]
  temperatures: { value: number; unit: string }[]
  containers: { name: string; count: number | null; volume: number | null; shape: string; diameter: number | null; height: number | null }[]
  mixing: SinkEvent[]
  packing: SinkEvent[]
  distribution: SinkEvent[]
  files: FileRef[]
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

type Obj = Record<string, unknown>
const obj = (v: unknown): Obj => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Obj) : {})
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : [])
const s = (v: unknown) => (v == null ? '' : typeof v === 'object' ? '' : String(v).trim())
const num = (v: unknown) => (v == null ? 0 : Number(v) || 0)
const numOrNull = (v: unknown) => {
  if (v == null || v === '') return null
  const x = Number(v)
  return Number.isFinite(x) ? x : null
}
const iso = (v: unknown) => {
  const t = s(v)
  return t && !Number.isNaN(Date.parse(t)) ? t : null
}
/** First non-empty string among `keys` of `o`. */
const pick = (o: Obj, ...keys: string[]) => {
  for (const k of keys) {
    const v = s(o[k])
    if (v) return v
  }
  return ''
}
/** A list of names from a string ("a, b"), string[] or {name}[]. */
const names = (v: unknown): string[] => {
  if (typeof v === 'string') return v.split(',').map((x) => x.trim()).filter(Boolean)
  return arr(v)
    .map((x) => (typeof x === 'string' ? x.trim() : pick(obj(x), 'name', 'mixName', 'otherMixName', 'title')))
    .filter(Boolean)
}
const qty = (v: unknown, unit: string) => {
  const x = numOrNull(v)
  return x == null ? '' : `${x.toLocaleString('en-US', { maximumFractionDigits: 2 })} ${unit}`.trim()
}

const FILE_OWNERS = ['batches', 'mixings', 'packagings', 'biomass-collections', 'applications', 'inventories'] as const
type FileOwner = (typeof FILE_OWNERS)[number]

async function filesOf(payload: Payload, owner: FileOwner, ids: string[]): Promise<Record<string, FileRef[]>> {
  if (!ids.length) return {}
  const res = await payload.find({
    collection: 'files',
    where: { and: [{ ownerCollection: { equals: owner } }, { ownerId: { in: ids.slice(0, 500) } }] },
    pagination: false,
    depth: 0,
    sort: 'category',
    select: { name: true, mimeType: true, category: true, status: true, size: true, ownerId: true },
    overrideAccess: true,
  })
  const out: Record<string, FileRef[]> = {}
  for (const f of res.docs) {
    const key = String(f.ownerId ?? '')
    ;(out[key] ??= []).push({
      id: String(f.id),
      name: f.name ?? '',
      mimeType: f.mimeType ?? '',
      category: f.category || 'other',
      status: (f.status ?? 'stored') as FileRef['status'],
      size: f.size ?? null,
    })
  }
  return out
}

/** Files attached to records of one collection, keyed by record id (for media strips on table rows). */
export async function ownerFiles(owner: FileOwner, ids: string[]) {
  return guard(async (): Promise<Record<string, FileRef[]>> => {
    const { payload } = await requireAdmin()
    if (!FILE_OWNERS.includes(owner)) throw new UserError('Unknown record type')
    if (!Array.isArray(ids)) throw new UserError('Unknown records')
    return filesOf(payload, owner, ids.filter((x) => typeof x === 'string'))
  })()
}

const EXTRA_TABS: readonly ExtraTab[] = ['inventory', 'sink', 'tracking']

function filters(query: ViewQuery, dateField: string, search: string[]): Where | undefined {
  const and: Where[] = []
  const networkId = filterValue(query.networkId)
  const siteId = filterValue(query.siteId)
  const from = dateValue(query.from)
  const to = dateValue(query.to)
  if (networkId) and.push({ network: { equals: networkId } })
  if (siteId) and.push({ site: { equals: siteId } })
  if (from) and.push({ [dateField]: { greater_than_equal: `${from}T00:00:00.000Z` } })
  if (to) and.push({ [dateField]: { less_than_equal: `${to}T23:59:59.999Z` } })
  const q = searchText(query.q)
  if (q) and.push({ or: search.map((f) => ({ [f]: { like: q } })) })
  return and.length ? { and } : undefined
}

/* ------------------------------------------------------------------ */
/* Inventory, Sink, Biochar tracking tabs                              */
/* ------------------------------------------------------------------ */

/** One page of inventory, sink (applications) or biochar-tracking (mixings) records, newest first. */
export async function queryProductionExtra(query: ViewQuery & { tab: ExtraTab }) {
  return guard(async (): Promise<ExtraResult> => {
    const { payload } = await requireAdmin()
    if (!EXTRA_TABS.includes(query?.tab)) throw new UserError('Unknown production tab')
    const limit = clampInt(query.limit, 25, 1, 200)
    const page = clampInt(query.page, 1, 1, 100_000)
    const meta = (r: { totalDocs: number; page?: number; totalPages: number }): Meta => ({ total: r.totalDocs, page: r.page ?? 1, pages: r.totalPages })

    switch (query.tab) {
      case 'inventory': {
        const res = await payload.find({
          collection: 'inventories',
          where: filters(query, 'packedAt', ['code', 'packagingType', 'bagType', 'status']),
          sort: '-packedAt',
          page,
          limit,
          depth: 0,
          select: { raw: false },
          overrideAccess: true,
        })
        const docs = res.docs as unknown as Obj[]
        const allBatchIds = [...new Set(docs.flatMap((d) => relIds(d.batches)))]
        const codes = allBatchIds.length
          ? await payload.find({
              collection: 'batches',
              where: { id: { in: allBatchIds.slice(0, 1000) } },
              pagination: false,
              depth: 0,
              select: { code: true },
              overrideAccess: true,
            })
          : { docs: [] }
        const codeOf = new Map(codes.docs.map((b) => [String(b.id), b.code]))
        return {
          tab: 'inventory',
          ...meta(res),
          rows: docs.map((d) => ({
            id: s(d.id),
            code: s(d.code),
            date: s(d.packedAt) || s(d.createdAt),
            networkId: relId(d.network) ?? null,
            siteId: relId(d.site) ?? null,
            batchCodes: relIds(d.batches).map((id) => codeOf.get(id) ?? id),
            packagingType: s(d.packagingType),
            bagType: s(d.bagType),
            bagQuantity: numOrNull(d.bagQuantity),
            bagUnit: s(d.bagUnit),
            actualQuantity: numOrNull(d.actualQuantity),
            status: s(d.status),
          })),
        }
      }
      case 'sink': {
        const res = await payload.find({
          collection: 'applications',
          where: filters(query, 'date', ['recipientName', 'recipientPhone', 'recipientAddress', 'kind', 'vehicle']),
          sort: '-date',
          page,
          limit,
          depth: 0,
          select: { raw: false },
          overrideAccess: true,
        })
        const docs = res.docs as unknown as Obj[]
        const files = await filesOf(payload, 'applications', docs.map((d) => s(d.id)))
        return {
          tab: 'sink',
          ...meta(res),
          rows: docs.map((d) => ({
            id: s(d.id),
            date: s(d.date),
            networkId: relId(d.network) ?? null,
            siteId: relId(d.site) ?? null,
            recipientName: s(d.recipientName),
            recipientPhone: s(d.recipientPhone),
            recipientAddress: s(d.recipientAddress),
            lat: numOrNull(d.lat),
            lng: numOrNull(d.lng),
            mixTypes: names(d.mixTypes),
            mode: s(d.mode),
            vehicle: s(d.vehicle),
            kind: s(d.kind),
            open: !!d.open,
            fullySinked: !!d.fullySinked,
            files: files[s(d.id)] ?? [],
          })),
        }
      }
      case 'tracking': {
        const res = await payload.find({
          collection: 'mixings',
          where: filters(query, 'date', ['mixingType', 'description', 'bagDetails', 'id']),
          sort: '-date',
          page,
          limit,
          depth: 0,
          overrideAccess: true,
        })
        const docs = res.docs as unknown as Obj[]
        const files = await filesOf(payload, 'mixings', docs.map((d) => s(d.id)))
        return {
          tab: 'tracking',
          ...meta(res),
          rows: docs.map((d) => {
            const raw = obj(d.raw)
            const ship = numOrNull(raw.shipmentCount ?? raw.totalShipments ?? raw.shipments_count)
            return {
              id: s(d.id),
              date: s(d.date),
              networkId: relId(d.network)!,
              siteId: relId(d.site)!,
              mixingType: s(d.mixingType),
              matrixCode: pick(raw, 'matrixCode', 'matrixId', 'shortCode', 'displayId', 'code'),
              biocharL: num(d.biocharL),
              otherMaterialKg: num(d.otherMaterialKg),
              totalKg: num(d.totalKg),
              bagsCreated: num(d.bagsCreated),
              bagsAvailable: num(d.bagsAvailable),
              bagDetails: s(d.bagDetails),
              composition: names(raw.otherMixName ?? raw.otherMixNames ?? raw.otherMaterials),
              batchIds: relIds(d.batches),
              shipments: ship ?? (Array.isArray(raw.shipments) ? raw.shipments.length : null),
              mediaCount: files[s(d.id)]?.length ?? 0,
            }
          }),
        }
      }
    }
  })()
}

/* ------------------------------------------------------------------ */
/* Batch detail                                                        */
/* ------------------------------------------------------------------ */

/** Everything about one batch for its full-record page, or null when it does not exist. */
export async function getBatchDetail(id: string) {
  return guard(async (): Promise<BatchDetail | null> => {
    const { payload } = await requireAdmin()
    const d = (await payload.findByID({ collection: 'batches', id, depth: 0, overrideAccess: true }).catch(() => null)) as Obj | null
    if (!d) return null
    const raw = obj(d.raw)

    const linked: Where = { batches: { in: [id] } }
    const [files, mixings, packagings, inventories] = await Promise.all([
      filesOf(payload, 'batches', [id]),
      payload.find({ collection: 'mixings', where: linked, pagination: false, depth: 0, sort: 'date', select: { raw: false }, overrideAccess: true }),
      payload.find({ collection: 'packagings', where: linked, pagination: false, depth: 0, sort: 'date', select: { raw: false }, overrideAccess: true }),
      payload.find({ collection: 'inventories', where: linked, pagination: false, depth: 0, sort: 'packedAt', select: { raw: false }, overrideAccess: true }),
    ])

    const moistureCol = arr(d.moistureReadings).map(Number).filter((x) => Number.isFinite(x))
    const additions = arr(raw.kilnProcessBiomass).map((x) => {
      const b = obj(x)
      const rel = arr(b.processBiomassRelation).map((r) => obj(obj(r).biomassAddition))
      return {
        source: pick(obj(b.fpu), 'fpuName', 'name'),
        at: iso(b.kilnDropTime) ?? iso(rel[0]?.dropTime),
        quantityKg: numOrNull(b.totalProcessBiomassQuantity) ?? (rel.length ? rel.reduce((t, r) => t + num(r.biomassQuantity), 0) : null),
        moisture: rel.flatMap((r) => arr(r.moistureArray).map(Number)).filter((m) => Number.isFinite(m)),
      }
    })

    /* C-sink timeline: raw Circonomy entries first, then linked records not already listed. */
    const mixing: SinkEvent[] = arr(raw.mixingDetails).map((x, i) => {
      const m = obj(x)
      return {
        id: s(m.id) || `mix-${i}`,
        at: iso(m.createdAt),
        title: pick(m, 'mixType', 'name') || 'Mixing',
        detail: qty(m.totalBiocharQuantity, 'L total biochar in mix'),
        quantity: qty(m.biocharQuantity, 'L'),
      }
    })
    for (const m of mixings.docs as unknown as Obj[]) {
      if (mixing.some((e) => e.id === s(m.id))) continue
      mixing.push({
        id: s(m.id),
        at: iso(m.date),
        title: s(m.mixingType) || 'Mixing',
        detail: [qty(m.totalKg, 'kg mixed'), num(m.bagsCreated) ? `${num(m.bagsCreated)} bags` : ''].filter(Boolean).join(' · '),
        quantity: qty(m.biocharL, 'L'),
      })
    }

    const packing: SinkEvent[] = arr(raw.mixedPackedInventory).map((x, i) => {
      const p = obj(x)
      return {
        id: s(p.id) || `pack-${i}`,
        at: iso(p.packedDate ?? p.createdAt),
        title: pick(p, 'displayId', 'name', 'packagingType') || 'Packed inventory',
        detail: [pick(p, 'packagingType', 'mixType'), pick(p, 'bagType')].filter(Boolean).join(' · '),
        quantity: qty(p.actualQuantity ?? p.quantity, pick(p, 'bagQuantityUnit', 'unit')),
        status: pick(p, 'status'),
      }
    })
    for (const p of inventories.docs as unknown as Obj[]) {
      if (packing.some((e) => e.id === s(p.id))) continue
      packing.push({
        id: s(p.id),
        at: iso(p.packedAt),
        title: s(p.code) || 'Inventory',
        detail: [s(p.packagingType), p.bagQuantity != null ? `${num(p.bagQuantity)} ${s(p.bagUnit)} ${s(p.bagType)}`.trim() : ''].filter(Boolean).join(' · '),
        quantity: qty(p.actualQuantity, s(p.bagUnit)),
        status: s(p.status),
      })
    }
    for (const p of packagings.docs as unknown as Obj[]) {
      packing.push({
        id: s(p.id),
        at: iso(p.date),
        title: s(p.packagingType) || 'Packaging',
        detail: [s(p.bagDetails), num(p.bagsCreated) ? `${num(p.bagsCreated)} bags, ${num(p.bagsRemaining)} remaining` : ''].filter(Boolean).join(' · '),
        quantity: qty(p.mixKg || p.biocharKg, 'kg'),
      })
    }

    const distribution: SinkEvent[] = [
      ...arr(raw.distributedInventory).map((x, i) => {
        const t = obj(x)
        return {
          id: s(t.id) || `dist-${i}`,
          at: iso(t.distributedAt ?? t.createdAt),
          title: t.isOpenDistribution ? 'Open distribution' : pick(t, 'name') || 'Distribution',
          detail: [s(t.mixTypeName), t.isOpenDistribution ? pick(t, 'name') : '', s(t.number)].filter(Boolean).join(' · '),
          quantity: qty(t.totalActualQty, ''),
        }
      }),
      ...arr(raw.applications).map((x, i) => {
        const a = obj(x)
        return {
          id: s(a.id) || `app-${i}`,
          at: iso(a.applicationDate ?? a.createdAt ?? a.date),
          title: pick(a, 'farmerName', 'name', 'recipientName') || 'Application',
          detail: [pick(a, 'mixTypeName', 'mixType', 'cropName'), pick(a, 'address', 'location')].filter(Boolean).join(' · '),
          quantity: qty(a.quantity ?? a.biocharQuantity ?? a.totalActualQty, pick(a, 'unit')),
        }
      }),
    ]

    const byDate = (a: SinkEvent, b: SinkEvent) => (a.at ?? '').localeCompare(b.at ?? '')
    const sc = obj(raw.samplingContainer)

    return {
      batch: {
        id: s(d.id),
        code: s(d.code),
        date: s(d.date),
        networkId: relId(d.network)!,
        siteId: relId(d.site)!,
        kilnId: relId(d.kiln) ?? null,
        startDate: iso(d.startDate),
        endedAt: iso(d.endedAt),
        feedstock: s(d.feedstock),
        biomassKg: num(d.biomassKg),
        biocharL: num(d.biocharL),
        bulkDensity: num(d.bulkDensity),
        carbonContent: num(d.carbonContent),
        csinkT: num(d.csinkT),
        operatorName: s(d.operatorName),
        status: s(d.status),
        assessedBy: s(d.assessedBy),
        sinkApproved: !!d.sinkApproved,
        registered: !!d.registered,
        rejectionReason: s(d.rejectionReason),
        assessedAt: iso(d.assessedAt),
        temperatureC: numOrNull(d.temperatureC),
        moistureReadings: moistureCol.length ? moistureCol : additions.flatMap((a) => a.moisture),
        co2EmissionKg: numOrNull(d.co2EmissionKg),
        methaneEmissionKg: numOrNull(d.methaneEmissionKg),
        shortTermSinkT: numOrNull(d.shortTermSinkT),
        kilnVolumeL: numOrNull(d.kilnVolumeL),
        samplingContainer: [pick(sc, 'ShortCode', 'shortCode'), pick(sc, 'name')].filter(Boolean).join(' · '),
      },
      collections: arr(raw.biomassCollectionUsed).map((x) => {
        const c = obj(x)
        return {
          source: pick(c, 'biomassSourceName', 'fpuName'),
          crop: pick(c, 'cropName'),
          quantityKg: numOrNull(c.biomassQuantity),
          vehicle: [pick(c, 'vehicleType'), pick(c, 'vehicleNumber')].filter(Boolean).join(' · '),
          site: pick(c, 'siteName'),
        }
      }),
      additions,
      temperatures: arr(raw.kilnProcessTemperature)
        .map((x) => ({ value: Number(obj(x).temperature), unit: pick(obj(x), 'temperatureUnit') || '°C' }))
        .filter((t) => Number.isFinite(t.value) && t.value > 0),
      containers: arr(raw.measuringContainers).map((x) => {
        const c = obj(x)
        return {
          name: pick(c, 'shortName', 'name'),
          count: numOrNull(c.count),
          volume: numOrNull(c.volume),
          shape: pick(c, 'shape'),
          diameter: numOrNull(c.diameter),
          height: numOrNull(c.height),
        }
      }),
      mixing: mixing.sort(byDate),
      packing: packing.sort(byDate),
      distribution: distribution.sort(byDate),
      files: files[id] ?? [],
    }
  })()
}
