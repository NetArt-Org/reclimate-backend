import 'server-only'

import config from '@payload-config'
import { getPayload } from 'payload'

import { storeUpload } from '@/dashboard/server/storage'
import { serveFile } from '@/lib/files/serve'
import type { File as FileRow, Person } from '@/payload-types'
import { FieldError, forgetPerson, personFor, relId, relIds, verifyToken, type FieldContext, type VerifiedToken } from './auth'
import { all, text, UPLOAD_LIMITS } from './common'
import { media } from './map'

/* ------------------------------------------------------------------ */
/* Files                                                                */
/* ------------------------------------------------------------------ */

/**
 * POST files — upload a photo/video. It belongs to the uploader until a save attaches it to a record.
 * The app names each file after its own id (`clientId`), so an upload repeated after a lost reply returns the
 * file already stored instead of storing it twice.
 */
export async function uploadFile(ctx: FieldContext, form: FormData) {
  const raw = form.get('file')
  if (!(raw instanceof File)) throw new FieldError(400, 'No file.')
  // Phones label recordings with their codec ("video/webm;codecs=vp9"): keep only the media type.
  const type = raw.type.split(';')[0].trim().toLowerCase()
  const file = type === raw.type ? raw : new File([raw], raw.name, { type })
  const kind = /^image\/(jpeg|png|webp)$/.test(file.type) ? 'photo' : /^video\/(mp4|webm|quicktime)$/.test(file.type) ? 'video' : null
  // The declared type is the client's word: the file's first bytes must match it too.
  if (!kind || !(await looksLike(file))) throw new FieldError(415, 'Only photos and videos can be uploaded.')
  if (file.size > UPLOAD_LIMITS[kind]) throw new FieldError(413, `This ${kind} is too large (at most ${UPLOAD_LIMITS[kind] / 1024 / 1024} MB).`)
  const clientId = typeof form.get('clientId') === 'string' ? String(form.get('clientId')).replace(/[^\w-]/g, '').slice(0, 40) : ''
  const name = clientId ? `field-${clientId}` : file.name
  if (clientId) {
    const existing = (await ctx.payload.find({ collection: 'files', where: { and: [{ ownerCollection: { equals: 'people' } }, { ownerId: { equals: ctx.person.id } }, { name: { equals: name } }] }, limit: 1, ...all })).docs[0]
    if (existing) return { file: media({ id: existing.id, mimeType: existing.mimeType ?? file.type }) }
  }
  const doc = await storeUpload(file, { collection: 'people', id: ctx.person.id, category: 'field:upload' }, { maxBytes: UPLOAD_LIMITS[kind], name })
  return { file: media({ id: doc.id, mimeType: file.type }) }
}

/** Whether a file's first bytes are those of its declared type (JPEG, PNG, WebP, MP4/MOV, WebM). */
async function looksLike(file: File) {
  const b = new Uint8Array(await file.slice(0, 16).arrayBuffer())
  const ascii = (from: number, to: number) => String.fromCharCode(...b.slice(from, to))
  switch (file.type) {
    case 'image/jpeg':
      return b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff
    case 'image/png':
      return ascii(1, 4) === 'PNG'
    case 'image/webp':
      return ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP'
    case 'video/mp4':
    case 'video/quicktime':
      return ['ftyp', 'moov', 'mdat', 'wide', 'free'].includes(ascii(4, 8))
    case 'video/webm':
      return b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3
  }
  return false
}

const SITED = ['batches', 'biomass-collections', 'mixings', 'packagings', 'applications', 'kilns', 'containers'] as const

/** Whether this person may see a file: their own uploads, people at their sites, or records at their sites. */
async function canSee(ctx: FieldContext, f: FileRow) {
  if (f.ownerCollection === 'people') {
    if (f.ownerId === ctx.person.id) return true
    const other = await ctx.payload.findByID({ collection: 'people', id: String(f.ownerId), ...all, select: { sites: true } }).catch(() => null)
    return !!other && relIds((other as Person).sites).some((s) => ctx.siteIds.includes(s))
  }
  const coll = SITED.find((c) => c === f.ownerCollection)
  if (!coll || !f.ownerId) return false
  const owner = await ctx.payload.findByID({ collection: coll, id: String(f.ownerId), ...all, select: { site: true } as never }).catch(() => null)
  return !!owner && ctx.siteIds.includes(relId((owner as { site?: unknown }).site) ?? '')
}

/** GET files/<id> */
export async function getFile(ctx: FieldContext, req: Request, id: string, cors: Record<string, string>) {
  if (!/^[\w-]{1,64}$/.test(id)) throw new FieldError(404, 'Not found.')
  const f = (await ctx.payload.findByID({ collection: 'files', id, ...all, showHiddenFields: true }).catch(() => null)) as FileRow | null
  if (!f || !(await canSee(ctx, f))) throw new FieldError(404, 'Not found.')
  return serveFile(req, f, cors)
}

/* ------------------------------------------------------------------ */
/* Profile                                                              */
/* ------------------------------------------------------------------ */

/** PATCH profile — name, phone, village and photo. The email is the login, so only an admin changes it. */
export async function saveProfile(ctx: FieldContext, body: { name?: string; phone?: string; village?: string; photoId?: string | null }) {
  const data: Record<string, unknown> = {}
  if (body.name !== undefined) {
    const name = text(body.name, 100)
    if (!name) throw new FieldError(400, 'Please enter your name.')
    data.name = name
  }
  if (body.phone !== undefined) data.phone = text(body.phone, 40) || null
  if (body.village !== undefined) data.address = text(body.village, 200) || null
  if (body.photoId === null) data.photo = null
  else if (typeof body.photoId === 'string') {
    const f = await ctx.payload.findByID({ collection: 'files', id: body.photoId, ...all }).catch(() => null)
    if (!f || f.ownerCollection !== 'people' || f.ownerId !== ctx.person.id) throw new FieldError(400, 'Upload the photo first.')
    await ctx.payload.update({ collection: 'files', id: f.id, data: { category: 'photo' }, ...all })
    // Stored as the admin's file link, so the photo shows in the admin panel too.
    data.photo = `/admin/files/${f.id}`
  }
  await ctx.payload.update({ collection: 'people', id: ctx.person.id, data: data as never, ...all })
  forgetPerson(ctx.person.firebaseUid)
  return { ok: true }
}

/** POST password-changed — the person chose their own password on first sign-in. */
export async function passwordChanged(ctx: FieldContext) {
  await ctx.payload.update({ collection: 'people', id: ctx.person.id, data: { mustChangePassword: false }, ...all })
  forgetPerson(ctx.person.firebaseUid)
  return { ok: true }
}

/**
 * POST account/delete — the person deletes their account (required by Google Play for apps that let people sign
 * up). Their sign-in is removed and their personal details are erased; the batches and records they made stay,
 * because they are part of the carbon-credit evidence, but no longer carry their name or contact details.
 */
export async function deleteAccount(ctx: FieldContext) {
  const { payload, person } = ctx
  const { firebaseAuth, isFirebaseConfigured } = await import('@/lib/firebase/admin')
  // Remove the sign-in (an account already gone in Firebase is fine).
  if (person.firebaseUid && isFirebaseConfigured()) {
    await firebaseAuth()
      .deleteUser(person.firebaseUid)
      .catch((e) => {
        if ((e as { code?: string }).code !== 'auth/user-not-found') throw e
      })
  }
  // Their profile photo goes too.
  const photo = person.photo?.match(/\/files\/([\w-]{1,64})/)?.[1]
  if (photo) {
    const { deleteUploads } = await import('@/dashboard/server/storage')
    await deleteUploads([photo]).catch(() => {})
  }
  await payload.update({
    collection: 'people',
    id: person.id,
    data: {
      name: 'Deleted user',
      email: null,
      phone: null,
      address: null,
      photo: null,
      firebaseUid: null,
      appAccess: false,
      active: false,
      device: null,
      registrationStatus: 'none',
      registrationNote: 'Account deleted by the user',
    } as never,
    ...all,
  })
  // Batches they ran or assessed stay as evidence, without their name or email.
  await payload.update({ collection: 'batches', where: { operator: { equals: person.id } }, data: { operatorName: 'Deleted user' } as never, ...all })
  if (person.email)
    await payload.update({ collection: 'batches', where: { assessorEmail: { equals: person.email } }, data: { assessedBy: 'Deleted user', assessorEmail: null } as never, ...all })
  await payload.create({
    collection: 'activity-logs',
    data: { message: 'A field-app user deleted their account (personal details erased)', network: relIds(person.networks)[0], by: 'Field app', actionType: 'account-deleted', at: new Date().toISOString() },
    ...all,
  } as never)
  forgetPerson(person.firebaseUid)
  return { ok: true }
}

/* ------------------------------------------------------------------ */
/* Register now                                                         */
/* ------------------------------------------------------------------ */

/** Roles someone can sign up for. Managers are added by an admin. */
const ROLES = [
  { value: 'operator', label: 'Kiln operator' },
  { value: 'supervisor', label: 'Supervisor' },
] as const

/** GET register/options — networks and their sites, to choose where the new person works. */
export async function registerOptions(req: Request) {
  await verifyToken(req)
  const payload = await getPayload({ config })
  const [networks, sites] = await Promise.all([
    payload.find({ collection: 'networks', where: { active: { not_equals: false } }, ...all, pagination: false, sort: 'name', select: { name: true } }),
    payload.find({ collection: 'sites', where: { active: { not_equals: false } }, ...all, pagination: false, sort: 'name', select: { name: true, network: true } }),
  ])
  return {
    roles: ROLES,
    networks: networks.docs.map((n) => ({
      id: n.id,
      name: n.name,
      sites: sites.docs.filter((s) => relId(s.network) === n.id).map((s) => ({ id: s.id, name: s.name })),
    })).filter((n) => n.sites.length),
  }
}

/** GET register/status — where this account's registration stands. */
export async function registerStatus(req: Request) {
  return registrationOf(await verifyToken(req))
}

export async function registrationOf(t: VerifiedToken) {
  const payload = await getPayload({ config })
  const person = await personFor(payload, t)
  if (!person) return { status: 'none' as const, email: t.email ?? '', name: t.name ?? '' }
  const status = person.appAccess && person.active ? 'approved' : (person.registrationStatus ?? 'none')
  return { status, email: person.email ?? t.email ?? '', name: person.name, note: person.registrationNote ?? '' }
}

/**
 * POST register — sign up after creating the Firebase account in the app. Creates the person without app access;
 * an admin approves (or rejects) the request in the Action Center.
 */
export async function register(req: Request) {
  const t = await verifyToken(req)
  return registerAccount(t, (await req.json().catch(() => null)) as Record<string, unknown> | null)
}

export async function registerAccount(t: VerifiedToken, body: Record<string, unknown> | null) {
  if (!t.email) throw new FieldError(400, 'Your account has no email address.')
  // Someone signing up with a password must prove the email is theirs (Google accounts already have).
  if (!t.emailVerified) throw new FieldError(403, 'Please verify your email first: open the link we sent you.', 'email_unverified')
  if (!body) throw new FieldError(400, 'Bad request.')
  const name = text(body.name, 100)
  const phone = text(body.phone, 40)
  const village = text(body.village, 200)
  const role = ROLES.find((r) => r.value === body.role)?.value
  if (!name) throw new FieldError(400, 'Please enter your name.')
  if (phone.replace(/\D/g, '').length < 8) throw new FieldError(400, 'Please enter your phone number.')
  if (!role) throw new FieldError(400, 'Please choose your role.')

  const payload = await getPayload({ config })
  const site = typeof body.siteId === 'string' ? await payload.findByID({ collection: 'sites', id: body.siteId, ...all, select: { network: true, name: true, active: true } }).catch(() => null) : null
  if (!site || site.active === false) throw new FieldError(400, 'Please choose your site.')
  const network = relId(site.network)!
  const net = await payload.findByID({ collection: 'networks', id: network, ...all, select: { organization: true, name: true } })

  const existing = await personFor(payload, t)
  if (existing && existing.registrationStatus !== 'rejected' && existing.registrationStatus !== 'pending') {
    throw new FieldError(409, 'This account is already set up. Sign in instead.')
  }
  // An email the admin already gave to someone: they get their login from the admin.
  const sameEmail = (await payload.find({ collection: 'people', where: { email: { like: t.email } }, ...all, limit: 5, select: { email: true, firebaseUid: true } })).docs.filter(
    (p) => p.email?.toLowerCase() === t.email && p.id !== existing?.id,
  )
  if (sameEmail.length) throw new FieldError(409, 'This email already belongs to someone in the system. Ask your admin for your login.')

  const data = {
    name,
    role,
    email: t.email,
    phone,
    address: village || null,
    sites: [site.id],
    networks: [network],
    organization: relId(net.organization) ?? null,
    active: true,
    appAccess: false,
    firebaseUid: t.uid,
    registrationStatus: 'pending',
    registrationNote: null,
  }
  const person = existing
    ? await payload.update({ collection: 'people', id: existing.id, data: data as never, ...all })
    : await payload.create({ collection: 'people', data: data as never, ...all })
  forgetPerson(t.uid)
  await payload.create({
    collection: 'activity-logs',
    data: { message: `${name} registered in the field app as ${role} at ${site.name} (${net.name}) — waiting for approval`, network, by: name, actionType: 'registration', at: new Date().toISOString() },
    ...all,
  } as never)
  return { ok: true, id: person.id, status: 'pending' }
}
