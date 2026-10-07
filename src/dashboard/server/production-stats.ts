'use server'

import { sql } from '@payloadcms/db-postgres'

type SQL = ReturnType<typeof sql>

import { n, requireAdmin } from './payload'
import { dateValue, filterValue } from './query'
import { guard } from './result'

export interface StatsQuery {
  networkId?: string
  siteId?: string
  /** YYYY-MM-DD, inclusive */
  from?: string
  to?: string
}

/** Biochar by assessment outcome, in m³ (volume as recorded) and t (volume × bulk density). */
export interface Quality {
  approved: { m3: number; t: number }
  pending: { m3: number; t: number }
  rejected: { m3: number; t: number }
}

export interface BatchStats {
  quality: Quality
  /** Per month (YYYY-MM): biomass and biochar in t, credits (approved C-sink) in tCO₂e. */
  months: { month: string; biomass: number; biochar: number; credits: number }[]
}

export interface CollectionStats {
  totalT: number
  byFeedstock: { feedstock: string; t: number }[]
  /** Per month (YYYY-MM), split by network type, in t. */
  months: { month: string; artisan: number; csink: number }[]
}

/** The same filters the table uses — place and date — so the numbers above it describe the same records. */
function where(q: StatsQuery, alias: string) {
  const parts: SQL[] = [sql`true`]
  const col = (c: string) => sql.raw(`${alias}.${c}`)
  const networkId = filterValue(q?.networkId)
  const siteId = filterValue(q?.siteId)
  const from = dateValue(q?.from)
  const to = dateValue(q?.to)
  if (networkId) parts.push(sql`${col('network_id')} = ${networkId}`)
  if (siteId) parts.push(sql`${col('site_id')} = ${siteId}`)
  if (from) parts.push(sql`${col('date')} >= ${`${from}T00:00:00.000Z`}`)
  if (to) parts.push(sql`${col('date')} <= ${`${to}T23:59:59.999Z`}`)
  return sql.join(parts, sql` and `)
}

/** Batches: quality-assessment split and monthly production & credits. */
export async function batchStats(q: StatsQuery) {
  return guard(async (): Promise<BatchStats> => {
    const { payload } = await requireAdmin()
    const drizzle = payload.db.drizzle
    const w = where(q, 'b')
    const [quality, months] = await Promise.all([
      drizzle.execute(sql`
        select case when status = 'admin_approved' then 'approved'
                    when status in ('rejected', 'admin_rejected') then 'rejected'
                    else 'pending' end as k,
          sum(biochar_l) / 1000 as m3, sum(biochar_l * coalesce(bulk_density, 0)) / 1000 as t
        from batches b where ${w} group by 1`),
      drizzle.execute(sql`
        select to_char(date, 'YYYY-MM') as month,
          sum(biomass_kg) / 1000 as biomass,
          sum(biochar_l * coalesce(bulk_density, 0)) / 1000 as biochar,
          sum(case when status = 'admin_approved' then csink_t else 0 end) as credits
        from batches b where ${w} group by 1 order by 1`),
    ])
    const out: Quality = { approved: { m3: 0, t: 0 }, pending: { m3: 0, t: 0 }, rejected: { m3: 0, t: 0 } }
    for (const r of quality.rows as { k: keyof Quality; m3: unknown; t: unknown }[]) out[r.k] = { m3: n(r.m3), t: n(r.t) }
    return {
      quality: out,
      months: (months.rows as Record<string, unknown>[]).map((r) => ({
        month: String(r.month),
        biomass: n(r.biomass),
        biochar: n(r.biochar),
        credits: n(r.credits),
      })),
    }
  })()
}

/** Biomass collection: total, split by feedstock, and monthly trend by network type. */
export async function collectionStats(q: StatsQuery) {
  return guard(async (): Promise<CollectionStats> => {
    const { payload } = await requireAdmin()
    const drizzle = payload.db.drizzle
    const w = where(q, 'c')
    const [byFeedstock, months] = await Promise.all([
      drizzle.execute(sql`
        select coalesce(nullif(trim(feedstock), ''), 'Unspecified') as feedstock, sum(quantity_kg) / 1000 as t
        from biomass_collections c where ${w} group by 1 order by 2 desc`),
      drizzle.execute(sql`
        select to_char(c.date, 'YYYY-MM') as month,
          sum(case when nw.type = 'csink' then c.quantity_kg else 0 end) / 1000 as csink,
          sum(case when nw.type = 'csink' then 0 else c.quantity_kg end) / 1000 as artisan
        from biomass_collections c left join networks nw on nw.id = c.network_id
        where ${w} group by 1 order by 1`),
    ])
    const feeds = (byFeedstock.rows as { feedstock: string; t: unknown }[]).map((r) => ({ feedstock: r.feedstock, t: n(r.t) }))
    return {
      totalT: feeds.reduce((s, f) => s + f.t, 0),
      byFeedstock: feeds,
      months: (months.rows as Record<string, unknown>[]).map((r) => ({ month: String(r.month), artisan: n(r.artisan), csink: n(r.csink) })),
    }
  })()
}
