import 'server-only'

import { createHash } from 'crypto'

import { FieldError } from './auth'
import { RateLimited } from './ratelimit'

/** HTTP plumbing of the field API: CORS, JSON replies, ETags, body limits. */

const allowedOrigins = () =>
  (process.env.CORS_ORIGINS || '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean)

/** Only listed origins may call the API from a browser/webview. No cookies are used, so no credentials. */
export function cors(req: Request): Record<string, string> {
  const origin = req.headers.get('origin')
  if (!origin || !allowedOrigins().includes(origin)) return { Vary: 'Origin' }
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Headers': 'Authorization, Content-Type, Range, If-None-Match, X-App-Version, X-Device-Model, X-App-Mode, X-Firebase-AppCheck',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Expose-Headers': 'Content-Range, Content-Length, ETag, Retry-After',
    'Access-Control-Max-Age': '600',
    Vary: 'Origin',
  }
}

/** Largest JSON body a save may send, and largest upload request (photos/videos are checked again per type). */
export const MAX_JSON_BYTES = 1024 * 1024
export const MAX_UPLOAD_REQUEST = 31 * 1024 * 1024

/** Refuse oversized requests before reading them (the Content-Length header). */
export function checkSize(req: Request, max: number) {
  const len = Number(req.headers.get('content-length') || 0)
  if (len > max) throw new FieldError(413, 'This request is too large.')
}

export async function readJson(req: Request) {
  checkSize(req, MAX_JSON_BYTES)
  const text = await req.text()
  if (text.length > MAX_JSON_BYTES) throw new FieldError(413, 'This request is too large.')
  try {
    const data = JSON.parse(text)
    if (data && typeof data === 'object' && !Array.isArray(data)) return data as Record<string, unknown>
  } catch {
    /* fall through */
  }
  throw new FieldError(400, 'Bad request.')
}

/** A JSON reply. Private data is never cached by proxies; GET replies carry an ETag so an unchanged poll is a 304. */
export function reply(req: Request, data: unknown, headers: Record<string, string>, status = 200): Response {
  const body = JSON.stringify(data)
  const base = { ...headers, 'Content-Type': 'application/json', 'Cache-Control': 'private, no-cache' }
  if (req.method === 'GET' && status === 200) {
    const etag = `"${createHash('sha1').update(body).digest('base64url')}"`
    if (req.headers.get('if-none-match') === etag) return new Response(null, { status: 304, headers: { ...base, ETag: etag } })
    return new Response(body, { status, headers: { ...base, ETag: etag } })
  }
  return new Response(body, { status, headers: base })
}

/** An error reply: the message is meant for the person using the app; nothing internal is revealed. */
export function errorReply(req: Request, err: unknown, headers: Record<string, string>): Response {
  if (err instanceof RateLimited) return reply(req, { error: err.message, code: err.code }, { ...headers, 'Retry-After': String(err.retryAfter) }, 429)
  if (err instanceof FieldError) return reply(req, { error: err.message, code: err.code }, headers, err.status)
  console.error('[field api]', err)
  return reply(req, { error: 'Something went wrong. Please try again.' }, headers, 500)
}
