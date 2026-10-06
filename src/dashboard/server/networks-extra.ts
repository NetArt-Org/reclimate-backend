'use server'

import { randomUUID } from 'crypto'
import type { Where } from 'payload'

import { relId, relIds, requireAdmin } from './payload'
import { guard, UserError } from './result'

/* ------------------------------------------------------------------ */
/* Types returned to the network detail screen                         */
/* ------------------------------------------------------------------ */

/** Dimensions in mm, keyed by name (diameter, height, upperDiameter, depth…). Only numeric values are kept. */
export type Dimensions = Record<string, number>

export interface Photo {
  id: string
  /** Only 'stored' files can be viewed at /admin/files/<id>. */
  stored: boolean
}

export interface NetworkInfo {
  address: string
  country: string
  methaneStrategy: string
}

export interface KilnExtra {
  id: string
  siteId: string
  shape: string
  dimensions: Dimensions
  volumeL: number | null
  photo: Photo | null
}

export interface MeasuringContainer {
  id: string
  siteId: string | null
  code: string
  name: string
  shape: string
  dimensions: Dimensions
  volumeL: number | null
  inUse: boolean
  photo: Photo | null
}

export interface SamplingContainer {
  id: string
  siteId: string | null
  code: string
  name: string
  volumeL: number | null
  filled: boolean
  addedAt: string | null
  /** addedAt + 6 months (UTC), when the sample may be discarded / is due for review. */
  dueAt: string | null
  /** dueAt is today or earlier. */
  due: boolean
  photo: Photo | null
}

export interface VehicleRow {
  id: string
  siteId: string | null
  name: string
  plate: string
  type: string
  fuel: string
  /** kg CO₂ per km (as recorded in Circonomy). */
  emissionFactor: number | null
  photo: Photo | null
}

export interface BiomassSourceRow {
  id: string
  siteId: string | null
  name: string
  address: string
  lat: number | null
  lng: number | null
  active: boolean
}

export interface FieldPerson {
  id: string
  name: string
  role: 'manager' | 'supervisor' | 'operator' | 'farmer'
  phone: string
  address: string
  siteIds: string[]
  active: boolean
}

export interface NetworkExtras {
  network: NetworkInfo
  /** Site details the global store does not carry. */
  sites: { id: string; address: string }[]
  kilns: KilnExtra[]
  measuring: MeasuringContainer[]
  sampling: SamplingContainer[]
  vehicles: VehicleRow[]
  sources: BiomassSourceRow[]
  /** Farmers and kiln operators of the network. */
  people: FieldPerson[]
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

const s = (v: unknown) => (v == null ? '' : String(v))
const numOrNull = (v: unknown) => {
  if (v == null || v === '') return null
  const x = Number(v)
  return Number.isFinite(x) ? x : null
}

function dims(v: unknown): Dimensions {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return {}
  const out: Dimensions = {}
  for (const [k, raw] of Object.entries(v as Record<string, unknown>)) {
    const x = numOrNull(raw)
    if (x != null && x > 0) out[k] = x
  }
  return out
}

/** addedAt + 6 calendar months, in UTC. */
function plusSixMonths(iso: string): Date {
  const d = new Date(iso)
  const due = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 6, d.getUTCDate()))
  // 31 Aug + 6 months would roll into March; clamp to the last day of the target month.
  if (due.getUTCDate() !== d.getUTCDate()) due.setUTCDate(0)
  return due
}

/* ------------------------------------------------------------------ */
/* Query                                                               */
/* ------------------------------------------------------------------ */

/** Kilns, containers, vehicles, biomass sources and field people of one network — loaded when its detail opens. */
export async function getNetworkExtras(networkId: string) {
  return guard(async (): Promise<NetworkExtras> => {
    const { payload } = await requireAdmin()
    const common = { pagination: false, depth: 0, overrideAccess: true } as const

    const [network, sitesRes] = await Promise.all([
      payload.findByID({ collection: 'networks', id: networkId, depth: 0, select: { address: true, country: true, methaneStrategy: true }, overrideAccess: true }),
      payload.find({ collection: 'sites', where: { network: { equals: networkId } }, select: { address: true }, ...common }),
    ])
    const siteIds = sitesRes.docs.map((d) => String(d.id))
    const inNetwork: Where = siteIds.length
      ? { or: [{ network: { equals: networkId } }, { site: { in: siteIds } }] }
      : { network: { equals: networkId } }

    const [kilns, containers, vehicles, sources, people] = await Promise.all([
      siteIds.length
        ? payload.find({ collection: 'kilns', where: { site: { in: siteIds } }, select: { site: true, shape: true, dimensions: true, volumeM3: true }, ...common })
        : Promise.resolve({ docs: [] }),
      payload.find({ collection: 'containers', where: inNetwork, sort: 'code', select: { raw: false }, ...common }),
      payload.find({ collection: 'vehicles', where: inNetwork, sort: 'name', select: { raw: false }, ...common }),
      payload.find({ collection: 'biomass-sources', where: inNetwork, sort: 'name', select: { raw: false, kml: false }, ...common }),
      payload.find({
        collection: 'people',
        where: { and: [{ networks: { in: [networkId] } }, { role: { in: ['farmer', 'operator'] } }] },
        sort: 'name',
        select: { name: true, role: true, phone: true, address: true, sites: true, active: true },
        ...common,
      }),
    ])

    // Photos: first image per kiln / container / vehicle, preferring ones already copied.
    const owners = [...kilns.docs, ...containers.docs, ...vehicles.docs].map((d) => String(d.id))
    const photos = new Map<string, Photo>()
    if (owners.length) {
      const files = await payload.find({
        collection: 'files',
        where: {
          and: [
            { ownerCollection: { in: ['kilns', 'containers', 'vehicles'] } },
            { ownerId: { in: owners } },
            { mimeType: { like: 'image/' } },
          ],
        },
        select: { ownerId: true, status: true },
        sort: 'createdAt',
        ...common,
      })
      for (const f of files.docs) {
        const owner = s(f.ownerId)
        const stored = f.status === 'stored'
        const prev = photos.get(owner)
        if (!prev || (!prev.stored && stored)) photos.set(owner, { id: String(f.id), stored })
      }
    }
    const photo = (id: unknown) => photos.get(String(id)) ?? null

    const today = new Date()
    today.setUTCHours(23, 59, 59, 999)

    const measuring: MeasuringContainer[] = []
    const sampling: SamplingContainer[] = []
    for (const c of containers.docs) {
      const base = { id: String(c.id), siteId: relId(c.site) ?? null, code: s(c.code), name: s(c.name), volumeL: numOrNull(c.volumeL), photo: photo(c.id) }
      if (c.kind === 'sampling') {
        const dueAt = c.addedAt ? plusSixMonths(c.addedAt) : null
        sampling.push({
          ...base,
          filled: !!c.filled,
          addedAt: c.addedAt ?? null,
          dueAt: dueAt ? dueAt.toISOString() : null,
          due: !!dueAt && dueAt <= today,
        })
      } else {
        measuring.push({ ...base, shape: s(c.shape), dimensions: dims(c.dimensions), inUse: !!c.inUse })
      }
    }

    return {
      network: { address: s(network.address), country: s(network.country), methaneStrategy: s(network.methaneStrategy) },
      sites: sitesRes.docs.map((d) => ({ id: String(d.id), address: s(d.address) })),
      kilns: kilns.docs.map((k) => {
        const v = numOrNull((k as { volumeM3?: unknown }).volumeM3)
        return {
          id: String(k.id),
          siteId: relId((k as { site?: unknown }).site) ?? '',
          shape: s((k as { shape?: unknown }).shape),
          dimensions: dims((k as { dimensions?: unknown }).dimensions),
          volumeL: v == null ? null : Math.round(v * 1000),
          photo: photo(k.id),
        }
      }),
      measuring,
      sampling,
      vehicles: vehicles.docs.map((v) => ({
        id: String(v.id),
        siteId: relId(v.site) ?? null,
        name: s(v.name),
        plate: s(v.plate),
        type: s(v.type),
        fuel: s(v.fuel),
        emissionFactor: numOrNull(v.emissionFactor),
        photo: photo(v.id),
      })),
      sources: sources.docs.map((b) => ({
        id: String(b.id),
        siteId: relId(b.site) ?? null,
        name: s(b.name),
        address: s(b.address),
        lat: numOrNull(b.lat),
        lng: numOrNull(b.lng),
        active: b.active !== false,
      })),
      people: people.docs.map((p) => ({
        id: String(p.id),
        name: s(p.name),
        role: p.role,
        phone: s(p.phone),
        address: s(p.address),
        siteIds: relIds(p.sites),
        active: p.active !== false,
      })),
    }
  })()
}

/* ------------------------------------------------------------------ */
/* Edits                                                               */
/* ------------------------------------------------------------------ */

async function checkSite(payload: Awaited<ReturnType<typeof requireAdmin>>['payload'], networkId: string, siteId: string | null) {
  if (!siteId) return
  const site = await payload.findByID({ collection: 'sites', id: siteId, depth: 0, select: { network: true }, overrideAccess: true }).catch(() => null)
  if (!site || relId(site.network) !== networkId) throw new UserError('That site is not part of this network')
}

export interface VehicleInput {
  /** Omit for a new vehicle. */
  id?: string
  networkId: string
  siteId: string | null
  name: string
  plate: string
  type: string
  fuel: string
  emissionFactor: number | null
}

/** Add or update a vehicle. Returns the saved row. */
export async function saveVehicle(input: VehicleInput) {
  return guard(async (): Promise<VehicleRow> => {
    const { payload } = await requireAdmin()
    const plate = input.plate.trim()
    if (!plate) throw new UserError('Enter the number plate')
    if (input.emissionFactor != null && (!Number.isFinite(input.emissionFactor) || input.emissionFactor < 0)) {
      throw new UserError('The CO₂ factor must be a positive number')
    }
    await checkSite(payload, input.networkId, input.siteId)
    const data = {
      network: input.networkId,
      site: input.siteId,
      name: input.name.trim() || null,
      plate,
      type: input.type.trim() || null,
      fuel: input.fuel.trim() || null,
      emissionFactor: input.emissionFactor,
    }
    const doc = input.id
      ? await payload.update({ collection: 'vehicles', id: input.id, data, depth: 0, select: { raw: false }, overrideAccess: true })
      : await payload.create({ collection: 'vehicles', data: { id: randomUUID(), ...data }, depth: 0, select: { raw: false }, overrideAccess: true })
    return {
      id: String(doc.id),
      siteId: relId(doc.site) ?? null,
      name: s(doc.name),
      plate: s(doc.plate),
      type: s(doc.type),
      fuel: s(doc.fuel),
      emissionFactor: numOrNull(doc.emissionFactor),
      photo: null,
    }
  })()
}

export interface BiomassSourceInput {
  id?: string
  networkId: string
  siteId: string | null
  name: string
  address: string
  lat: number | null
  lng: number | null
  active: boolean
}

/** Add or update a biomass source (FPU). Returns the saved row. */
export async function saveBiomassSource(input: BiomassSourceInput) {
  return guard(async (): Promise<BiomassSourceRow> => {
    const { payload } = await requireAdmin()
    const name = input.name.trim()
    if (!name) throw new UserError('Enter a name')
    if ((input.lat == null) !== (input.lng == null)) throw new UserError('Enter both latitude and longitude, or neither')
    if (input.lat != null && (input.lat < -90 || input.lat > 90)) throw new UserError('Latitude must be between -90 and 90')
    if (input.lng != null && (input.lng < -180 || input.lng > 180)) throw new UserError('Longitude must be between -180 and 180')
    await checkSite(payload, input.networkId, input.siteId)
    const data = {
      network: input.networkId,
      site: input.siteId,
      name,
      address: input.address.trim() || null,
      lat: input.lat,
      lng: input.lng,
      active: input.active,
    }
    const doc = input.id
      ? await payload.update({ collection: 'biomass-sources', id: input.id, data, depth: 0, select: { raw: false, kml: false }, overrideAccess: true })
      : await payload.create({ collection: 'biomass-sources', data: { id: randomUUID(), ...data }, depth: 0, select: { raw: false, kml: false }, overrideAccess: true })
    return {
      id: String(doc.id),
      siteId: relId(doc.site) ?? null,
      name: s(doc.name),
      address: s(doc.address),
      lat: numOrNull(doc.lat),
      lng: numOrNull(doc.lng),
      active: doc.active !== false,
    }
  })()
}
