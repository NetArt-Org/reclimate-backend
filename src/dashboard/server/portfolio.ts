'use server'

import { sql } from '@payloadcms/db-postgres'
import { revalidatePath } from 'next/cache'

import { db, n, relId, requireAdmin } from './payload'
import { guard, MAX_UPLOAD_BYTES, MAX_UPLOAD_LABEL, UserError } from './result'
import { storeUpload } from './storage'
import { bucket, isFirebaseConfigured } from '@/lib/firebase/admin'
import { randomUUID } from 'crypto'

export interface PortfolioDocument {
  id: string
  title: string
  category: string
  reference: string
  issuedAt: string | null
  expiresAt: string | null
  file: { id: string; name: string; size: number; type: string } | null
}

export interface StockRow {
  id: string
  stockId: string
  code: string
  networkId: string | null
  feedstock: string
  biocharT: number
  creditsT: number | null
  producedAt: string | null
  generatedAt: string | null
  partial: boolean
  deleted: boolean
}

export interface SinkRow {
  id: string
  sinkId: string
  date: string
  stockId: string | null
  stockRef: string | null
  biocharT: number
  matrixId: string
  status: 'pending' | 'approved' | 'rejected'
  deleted: boolean
}

/** Per-network progress through the credit pipeline (Register credits → telemetry). */
export interface Telemetry {
  networkId: string
  collections: number
  batches: number
  assessed: number
  processed: number
  sinkApproved: number
  registered: number
  /** t CO₂e that has passed the sink check and is waiting to be registered. */
  readyT: number
}

export interface PortfolioExtras {
  documents: PortfolioDocument[]
  stocks: StockRow[]
  sinks: SinkRow[]
  telemetry: Telemetry[]
  registerableT: number
}

const all = { pagination: false, depth: 1, overrideAccess: true } as const
/** Populate only what the tables show — never the files' legacy base64 `data` column. */
const populate = { files: { name: true, mimeType: true, size: true }, stocks: { stockId: true } } as const
const LEDGERS = ['stocks', 'sinks'] as const

/** Ledgers, documents and pipeline status for the Projects portfolio page. */
export async function loadPortfolioExtras() {
  return guard(async (): Promise<PortfolioExtras> => {
    await requireAdmin()
    const payload = await db()
    const [documents, stocks, sinks, telemetry] = await Promise.all([
      payload.find({ collection: 'documents', ...all, populate, select: { raw: false }, sort: '-issuedAt' }),
      payload.find({ collection: 'stocks', ...all, depth: 0, select: { raw: false }, sort: '-generatedAt' }),
      payload.find({ collection: 'sinks', ...all, populate, select: { raw: false }, sort: '-date' }),
      payload.db.drizzle.execute(sql`
        select n.id as network_id,
          (select count(*) from biomass_collections c where c.network_id = n.id) as collections,
          count(b.id) as batches,
          count(b.id) filter (where b.status in ('admin_approved', 'admin_rejected')) as assessed,
          (select count(*) from mixings m where m.network_id = n.id) + (select count(*) from packagings p where p.network_id = n.id) as processed,
          count(b.id) filter (where b.sink_approved) as sink_approved,
          count(b.id) filter (where b.registered) as registered,
          coalesce(sum(b.csink_t) filter (where b.status = 'admin_approved' and b.sink_approved and not b.registered), 0) as ready_t
        from networks n left join batches b on b.network_id = n.id
        group by n.id`),
    ])

    const tel = (telemetry.rows as Record<string, unknown>[]).map(
      (r): Telemetry => ({
        networkId: String(r.network_id),
        collections: n(r.collections),
        batches: n(r.batches),
        assessed: n(r.assessed),
        processed: n(r.processed),
        sinkApproved: n(r.sink_approved),
        registered: n(r.registered),
        readyT: n(r.ready_t),
      }),
    )

    return {
      documents: documents.docs.map((d) => {
        const f = d.file && typeof d.file === 'object' ? d.file : null
        return {
          id: String(d.id),
          title: d.title,
          category: d.category,
          reference: d.reference ?? '',
          issuedAt: d.issuedAt ?? null,
          expiresAt: d.expiresAt ?? null,
          file: f ? { id: String(f.id), name: f.name, size: f.size ?? 0, type: f.mimeType } : null,
        }
      }),
      stocks: stocks.docs.map((s) => ({
        id: String(s.id),
        stockId: s.stockId,
        code: s.code ?? '',
        networkId: relId(s.network) ?? null,
        feedstock: s.feedstock ?? '',
        biocharT: s.biocharT ?? 0,
        creditsT: s.creditsT ?? null,
        producedAt: s.producedAt ?? null,
        generatedAt: s.generatedAt ?? null,
        partial: !!s.partial,
        deleted: !!s.deleted,
      })),
      sinks: sinks.docs.map((s) => {
        const st = s.stock && typeof s.stock === 'object' ? s.stock : null
        return {
          id: String(s.id),
          sinkId: s.sinkId,
          date: s.date,
          stockId: st ? String(st.id) : null,
          stockRef: st ? st.stockId : null,
          biocharT: s.biocharT ?? 0,
          matrixId: s.matrixId ?? '',
          status: s.status,
          deleted: !!s.deleted,
        }
      }),
      telemetry: tel,
      registerableT: tel.reduce((a, t) => a + t.readyT, 0),
    }
  })()
}

/** Register every batch that is admin-approved and sink-approved but not yet on the registry. */
export async function registerCredits() {
  return guard(async (): Promise<{ batches: number; t: number }> => {
    const { payload, user } = await requireAdmin()
    const res = await payload.db.drizzle.execute(sql`
      update batches set registered = true, updated_at = now()
      where status = 'admin_approved' and sink_approved and not registered
      returning csink_t`)
    const rows = res.rows as { csink_t: string }[]
    const t = rows.reduce((a, r) => a + n(r.csink_t), 0)
    await payload.create({
      collection: 'activity-logs',
      data: { message: `${t.toFixed(3)} t CO₂e registered from ${rows.length} batches`, by: user.name },
      overrideAccess: true,
    } as never)
    revalidatePath('/admin', 'layout')
    return { batches: rows.length, t }
  })()
}

/** Add a compliance document; the file (optional) is stored in Neon. */
const DOC_CATEGORIES = ['csi-compliance', 'certificate', 'other'] as const
const DATE = /^\d{4}-\d{2}-\d{2}$/

/** Document fields from a form, validated. */
function documentFields(form: FormData) {
  const title = String(form.get('title') ?? '').trim()
  if (!title) throw new UserError('Give the document a title')
  if (title.length > 200) throw new UserError('The title can be at most 200 characters')
  const category = String(form.get('category') || 'csi-compliance')
  if (!(DOC_CATEGORIES as readonly string[]).includes(category)) throw new UserError('Choose a category')
  const reference = String(form.get('reference') ?? '').trim().slice(0, 100)
  const date = (k: string) => {
    const v = String(form.get(k) ?? '').trim()
    if (!v) return null
    if (!DATE.test(v)) throw new UserError('Use a valid date')
    return v
  }
  return { title, category: category as (typeof DOC_CATEGORIES)[number], reference, issuedAt: date('issuedAt'), expiresAt: date('expiresAt') }
}

function formFile(form: FormData) {
  const file = form.get('file')
  if (!(file instanceof File) || !file.size) return null
  if (file.size > MAX_UPLOAD_BYTES) throw new UserError(`Files can be at most ${MAX_UPLOAD_LABEL}`)
  return file
}

/** Delete a document's stored file for good (Firebase Storage object + record), whatever its origin. */
async function removeFile(payload: Awaited<ReturnType<typeof db>>, fileId: string | undefined) {
  if (!fileId) return
  const f = await payload.findByID({ collection: 'files', id: fileId, depth: 0, select: { storagePath: true }, overrideAccess: true }).catch(() => null)
  if (!f) return
  if (f.storagePath && isFirebaseConfigured()) await bucket().file(f.storagePath).delete({ ignoreNotFound: true })
  await payload.delete({ collection: 'files', id: fileId, overrideAccess: true })
}

/** Add a compliance document; the file (optional) goes to Firebase Storage. */
export async function addDocument(form: FormData) {
  return guard(async () => {
    const { payload } = await requireAdmin()
    const fields = documentFields(form)
    const file = formFile(form)
    const id = randomUUID()
    const stored = file ? await storeUpload(file, { collection: 'documents', id, category: 'document' }) : null
    await payload.create({ collection: 'documents', data: { id, ...fields, file: stored?.id ?? null }, overrideAccess: true } as never)
    revalidatePath('/admin/portfolio')
  })()
}

/**
 * Edit a document's details. With a new file, the file is replaced and the old one deleted;
 * with `removeFile=1`, the file is removed and the document kept.
 */
export async function updateDocument(id: string, form: FormData) {
  return guard(async () => {
    const { payload } = await requireAdmin()
    if (typeof id !== 'string' || !/^[\w-]{1,64}$/.test(id)) throw new UserError('Invalid document')
    const doc = await payload.findByID({ collection: 'documents', id, depth: 0, select: { file: true }, overrideAccess: true }).catch(() => null)
    if (!doc) throw new UserError('This document no longer exists')
    const fields = documentFields(form)
    const file = formFile(form)
    const oldFile = relId(doc.file)
    let fileId: string | null | undefined = undefined
    if (file) fileId = (await storeUpload(file, { collection: 'documents', id, category: 'document' })).id
    else if (form.get('removeFile') === '1') fileId = null
    await payload.update({
      collection: 'documents',
      id,
      data: { ...fields, ...(fileId !== undefined ? { file: fileId } : {}) },
      overrideAccess: true,
    })
    if (fileId !== undefined && oldFile && oldFile !== fileId) await removeFile(payload, oldFile)
    revalidatePath('/admin/portfolio')
  })()
}

/** Delete a document and its file. */
export async function deleteDocument(id: string) {
  return guard(async () => {
    const { payload } = await requireAdmin()
    if (typeof id !== 'string' || !/^[\w-]{1,64}$/.test(id)) throw new UserError('Invalid document')
    const doc = await payload.findByID({ collection: 'documents', id, depth: 0, select: { file: true }, overrideAccess: true }).catch(() => null)
    if (!doc) throw new UserError('This document no longer exists')
    await payload.delete({ collection: 'documents', id, overrideAccess: true })
    await removeFile(payload, relId(doc.file))
    revalidatePath('/admin/portfolio')
  })()
}

/** Soft delete / restore a ledger row ("Show deleted" brings them back into view). */
export async function setLedgerDeleted(kind: 'stocks' | 'sinks', id: string, deleted: boolean) {
  return guard(async () => {
    const { payload } = await requireAdmin()
    if (!(LEDGERS as readonly string[]).includes(kind)) throw new UserError('Unknown ledger')
    if (typeof deleted !== 'boolean') throw new UserError('Unknown setting')
    await payload.update({ collection: kind, id, data: { deleted }, depth: 0, select: { id: true }, overrideAccess: true })
    revalidatePath('/admin/portfolio')
  })()
}
