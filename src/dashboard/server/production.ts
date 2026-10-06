'use server'

import { revalidatePath } from 'next/cache'
import type { Where } from 'payload'

import { relId, relIds, requireAdmin } from './payload'
import { clampInt, dateValue, filterValue, searchText } from './query'
import { guard, UserError } from './result'

export type ProductionTab = 'batches' | 'collections' | 'mixing' | 'packaging'

export interface ProductionQuery {
  tab: ProductionTab
  q?: string
  networkId?: string
  siteId?: string
  /** Batches only */
  status?: string
  /** YYYY-MM-DD, inclusive */
  from?: string
  to?: string
  page?: number
  limit?: number
}

export interface BatchRow {
  id: string
  code: string
  date: string
  networkId: string
  siteId: string
  kilnId: string | null
  startDate: string | null
  endedAt: string | null
  feedstock: string
  biomassKg: number
  biocharL: number
  /** kg per litre, as recorded */
  bulkDensity: number
  /** fraction 0–1 */
  carbonContent: number
  csinkT: number
  operatorName: string
  status: string
  assessedBy: string
  sinkApproved: boolean
  registered: boolean
  rejectionReason: string
}

export interface CollectionRow {
  id: string
  date: string
  networkId: string
  siteId: string
  farmerId: string | null
  feedstock: string
  source: string
  quantityKg: number
  transport: string
  vehicleDetails: string
  emissionFactor: number
  distanceKm: number
  emissions: number
}

export interface MixingRow {
  id: string
  date: string
  networkId: string
  siteId: string
  batchIds: string[]
  mixingType: string
  biocharL: number
  otherMaterialKg: number
  totalKg: number
  bagsCreated: number
  bagsAvailable: number
  description: string
  rejectedBiocharL: number
}

export interface PackagingRow {
  id: string
  date: string
  networkId: string
  siteId: string
  batchIds: string[]
  packagingType: string
  biocharKg: number
  mixKg: number
  bagDetails: string
  bagsCreated: number
  bagsDistributed: number
  bagsRemaining: number
  description: string
}

export type ProductionResult =
  | { tab: 'batches'; rows: BatchRow[]; total: number; page: number; pages: number }
  | { tab: 'collections'; rows: CollectionRow[]; total: number; page: number; pages: number }
  | { tab: 'mixing'; rows: MixingRow[]; total: number; page: number; pages: number }
  | { tab: 'packaging'; rows: PackagingRow[]; total: number; page: number; pages: number }

const COLLECTION = {
  batches: 'batches',
  collections: 'biomass-collections',
  mixing: 'mixings',
  packaging: 'packagings',
} as const

/** Text fields searched by the search box, per tab. */
const SEARCH: Record<ProductionTab, string[]> = {
  batches: ['code', 'feedstock', 'operatorName', 'id'],
  collections: ['feedstock', 'source', 'vehicleDetails', 'id'],
  mixing: ['mixingType', 'description', 'id'],
  packaging: ['packagingType', 'description', 'bagDetails', 'id'],
}

const TABS = Object.keys(COLLECTION) as ProductionTab[]
const isProductionTab = (v: unknown): v is ProductionTab => typeof v === 'string' && (TABS as string[]).includes(v)

/** One page of production records, filtered and newest first. */
export async function queryProduction(query: ProductionQuery) {
  return guard(async (): Promise<ProductionResult> => {
    const { payload } = await requireAdmin()
    const tab = query?.tab
    if (!isProductionTab(tab)) throw new UserError('Unknown production tab')
    const and: Where[] = []
    const networkId = filterValue(query.networkId)
    const siteId = filterValue(query.siteId)
    const from = dateValue(query.from)
    const to = dateValue(query.to)
    const status = filterValue(query.status, 40)
    if (networkId) and.push({ network: { equals: networkId } })
    if (siteId) and.push({ site: { equals: siteId } })
    if (from) and.push({ date: { greater_than_equal: `${from}T00:00:00.000Z` } })
    if (to) and.push({ date: { less_than_equal: `${to}T23:59:59.999Z` } })
    if (tab === 'batches' && status) and.push({ status: { equals: status } })
    const q = searchText(query.q)
    if (q) and.push({ or: SEARCH[tab].map((f) => ({ [f]: { like: q } })) })

    const limit = clampInt(query.limit, 25, 1, 200)
    const res = await payload.find({
      collection: COLLECTION[tab],
      where: and.length ? { and } : undefined,
      sort: '-date',
      page: clampInt(query.page, 1, 1, 100_000),
      limit,
      depth: 0,
      select: { raw: false },
      overrideAccess: true,
    })
    const meta = { total: res.totalDocs, page: res.page ?? 1, pages: res.totalPages }
    const docs = res.docs as unknown as Record<string, unknown>[]
    const s = (v: unknown) => (v == null ? '' : String(v))
    const num = (v: unknown) => (v == null ? 0 : Number(v))
    const base = (d: Record<string, unknown>) => ({
      id: s(d.id),
      date: s(d.date),
      networkId: relId(d.network)!,
      siteId: relId(d.site)!,
    })

    switch (tab) {
      case 'batches':
        return {
          tab,
          ...meta,
          rows: docs.map((d) => ({
            ...base(d),
            code: s(d.code),
            kilnId: relId(d.kiln) ?? null,
            startDate: (d.startDate as string) ?? null,
            endedAt: (d.endedAt as string) ?? null,
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
          })),
        }
      case 'collections':
        return {
          tab,
          ...meta,
          rows: docs.map((d) => ({
            ...base(d),
            farmerId: relId(d.farmer) ?? null,
            feedstock: s(d.feedstock),
            source: s(d.source),
            quantityKg: num(d.quantityKg),
            transport: s(d.transport),
            vehicleDetails: s(d.vehicleDetails),
            emissionFactor: num(d.emissionFactor),
            distanceKm: num(d.distanceKm),
            emissions: num(d.emissions),
          })),
        }
      case 'mixing':
        return {
          tab,
          ...meta,
          rows: docs.map((d) => ({
            ...base(d),
            batchIds: relIds(d.batches),
            mixingType: s(d.mixingType),
            biocharL: num(d.biocharL),
            otherMaterialKg: num(d.otherMaterialKg),
            totalKg: num(d.totalKg),
            bagsCreated: num(d.bagsCreated),
            bagsAvailable: num(d.bagsAvailable),
            description: s(d.description),
            rejectedBiocharL: num(d.rejectedBiocharL),
          })),
        }
      case 'packaging':
        return {
          tab,
          ...meta,
          rows: docs.map((d) => ({
            ...base(d),
            batchIds: relIds(d.batches),
            packagingType: s(d.packagingType),
            biocharKg: num(d.biocharKg),
            mixKg: num(d.mixKg),
            bagDetails: s(d.bagDetails),
            bagsCreated: num(d.bagsCreated),
            bagsDistributed: num(d.bagsDistributed),
            bagsRemaining: num(d.bagsRemaining),
            description: s(d.description),
          })),
        }
    }
  })()
}

/** Batch codes for a list of batch ids (mixing and packaging rows link to batches). */
export async function batchCodes(ids: string[]) {
  return guard(async (): Promise<Record<string, string>> => {
    const { payload } = await requireAdmin()
    if (!Array.isArray(ids)) throw new UserError('Unknown batches')
    ids = ids.filter((x) => typeof x === 'string')
    if (!ids.length) return {}
    const res = await payload.find({
      collection: 'batches',
      where: { id: { in: ids.slice(0, 500) } },
      pagination: false,
      depth: 0,
      select: { code: true },
      overrideAccess: true,
    })
    return Object.fromEntries(res.docs.map((d) => [String(d.id), d.code]))
  })()
}

/** Statuses a batch can be assessed from (waiting for, or approved by, the network). */
const ASSESSABLE = ['not_assessed', 'approved']

/** Approve or reject a batch that is waiting for assessment. */
export async function assessBatch(id: string, decision: 'approve' | 'reject', reason?: string) {
  return guard(async () => {
    const { payload, user } = await requireAdmin()
    if (decision !== 'approve' && decision !== 'reject') throw new UserError('Unknown decision')
    reason = typeof reason === 'string' ? reason.trim() : ''
    if (decision === 'reject' && !reason) throw new UserError('Give a reason for rejecting the batch')
    if (reason.length > 500) throw new UserError('The reason can be at most 500 characters')
    const batch = await payload
      .findByID({ collection: 'batches', id, depth: 0, select: { code: true, network: true, status: true, registered: true }, overrideAccess: true })
      .catch(() => null)
    if (!batch) throw new UserError('This batch no longer exists.')
    if (!ASSESSABLE.includes(String(batch.status)) || batch.registered) throw new UserError('This batch has already been assessed.')
    await payload.update({
      collection: 'batches',
      id,
      data: {
        status: decision === 'approve' ? 'admin_approved' : 'admin_rejected',
        assessedBy: user.name,
        assessorEmail: user.email ?? '',
        rejectionReason: decision === 'reject' ? reason : '',
      },
      overrideAccess: true,
    })
    await payload.create({
      collection: 'activity-logs',
      data: {
        message: `Batch ${batch.code} ${decision === 'approve' ? 'approved' : `rejected: ${reason}`}`,
        network: relId(batch.network),
        by: user.name,
      },
      overrideAccess: true,
    } as never)
    revalidatePath('/admin', 'layout')
  })()
}
