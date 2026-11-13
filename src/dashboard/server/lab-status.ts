import 'server-only'

import { sql } from '@payloadcms/db-postgres'

import { ANALYSIS_EVERY_DAYS, BULK_DENSITY_EVERY_M3, type LabStatus } from '../data/lab'
import { db, n } from './payload'

/**
 * Lab status of every network × feedstock that has made biochar. Used by the Feedstock management page and by the
 * "lab reports due" reminder in Needs attention.
 */
export async function labStatuses(feedstockName?: string): Promise<LabStatus[]> {
  const payload = await db()
  const drizzle = payload.db.drizzle
  const [produced, reports] = await Promise.all([
    drizzle.execute(sql`
      select network_id, trim(feedstock) as feedstock, sum(biochar_l) / 1000 as m3,
        sum(case when date >= now() - interval '365 days' then biochar_l else 0 end) / 1000 as recent_m3
      from batches
      where voided is not true and network_id is not null and coalesce(trim(feedstock), '') <> ''
        and status not in ('rejected', 'admin_rejected')
        ${feedstockName ? sql`and trim(feedstock) = ${feedstockName}` : sql``}
      group by 1, 2`),
    drizzle.execute(sql`
      select distinct on (r.network_id, f.name, r.kind) r.network_id, f.name as feedstock, r.kind, r.report_date, r.produced_m3, r.bulk_density
      from lab_reports r join feedstocks f on f.id = r.feedstock_id
      ${feedstockName ? sql`where f.name = ${feedstockName}` : sql``}
      order by r.network_id, f.name, r.kind, r.report_date desc, r.created_at desc`),
  ])
  const last = new Map<string, { date: string; producedM3: number | null; bulkDensity: number | null }>()
  for (const r of reports.rows as Record<string, unknown>[]) {
    last.set(`${r.network_id}|${r.feedstock}|${r.kind}`, {
      date: new Date(String(r.report_date)).toISOString(),
      producedM3: r.produced_m3 == null ? null : n(r.produced_m3),
      bulkDensity: r.bulk_density == null ? null : n(r.bulk_density),
    })
  }
  const yearAgo = Date.now() - ANALYSIS_EVERY_DAYS * 86_400_000
  return (produced.rows as Record<string, unknown>[]).map((r) => {
    const key = `${r.network_id}|${r.feedstock}`
    const bd = last.get(`${key}|bulk-density`)
    const an = last.get(`${key}|analysis`)
    const producedM3 = +n(r.m3).toFixed(3)
    const since = +Math.max(0, producedM3 - (bd?.producedM3 ?? 0)).toFixed(3)
    return {
      networkId: String(r.network_id),
      feedstock: String(r.feedstock),
      producedM3,
      sinceBulkDensityM3: since,
      bulkDensityDue: since >= BULK_DENSITY_EVERY_M3,
      lastBulkDensity: bd ? { date: bd.date, value: bd.bulkDensity } : null,
      lastAnalysis: an ? { date: an.date } : null,
      // Only where the feedstock was used in the last year.
      analysisDue: n(r.recent_m3) > 0 && (!an || Date.parse(an.date) < yearAgo),
    }
  })
}

