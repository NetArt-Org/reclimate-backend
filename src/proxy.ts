import { NextResponse, type NextRequest } from 'next/server'

import { clientIp } from '@/lib/client-ip'

/**
 * Flood guard for everything except the field API (which has its own, finer limits in src/field/ratelimit.ts):
 * the admin panel, Payload's REST API and editor (/api, /cms), and the public pages. Counted per address on each
 * instance, in memory — cheap, and enough to stop one client from hammering the server into new (billed) instances.
 */
const WINDOW_MS = 60_000
const MAX = { api: 120, page: 300 }
const hits = new Map<string, { start: number; count: number }>()

export function proxy(req: NextRequest) {
  const kind = req.nextUrl.pathname.startsWith('/api/') ? 'api' : 'page'
  const key = `${kind}:${clientIp(req)}`
  const now = Date.now()
  const cur = hits.get(key)
  const entry = cur && now - cur.start < WINDOW_MS ? cur : { start: now, count: 0 }
  entry.count++
  hits.set(key, entry)
  if (hits.size > 50_000) hits.clear()
  if (entry.count > MAX[kind]) {
    const retry = String(Math.ceil((entry.start + WINDOW_MS - now) / 1000))
    return NextResponse.json({ error: 'Too many requests. Please wait a moment and try again.' }, { status: 429, headers: { 'Retry-After': retry } })
  }
  return NextResponse.next()
}

export const config = {
  // Not static files, and not the field API: a proxy buffers request bodies (up to 10 MB), which would cut off
  // video uploads.
  matcher: ['/((?!_next/static|_next/image|api/field|favicon.ico|icon.svg|apple-icon).*)'],
}
