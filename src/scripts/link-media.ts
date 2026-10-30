/**
 * Links media already copied to Firebase Storage (by media:copy) to the files rows of this database, so the copy
 * (hours of download + compress + upload) runs once, against any database: local and production use the same
 * storage bucket, and media:copy stores each file at a key derived from its row (circonomy/<category>/<source key>).
 *
 *   NODE_ENV=production npm run media:link
 *
 * Lists what is under circonomy/ in the bucket, then marks each row still "pending"/"failed" whose object exists as
 * "stored", with that object's size and type. Rows the field app stored are left alone. Re-runnable.
 */
import { sql } from '@payloadcms/db-postgres'
import { getPayload } from 'payload'

import config from '../payload.config'
import { bucket } from '../lib/firebase/admin'

async function run() {
  const payload = await getPayload({ config })
  const db = payload.db.drizzle

  const [objects] = await bucket().getFiles({ prefix: 'circonomy/' })
  const stored = new Map(objects.map((o) => [o.name, { size: Number(o.metadata.size), type: String(o.metadata.contentType || '') }]))
  console.log(`${stored.size} copied files in storage`)

  const res = await db.execute(sql`
    select id, name, category, source_path, mime_type, owner_collection, owner_id from files
    where status in ('pending', 'failed') and source_path is not null`)
  const rows = res.rows as { id: string; name: string; category: string | null; source_path: string; mime_type: string | null; owner_collection: string | null; owner_id: string | null }[]

  const found: { id: string; key: string; size: number; type: string }[] = []
  for (const f of rows) {
    const key = `circonomy/${f.category || 'other'}/${f.source_path.replace(/^s3:\/\/[^/]+\//, '')}`
    const o = stored.get(key)
    if (o) found.push({ id: f.id, key, size: o.size, type: o.type || f.mime_type || 'application/octet-stream' })
    else console.log(`  waiting: ${f.name} (file ${f.id}, ${f.owner_collection ?? '-'} ${f.owner_id ?? '-'}, ${key})`)
  }

  let linked = 0
  for (let i = 0; i < found.length; i += 500) {
    const chunk = found.slice(i, i + 500)
    const values = sql.join(chunk.map((f) => sql`(${f.id}, ${f.key}, ${f.size}, ${f.type})`), sql`, `)
    const r = await db.execute(sql`
      update files f set storage_path = v.path, size = v.size::numeric, mime_type = v.mime, status = 'stored', updated_at = now()
      from (values ${values}) as v(id, path, size, mime)
      where f.id::text = v.id and f.status in ('pending', 'failed')`)
    linked += r.rowCount ?? 0
  }
  console.log(`✓ linked ${linked} files; ${rows.length - found.length} files still waiting (not in storage)`)
  process.exit(0)
}

try {
  await run()
} catch (err) {
  console.error(err)
  process.exit(1)
}
