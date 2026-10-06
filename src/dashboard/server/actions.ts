'use server'

import type { CollectionSlug } from 'payload'
import { revalidatePath } from 'next/cache'

import type { Alert, Company, DocFile, Kiln, Network, PartnerOrg, Site, User } from '../data/types'
import { invalidateDashboard, requireAdmin } from './payload'
import { guard, MAX_UPLOAD_BYTES, MAX_UPLOAD_LABEL, UserError } from './result'
import { deleteDroppedUploads, deleteUploads, fileIdsIn, storeUpload } from './storage'

/**
 * Writes from the dashboard store. The store updates the screen first, then calls one of these;
 * if a call fails it shows the error and reloads the data from Neon.
 * Every action returns an ActionResult (see ./result) so error messages survive production builds.
 */

type Payload = Awaited<ReturnType<typeof requireAdmin>>['payload']

/**
 * Update the document, or create it with this id when it does not exist yet.
 * Returns the previous document (without the large `raw` field), so callers can clean up files a save dropped.
 */
async function upsert(payload: Payload, collection: CollectionSlug, id: string, data: Record<string, unknown>) {
  if (typeof id !== 'string' || !/^[\w-]{1,64}$/.test(id)) throw new UserError('Invalid record id')
  const found = await payload.find({ collection, where: { id: { equals: id } }, limit: 1, depth: 0, overrideAccess: true, select: { raw: false } as never })
  const before = found.docs[0] as Record<string, unknown> | undefined
  if (before) await payload.update({ collection, id, data, depth: 0, overrideAccess: true })
  else await payload.create({ collection, data: { id, ...data }, depth: 0, overrideAccess: true } as never)
  return before
}

export async function saveCompany(company: Company) {
  return guard(async () => {
    const { payload } = await requireAdmin()
    const { name, kind, address, email, phone, dmrvProvider, ...profile } = company
    const before = await payload.findGlobal({ slug: 'company', depth: 0, overrideAccess: true })
    await payload.updateGlobal({
      slug: 'company',
      data: { name, kind, address, email, phone, dmrvProvider, profile },
      overrideAccess: true,
    })
    // Documents removed from the profile (company docs, billing docs) are deleted from storage.
    await deleteDroppedUploads(before.profile, profile)
    invalidateDashboard()
  })()
}

export async function saveOrg(o: PartnerOrg) {
  return guard(async () => {
    const { payload } = await requireAdmin()
    await upsert(payload, 'organizations', o.id, {
      code: o.code,
      name: o.name,
      country: o.country,
      address: o.address,
      active: o.active,
      admins: o.admins ?? [],
      standards: o.standards ?? null,
    })
    invalidateDashboard()
  })()
}

export async function saveNetwork(x: Network) {
  return guard(async () => {
    const { payload } = await requireAdmin()
    const before = await upsert(payload, 'networks', x.id, {
      organization: x.orgId,
      code: x.code,
      name: x.name,
      type: x.type,
      location: x.location,
      lat: x.lat,
      lng: x.lng,
      active: x.active,
      ceresApproved: x.ceresApproved,
      certifiedAt: x.certifiedAt || null,
      config: x.config,
      kml: x.kml ?? null,
    })
    // SOP documents removed from the drying/shredding steps.
    await deleteDroppedUploads(before?.config, x.config)
    invalidateDashboard()
  })()
}

export async function saveSite(s: Site) {
  return guard(async () => {
    const { payload } = await requireAdmin()
    await upsert(payload, 'sites', s.id, { network: s.networkId, code: s.code, name: s.name, lat: s.lat, lng: s.lng, active: s.active })
    invalidateDashboard()
  })()
}

export async function saveKiln(k: Kiln) {
  return guard(async () => {
    const { payload } = await requireAdmin()
    await upsert(payload, 'kilns', k.id, {
      site: k.siteId,
      code: k.code,
      name: k.name,
      type: k.type,
      volumeM3: k.volumeM3,
      lat: k.lat,
      lng: k.lng,
      active: k.active,
    })
    invalidateDashboard()
  })()
}

export async function savePerson(u: User) {
  return guard(async () => {
    const { payload } = await requireAdmin()
    const before = await upsert(payload, 'people', u.id, {
      name: u.name,
      role: u.role,
      email: u.email || null,
      phone: u.phone || null,
      organization: u.orgId || null,
      networks: u.networkIds,
      sites: u.siteIds,
      active: u.active,
      otpBypass: u.otpBypass,
      photo: u.photo ?? null,
      trainingDocs: u.trainingDocs,
      device: u.device ?? null,
      lat: u.lat ?? null,
      lng: u.lng ?? null,
    })
    // A replaced photo or a removed training certificate is deleted from storage.
    await deleteDroppedUploads([before?.photo, before?.trainingDocs], [u.photo, u.trainingDocs])
    invalidateDashboard()
  })()
}

export async function deletePerson(id: string) {
  return guard(async () => {
    const { payload } = await requireAdmin()
    const person = await payload.delete({ collection: 'people', id, overrideAccess: true })
    // Their photo and training certificates go with them.
    await deleteUploads(fileIdsIn([person.photo, person.trainingDocs]))
    invalidateDashboard()
  })()
}

/** Approve / reject / dismiss an Action Center alert. Approving a bulk-density request updates the network's reference. */
export async function resolveAlert(id: string, status: Exclude<Alert['status'], 'open'>) {
  return guard(async () => {
    const { payload, user } = await requireAdmin()
    const alert = await payload.update({ collection: 'alerts', id, data: { status }, depth: 0, overrideAccess: true })
    const networkId = alert.network ? String(typeof alert.network === 'object' ? alert.network.id : alert.network) : undefined
    const request = alert.request as Alert['request']
    if (status === 'approved' && request && networkId) {
      const net = await payload.findByID({ collection: 'networks', id: networkId, depth: 0, overrideAccess: true })
      const config = (net.config ?? {}) as unknown as Network['config']
      const ref = config.references?.find((r) => r.feedstock === request.feedstock)
      if (ref) {
        ref.bulkDensity = request.bulkDensity
        await payload.update({ collection: 'networks', id: networkId, data: { config: config as never }, overrideAccess: true })
      }
    }
    await payload.create({
      collection: 'activity-logs',
      data: { message: `Alert ${status}: ${alert.message}`, network: networkId, by: user.name },
      overrideAccess: true,
    } as never)
    invalidateDashboard()
  })()
}

/** Store an uploaded file (Firebase Storage) and describe it for the record that keeps it. */
export async function uploadFile(form: FormData) {
  return guard(async (): Promise<DocFile> => {
    await requireAdmin()
    const file = form.get('file')
    if (!(file instanceof File)) throw new UserError('No file received')
    if (file.size > MAX_UPLOAD_BYTES) throw new UserError(`Files can be at most ${MAX_UPLOAD_LABEL}`)
    return storeUpload(file)
  })()
}

/** Reload every admin page's data after a write made outside the store. */
export async function refreshAdmin() {
  return guard(async () => {
    await requireAdmin()
    revalidatePath('/admin', 'layout')
  })()
}
