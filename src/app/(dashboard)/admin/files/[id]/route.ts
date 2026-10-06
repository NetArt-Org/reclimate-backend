import config from '@payload-config'
import { getPayload } from 'payload'
import { Readable } from 'stream'


/** Only formats that cannot carry script are shown inline (never SVG or HTML). */
const INLINE = /^(image\/(png|jpe?g|gif|webp)|video\/(mp4|quicktime|webm)|application\/pdf)$/

const notFound = () => new Response('Not found', { status: 404 })

/**
 * A file for signed-in admins, streamed from Firebase Storage (with byte ranges, so videos can seek),
 * or — older uploads — from Neon. Migrated files still waiting to be copied answer 404.
 */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    return await serve(req, ctx)
  } catch (err) {
    console.error('[files] could not serve file', err)
    return new Response('This file could not be loaded right now.', { status: 500 })
  }
}

async function serve(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: req.headers })
  if (!user || user.role !== 'admin') return notFound()
  const { id } = await params
  if (!/^[\w-]{1,64}$/.test(id)) return notFound()
  const file = await payload
    .findByID({ collection: 'files', id, depth: 0, overrideAccess: true, showHiddenFields: true })
    .catch(() => null)
  if (!file) return notFound()

  const headers: Record<string, string> = {
    'Content-Type': INLINE.test(file.mimeType) ? file.mimeType : 'application/octet-stream',
    'Content-Disposition': `${INLINE.test(file.mimeType) ? 'inline' : 'attachment'}; filename*=UTF-8''${encodeURIComponent(file.name)}`,
    // Short, private caching: someone whose access is removed cannot keep reading from the cache for long.
    'Cache-Control': 'private, max-age=300',
    'X-Content-Type-Options': 'nosniff',
    'Accept-Ranges': 'bytes',
  }

  const { bucket, isFirebaseConfigured } = await import('@/lib/firebase/admin')
  if (file.storagePath && isFirebaseConfigured()) {
    const obj = bucket().file(file.storagePath)
    const size = Number(file.size) || Number((await obj.getMetadata())[0].size)
    const range = req.headers.get('range')?.match(/^bytes=(\d*)-(\d*)$/)
    if (range && size) {
      const start = range[1] ? Number(range[1]) : Math.max(0, size - Number(range[2]))
      const end = range[1] && range[2] ? Math.min(Number(range[2]), size - 1) : size - 1
      if (start > end || start >= size) return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${size}` } })
      const stream = Readable.toWeb(obj.createReadStream({ start, end })) as ReadableStream
      return new Response(stream, {
        status: 206,
        headers: { ...headers, 'Content-Range': `bytes ${start}-${end}/${size}`, 'Content-Length': String(end - start + 1) },
      })
    }
    const stream = Readable.toWeb(obj.createReadStream()) as ReadableStream
    return new Response(stream, { headers: size ? { ...headers, 'Content-Length': String(size) } : headers })
  }
  if (file.data) {
    const body = Buffer.from(String(file.data), 'base64')
    return new Response(new Uint8Array(body), { headers: { ...headers, 'Content-Length': String(body.length) } })
  }
  return new Response('This file has not been copied from Circonomy yet.', { status: 404 })
}
