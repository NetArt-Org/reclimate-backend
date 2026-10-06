import 'server-only'

import { sql } from '@payloadcms/db-postgres'

import type {
  Alert,
  Company,
  CreditBucket,
  DashboardData,
  Feedstock,
  Kiln,
  LogEntry,
  Network,
  PartnerOrg,
  PortfolioRow,
  Production,
  Site,
  User,
} from '../data/types'
import { db, n, relId, relIds } from './payload'

/** SQL for the credit bucket of a batch — the single definition of the portfolio statuses. */
export const BUCKET_SQL = sql`case
  when status in ('rejected', 'admin_rejected') then 'lost'
  when status = 'admin_approved' and registered then 'registered'
  when status = 'admin_approved' and sink_approved then 'pendingCeres'
  when status = 'admin_approved' then 'pendingSink'
  else 'pendingCirconomy' end`

const all = { pagination: false, depth: 0, overrideAccess: true } as const
// `raw` (the full Circonomy source record) is large and never needed for the shared dashboard data.
const noRaw = { ...all, select: { raw: false } } as const

/** Everything the dashboard pages share, read from Neon in one go. */
export async function loadDashboardData(): Promise<DashboardData> {
  const payload = await db()
  const drizzle = payload.db.drizzle

  const [company, orgs, networks, sites, kilns, people, feedstocks, alerts, logs, production, portfolio, sampling] = await Promise.all([
    payload.findGlobal({ slug: 'company', depth: 0, overrideAccess: true }),
    payload.find({ collection: 'organizations', ...noRaw, sort: 'code' }),
    payload.find({ collection: 'networks', ...noRaw, sort: 'name' }),
    payload.find({ collection: 'sites', ...noRaw, sort: 'name' }),
    payload.find({ collection: 'kilns', ...noRaw, sort: 'name' }),
    payload.find({ collection: 'people', ...noRaw, sort: 'name' }),
    payload.find({ collection: 'feedstocks', ...all, sort: 'name' }),
    payload.find({ collection: 'alerts', ...all, sort: '-createdAt', limit: 100 }),
    payload.find({ collection: 'activity-logs', pagination: true, limit: 60, depth: 0, overrideAccess: true, sort: '-at' }),
    // Weekly production per site. Biochar mass = litres × bulk density (kg/L).
    drizzle.execute(sql`
      select to_char(date_trunc('week', date), 'YYYY-MM-DD') as week, site_id, network_id,
        sum(biomass_kg) / 1000 as biomass_t,
        sum(biochar_l * coalesce(bulk_density, 0)) / 1000 as biochar_t,
        sum(csink_t) as co2_t,
        sum(case when status = 'admin_approved' then csink_t else 0 end) as credits_t
      from batches group by 1, 2, 3`),
    drizzle.execute(sql`
      select network_id, site_id, to_char(date, 'YYYY-MM') as month, ${BUCKET_SQL} as bucket, sum(csink_t) as co2_t
      from batches group by 1, 2, 3, 4`),
    // Sampling containers must be kept 6 months; flag the ones whose time is up (Circonomy raised these as alerts).
    drizzle.execute(sql`
      select c.id, c.code, c.added_at, c.network_id, n.name as network,
        (select b.feedstock from batches b where b.sampling_container_id = c.id order by b.date desc limit 1) as feedstock
      from containers c left join networks n on n.id = c.network_id
      where c.kind = 'sampling' and c.added_at is not null and c.added_at + interval '6 months' <= now()
      order by c.added_at desc limit 50`),
  ])

  const { name, kind, address, email, phone, dmrvProvider, profile } = company as unknown as Record<string, unknown>
  const companyData = {
    ...(profile as object),
    name: name ?? '',
    kind: kind ?? '',
    address: address ?? '',
    email: email ?? '',
    phone: phone ?? '',
    dmrvProvider: dmrvProvider ?? '',
  } as Company

  return {
    company: companyData,
    orgs: orgs.docs.map(
      (o): PartnerOrg => ({
        id: String(o.id),
        name: o.name,
        code: o.code,
        country: o.country ?? undefined,
        active: !!o.active,
        address: o.address ?? undefined,
        admins: (o.admins as PartnerOrg['admins']) ?? [],
        standards: (o.standards as PartnerOrg['standards']) ?? undefined,
      }),
    ),
    networks: networks.docs.map(
      (x): Network => ({
        id: String(x.id),
        orgId: relId(x.organization)!,
        code: x.code ?? undefined,
        type: x.type,
        name: x.name,
        location: x.location ?? '',
        lat: x.lat ?? null,
        lng: x.lng ?? null,
        active: !!x.active,
        ceresApproved: !!x.ceresApproved,
        certifiedAt: x.certifiedAt ?? undefined,
        config: { feedstocks: [], mixingTypes: [], applicationTypes: [], references: [], ...(x.config as object) },
        kml: (x.kml as Network['kml']) ?? undefined,
      }),
    ),
    sites: sites.docs.map(
      (s): Site => ({
        id: String(s.id),
        networkId: relId(s.network)!,
        name: s.name,
        code: s.code ?? undefined,
        lat: s.lat ?? null,
        lng: s.lng ?? null,
        active: !!s.active,
      }),
    ),
    kilns: kilns.docs.map(
      (k): Kiln => ({
        id: String(k.id),
        siteId: relId(k.site)!,
        name: k.name,
        code: k.code ?? undefined,
        type: k.type,
        volumeM3: k.volumeM3 ?? undefined,
        lat: k.lat ?? null,
        lng: k.lng ?? null,
        active: !!k.active,
      }),
    ),
    users: people.docs.map(
      (p): User => ({
        id: String(p.id),
        name: p.name,
        role: p.role,
        email: p.email ?? undefined,
        phone: p.phone ?? '',
        orgId: relId(p.organization) ?? '',
        networkIds: relIds(p.networks),
        siteIds: relIds(p.sites),
        active: !!p.active,
        otpBypass: !!p.otpBypass,
        photo: p.photo ?? undefined,
        trainingDocs: (p.trainingDocs as User['trainingDocs']) ?? [],
        device: (p.device as User['device']) ?? undefined,
        lat: p.lat ?? undefined,
        lng: p.lng ?? undefined,
      }),
    ),
    feedstocks: feedstocks.docs.map(
      (f): Feedstock => ({
        id: String(f.id),
        name: f.name,
        strategy: f.strategy ?? null,
        spc: !!f.spc,
        bulkDensity: f.bulkDensity ?? null,
        carbonContent: f.carbonContent ?? null,
        volumeTracking: !!f.volumeTracking,
      }),
    ),
    production: (production.rows as Record<string, unknown>[]).map(
      (r): Production => ({
        week: String(r.week),
        month: String(r.week).slice(0, 7),
        networkId: String(r.network_id),
        siteId: String(r.site_id),
        biomassT: +n(r.biomass_t).toFixed(3),
        biocharT: +n(r.biochar_t).toFixed(3),
        co2T: +n(r.co2_t).toFixed(3),
        creditsT: +n(r.credits_t).toFixed(3),
      }),
    ),
    portfolio: (portfolio.rows as Record<string, unknown>[]).map(
      (r): PortfolioRow => ({
        networkId: String(r.network_id),
        siteId: String(r.site_id),
        month: String(r.month),
        bucket: r.bucket as CreditBucket,
        co2T: n(r.co2_t),
      }),
    ),
    alerts: [
      ...alerts.docs.map(
        (a): Alert => ({
          id: String(a.id),
          kind: a.kind,
          message: a.message,
          date: a.createdAt,
          networkId: relId(a.network),
          request: (a.request as Alert['request']) ?? undefined,
          status: a.status ?? 'open',
        }),
      ),
      ...(sampling.rows as Record<string, unknown>[]).map(
        (r): Alert => ({
          id: `sampling-${r.id}`,
          kind: 'sampling',
          message: `Container ${r.code}${r.feedstock ? ` for ${r.feedstock}` : ''} under ${r.network ?? 'a network'} has reached 6 month sampling`,
          date: new Date(new Date(String(r.added_at)).getTime() + 182.5 * 86400000).toISOString(),
          networkId: r.network_id ? String(r.network_id) : undefined,
          status: 'open',
        }),
      ),
    ],
    logs: logs.docs.map(
      (l): LogEntry => ({ id: String(l.id), message: l.message, date: l.at ?? l.createdAt, networkId: relId(l.network) }),
    ),
  }
}
