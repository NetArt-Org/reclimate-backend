import 'server-only'

import { REJECT_REASONS } from '@/dashboard/data/catalog'
import type { FieldContext } from './auth'
import { batchPage } from './batches'
import { all, PAGE_SIZE, UPLOAD_LIMITS } from './common'
import { kilnRequests, loadCredits, SETUP_KEYS, setupPage, supervisorPage } from './lists'
import { media } from './map'
import { recordPage } from './records'
import { networkSettings } from './settings'
import { siteStats } from './stats'
import { appVersions } from './version'

/** The backend's public pages the app links to (privacy policy, terms, account deletion). */
export const publicLinks = () => {
  const base = (process.env.SERVER_URL || '').replace(/\/$/, '')
  return { privacyUrl: `${base}/privacy`, termsUrl: `${base}/terms`, deletionUrl: `${base}/account-deletion` }
}

/** GET me — everything the app needs to start, for the selected site (`?site=`). Long lists come one page at a time. */
export async function bootstrap(ctx: FieldContext) {
  const { payload, person, role, siteIds } = ctx
  const net = await networkSettings(ctx)
  const photoId = person.photo?.match(/\/files\/([\w-]{1,64})/)?.[1]
  const [sites, setup, requests, supervisors, batches, queue, ongoing, collections, mixings, packagings, applications, credits, stats] = await Promise.all([
    siteIds.length ? payload.find({ collection: 'sites', where: { id: { in: siteIds } }, ...all, pagination: false, sort: 'name', select: { name: true, active: true, network: true } }) : null,
    Promise.all(SETUP_KEYS.map(async (key) => ({ key, ...(await setupPage(ctx, key, 1, 100, net.feedstocks)) }))),
    kilnRequests(ctx),
    supervisorPage(ctx),
    batchPage(ctx),
    // Supervisors get their whole review queue's first page, whatever its age.
    role === 'sup' ? batchPage(ctx, 1, PAGE_SIZE, 'waiting') : null,
    // Burns still going, whatever their age (the Classic app's Ongoing tab).
    batchPage(ctx, 1, PAGE_SIZE, 'ongoing'),
    recordPage(ctx, 'collections'),
    recordPage(ctx, 'mixings'),
    recordPage(ctx, 'packagings'),
    recordPage(ctx, 'applications'),
    loadCredits(ctx),
    siteStats(ctx),
  ])
  // Kilns waiting for approval are listed with the site's kilns (marked pending, not selectable).
  const kilns = setup.find((s) => s.key === 'kilns')
  if (kilns) kilns.items = [...kilns.items, ...requests]

  return {
    person: {
      id: person.id,
      name: person.name,
      role,
      fieldRole: person.role,
      email: person.email ?? '',
      phone: person.phone ?? '',
      village: person.address ?? '',
      photo: photoId ? media({ id: photoId, mimeType: 'image/jpeg' }) : null,
      mustChangePassword: !!person.mustChangePassword,
    },
    sites: (sites?.docs ?? []).map((s) => ({ id: s.id, name: s.name, active: s.active !== false })),
    siteId: ctx.siteId,
    ...net,
    rejectReasons: REJECT_REASONS,
    settings: { pageSize: PAGE_SIZE, uploadLimits: UPLOAD_LIMITS, ...appVersions(), ...publicLinks() },
    setup,
    supervisors,
    batches,
    queue,
    ongoing,
    records: { collections, mixings, packagings, applications },
    ...credits,
    stats,
  }
}
