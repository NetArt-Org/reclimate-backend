import config from '@payload-config'
import { getPayload } from 'payload'

import { serveFile } from '@/lib/files/serve'


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

  return serveFile(req, file)
}
