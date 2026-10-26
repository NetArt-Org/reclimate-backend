import { revalidateTag } from 'next/cache'

import config from '@payload-config'
import { getPayload } from 'payload'

import { DASHBOARD_TAG } from '@/dashboard/server/payload'
import { deleteAccount, getFile, passwordChanged, register, registerOptions, registerStatus, saveProfile, uploadFile } from '@/field/account'
import { authenticate, FieldError, tokenFrom, verifyToken, type FieldContext } from '@/field/auth'
import { batchPage, isBatchFilter, reviewBatch, saveBatch } from '@/field/batches'
import { bootstrap } from '@/field/bootstrap'
import { bust } from '@/field/cache'
import { limitParam, pageParam } from '@/field/common'
import { checkSize, cors, errorReply, MAX_UPLOAD_REQUEST, readJson, reply } from '@/field/http'
import { addSetupItem, createSellRequest, isSetupKey, loadCredits, removeSetupItem, setupPage, supervisorPage } from '@/field/lists'
import { checkAppCheck } from '@/field/appcheck'
import { clientIp, gate, limit, type LimitName } from '@/field/ratelimit'
import { createApplication, createCollection, createMixing, createPackaging, isRecordKind, recordPage } from '@/field/records'
import { networkSettings } from '@/field/settings'
import { siteStats } from '@/field/stats'
import { checkAppVersion } from '@/field/version'
import { once } from '@/field/idempotency'

/**
 * The field app's API (/api/field/...). Every request carries the person's Firebase ID token
 * (`X-Field-Token`, or `Authorization: Bearer` from older builds; see src/field/auth.ts) and, optionally, the site it works on (`?site=<id>`).
 * The backend is the single source of truth: both app layouts (step-by-step and Classic) read and write
 * the same records through these routes, and every rule and limit the app applies comes from here.
 * Every route is rate limited (src/field/ratelimit.ts); GET replies carry an ETag (an unchanged poll is a 304).
 * Builds older than MIN_APP_VERSION get 426 (src/field/version.ts); App Check can be required (src/field/appcheck.ts).
 *
 *   GET    register/options          networks and sites to sign up for        (signed in, no person needed)
 *   GET    register/status           where a sign-up stands                   (signed in, no person needed)
 *   POST   register                  sign up (verified email); an admin approves
 *   GET    me                        start-up data for the site: profile, rules, lists, first pages, stats
 *   GET    stats                     the site summary
 *   GET    page/<list>?page=N        next page: batches (?filter=waiting|ongoing|completed|reviewed), history,
 *                                    supervisors, collections, mixings, packagings, applications, setup/<key>
 *   PUT    batches/<code>            save a batch (create or update)
 *   POST   batches/<code>/review     supervisor: accept / reject
 *   POST   collections|mixings|packagings|applications   add a record (Classic app; `clientId` makes it idempotent)
 *   POST   files                     upload a photo/video (multipart "file", optional "clientId")
 *   GET    files/<id>                a photo/video
 *   PATCH  profile                   name, phone, village, photo
 *   POST   password-changed          first-sign-in password chosen
 *   POST   account/delete            delete the account (personal details erased, records kept anonymously)
 *   POST   setup/<list>              add to a site list (kilns and bulk densities are requests to the admin)
 *   DELETE setup/<list>/<id>         remove from a site list
 *   POST   sell-requests             ask to sell credits
 */

type Ctx = { params: Promise<{ path: string[] }> }

/**
 * Uploads hold the whole file in memory: at most 4 run at once on an instance (4 × 30 MB fits easily in 1 GiB);
 * the rest wait their turn for up to 20 s, then get "busy, try again" instead of crashing the instance.
 */
const uploads = gate(4, 20_000)

/** Which limit a request counts against. */
function limitFor(m: string, a: string | undefined): LimitName {
  if (m === 'GET') return 'read'
  if (a === 'files') return 'upload'
  if (a === 'sell-requests') return 'sell'
  if (a === 'account') return 'deleteAccount'
  return 'write'
}


/** Add a Classic-app record (collection, mixing, packaging, application), checked against the network's rules. */
async function createRecord(ctx: FieldContext, kind: string, data: Record<string, unknown>) {
  const { rules } = await networkSettings(ctx)
  if (kind === 'collections') return createCollection(ctx, data, rules.photos.biomass)
  if (kind === 'mixings') {
    if (rules.hideMixingTab) throw new FieldError(403, 'Mixing is switched off for this network.')
    return createMixing(ctx, data, rules.photos.mixing)
  }
  if (kind === 'packagings') return createPackaging(ctx, data, rules.photos.packing)
  return createApplication(ctx, data, rules.photos.application, rules.canApplyOpenBiochar)
}

async function route(req: Request, path: string[], url: URL): Promise<unknown | Response> {
  const [a, b, c] = path
  const m = req.method
  const page = pageParam(url.searchParams.get('page'))
  const size = limitParam(url.searchParams.get('limit'))
  const payload = await getPayload({ config })

  // Sign-up: a Firebase account without a person yet.
  if (a === 'register') {
    const t = await verifyToken(req)
    await limit(null, 'read', t.uid)
    if (m === 'GET' && b === 'options') return registerOptions(req)
    if (m === 'GET' && b === 'status') return registerStatus(req)
    if (m === 'POST' && !b) {
      await limit(payload, 'register', t.uid)
      await limit(payload, 'registerIp', clientIp(req))
      return register(req)
    }
    throw new FieldError(404, 'Not found.')
  }

  const ctx = await authenticate(req, url.searchParams.get('site'))
  await limit(payload, limitFor(m, a), ctx.person.id)

  if (m === 'GET' && a === 'me' && !b) return bootstrap(ctx)
  if (m === 'GET' && a === 'stats' && !b) return siteStats(ctx)
  if (m === 'GET' && a === 'page') {
    if (b === 'batches') {
      const f = url.searchParams.get('filter')
      return batchPage(ctx, page, size, isBatchFilter(f) ? f : undefined)
    }
    if (b === 'history') return (await loadCredits(ctx, page, size)).history
    if (b === 'supervisors') return supervisorPage(ctx, page, size)
    if (b && isRecordKind(b)) return recordPage(ctx, b, page, size, url.searchParams.get('filter'))
    if (b === 'setup' && c && isSetupKey(c)) return setupPage(ctx, c, page, Math.max(size, 50), c === 'bioref' ? (await networkSettings(ctx)).feedstocks : [])
    throw new FieldError(404, 'Unknown list.')
  }
  if (m === 'GET' && a === 'files' && b && !c) return getFile(ctx, req, b, cors(req))

  // ---- writes ----
  if (m === 'PUT' && a === 'batches' && b && !c) return saveBatch(ctx, b, await readJson(req))
  if (m === 'POST' && a === 'batches' && b && c === 'review') return reviewBatch(ctx, b, await readJson(req))
  if (m === 'POST' && !b && a && isRecordKind(a)) {
    const data = await readJson(req)
    return once(payload, `${a}:${ctx.person.id}`, data.clientId, () => createRecord(ctx, a, data))
  }
  if (m === 'POST' && a === 'files' && !b) {
    // The size must be declared up front (no open-ended streamed bodies), and counts against the daily byte quota.
    const len = Number(req.headers.get('content-length'))
    if (!len) throw new FieldError(411, 'Bad request.')
    checkSize(req, MAX_UPLOAD_REQUEST)
    await limit(payload, 'uploadBytes', ctx.person.id, len)
    return uploads(async () => uploadFile(ctx, await req.formData()))
  }
  if (m === 'PATCH' && a === 'profile') return saveProfile(ctx, await readJson(req))
  if (m === 'POST' && a === 'password-changed') return passwordChanged(ctx)
  if (m === 'POST' && a === 'account' && b === 'delete') return deleteAccount(ctx)
  if (m === 'POST' && a === 'setup' && b && !c) {
    const data = await readJson(req)
    return once(payload, `setup:${ctx.person.id}`, data.clientId, () => addSetupItem(ctx, b, data))
  }
  if (m === 'DELETE' && a === 'setup' && b && c) return removeSetupItem(ctx, b, c)
  if (m === 'POST' && a === 'sell-requests') return createSellRequest(ctx)
  throw new FieldError(404, 'Not found.')
}

async function handle(req: Request, { params }: Ctx): Promise<Response> {
  const headers = cors(req)
  try {
    const url = new URL(req.url)
    // Requests without a sign-in are limited per address before any work is done.
    if (!tokenFrom(req)) await limit(null, 'anonymous', clientIp(req))
    checkAppVersion(req)
    await checkAppCheck(req)
    const out = await route(req, (await params).path, url)
    if (out instanceof Response) return out
    if (req.method !== 'GET') {
      // Site totals and lists change with the write: drop their cached copies here, and refresh the admin panel.
      bust('stats:', 'setup:')
      revalidateTag(DASHBOARD_TAG, { expire: 0 })
    }
    return reply(req, out, headers)
  } catch (err) {
    // Rejected sign-ins also count against the address, so a bad or stolen token cannot be tried endlessly.
    // (Requests with no token at all were already counted above.)
    if (err instanceof FieldError && err.code === 'signed_out' && tokenFrom(req)) {
      try {
        await limit(null, 'anonymous', clientIp(req))
      } catch (limited) {
        return errorReply(req, limited, headers)
      }
    }
    return errorReply(req, err, headers)
  }
}

export const GET = handle
export const POST = handle
export const PUT = handle
export const PATCH = handle
export const DELETE = handle
export const OPTIONS = (req: Request) => new Response(null, { status: 204, headers: cors(req) })
