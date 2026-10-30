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
 *
 * Files are compressed on the way, without visible loss (checked on samples: photos SSIM 0.993):
 *  - JPEG photos: re-encoded at quality 85 (mozjpeg), longest side at most 2048 px, metadata kept;
 *  - videos: the picture is kept exactly as it is (re-encoding these phone videos softens them for little
 *    gain); only the audio goes to AAC 96 kbps, and the file is made streamable (faststart). Needs ffmpeg.
 * A compressed file is used only when it is clearly smaller (under 90 % of the original). MEDIA_RAW=1 turns this off.
 */
import { execFile } from 'child_process'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { promisify } from 'util'
import sharp from 'sharp'
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

const exec = promisify(execFile)
const FFMPEG = ['/opt/homebrew/bin/ffmpeg', '/usr/local/bin/ffmpeg'].find((p) => fs.existsSync(p)) ?? 'ffmpeg'

async function compressVideo(body: Buffer, ext: string): Promise<Buffer> {
  const dir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'media-'))
  const src = path.join(dir, `in.${ext}`)
  const out = path.join(dir, `out.${ext}`)
  try {
    await fs.promises.writeFile(src, body)
    await exec(FFMPEG, ['-v', 'error', '-y', '-i', src, '-map', '0:v', '-map', '0:a?', '-map_metadata', '0', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '96k', '-movflags', '+faststart', out])
    return await fs.promises.readFile(out)
  } finally {
    await fs.promises.rm(dir, { recursive: true, force: true })
  }
}

/** The smaller of the original and its compressed version (compression problems keep the original). */
async function compress(body: Buffer, type: string, name: string): Promise<Buffer> {
  if (process.env.MEDIA_RAW) return body
  const ext = (name.split('.').pop() || '').toLowerCase()
  let out: Buffer | null = null
  try {
    if (type === 'image/jpeg') {
      out = await sharp(body).rotate().resize({ width: 2048, height: 2048, fit: 'inside', withoutEnlargement: true }).keepMetadata().jpeg({ quality: 85, mozjpeg: true }).toBuffer()
    } else if (type.startsWith('video/') && /^(mp4|mov|m4v)$/.test(ext)) {
      out = await compressVideo(body, ext)
    }
  } catch {
    out = null
  }
  return out && out.length > 0 && out.length < body.length * 0.9 ? out : body
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
  let sourceBytes = 0
  let i = 0
  const worker = async () => {
    while (i < rows.length && bytes < maxBytes) {
      const f = rows[i++]
      const url = links.get(f.id)
      try {
        if (!url) throw new Error('no download link in the export')
        const r = await fetch(url)
        if (!r.ok) throw new Error(`download ${r.status}${r.status === 403 ? ' (link expired — export again)' : ''}`)
        const original = Buffer.from(await r.arrayBuffer())
        const type = r.headers.get('content-type') && r.headers.get('content-type') !== 'binary/octet-stream' ? r.headers.get('content-type')! : f.mime_type
        const body = await compress(original, type, f.name)
        sourceBytes += original.length
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
      if ((done + failed) % 250 === 0) console.log(`  ${done + failed}/${rows.length} · ${(sourceBytes / 1e9).toFixed(2)} GB → ${(bytes / 1e9).toFixed(2)} GB stored · ${failed} failed`)
    }
  }
  await Promise.all(Array.from({ length: 8 }, worker))
  console.log(`✓ copied ${done} files (${(sourceBytes / 1e9).toFixed(2)} GB → ${(bytes / 1e9).toFixed(2)} GB), ${failed} failed${bytes >= maxBytes ? ' — stopped at the size cap' : ''}`)
  process.exit(0)
}

try {
  await run()
} catch (err) {
  console.error(err)
  process.exit(1)
}
