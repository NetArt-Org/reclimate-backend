import 'server-only'

import { sql } from '@payloadcms/db-postgres'

import type { FieldContext } from './auth'
import { memo, TTL } from './cache'

const n = (v: unknown) => {
  const x = Number(v)
  return Number.isFinite(x) ? x : 0
}

interface Flow {
  litres: number
  kg: number
  bags: number
  count: number
}

export interface SiteStats {
  biochar: { totalL: number; approvedL: number; rejectedL: number; pendingL: number; mixedL: number; shipped: Flow; applied: Flow }
  batches: { inProgress: number; waiting: number; approved: number; rejected: number; total: number }
  biomass: { totalKg: number; collections: number; byFeedstock: { feedstock: string; kg: number; count: number }[] }
  mixing: { byType: { type: string; biocharL: number; kg: number; count: number }[]; count: number }
  packing: { type: string; bag: string; bags: number; remaining: number; kg: number }[]
  /** Approved biochar not yet used in a mixing (litres). */
  available: { biocharL: number }
  /** Biochar made per day over the last 30 days. */
  trend: { day: string; litres: number }[]
}

/**
 * Totals for the current site, across all of its records (not only the batches loaded on the phone): what the
 * Home screens show. Volumes are litres and masses kilograms; the app chooses how to display them.
 */
export const siteStats = (ctx: FieldContext): Promise<SiteStats> => memo(`stats:${ctx.siteId ?? '-'}`, TTL.stats, () => loadStats(ctx))

async function loadStats(ctx: FieldContext): Promise<SiteStats> {
  const site = ctx.siteId
  if (!site) return emptyStats()
  const db = ctx.payload.db.drizzle
  const [batches, trend, biomass, mixed, packed, applied] = await Promise.all([
    db.execute(sql`
      select status, count(*) as n, coalesce(sum(biochar_l), 0) as l, coalesce(sum(biomass_kg), 0) as kg
      from batches where site_id = ${site} group by status`),
    db.execute(sql`
      select to_char(date_trunc('day', date), 'YYYY-MM-DD') as day, coalesce(sum(biochar_l), 0) as l
      from batches where site_id = ${site} and date >= now() - interval '30 days' group by 1 order by 1`),
    db.execute(sql`
      select coalesce(nullif(trim(feedstock), ''), 'Other') as feedstock, coalesce(sum(quantity_kg), 0) as kg, count(*) as n
      from biomass_collections where site_id = ${site} group by 1 order by 2 desc`),
    db.execute(sql`
      select coalesce(nullif(trim(mixing_type), ''), 'Other') as type, coalesce(sum(biochar_l), 0) as l, coalesce(sum(total_kg), 0) as kg, count(*) as n
      from mixings where site_id = ${site} group by 1 order by 2 desc`),
    db.execute(sql`
      select coalesce(nullif(trim(packaging_type), ''), 'Other') as type, coalesce(nullif(trim(bag_details), ''), 'Open') as bag,
        coalesce(sum(bags_created), 0) as bags, coalesce(sum(bags_remaining), 0) as remaining,
        coalesce(sum(coalesce(biochar_kg, 0) + coalesce(mix_kg, 0)), 0) as kg
      from packagings where site_id = ${site} group by 1, 2 order by 1, 2`),
    db.execute(sql`
      select case when kind = 'distribution' then 'distribution' else 'application' end as kind,
        coalesce(sum(case when lower(coalesce(quantity_unit, '')) in ('l', 'litre', 'liter', 'ltr') then quantity else 0 end), 0) as l,
        coalesce(sum(case when lower(coalesce(quantity_unit, '')) = 'kg' then quantity else 0 end), 0) as kg,
        coalesce(sum(bags), 0) as bags, count(*) as n
      from applications where site_id = ${site} group by 1`),
  ])

  const by = new Map((batches.rows as { status: string; n: unknown; l: unknown; kg: unknown }[]).map((r) => [r.status, r]))
  const sum = (statuses: string[], k: 'n' | 'l' | 'kg') => statuses.reduce((a, s) => a + n(by.get(s)?.[k]), 0)
  const APPROVED = ['approved', 'admin_approved'], REJECTED = ['rejected', 'admin_rejected'], PENDING = ['not_assessed', 'started']
  const approvedL = sum(APPROVED, 'l')
  const mixes = (mixed.rows as { type: string; l: unknown; kg: unknown; n: unknown }[]).map((r) => ({ type: r.type, biocharL: n(r.l), kg: n(r.kg), count: n(r.n) }))
  const mixedL = mixes.reduce((a, m) => a + m.biocharL, 0)
  const apps = new Map((applied.rows as { kind: string; l: unknown; kg: unknown; bags: unknown; n: unknown }[]).map((r) => [r.kind, { litres: n(r.l), kg: n(r.kg), bags: n(r.bags), count: n(r.n) }]))
  const none = { litres: 0, kg: 0, bags: 0, count: 0 }

  // The last 30 days, one entry per day (zero on days without a batch).
  const perDay = new Map((trend.rows as { day: string; l: unknown }[]).map((r) => [r.day, n(r.l)]))
  const days = Array.from({ length: 30 }, (_, i) => {
    const d = new Date(Date.now() - (29 - i) * 86400000).toISOString().slice(0, 10)
    return { day: d, litres: perDay.get(d) ?? 0 }
  })

  const feedstocks = (biomass.rows as { feedstock: string; kg: unknown; n: unknown }[]).map((r) => ({ feedstock: r.feedstock, kg: n(r.kg), count: n(r.n) }))
  return {
    biochar: {
      totalL: sum([...APPROVED, ...REJECTED, ...PENDING], 'l'),
      approvedL,
      rejectedL: sum(REJECTED, 'l'),
      pendingL: sum(PENDING, 'l'),
      mixedL,
      shipped: apps.get('distribution') ?? none,
      applied: apps.get('application') ?? none,
    },
    batches: { inProgress: sum(['started'], 'n'), waiting: sum(['not_assessed'], 'n'), approved: sum(APPROVED, 'n'), rejected: sum(REJECTED, 'n'), total: sum([...APPROVED, ...REJECTED, ...PENDING], 'n') },
    biomass: { totalKg: feedstocks.reduce((a, f) => a + f.kg, 0), collections: feedstocks.reduce((a, f) => a + f.count, 0), byFeedstock: feedstocks },
    mixing: { byType: mixes, count: mixes.reduce((a, m) => a + m.count, 0) },
    packing: (packed.rows as { type: string; bag: string; bags: unknown; remaining: unknown; kg: unknown }[]).map((r) => ({ type: r.type, bag: r.bag, bags: n(r.bags), remaining: n(r.remaining), kg: n(r.kg) })),
    available: { biocharL: Math.max(0, approvedL - mixedL) },
    trend: days,
  }
}

function emptyStats(): SiteStats {
  const none = { litres: 0, kg: 0, bags: 0, count: 0 }
  return {
    biochar: { totalL: 0, approvedL: 0, rejectedL: 0, pendingL: 0, mixedL: 0, shipped: none, applied: none },
    batches: { inProgress: 0, waiting: 0, approved: 0, rejected: 0, total: 0 },
    biomass: { totalKg: 0, collections: 0, byFeedstock: [] },
    mixing: { byType: [], count: 0 },
    packing: [],
    available: { biocharL: 0 },
    trend: Array.from({ length: 30 }, (_, i) => ({ day: new Date(Date.now() - (29 - i) * 86400000).toISOString().slice(0, 10), litres: 0 })),
  }
}
