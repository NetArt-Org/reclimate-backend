'use server'

import type { CollectionSlug } from 'payload'
import { revalidatePath } from 'next/cache'

import type { Alert, Company, DocFile, Kiln, Network, PartnerOrg, Site, User } from '../data/types'
import { diff, fieldList, record } from './audit'
import { invalidateDashboard, relIds, requireAdmin } from './payload'
import { guard, MAX_UPLOAD_BYTES, MAX_UPLOAD_LABEL, UserError } from './result'
import { deleteDroppedUploads, deleteUploads, fileIdsIn, storeUpload } from './storage'

/**
 * Writes from the dashboard store. The store updates the screen first, then calls one of these;
 * if a call fails it shows the error and reloads the data from Neon.
 * Every action returns an ActionResult (see ./result) so error messages survive production builds.
 */

type Admin = Awaited<ReturnType<typeof requireAdmin>>

/**
 * Update the document, or create it with this id when it does not exist yet, and record the change in its history
 * (who, when, each field's old and new value). Returns the previous document (without the large `raw` field), so
 * callers can clean up files a save dropped.
 */
async function upsert(
  admin: Admin,
  collection: CollectionSlug,
  id: string,
  data: Record<string, unknown>,
  what: { label: string; name: string; network?: string | null },
) {
  const { payload } = admin
  if (typeof id !== 'string' || !/^[\w-]{1,64}$/.test(id)) throw new UserError('Invalid record id')
  const found = await payload.find({ collection, where: { id: { equals: id } }, limit: 1, depth: 0, overrideAccess: true, select: { raw: false } as never })
  const before = found.docs[0] as Record<string, unknown> | undefined
  if (before) await payload.update({ collection, id, data, depth: 0, overrideAccess: true })
  else await payload.create({ collection, data: { id, ...data }, depth: 0, overrideAccess: true } as never)
  const changes = diff(before ?? null, data)
  if (!before) {
    await record(admin, { entity: collection, entityId: id, action: 'create', message: `${what.label} ${what.name} added`, changes, network: what.network })
  } else if (changes.length) {
    await record(admin, { entity: collection, entityId: id, action: 'update', message: `${what.label} ${what.name}: ${fieldList(changes)} changed`, changes, network: what.network })
  }
  return before
}

export async function saveCompany(company: Company) {
  return guard(async () => {
    const admin = await requireAdmin()
    const { payload } = admin
    const { name, kind, address, email, phone, dmrvProvider, ...profile } = company
    const before = await payload.findGlobal({ slug: 'company', depth: 0, overrideAccess: true })
    await payload.updateGlobal({
      slug: 'company',
      data: { name, kind, address, email, phone, dmrvProvider, profile },
      overrideAccess: true,
    })
    // History: the top-level fields and each part of the profile (projects, certificates, app rules, …).
    const { audit: _audit, ...rest } = profile as Record<string, unknown>
    void _audit
    const changes = diff(
      { name: before.name, kind: before.kind, address: before.address, email: before.email, phone: before.phone, dmrvProvider: before.dmrvProvider, ...((before.profile ?? {}) as Record<string, unknown>), audit: undefined },
      { name, kind, address, email, phone, dmrvProvider, ...rest },
    ).filter((c) => c.field !== 'audit')
    if (changes.length) await record(admin, { entity: 'company', entityId: 'company', action: 'update', message: `Company profile: ${fieldList(changes)} changed`, changes })
    // Documents removed from the profile (company docs, billing docs) are deleted from storage.
    await deleteDroppedUploads(before.profile, profile)
    invalidateDashboard()
  })()
}

export async function saveOrg(o: PartnerOrg) {
  return guard(async () => {
    const admin = await requireAdmin()
    await upsert(admin, 'organizations', o.id, {
      code: o.code,
      name: o.name,
      country: o.country,
      address: o.address,
      active: o.active,
      admins: o.admins ?? [],
      standards: o.standards ?? null,
    }, { label: 'Organisation', name: o.name })
    invalidateDashboard()
  })()
}

export async function saveNetwork(x: Network) {
  return guard(async () => {
    const admin = await requireAdmin()
    const before = await upsert(admin, 'networks', x.id, {
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
    }, { label: 'Network', name: x.name, network: x.id })
    // SOP documents removed from the drying/shredding steps.
    await deleteDroppedUploads(before?.config, x.config)
    invalidateDashboard()
  })()
}

export async function saveSite(s: Site) {
  return guard(async () => {
    const admin = await requireAdmin()
    if (!s.name?.trim()) throw new UserError('Give the site a name')
    if (s.lat != null && (s.lat < -90 || s.lat > 90)) throw new UserError('Latitude must be between -90 and 90')
    if (s.lng != null && (s.lng < -180 || s.lng > 180)) throw new UserError('Longitude must be between -180 and 180')
    await upsert(
      admin,
      'sites',
      s.id,
      { network: s.networkId, code: s.code?.trim() || null, name: s.name.trim(), address: s.address?.trim() || null, lat: s.lat, lng: s.lng, active: s.active },
      { label: 'Site', name: s.name.trim(), network: s.networkId },
    )
    invalidateDashboard()
  })()
}

export async function saveKiln(k: Kiln) {
  return guard(async () => {
    const admin = await requireAdmin()
    if (!k.name?.trim()) throw new UserError('Give the kiln a name')
    if (k.type !== 'kontiki' && k.type !== 'pit') throw new UserError('Choose Kon-Tiki or pit')
    if (k.volumeM3 != null && (!Number.isFinite(k.volumeM3) || k.volumeM3 < 0 || k.volumeM3 > 1000)) throw new UserError('The volume must be between 0 and 1000 m³')
    const site = await admin.payload.findByID({ collection: 'sites', id: k.siteId, depth: 0, select: { network: true }, overrideAccess: true }).catch(() => null)
    if (!site) throw new UserError('Choose the site of the kiln')
    await upsert(
      admin,
      'kilns',
      k.id,
      {
        site: k.siteId,
        code: k.code?.trim() || null,
        name: k.name.trim(),
        type: k.type,
        volumeM3: k.volumeM3 ?? null,
        shape: k.shape || null,
        dimensions: k.dimensions ?? null,
        lat: k.lat,
        lng: k.lng,
        active: k.active,
      },
      { label: 'Kiln', name: k.name.trim(), network: relIds([site.network])[0] },
    )
    invalidateDashboard()
  })()
}

export async function savePerson(u: User) {
  return guard(async () => {
    const admin = await requireAdmin()
    const before = await upsert(admin, 'people', u.id, {
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
    }, { label: 'Person', name: u.name, network: u.networkIds[0] })
    // A replaced photo or a removed training certificate is deleted from storage.
    await deleteDroppedUploads([before?.photo, before?.trainingDocs], [u.photo, u.trainingDocs])
    invalidateDashboard()
  })()
}

export async function deletePerson(id: string) {
  return guard(async () => {
    const admin = await requireAdmin()
    const person = await admin.payload.delete({ collection: 'people', id, overrideAccess: true })
    await record(admin, { entity: 'people', entityId: id, action: 'delete', message: `Person ${person.name} deleted`, network: relIds(person.networks)[0] })
    // Their photo and training certificates go with them.
    await deleteUploads(fileIdsIn([person.photo, person.trainingDocs]))
    invalidateDashboard()
  })()
}

/** Approve / reject / dismiss an Action Center alert. Approving a bulk-density request updates the network's reference. */
export async function resolveAlert(id: string, status: Exclude<Alert['status'], 'open'>) {
  return guard(async () => {
    const admin = await requireAdmin()
    const { payload, user } = admin
    // A field-app sell request: approve = paid (the credits leave the worker's balance), reject = declined.
    if (id.startsWith('sell-')) {
      const req = await payload.update({
        collection: 'sell-requests',
        id: id.slice(5),
        data: { status: status === 'approved' ? 'paid' : 'declined', decidedBy: user.name, decidedAt: new Date().toISOString() },
        depth: 1,
        overrideAccess: true,
      })
      const person = typeof req.person === 'object' && req.person ? req.person.name : 'a worker'
      await record(admin, {
        entity: 'sell-requests',
        entityId: String(req.id),
        action: status === 'approved' ? 'paid' : 'declined',
        message: `Sell request of ${req.creditsT} credits from ${person} ${status === 'approved' ? 'marked paid' : 'declined'}`,
        network: relIds([req.network])[0],
      })
      invalidateDashboard()
      return
    }
    // A field-app sign-up: approve = app access at the site they chose; reject = they see that it was not approved.
    if (id.startsWith('reg-')) {
      const approve = status === 'approved'
      const person = await payload.update({
        collection: 'people',
        id: id.slice(4),
        data: { registrationStatus: approve ? 'approved' : 'rejected', appAccess: approve, active: true, registrationNote: approve ? null : 'Your registration was not approved. Contact your admin.' },
        depth: 0,
        overrideAccess: true,
      })
      await record(admin, {
        entity: 'people',
        entityId: String(person.id),
        action: approve ? 'approved' : 'rejected',
        message: `Field app sign-up of ${person.name} ${approve ? 'approved' : 'rejected'}`,
        network: relIds(person.networks)[0],
      })
      invalidateDashboard()
      return
    }
    const alert = await payload.update({ collection: 'alerts', id, data: { status }, depth: 0, overrideAccess: true })
    // A kiln a field user asked for: approving adds it to their site.
    const kilnReq = alert.request as Alert['kilnRequest'] | null
    if (status === 'approved' && kilnReq?.kiln && kilnReq.siteId) {
      await payload.create({
        collection: 'kilns',
        data: { site: kilnReq.siteId, name: kilnReq.kiln, type: 'kontiki', volumeM3: kilnReq.volumeL ? kilnReq.volumeL / 1000 : null, active: true } as never,
        overrideAccess: true,
      })
    }
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
    await record(admin, { entity: 'alerts', entityId: String(alert.id), action: status, message: `Alert ${status}: ${alert.message}`, network: networkId })
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
