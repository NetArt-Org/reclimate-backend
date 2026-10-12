import 'server-only'

import type { Application, Batch, BiomassCollection, File as FileRow, Mixing, Packaging } from '@/payload-types'

/**
 * The field app works with one "batch" object across its 4-day wizard (collect → burn → mix & pack →
 * give & apply), with the captured values keyed as in the app (`v.qty`, `v.firePh`…). In Neon that
 * batch is spread over `batches`, `biomass-collections`, `mixings` and `applications`. This file maps
 * between the two, so the app keeps its shape and the admin sees normal records.
 */

export interface AppMedia {
  id: string
  pend: false
  kind: 'photo' | 'video'
  remoteId: string
  url: string
}
export interface AppMoisture {
  val: string
  ph: AppMedia | null
}
export type AppValue = string | number | AppMedia[] | AppMoisture[] | undefined
export type AppStatus = 'progress' | 'waiting' | 'approved' | 'rejected' | 'done'

export interface AppBatch {
  id: string
  remoteId?: string
  bio: string
  kg: number
  kiln: string
  date: string
  status: AppStatus
  day: number
  step: number
  litres: number
  v: Record<string, AppValue>
  by?: string
  workerName?: string
  rejectKey?: string | null
  rejectNote?: string
  reasonText?: string
  /** The decision is the admin's final one (not a supervisor's network review). */
  adminDecision?: boolean
  fixing?: boolean
  /** Carbon credits of the batch (t CO₂e) and whether it is still an estimate from litres. */
  credits?: number | null
  creditsEstimated?: boolean
}

/** What the app keeps per batch that has no column: wizard position and Day 1/3/4 details. */
export interface AppState {
  day?: number
  step?: number
  unit?: 'kg' | 'ton'
  qty?: number
  transport?: string
  bag?: string
  bags?: number
  giveBags?: number
  to?: string
  loc?: string
  lat?: number
  lng?: number
  /** Extra temperature readings (the first is `temperatureC`'s source). */
  temps?: number[]
  vehicle?: string
  measure?: string
  sample?: string
  packagingId?: string
  fixing?: boolean
  rejectKey?: string | null
  rejectNote?: string
  collectionId?: string
  mixingId?: string
  applicationId?: string
  /** Credits were estimated from litres here, not computed by an assessor. */
  csinkEstimated?: boolean
}

export const appState = (b: { raw?: unknown }): AppState => (((b.raw as Record<string, unknown>) ?? {}).app as AppState) ?? {}

const pad = (n: number) => String(n).padStart(2, '0')
export const ddmmyyyy = (iso?: string | null) => {
  if (!iso) return ''
  const d = new Date(iso)
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`
}
const ms = (iso?: string | null) => (iso ? new Date(iso).getTime() : undefined)
export const num = (v: unknown): number | null => {
  const n = parseFloat(String(v ?? ''))
  return Number.isFinite(n) ? n : null
}
const short = (name?: string | null) => (name ?? '').trim().split(/\s+/).slice(0, 2).join(' ')

/* ------------------------------------------------------------------ */
/* Status                                                               */
/* ------------------------------------------------------------------ */

export function statusToApp(b: Batch, st: AppState): AppStatus {
  switch (b.status) {
    case 'started':
      return 'progress'
    case 'not_assessed':
      return 'waiting'
    case 'rejected':
    case 'admin_rejected':
      return 'rejected'
    default:
      return (st.day ?? 0) > 4 ? 'done' : 'approved'
  }
}

/**
 * The status a worker's save may set. Approving and rejecting is for supervisors and admins, and a stale
 * save from an offline phone never undoes a decision: anything else keeps the current status.
 */
export function workerStatus(current: Batch['status'] | undefined, wanted: AppStatus): Batch['status'] {
  const next = wanted === 'progress' ? 'started' : wanted === 'waiting' ? 'not_assessed' : undefined
  if (!current) return next ?? 'started'
  if (next === 'not_assessed' && (current === 'started' || current === 'rejected' || current === 'admin_rejected')) return 'not_assessed'
  return current
}

/* ------------------------------------------------------------------ */
/* Files → app media slots                                              */
/* ------------------------------------------------------------------ */

export const fileUrl = (id: string) => `/api/field/files/${id}`

export const media = (f: Pick<FileRow, 'id' | 'mimeType'>): AppMedia => ({
  id: `f-${f.id}`,
  pend: false,
  kind: f.mimeType?.startsWith('video') ? 'video' : 'photo',
  remoteId: f.id,
  url: fileUrl(f.id),
})

/**
 * Which wizard slot a file belongs to. Files saved by the app carry `field:<key>`; files migrated from
 * Circonomy carry its categories, mapped to the nearest slot.
 */
export function slotOf(f: Pick<FileRow, 'category' | 'mimeType' | 'ownerCollection'>): string | undefined {
  const c = f.category ?? ''
  if (c.startsWith('field:')) return c.slice(6)
  const video = f.mimeType?.startsWith('video')
  if (f.ownerCollection === 'biomass-collections') return 'bphoto'
  if (f.ownerCollection === 'mixings' || f.ownerCollection === 'packagings') return 'packPh'
  if (f.ownerCollection === 'applications') return 'applyPh'
  switch (c) {
    case 'firing':
      return video ? 'fireVid' : 'firePh'
    case 'pre_quenching':
      return 'preq'
    case 'quenching':
      return 'quench'
    case 'kiln_process_biomass_moisture':
      return 'moist'
    case 'transportation':
      return 'bphoto'
    case 'packaging':
      return 'packPh'
    case 'applications':
    case 'distributedInventory':
      return 'applyPh'
    default:
      return undefined
  }
}

/* ------------------------------------------------------------------ */
/* Neon → app                                                           */
/* ------------------------------------------------------------------ */

export interface Related {
  kilnName?: string
  collection?: BiomassCollection
  mixing?: Mixing
  application?: Application
  files: FileRow[]
}

const TRANSPORT_TO_APP: Record<string, string> = { manual: 'Manual', vehicle: 'Vehicle' }

export function batchToApp(b: Batch, r: Related): AppBatch {
  const st = appState(b)
  const col = r.collection
  const mix = r.mixing
  const app = r.application

  // A migrated batch has no wizard position: a burn still going is on Day 2, one waiting for (or sent back from)
  // review on Day 3, and an approved one is history — complete, not a task for the step-by-step app.
  const day = st.day ?? (b.status === 'started' ? 2 : b.status === 'not_assessed' || b.status === 'rejected' || b.status === 'admin_rejected' ? 3 : 5)
  const step = st.step ?? 0

  const v: Record<string, AppValue> = {}
  const put = (k: string, val: unknown) => {
    if (val != null && val !== '') v[k] = typeof val === 'number' ? String(val) : (val as AppValue)
  }

  // Day 1
  put('source', col?.source)
  put('btype', b.feedstock || col?.feedstock)
  const qty = st.qty ?? num(col?.quantityKg) ?? num(b.biomassKg)
  if (qty) {
    put('qty', qty)
    v.unit = st.unit ?? 'kg'
  }
  put('transport', TRANSPORT_TO_APP[col?.transport ?? ''] ?? st.transport)
  // Day 2
  put('kiln', r.kilnName)
  const readings = Array.isArray(b.moistureReadings) ? (b.moistureReadings as unknown[]).map(num).filter((x): x is number => x != null).slice(0, 5) : []
  if (b.startDate) v.burn = ms(b.startDate)
  if (b.endedAt) v.burnEnd = ms(b.endedAt)
  const temps = st.temps?.length ? st.temps : num(b.temperatureC) != null ? [num(b.temperatureC)!] : []
  temps.forEach((t, i) => put(i === 0 ? 'temp' : `temp${i + 1}`, t))
  put('vehicle', st.vehicle)
  put('measure', st.measure)
  put('sample', st.sample)
  const litres = num(b.biocharL)
  if (litres) put('litres', litres)
  // Day 3
  put('mixType', mix?.mixingType)
  put('mixL', num(mix?.biocharL))
  put('bag', mix?.bagDetails ?? st.bag)
  put('bags', num(mix?.bagsCreated) ?? st.bags)
  // Day 4
  put('to', app?.recipientName ?? st.to)
  put('giveBags', st.giveBags)
  put('loc', st.loc ?? app?.recipientAddress)
  if (app?.lat != null || st.lat != null) v.lat = (app?.lat ?? st.lat) as number
  if (app?.lng != null || st.lng != null) v.lng = (app?.lng ?? st.lng) as number

  // Photos and videos, in capture order.
  const bySlot = new Map<string, AppMedia[]>()
  const moistPhotos: (AppMedia | null)[] = []
  for (const f of [...r.files].sort((a, z) => String(a.createdAt).localeCompare(String(z.createdAt)))) {
    const slot = slotOf(f)
    if (!slot) continue
    if (slot === 'moist' || slot.startsWith('moist:')) {
      // App photos name their row; migrated meter photos fill the rows in order.
      let i = slot.startsWith('moist:') ? Number(slot.slice(6)) : -1
      if (i < 0) {
        i = 0
        while (i < 5 && moistPhotos[i]) i++
      }
      if (i >= 0 && i < 5) moistPhotos[i] = media(f)
      continue
    }
    bySlot.set(slot, [...(bySlot.get(slot) ?? []), media(f)])
  }
  bySlot.forEach((items, slot) => (v[slot] = items))
  const rows = Math.max(readings.length, moistPhotos.filter(Boolean).length)
  if (rows) v.moist = Array.from({ length: Math.min(rows, 5) }, (_, i) => ({ val: readings[i] != null ? String(readings[i]) : '', ph: moistPhotos[i] ?? null }))

  const status = statusToApp(b, st)
  return {
    id: b.code,
    remoteId: b.id,
    status,
    day,
    step,
    date: ddmmyyyy(b.date),
    bio: day > 1 ? (b.feedstock ?? '') : '',
    kg: day > 1 ? (num(b.biomassKg) ?? 0) : 0,
    kiln: r.kilnName ?? '',
    litres: day > 2 ? (litres ?? 0) : 0,
    v,
    by: status !== 'progress' && status !== 'waiting' ? short(b.assessedBy) || undefined : undefined,
    workerName: b.operatorName || undefined,
    rejectKey: status === 'rejected' ? (st.rejectKey ?? null) : undefined,
    rejectNote: status === 'rejected' ? (st.rejectNote ?? '') : undefined,
    reasonText: status === 'rejected' ? (b.rejectionReason ?? undefined) : undefined,
    adminDecision: b.status === 'admin_approved' || b.status === 'admin_rejected',
    fixing: st.fixing,
    credits: num(b.csinkT),
    creditsEstimated: !!st.csinkEstimated,
  }
}

/** Media ids referenced in an app batch, per wizard slot (moisture photos as `moist:<row>`). */
export function mediaBySlot(v: AppBatch['v']): Map<string, string[]> {
  const out = new Map<string, string[]>()
  for (const [k, val] of Object.entries(v)) {
    if (!Array.isArray(val)) continue
    if (k === 'moist') {
      ;(val as AppMoisture[]).forEach((row, i) => {
        if (row?.ph?.remoteId) out.set(`moist:${i}`, [row.ph.remoteId])
      })
    } else {
      const ids = (val as AppMedia[]).map((m) => m?.remoteId).filter((x): x is string => !!x)
      if (ids.length) out.set(k, ids)
    }
  }
  return out
}

/** Which record a wizard slot's files belong to. */
export const ownerOfSlot = (slot: string): 'collection' | 'mixing' | 'packaging' | 'application' | 'batch' =>
  slot === 'bphoto' ? 'collection' : slot === 'mixPh' ? 'mixing' : slot === 'packPh' ? 'packaging' : slot === 'applyPh' ? 'application' : 'batch'

/** "23/09/2026" → ISO at local noon (or now when missing). */
export function appDateToIso(d?: string) {
  const m = d?.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  return m ? new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]), 12).toISOString() : new Date().toISOString()
}

/**
 * Estimated carbon sink (t CO₂e) of a batch from its biochar volume: dry mass from bulk density,
 * carbon from the feedstock's carbon content, × 44/12 for CO₂. An assessor can correct it later.
 */
export function estimateCsink(biocharL: number, bulkDensity?: number | null, carbonContent?: number | null) {
  if (!biocharL || !bulkDensity || !carbonContent) return null
  const massT = (biocharL / 1000) * bulkDensity / 1000
  return +(massT * (carbonContent / 100) * (44 / 12)).toFixed(4)
}

/* ------------------------------------------------------------------ */
/* Records as the Classic app lists them                                */
/* ------------------------------------------------------------------ */

const split = (files: FileRow[]) => ({
  photos: files.filter((f) => !f.mimeType?.startsWith('video')).map(media),
  videos: files.filter((f) => f.mimeType?.startsWith('video')).map(media),
})

export const collectionToApp = (c: BiomassCollection, files: FileRow[]) => ({
  id: c.id,
  date: c.date,
  source: c.source ?? '',
  feedstock: c.feedstock ?? '',
  kg: num(c.quantityKg) ?? 0,
  transport: c.transport === 'vehicle' ? 'Vehicle' : 'Manual',
  vehicle: c.vehicleDetails ?? '',
  ...split(files),
})

export const mixingToApp = (m: Mixing, files: FileRow[]) => ({
  id: m.id,
  date: m.date,
  mixType: m.mixingType ?? '',
  feedstock: m.feedstock ?? '',
  biocharL: num(m.biocharL) ?? 0,
  otherKg: num(m.otherMaterialKg) ?? 0,
  totalKg: num(m.totalKg) ?? 0,
  note: m.description ?? '',
  ...split(files),
})

export const packagingToApp = (p: Packaging, files: FileRow[]) => ({
  id: p.id,
  date: p.date,
  packagingType: p.packagingType ?? '',
  bag: p.bagDetails ?? '',
  bags: num(p.bagsCreated) ?? 0,
  bagsRemaining: num(p.bagsRemaining) ?? 0,
  biocharKg: num(p.biocharKg) ?? 0,
  mixKg: num(p.mixKg) ?? 0,
  note: p.description ?? '',
  ...split(files),
})

export const applicationToApp = (a: Application, files: FileRow[]) => ({
  id: a.id,
  date: a.date,
  kind: a.kind === 'distribution' ? 'distribution' : 'application',
  recipient: a.recipientName ?? '',
  phone: a.recipientPhone ?? '',
  address: a.recipientAddress ?? '',
  lat: num(a.lat),
  lng: num(a.lng),
  mixType: Array.isArray(a.mixTypes) ? String((a.mixTypes as unknown[])[0] ?? '') : '',
  quantity: num(a.quantity),
  unit: a.quantityUnit ?? '',
  bags: num(a.bags),
  bagType: a.bagType ?? '',
  mode: a.mode === 'vehicle' ? 'Vehicle' : 'Manual',
  vehicle: a.vehicle ?? '',
  ...split(files),
})

export type AppCollection = ReturnType<typeof collectionToApp>
export type AppMixing = ReturnType<typeof mixingToApp>
export type AppPackaging = ReturnType<typeof packagingToApp>
export type AppApplication = ReturnType<typeof applicationToApp>
