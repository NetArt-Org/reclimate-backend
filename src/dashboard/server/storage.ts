import 'server-only'

import { randomUUID } from 'crypto'

import { bucket, isFirebaseConfigured } from '@/lib/firebase/admin'
import type { DocFile } from '../data/types'
import { db } from './payload'
import { UserError } from './result'

/** Largest admin-panel upload by default (callers can allow more, e.g. field videos). */
export const MAX_FILE = 10 * 1024 * 1024
/** Without Firebase Storage (local development only), files up to this size are kept in Neon. */
const MAX_IN_DATABASE = 4 * 1024 * 1024

/**
 * Store an uploaded file: bytes in Firebase Storage, the record in Neon (`files`).
 * Until Firebase is configured, small files are kept in Neon so uploads keep working.
 */
export async function storeUpload(
  file: File,
  owner?: { collection: string; id: string; category?: string },
  opts: { maxBytes?: number; name?: string } = {},
): Promise<DocFile> {
  const max = opts.maxBytes ?? MAX_FILE
  if (file.size > max) throw new UserError(`Files can be at most ${Math.round(max / 1024 / 1024)} MB`)
  if (!isFirebaseConfigured() && file.size > MAX_IN_DATABASE) throw new UserError('File storage is not set up for files this large.')
  const payload = await db()
  const id = randomUUID()
  const bytes = Buffer.from(await file.arrayBuffer())
  const mimeType = file.type || 'application/octet-stream'
  const base = {
    id,
    name: (opts.name ?? file.name).slice(0, 160),
    mimeType,
    size: file.size,
    category: owner?.category ?? 'upload',
    ownerCollection: owner?.collection ?? null,
    ownerId: owner?.id ?? null,
    status: 'stored' as const,
  }
  if (isFirebaseConfigured()) {
    const storagePath = `uploads/${id}/${(opts.name ?? file.name).replace(/[^\w.-]+/g, '_').slice(0, 120)}`
    await bucket().file(storagePath).save(bytes, { contentType: mimeType, resumable: false })
    await payload.create({ collection: 'files', data: { ...base, storagePath }, overrideAccess: true } as never)
  } else {
    await payload.create({ collection: 'files', data: { ...base, data: bytes.toString('base64') }, overrideAccess: true } as never)
  }
  return { id, name: file.name, size: file.size, type: mimeType, url: `/admin/files/${id}`, addedAt: new Date().toISOString() }
}

const FILE_URL = /\/admin\/files\/([\w-]{1,64})/g
const FILE_KEYS = /^(id|fileId|logoFileId|sideImageFileId|signatureFileId)$/

/**
 * Ids of uploaded files a stored value points at: `/admin/files/<id>` links (DocFile.url, photo urls)
 * and `*FileId` keys (certificate logo, signatures…). Used to tell which uploads a save dropped.
 */
export function fileIdsIn(value: unknown, out = new Set<string>()): Set<string> {
  if (typeof value === 'string') {
    for (const m of value.matchAll(FILE_URL)) out.add(m[1])
  } else if (Array.isArray(value)) {
    value.forEach((v) => fileIdsIn(v, out))
  } else if (value && typeof value === 'object') {
    const o = value as Record<string, unknown>
    // A DocFile carries its id next to its url; only trust ids that come with a file url.
    const isDoc = typeof o.url === 'string' && o.url.includes('/admin/files/')
    for (const [k, v] of Object.entries(o)) {
      if (typeof v === 'string' && FILE_KEYS.test(k) && (k !== 'id' || isDoc)) out.add(v)
      else fileIdsIn(v, out)
    }
  }
  return out
}

/**
 * Permanently delete uploaded files: the object in Firebase Storage and the row in Neon.
 * Only admin uploads are touched — media migrated from Circonomy (it has a sourcePath) is never deleted here.
 */
export async function deleteUploads(ids: Iterable<string>) {
  const list = [...new Set(ids)].filter((id) => /^[\w-]{1,64}$/.test(id))
  if (!list.length) return 0
  const payload = await db()
  const found = await payload.find({
    collection: 'files',
    where: { and: [{ id: { in: list } }, { sourcePath: { exists: false } }] },
    pagination: false,
    depth: 0,
    select: { storagePath: true },
    overrideAccess: true,
  })
  for (const f of found.docs) {
    if (f.storagePath && isFirebaseConfigured()) {
      await bucket().file(f.storagePath).delete({ ignoreNotFound: true })
    }
    await payload.delete({ collection: 'files', id: f.id, overrideAccess: true })
  }
  return found.docs.length
}

/** After a save: delete the uploads that `before` referenced and `after` no longer does. */
export async function deleteDroppedUploads(before: unknown, after: unknown) {
  const keep = fileIdsIn(after)
  const dropped = [...fileIdsIn(before)].filter((id) => !keep.has(id))
  if (dropped.length) await deleteUploads(dropped).catch((err) => console.warn('[storage] could not delete files', err))
}
