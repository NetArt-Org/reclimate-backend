/**
 * Delete uploads nothing points at any more (picked in a form that was then cancelled, or left behind).
 *
 *   npm run files:prune            list what would be deleted
 *   PRUNE=yes npm run files:prune  delete it
 *
 * Only admin uploads older than a day are considered; media migrated from Circonomy is never touched.
 */
import { getPayload } from 'payload'

import config from '../payload.config'
import { bucket, isFirebaseConfigured } from '../lib/firebase/admin'

const FILE_URL = /\/admin\/files\/([\w-]{1,64})/g
const FILE_KEYS = /^(fileId|logoFileId|sideImageFileId|signatureFileId)$/

/** Every upload id referenced anywhere in a value (file links and *FileId keys). */
function collect(value: unknown, out: Set<string>) {
  if (typeof value === 'string') for (const m of value.matchAll(FILE_URL)) out.add(m[1])
  else if (Array.isArray(value)) value.forEach((v) => collect(v, out))
  else if (value && typeof value === 'object')
    for (const [k, v] of Object.entries(value)) {
      if (typeof v === 'string' && FILE_KEYS.test(k)) out.add(v)
      else collect(v, out)
    }
}

const payload = await getPayload({ config })
const all = { pagination: false, depth: 0, overrideAccess: true } as const

const used = new Set<string>()
const [documents, people, networks, company] = await Promise.all([
  payload.find({ collection: 'documents', ...all, select: { file: true } }),
  payload.find({ collection: 'people', ...all, select: { photo: true, trainingDocs: true } }),
  payload.find({ collection: 'networks', ...all, select: { config: true } }),
  payload.findGlobal({ slug: 'company', depth: 0, overrideAccess: true }),
])
documents.docs.forEach((d) => d.file && used.add(String(d.file)))
people.docs.forEach((p) => collect([p.photo, p.trainingDocs], used))
networks.docs.forEach((n) => collect(n.config, used))
collect([company.profile, company.certificateSettings], used)

const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
const uploads = await payload.find({
  collection: 'files',
  ...all,
  where: { and: [{ sourcePath: { exists: false } }, { createdAt: { less_than: dayAgo } }] },
  select: { name: true, size: true, storagePath: true },
})
const orphans = uploads.docs.filter((f) => !used.has(String(f.id)))
const bytes = orphans.reduce((a, f) => a + (Number(f.size) || 0), 0)
console.log(`${uploads.docs.length} uploads checked, ${orphans.length} unused (${(bytes / 1e6).toFixed(1)} MB)`)
orphans.slice(0, 20).forEach((f) => console.log(`  - ${f.name}`))

if (process.env.PRUNE === 'yes') {
  for (const f of orphans) {
    if (f.storagePath && isFirebaseConfigured()) await bucket().file(f.storagePath).delete({ ignoreNotFound: true })
    await payload.delete({ collection: 'files', id: f.id, overrideAccess: true })
  }
  console.log(`✓ deleted ${orphans.length} unused uploads`)
} else if (orphans.length) {
  console.log('Run with PRUNE=yes to delete them.')
}
process.exit(0)
