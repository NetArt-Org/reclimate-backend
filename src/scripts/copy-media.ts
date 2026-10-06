/**
 * Copies migrated photos/videos/PDFs from Circonomy into Firebase Storage.
 *
 *   npm run media:copy            copy every file still "pending" (or "failed")
 *   MEDIA_LIMIT=200 npm run media:copy   copy a few first, to check
 *   MEDIA_SKIP=batches npm run media:copy    skip files of these record types (comma separated)
 *   MEDIA_ONLY=batches MEDIA_MAX_GB=1.5 npm run media:copy
 *        copy only batch media, newest batches first, and stop once 1.5 GB has been copied in this run —
 *        keeps Firebase Storage inside its free 5 GB while testing
 *
 * The download links come from the export (data/import/circonomy-export.json). They are signed links that
 * stop working about 6 days after the export, so run this soon after exporting — or export again.
 * Re-runnable: files already copied are skipped.
 */
import fs from 'fs'
import path from 'path'
import { sql } from '@payloadcms/db-postgres'
import { getPayload } from 'payload'

import config from '../payload.config'
import { bucket } from '../lib/firebase/admin'

/* eslint-disable @typescript-eslint/no-explicit-any */

/** file id → signed download link, read from the export. */
function sourceLinks(): Map<string, string> {
  const file = path.resolve(process.cwd(), 'data/import/circonomy-export.json')
  if (!fs.existsSync(file)) throw new Error(`Missing ${file}`)
  const links = new Map<string, string>()
  const walk = (o: any) => {
    if (Array.isArray(o)) return o.forEach(walk)
    if (!o || typeof o !== 'object') return
    const url = typeof o.url === 'string' && o.url.startsWith('https://') ? o.url : null
    if (o.id && url && !links.has(String(o.id))) links.set(String(o.id), url)
    for (const v of Object.values(o)) if (v && typeof v === 'object') walk(v)
  }
  walk(JSON.parse(fs.readFileSync(file, 'utf8')))
  return links
}

async function run() {
  const payload = await getPayload({ config })
  const db = payload.db.drizzle
  const links = sourceLinks()
  const limit = Number(process.env.MEDIA_LIMIT) || 1_000_000
  const list = (v?: string) => (v || '').split(',').map((s) => s.trim()).filter(Boolean)
  const skip = list(process.env.MEDIA_SKIP)
  const only = list(process.env.MEDIA_ONLY)
  const maxBytes = Number(process.env.MEDIA_MAX_GB) > 0 ? Number(process.env.MEDIA_MAX_GB) * 1e9 : Infinity
  const inList = (xs: string[]) => sql.join(xs.map((x) => sql`${x}`), sql`, `)
  // Newest records first (by the batch date when the file belongs to a batch), so a capped copy covers recent work.
  const res = await db.execute(sql`
    select f.id, f.name, f.mime_type, f.source_path, f.category from files f
    left join batches b on f.owner_collection = 'batches' and b.id = f.owner_id
    where f.status in ('pending', 'failed') and f.source_path is not null
      ${skip.length ? sql`and (f.owner_collection is null or f.owner_collection not in (${inList(skip)}))` : sql``}
      ${only.length ? sql`and f.owner_collection in (${inList(only)})` : sql``}
    order by b.date desc nulls last, f.created_at limit ${limit}`)
  const rows = res.rows as { id: string; name: string; mime_type: string; source_path: string; category: string }[]
  console.log(`${rows.length} files to copy`)

  const store = bucket()
  let done = 0
  let failed = 0
  let bytes = 0
  let i = 0
  const worker = async () => {
    while (i < rows.length && bytes < maxBytes) {
      const f = rows[i++]
      const url = links.get(f.id)
      try {
        if (!url) throw new Error('no download link in the export')
        const r = await fetch(url)
        if (!r.ok) throw new Error(`download ${r.status}${r.status === 403 ? ' (link expired — export again)' : ''}`)
        const body = Buffer.from(await r.arrayBuffer())
        const type = r.headers.get('content-type') && r.headers.get('content-type') !== 'binary/octet-stream' ? r.headers.get('content-type')! : f.mime_type
        // Same key layout as the source, grouped under circonomy/<category>/.
        const key = `circonomy/${f.category || 'other'}/${f.source_path.replace(/^s3:\/\/[^/]+\//, '')}`
        await store.file(key).save(body, { contentType: type, resumable: false, metadata: { cacheControl: 'private, max-age=31536000' } })
        await db.execute(sql`update files set storage_path = ${key}, size = ${body.length}, mime_type = ${type}, status = 'stored', updated_at = now() where id = ${f.id}`)
        bytes += body.length
        done++
      } catch (err) {
        failed++
        await db.execute(sql`update files set status = 'failed', updated_at = now() where id = ${f.id}`)
        if (failed <= 10) console.warn(`✗ ${f.name}: ${err instanceof Error ? err.message : err}`)
      }
      if ((done + failed) % 250 === 0) console.log(`  ${done + failed}/${rows.length} · ${(bytes / 1e9).toFixed(2)} GB`)
    }
  }
  await Promise.all(Array.from({ length: 8 }, worker))
  console.log(`✓ copied ${done} files (${(bytes / 1e9).toFixed(2)} GB), ${failed} failed${bytes >= maxBytes ? ' — stopped at the size cap' : ''}`)
  process.exit(0)
}

try {
  await run()
} catch (err) {
  console.error(err)
  process.exit(1)
}
