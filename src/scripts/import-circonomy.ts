/**
 * Imports a Circonomy admin-panel export (data/import/circonomy-export.json) into Neon.
 *
 *   npm run import:circonomy
 *
 * Re-runnable: every record keeps its Circonomy id, so a second run updates what changed and adds what is new
 * (use it to keep Neon in step until the switch-over). The full source record is kept in each row's `raw`.
 * Photos/videos/PDFs are registered in `files` as "pending"; `npm run media:copy` copies them to Firebase Storage.
 *
 * The older Excel exports (data/import/batches.json …) fill the few fields the API does not return:
 * sink/registry flags and the firing operator per batch, and the batch links of mixing/packaging rows.
 */
import fs from 'fs'
import path from 'path'
import { sql } from '@payloadcms/db-postgres'
import { getPayload, type CollectionSlug } from 'payload'

import config from '../payload.config'
import { DEFAULT_APP_CONFIG } from '../dashboard/data/catalog'
import type { Company } from '../dashboard/data/types'

/* eslint-disable @typescript-eslint/no-explicit-any */
type Obj = Record<string, any>

const DIR = path.resolve(process.cwd(), 'data/import')
const read = (name: string, fallback: any = null) => {
  const p = path.join(DIR, name)
  return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : fallback
}

/* ---------------------------------------------------------------- helpers */

const clean = (s: unknown) => (s == null ? '' : String(s).replace(/\s+/g, ' ').trim())
const num = (v: unknown) => (v == null || v === '' || Number.isNaN(Number(v)) ? null : Number(v))
const kgToT = (v: unknown) => (num(v) == null ? null : +(Number(v) / 1000).toFixed(6))

/** "(3.53,101.45)" or { x, y } → [lat, lng] */
function coords(v: unknown): [number | null, number | null] {
  if (!v) return [null, null]
  if (typeof v === 'object') {
    const o = v as Obj
    return [num(o.x ?? o.lat), num(o.y ?? o.lng)]
  }
  const m = String(v).match(/\(?\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*\)?/)
  return m ? [Number(m[1]), Number(m[2])] : [null, null]
}

/** Remove presigned URLs (they expire and carry signatures), tokens and national-ID details from a source record. */
function strip(o: any): any {
  if (Array.isArray(o)) return o.map(strip)
  if (!o || typeof o !== 'object') return o
  const out: Obj = {}
  for (const [k, v] of Object.entries(o)) {
    if (/token|password|secret|aadhaar|url$|urls$/i.test(k)) continue
    out[k] = strip(v)
  }
  return out
}

const STATUS: Record<string, string> = {
  'admin-approved': 'admin_approved',
  'admin-rejected': 'admin_rejected',
  not_assessed: 'not_assessed',
  started: 'started',
  approved: 'approved',
  rejected: 'rejected',
}

const ROLES: Record<string, string> = { manager: 'manager', supervisor: 'supervisor', operator: 'operator', farmer: 'farmer' }

const MIME: Record<string, string> = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif', heic: 'image/heic',
  mp4: 'video/mp4', mov: 'video/quicktime', webm: 'video/webm', pdf: 'application/pdf', kml: 'application/vnd.google-earth.kml+xml',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', csv: 'text/csv',
}

/* ---------------------------------------------------------------- media */

interface MediaRow {
  id: string
  name: string
  mimeType: string
  sourcePath: string
  category: string
  ownerCollection: string
  ownerId: string
}

/** Collect every { id, path: 's3://…' } file object inside `o`, attributed to its owner record. */
function collectMedia(o: any, owner: [string, string], out: Map<string, MediaRow>, category = 'other') {
  if (Array.isArray(o)) return o.forEach((x) => collectMedia(x, owner, out, category))
  if (!o || typeof o !== 'object') return
  const p = typeof o.path === 'string' && o.path.startsWith('s3://') ? o.path : typeof o.fileName === 'string' && o.fileName.startsWith('s3://') ? o.fileName : null
  if (p && o.id && !out.has(String(o.id))) {
    const name = p.split('/').pop()!
    const ext = name.split('.').pop()!.toLowerCase()
    out.set(String(o.id), {
      id: String(o.id),
      name,
      mimeType: MIME[ext] ?? (o.fileType === 'video' ? 'video/mp4' : 'application/octet-stream'),
      sourcePath: p,
      category: String(o.category || category),
      ownerCollection: owner[0],
      ownerId: owner[1],
    })
  }
  for (const [k, v] of Object.entries(o)) {
    if (v && typeof v === 'object') {
      // Use the key as the category when the file object itself has none (firing, temperature, images…).
      const cat = /images|videos|image|video|file/i.test(k) ? category : k
      collectMedia(v, owner, out, cat)
    }
  }
}

/* ---------------------------------------------------------------- run */

async function run() {
  const exp = read('circonomy-export.json')
  if (!exp) throw new Error(`Missing ${path.join(DIR, 'circonomy-export.json')}`)
  const payload = await getPayload({ config })
  const db = payload.db.drizzle
  const o: Obj = exp.other

  // Excel exports: fields the API does not return.
  const xBatches = new Map<string, Obj>((read('batches.json', []) as Obj[]).map((b) => [b.id, b]))
  const xCollections = new Map<string, Obj>((read('collections.json', []) as Obj[]).map((c) => [c.id, c]))
  const xMixings = new Map<string, Obj>((read('mixings.json', []) as Obj[]).map((m) => [m.id, m]))
  const xPackagings = new Map<string, Obj>((read('packagings.json', []) as Obj[]).map((m) => [m.id, m]))
  const screens = read('screens.json', { feedstockStrategies: {}, feedstockSpc: [] })

  const media = new Map<string, MediaRow>()
  const counts: Record<string, string> = {}

  /** Create-or-update every row of a collection, 8 at a time. */
  async function upsertAll(collection: CollectionSlug, rows: Obj[]) {
    const existing = await payload.find({ collection, pagination: false, depth: 0, select: { createdAt: true }, overrideAccess: true })
    const have = new Set(existing.docs.map((d) => String(d.id)))
    let created = 0
    let updated = 0
    let i = 0
    const worker = async () => {
      while (i < rows.length) {
        const row = rows[i++]
        const { id, ...data } = row
        if (have.has(String(id))) {
          await payload.update({ collection, id, data, depth: 0, overrideAccess: true })
          updated++
        } else {
          await payload.create({ collection, data: row, depth: 0, overrideAccess: true } as never)
          created++
        }
      }
    }
    await Promise.all(Array.from({ length: 8 }, worker))
    counts[collection] = `${created} new, ${updated} updated`
    console.log(`✓ ${collection}: ${counts[collection]}`)
  }

  /** Register every file collected so far in `files` (bulk). Records that point at a file need it to exist first. */
  const flushed = new Set<string>()
  async function flushMedia() {
    const rows = [...media.values()].filter((m) => !flushed.has(m.id))
    for (let i = 0; i < rows.length; i += 500) {
      const chunk = rows.slice(i, i + 500)
      const values = sql.join(
        chunk.map(
          (m) => sql`(${m.id}, ${m.name}, ${m.mimeType}, ${m.sourcePath}, ${m.category}, ${m.ownerCollection}, ${m.ownerId}, 'pending', now(), now())`,
        ),
        sql`, `,
      )
      // A file already copied keeps its storage path; new files are queued.
      await db.execute(sql`
        insert into files (id, name, mime_type, source_path, category, owner_collection, owner_id, status, updated_at, created_at)
        values ${values}
        on conflict (id) do update set category = excluded.category, owner_collection = excluded.owner_collection, owner_id = excluded.owner_id`)
    }
    rows.forEach((m) => flushed.add(m.id))
    if (rows.length) console.log(`✓ files registered: ${rows.length} (copy them with npm run media:copy)`)
  }

  /* ---------- organisations (Circonomy: biomass aggregators) ---------- */
  const bas: Obj[] = o.biomassAggregators?.biomassAggregators ?? []
  await upsertAll(
    'organizations',
    bas.map((b) => ({
      id: b.id,
      code: b.shortName,
      name: clean(b.name),
      address: clean(b.locationName),
      active: !b.suspended,
      admins: (b.managerDetails ?? []).map((m: Obj) => ({ id: m.managerId, name: m.managerName, role: m.accountType, email: m.managerEmail, phone: m.managerPhone })),
      raw: strip(b),
    })),
  )

  /* ---------- networks ---------- */
  const entities: Obj[] = o.entities?.items ?? []
  const details: Obj = exp.networkDetails ?? {}
  const ceres = new Set<string>((o.ceresNetworks?.networks ?? []).map((n: Obj) => n.id ?? n.networkId))
  const processList: Obj[] = exp.processList
  const processDetails: Obj = exp.processDetails

  // First registered batch per network = its CERES cut-off date (registry flags come from the Excel export).
  const firstRegistered = new Map<string, string>()
  for (const p of processList) {
    const x = xBatches.get(p.id)
    const net = p.artisanProId ?? p.networkId
    if (x?.registered && (!firstRegistered.has(net) || p.startTime < firstRegistered.get(net)!)) firstRegistered.set(net, p.startTime)
  }
  const median = (xs: number[]) => {
    const s = xs.filter((v) => v > 0).sort((a, b) => a - b)
    return s.length ? s[Math.floor(s.length / 2)] : 0
  }

  await upsertAll(
    'networks',
    entities.map((e) => {
      const d = details[e.id]?.detail ?? {}
      const [lat, lng] = coords(e.coordinate ?? d.location ?? d.coordinate)
      const own = processList.filter((p) => (p.artisanProId ?? p.networkId) === e.id)
      const feeds = [...new Set(own.map((p) => clean(p.cropName)).filter(Boolean))]
      return {
        id: e.id,
        organization: e.biomassAggregatorId,
        code: d.shortCode ?? d.shortName ?? null,
        name: clean(e.name),
        type: e.entityType === 'csink_network' ? 'csink' : 'artisan',
        location: clean(e.areaLocality || e.location || d.locationName || d.address),
        address: clean(d.address || d.locationName || e.location),
        country: clean(e.country || d.country) || null,
        lat,
        lng,
        active: !e.suspended,
        ceresApproved: !!(e.isCsiApproved || ceres.has(e.id)),
        certifiedAt: firstRegistered.get(e.id) ?? null,
        methaneStrategy: clean(d.methaneCompensationStrategy) || null,
        config: {
          feedstocks: feeds,
          mixingTypes: [...new Set((o.mixing?.items ?? []).filter((m: Obj) => (m.artisanProId ?? m.csinkNetworkId) === e.id).map((m: Obj) => clean(m.mixType)))],
          applicationTypes: (d.applicationTypes ?? []).map((a: Obj) => clean(a.type)).filter(Boolean),
          references: feeds.map((f) => {
            const rows = own.filter((p) => clean(p.cropName) === f).map((p) => processDetails[p.id]?.kilnProcessDetail ?? {})
            return {
              feedstock: f,
              bulkDensity: +(median(rows.map((r) => Number(r.density) || 0)) * 1000).toFixed(1),
              carbonContent: +median(rows.map((r) => Number(r.carbonPercentage) || 0)).toFixed(2),
            }
          }),
        },
        raw: strip({ entity: e, detail: d }),
      }
    }),
  )

  const netIds = new Set(entities.map((e) => e.id))
  const knownNet = (id: unknown) => (id && netIds.has(String(id)) ? String(id) : null)

  /* ---------- sites, kilns, containers, vehicles, biomass sources ---------- */
  const sites: Obj[] = []
  const kilns = new Map<string, Obj>()
  const containers: Obj[] = []
  const vehicles: Obj[] = []
  const sources: Obj[] = []
  for (const [netId, nd] of Object.entries<Obj>(details)) {
    const list: Obj[] = nd.sites?.siteList ?? []
    for (const s of list) {
      const sd: Obj = nd.siteDetails?.[s.id] ?? s
      const [lat, lng] = coords(sd.coordinate ?? s.coordinate)
      sites.push({
        id: s.id,
        network: netId,
        code: sd.shortName ?? s.shortCode ?? null,
        name: clean(s.name),
        address: clean(sd.address ?? s.address),
        lat,
        lng,
        active: !sd.isSuspended,
        kml: sd.kmlCoordinates ?? null,
        raw: strip({ ...s, ...sd, details: undefined }),
      })
      const dt: Obj = sd.details ?? {}
      for (const k of dt.kilns ?? []) {
        const [klat, klng] = coords(k.coordinate)
        const dims = Object.fromEntries(
          ['upperSurfaceDiameter', 'lowerSurfaceDiameter', 'diameter', 'depth', 'upperSide', 'lowerSide', 'frustumLength', 'longBase', 'shortBase']
            .filter((f) => num(k[f]))
            .map((f) => [f, num(k[f])]),
        )
        kilns.set(k.id, {
          id: k.id,
          site: s.id,
          code: k.ShortName ?? null,
          name: clean(k.name),
          type: k.kilnType === 'pit' ? 'pit' : 'kontiki',
          volumeM3: num(k.volume) != null ? +(Number(k.volume) / 1000).toFixed(5) : null,
          shape: k.kilnShape ?? null,
          dimensions: dims,
          lat: klat,
          lng: klng,
          active: !k.isSuspended,
          raw: strip(k),
        })
        collectMedia(k, ['kilns', k.id], media, 'kiln')
      }
      for (const c of dt.measuringContainers ?? []) {
        containers.push({
          id: c.id,
          kind: 'measuring',
          site: s.id,
          network: netId,
          code: c.ShortName ?? null,
          name: clean(c.name) || null,
          shape: c.shape || null,
          dimensions: Object.fromEntries(['diameter', 'height', 'length', 'breadth', 'upperSurfaceDiameter', 'lowerSurfaceDiameter', 'upperBase', 'lowerBase'].filter((f) => num(c[f])).map((f) => [f, num(c[f])])),
          volumeL: num(c.volume),
          inUse: !!c.inUse,
          filled: !!c.isPartialFilled,
          raw: strip(c),
        })
        collectMedia(c, ['containers', c.id], media, 'measuring_container')
      }
      for (const c of dt.samplingContainers ?? []) {
        containers.push({
          id: c.id,
          kind: 'sampling',
          site: s.id,
          network: netId,
          code: c.shortCode ?? null,
          name: clean(c.name) || null,
          shape: c.shape || null,
          dimensions: Object.fromEntries(['diameter', 'height', 'length', 'breadth', 'upperSurfaceDiameter', 'lowerSurfaceDiameter'].filter((f) => num(c[f])).map((f) => [f, num(c[f])])),
          volumeL: num(c.volume),
          inUse: !!c.inUse,
          filled: !!c.filled,
          addedAt: c.createdAt ?? null,
          raw: strip(c),
        })
        collectMedia(c, ['containers', c.id], media, 'sampling_container')
      }
      for (const v of dt.vehicles ?? []) {
        vehicles.push({
          id: v.id,
          network: netId,
          site: s.id,
          name: clean(v.name) || null,
          plate: clean(v.number) || clean(v.name) || 'Unknown',
          type: v.categoryName ?? v.type ?? null,
          fuel: v.fuelType ?? null,
          emissionFactor: num(v.co2Emission),
          raw: strip(v),
        })
        collectMedia(v, ['vehicles', v.id], media, 'vehicle')
      }
      for (const f of dt.fpu ?? []) {
        const [flat, flng] = coords(f.coordinate)
        sources.push({ id: f.id, site: s.id, network: netId, name: clean(f.name), address: clean(f.address), lat: flat, lng: flng, active: !f.isSuspended, kml: f.kmlCoordinates ?? null, raw: strip(f) })
      }
    }
  }
  // Kilns that only appear on batches (removed from their site since).
  const siteIds = new Set(sites.map((s) => s.id))
  for (const p of processList) {
    if (p.kilnID && !kilns.has(p.kilnID) && siteIds.has(p.siteId)) {
      const d = processDetails[p.id]?.kilnProcessDetail ?? {}
      kilns.set(p.kilnID, {
        id: p.kilnID,
        site: p.siteId,
        code: p.kilnShortName ?? null,
        name: clean(p.kilnName),
        type: 'pit',
        volumeM3: num(d.kilnVolume) != null ? +(Number(d.kilnVolume) / 1000).toFixed(5) : null,
        active: false,
        raw: { fromBatch: p.id },
      })
    }
  }
  await upsertAll('sites', sites)
  await upsertAll('kilns', [...kilns.values()])
  await upsertAll('containers', containers)
  await upsertAll('vehicles', vehicles)
  await upsertAll('biomass-sources', sources)

  /* ---------- people ---------- */
  const people = new Map<string, Obj>()
  for (const u of o.users?.items ?? []) {
    people.set(u.id, {
      id: u.id,
      name: clean(u.name),
      role: ROLES[u.accountType] ?? 'operator',
      email: u.email || null,
      phone: u.number ? `${u.countryCode ?? ''} ${u.number}`.trim() : null,
      organization: u.biomassAggregatorId ?? null,
      networks: [...new Set([...(u.artisanPros ?? []).map((a: Obj) => a.id), ...(u.csinkNetworks ?? []).map((a: Obj) => a.id), u.artisanProId, u.csinkNetworkId].filter(Boolean))].filter((id) => entities.some((e) => e.id === id)),
      sites: u.siteId && siteIds.has(u.siteId) ? [u.siteId] : [],
      active: !u.isSuspended,
      trainingDocs: [],
      raw: strip(u),
    })
    collectMedia(u, ['people', u.id], media, 'training')
  }
  for (const [netId, nd] of Object.entries<Obj>(details)) {
    for (const f of nd.farmers?.farmers ?? []) {
      if (people.has(f.id)) continue
      people.set(f.id, {
        id: f.id,
        name: clean(f.name),
        role: 'farmer',
        phone: f.number ? `${f.countryCode ?? ''} ${f.number}`.trim() : null,
        email: f.email || null,
        address: clean(f.address) || null,
        organization: entities.find((e) => e.id === netId)?.biomassAggregatorId ?? null,
        networks: [netId],
        sites: [],
        active: !f.isSuspended,
        trainingDocs: [],
        raw: strip(f),
      })
      collectMedia(f, ['people', f.id], media, 'farmer')
    }
  }
  await upsertAll('people', [...people.values()])

  /* ---------- feedstocks ---------- */
  const crops: Obj[] = o.csinkManager?.crops ?? []
  const strategies: Record<string, string> = screens.feedstockStrategies ?? {}
  const feedNames = new Map<string, string>() // name → id
  for (const c of crops) feedNames.set(clean(c.cropName), c.cropId)
  for (const p of processList) if (p.cropName && !feedNames.has(clean(p.cropName))) feedNames.set(clean(p.cropName), processDetails[p.id]?.kilnProcessDetail?.cropId ?? undefined!)
  const existingFeeds = await payload.find({ collection: 'feedstocks', pagination: false, depth: 0, overrideAccess: true })
  const feedRows = [...feedNames.entries()].map(([name, id]) => {
    const rows = processList.filter((p) => clean(p.cropName) === name).map((p) => processDetails[p.id]?.kilnProcessDetail ?? {})
    const prev = existingFeeds.docs.find((f) => f.name === name)
    return {
      id: prev?.id ?? id ?? crypto.randomUUID(),
      name,
      // Keep a strategy edited in our admin; otherwise take the one shown in Circonomy.
      strategy: prev?.strategy ?? strategies[name] ?? null,
      spc: prev?.spc ?? (screens.feedstockSpc ?? []).includes(name),
      bulkDensity: +(median(rows.map((r) => Number(r.density) || 0)) * 1000).toFixed(1) || null,
      carbonContent: +median(rows.map((r) => Number(r.carbonPercentage) || 0)).toFixed(2) || null,
      volumeTracking: prev?.volumeTracking ?? false,
    }
  })
  await upsertAll('feedstocks', feedRows)

  /* ---------- batches ---------- */
  const containerIds = new Set(containers.map((c) => c.id))
  const batchRows = processList.map((p) => {
    const d: Obj = processDetails[p.id] ?? {}
    const k: Obj = d.kilnProcessDetail ?? {}
    const x = xBatches.get(p.id)
    const temps = (d.kilnProcessTemperature ?? []).map((t: Obj) => Number(t.temperature)).filter((t: number) => t > 0)
    const moisture = (d.kilnProcessBiomass ?? []).flatMap((b: Obj) =>
      (b.processBiomassRelation ?? []).flatMap((r: Obj) => r.biomassAddition?.moistureArray ?? []),
    )
    collectMedia(d, ['batches', p.id], media, 'batch')
    return {
      id: p.id,
      code: p.shortCode,
      date: p.startTime,
      network: p.artisanProId ?? p.networkId,
      site: p.siteId,
      kiln: kilns.has(p.kilnID) ? p.kilnID : null,
      startDate: p.startTime,
      endedAt: p.endTime ?? null,
      feedstock: clean(p.cropName),
      biomassKg: num(k.biomassQty ?? p.biomassQuantity) ?? 0,
      biocharL: num(k.bioCharQty ?? p.biocharQuantity) ?? 0,
      bulkDensity: num(k.density) ?? 0,
      carbonContent: num(k.carbonPercentage) != null ? Number(k.carbonPercentage) / 100 : 0,
      csinkT: kgToT(k.carbonCredits) ?? 0,
      operatorName: x?.operatorName ?? '',
      status: STATUS[k.status ?? p.status] ?? 'not_assessed',
      assessedBy: clean(k.statusAccessedByName) || x?.assessedBy || '',
      assessorEmail: x?.assessorEmail ?? '',
      assessedAt: k.statusAccessedTime ?? null,
      sinkApproved: !!x?.sinkApproved,
      registered: !!x?.registered,
      rejectionReason: clean(k.reason) || x?.rejectionReason || '',
      temperatureC: temps.length ? Math.max(...temps) : null,
      moistureReadings: moisture,
      co2EmissionKg: num(k.co2Emission),
      methaneEmissionKg: num(k.methaneEmission),
      shortTermSinkT: kgToT(k.shortTermCarbonSink),
      kilnVolumeL: num(k.kilnVolume),
      samplingContainer: d.samplingContainer?.id && containerIds.has(d.samplingContainer.id) ? d.samplingContainer.id : null,
      raw: strip(d),
    }
  })
  await upsertAll('batches', batchRows)
  const batchIds = new Set(batchRows.map((b) => b.id))
  const batchByCode = new Map(batchRows.map((b) => [b.code, b.id]))

  /* ---------- biomass collection, mixing, packaging, inventory, applications ---------- */
  const sourceByName = new Map(sources.map((s) => [`${s.site}|${s.name}`, s.id]))
  await upsertAll(
    'biomass-collections',
    (o.biomassCollection?.items ?? []).filter((c: Obj) => siteIds.has(c.siteId)).map((c: Obj) => {
      const x = xCollections.get(c.id)
      collectMedia(c, ['biomass-collections', c.id], media, 'transportation')
      return {
        id: c.id,
        date: c.dropTime ?? c.createdAt,
        network: c.artisanProId ?? c.networkId,
        site: c.siteId,
        farmer: c.farmerId && people.has(c.farmerId) ? c.farmerId : null,
        feedstock: clean(c.cropName),
        source: clean(c.fpuName),
        quantityKg: num(c.biomassQuantity) ?? 0,
        transport: c.transportationType === 'manual' ? 'manual' : 'vehicle',
        vehicleDetails: [c.vehicleType, c.vehicleNumber, c.vehicleFuelType].filter(Boolean).join(' · ') || x?.vehicleDetails || '',
        emissionFactor: x?.emissionFactor ?? null,
        distanceKm: num(c.distance),
        emissions: x?.emissions ?? null,
        biomassSource: sourceByName.get(`${c.siteId}|${clean(c.fpuName)}`) ?? null,
        raw: strip(c),
      }
    }),
  )

  const mixRow = (m: Obj, x: Obj | undefined, collection: 'mixings' | 'packagings') => {
    collectMedia(m, [collection, m.id], media, 'packaging')
    return {
      id: m.id,
      date: m.createdAt,
      batches: (x?.batches ?? []).filter((id: string) => batchIds.has(id)),
      network: m.artisanProId ?? m.csinkNetworkId,
      site: m.siteId,
      description: x?.description ?? '',
      rejectedBiocharL: x?.rejectedBiocharL ?? 0,
      raw: strip(m),
    }
  }
  await upsertAll(
    'mixings',
    (o.mixing?.items ?? []).filter((m: Obj) => siteIds.has(m.siteId)).map((m: Obj) => ({
      ...mixRow(m, xMixings.get(m.id), 'mixings'),
      mixingType: clean(m.mixType),
      biocharL: num(m.totalBiocharQuantity) ?? 0,
      otherMaterialKg: num(m.otherMaterialQuantity) ?? 0,
      totalKg: num(m.totalMixedQuantity) ?? 0,
      bagDetails: (m.createdBags ?? []).map((b: Obj) => `${b.name} (${b.quantity} ${b.quantityUnit})`).join(', '),
      bagsCreated: num(m.totalBags) ?? 0,
      bagsAvailable: num(m.availableBags) ?? 0,
    })),
  )
  await upsertAll(
    'packagings',
    (o.packaging?.items ?? []).filter((m: Obj) => siteIds.has(m.siteId)).map((m: Obj) => {
      const x = xPackagings.get(m.id)
      return {
        ...mixRow(m, x, 'packagings'),
        packagingType: clean(m.mixType),
        biocharKg: num(m.totalBiocharQuantity) ?? 0,
        mixKg: num(m.totalMixedQuantity) ?? 0,
        bagDetails: (m.createdBags ?? []).map((b: Obj) => `${b.name} (${b.quantity} ${b.quantityUnit})`).join(', ') || x?.bagDetails || '',
        bagsCreated: num(m.totalBags) ?? 0,
        bagsDistributed: (num(m.totalBags) ?? 0) - (num(m.availableBags) ?? 0),
        bagsRemaining: num(m.availableBags) ?? 0,
      }
    }),
  )
  await upsertAll(
    'inventories',
    (o.inventories?.items ?? []).map((i: Obj) => ({
      id: i.id,
      code: i.displayId,
      network: knownNet(i.artisanProId ?? i.csinkNetworkId),
      site: siteIds.has(i.siteId) ? i.siteId : null,
      batches: (i.kilnProcessDisplayIds ?? []).map((c: string) => batchByCode.get(c)).filter(Boolean),
      packagingType: clean(i.packagingType),
      bagType: i.bagType,
      bagQuantity: num(i.bagQuantity),
      bagUnit: i.bagQuantityUnit,
      actualQuantity: num(i.actualQuantity),
      packedAt: i.packedDate,
      status: i.status,
      raw: strip(i),
    })),
  )
  await upsertAll(
    'applications',
    (o.distributions?.items ?? []).map((a: Obj) => {
      const [lat, lng] = coords(a.recipient?.coordinate)
      collectMedia(a, ['applications', a.id], media, 'application')
      return {
        id: a.id,
        date: a.createdAt,
        network: knownNet(a.network?.id),
        site: a.site?.id && siteIds.has(a.site.id) ? a.site.id : null,
        recipientName: clean(a.recipient?.name),
        recipientPhone: a.recipient?.number ? `${a.recipient.countryCode ?? ''} ${a.recipient.number}`.trim() : null,
        recipientAddress: clean(a.recipient?.address),
        lat,
        lng,
        mixTypes: (a.packingTypes ?? []).map((p: Obj) => p.name),
        mode: a.vehicle ? 'vehicle' : 'manual',
        vehicle: a.vehicle ? [a.vehicle.fuelType, a.vehicle.number ?? a.vehicle.name].filter(Boolean).join(' - ') : null,
        kind: a.isOpen ? 'Diffuse distribution' : a.entityType,
        open: !!a.isOpen,
        fullySinked: !!a.isCompletelySinked,
        raw: strip(a),
      }
    }),
  )

  /* ---------- stocks, sinks, documents ---------- */
  const netByName = new Map(entities.map((e) => [clean(e.name), e.id]))
  const stocks: Obj[] = o.stocks?.stocks ?? []
  await upsertAll(
    'stocks',
    stocks.map((s) => {
      collectMedia(s, ['stocks', String(s.stockId)], media, 'certificate')
      return {
        id: `stock-${s.stockId}`,
        stockId: String(s.stockId),
        code: s.code ?? '',
        network: netByName.get(clean(s.networkName)) ?? null,
        feedstock: clean(s.cropName),
        biocharT: num(s.bioCharQuantity) ?? 0,
        creditsT: num(s.carbonCredits),
        carbonContent: num(s.carbonPercentage),
        producedAt: s.productionDate ?? null,
        generatedAt: s.createdAt ?? null,
        status: s.status ?? null,
        partial: false,
        deleted: !!s.isDeleted,
        certificates: (s.certificates ?? []).map((c: Obj) => ({ id: c.certificateId, body: c.certificationBodyName, date: c.certificationDate, fileId: c.certificateFile?.id ?? null })),
        raw: strip(s),
      }
    }),
  )
  // Old stock rows (made from screenshots) used random ids — replace them.
  await db.execute(sql`delete from stocks where id not like 'stock-%'`)
  await upsertAll(
    'sinks',
    (o.sinks?.sinks ?? []).map((s: Obj) => {
      collectMedia(s, ['sinks', String(s.id)], media, 'monitoring_report')
      return {
        id: `sink-${s.id}`,
        sinkId: String(s.id),
        date: s.createdAt,
        stock: `stock-${s.stockId}`,
        biocharT: num(s.biocharQuantity) ?? 0,
        matrixId: (s.blendingMatrixId ?? []).join(', '),
        status: String(s.sinkStatus ?? 'pending').toLowerCase(),
        deleted: !!s.isDeleted,
        reports: (s.files ?? []).map((f: Obj) => ({ description: f.description, code: f.identificationCode, fileId: f.file?.id ?? null })),
        raw: strip(s),
      }
    }),
  )
  await db.execute(sql`delete from sinks where id not like 'sink-%'`)

  const proj: Obj = o.project ?? {}
  const DOC_TYPES: Record<string, string> = { csi_network_verification: 'csi-compliance', verification_statement: 'csi-compliance', ceres_certificate: 'certificate' }
  const projDocs: Obj[] = proj.projectDocuments ?? []
  projDocs.forEach((d) => d.file?.id && collectMedia(d.file, ['documents', d.id], media, 'document'))
  await flushMedia()
  await upsertAll(
    'documents',
    projDocs.map((d: Obj) => {
      return {
        id: d.id,
        title: clean(d.bodyName) || clean(d.type),
        category: DOC_TYPES[d.type] ?? 'csi-compliance',
        reference: d.certificateId ?? '',
        issuedAt: d.issueDate ?? null,
        expiresAt: d.expiryDate ?? null,
        file: d.file?.id ?? null,
        raw: strip(d),
      }
    }),
  )
  // The document rows made from screenshots are superseded by the real ones.
  await db.execute(sql`delete from documents where raw is null`)

  /* ---------- activity log ---------- */
  const logs: Obj[] = o.activityLogs?.items ?? []
  await upsertAll(
    'activity-logs',
    logs.map((l) => ({
      id: l.id,
      message: clean(l.message),
      network: knownNet(l.redirect?.artisanProId ?? l.redirect?.csinkNetworkId),
      actionType: l.actionType ?? null,
      at: l.createdAt,
    })),
  )

  /* ---------- company ---------- */
  const cm: Obj = o.csinkManager ?? {}
  const prev = (await payload.findGlobal({ slug: 'company', depth: 0, overrideAccess: true })) as Obj
  const prevProfile: Partial<Company> = prev?.profile ?? {}
  const regNets = entities.filter((e) => firstRegistered.has(e.id)).map((e) => e.id)
  const profile: Omit<Company, 'name' | 'kind' | 'address' | 'email' | 'phone'> = {
    admins: (cm.managerDetails ?? []).map((m: Obj) => ({
      id: m.managerId,
      name: clean(m.managerName),
      role: m.isBillingManager ? 'Billing manager' : m.accountType === 'company_admin' ? 'Company admin' : clean(m.accountType),
      email: m.managerEmail ?? undefined,
      phone: m.managerPhone ? `${m.countryCode ?? ''} ${m.managerPhone}`.trim() : undefined,
    })),
    billingManagers: prevProfile.billingManagers ?? [],
    billingDocs: prevProfile.billingDocs ?? [],
    icsManagers: prevProfile.icsManagers ?? [],
    documents: prevProfile.documents ?? [],
    services: { afforestation: !!cm.isAfforestationEnabled, iot: !!cm.isIotEnabled },
    feedstocks: feedRows.map((f) => ({ name: f.name, strategy: f.strategy === 'avoidance' || f.strategy === 'compensation' ? f.strategy : null, spc: f.spc })),
    mixingTypes: (cm.mixingTypes ?? []).map((m: Obj) => clean(m.name)),
    applicationTypes: (cm.applicationTypes ?? []).map((a: Obj) => clean(a.type ?? a.name)),
    approvedNetworkIds: entities.filter((e) => e.isCsiApproved || ceres.has(e.id)).map((e) => e.id),
    references: prevProfile.references ?? [],
    appConfig: prevProfile.appConfig ?? { artisan: structuredClone(DEFAULT_APP_CONFIG), csink: structuredClone(DEFAULT_APP_CONFIG), company: structuredClone(DEFAULT_APP_CONFIG) },
    pendingAppConfig: prevProfile.pendingAppConfig,
    audit: prevProfile.audit ?? [],
    projects: [
      {
        id: proj.id ?? 'pr-1',
        name: clean(proj.registryProjectName) || clean(proj.name),
        registry: 'CSI (C-Sink 1000+)',
        status: 'registered',
        networkIds: regNets,
        createdAt: new Date().toISOString(),
      },
    ],
    certificates: stocks
      .flatMap((s) => s.certificates ?? [])
      .filter((c: Obj, i: number, all: Obj[]) => all.findIndex((x) => x.certificateId === c.certificateId) === i)
      .map((c: Obj) => ({
        id: c.certificateId,
        companyName: clean(cm.name),
        email: cm.email ?? '',
        phone: '',
        issuer: clean(c.certificationBodyName),
        number: c.certificateId,
        validFrom: String(c.certificationDate ?? '').slice(0, 10),
        validTo: '',
      })),
  }
  const [clat, clng] = coords(cm.location)
  const cert: Obj = o.certificateRequest ?? {}
  if (cm.companyLogo) collectMedia(cm.companyLogo, ['company', 'logo'], media, 'logo')
  await payload.updateGlobal({
    slug: 'company',
    data: {
      name: clean(cm.name) || 'Reclimate Pte Ltd',
      kind: 'C-sink manager',
      address: clean(cm.locationName),
      email: cm.email ?? '',
      phone: cm.phoneNumber ? `${cm.countryCode ?? ''} ${cm.phoneNumber}`.trim() : '',
      dmrvProvider: 'Circonomy',
      profile: { ...profile, location: { lat: clat, lng: clng }, projectDetails: strip(proj) },
      certificateSettings: {
        companyName: clean(cert.cSinkManagerCompanyName),
        email: cert.email ?? '',
        phone: cert.phoneNumber ?? '',
        logoFileId: cm.companyLogo?.id ?? null,
        signingAuthorities: strip(cert.signingAuthorityDetails ?? []),
      },
      raw: strip(cm),
    },
    overrideAccess: true,
  })
  console.log('✓ company profile')

  await flushMedia()
  console.log('Import complete.')
  process.exit(0)
}

// `payload run` exits once this module has loaded, so the work must finish inside it.
try {
  await run()
} catch (err) {
  console.error(err)
  process.exit(1)
}
