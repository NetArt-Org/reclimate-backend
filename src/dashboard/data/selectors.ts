import { LATEST_APP_VERSION } from './catalog'
import { monthRange } from './mock'
import type { DashboardData, Filters, Network, Production } from './types'
import { versionLess } from '../lib/utils'

const pad = (n: number) => String(n).padStart(2, '0')
const thisMonth = () => {
  const d = new Date()
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`
}

/** Networks matching the organisation + network-type filters (before the network picker). */
export function scopedNetworks(data: DashboardData, f: Filters): Network[] {
  return data.networks.filter((n) => (!f.orgId || n.orgId === f.orgId) && (!f.networkType || n.type === f.networkType))
}

/** Networks actually included: the picked ones, or all in scope. */
export function selectedNetworks(data: DashboardData, f: Filters): Network[] {
  const scoped = scopedNetworks(data, f)
  return f.networkIds.length ? scoped.filter((n) => f.networkIds.includes(n.id)) : scoped
}

export function selectedSites(data: DashboardData, f: Filters) {
  const nets = new Set(selectedNetworks(data, f).map((n) => n.id))
  const inScope = data.sites.filter((s) => nets.has(s.networkId))
  return f.siteIds.length ? inScope.filter((s) => f.siteIds.includes(s.id)) : inScope
}

function inPeriod(month: string, f: Filters) {
  const p = f.period
  if (p.kind === 'month') return month === thisMonth()
  if (p.kind === 'year') return month.slice(0, 4) === thisMonth().slice(0, 4)
  if (p.kind === 'custom') return (!p.from || month >= p.from.slice(0, 7)) && (!p.to || month <= p.to.slice(0, 7))
  return true
}

/** Production rows for the current filters. */
export function filteredProduction(data: DashboardData, f: Filters): Production[] {
  const siteIds = new Set(selectedSites(data, f).map((s) => s.id))
  return data.production.filter((p) => siteIds.has(p.siteId) && inPeriod(p.month, f))
}

/**
 * Credits counted under the current filters:
 *  - Vintage: only the picked production years.
 *  - Cut-off date: only months on/after the network's CERES certificate date.
 */
function eligibleCredits(p: Production, f: Filters, nets: Map<string, Network>) {
  if (f.vintages.length && !f.vintages.includes(Number(p.month.slice(0, 4)))) return 0
  if (f.cutoff) {
    const certified = nets.get(p.networkId)?.certifiedAt
    if (!certified || p.month < certified.slice(0, 7)) return 0
  }
  return p.creditsT
}

export function kpis(data: DashboardData, f: Filters) {
  const rows = filteredProduction(data, f)
  const nets = new Map(data.networks.map((n) => [n.id, n]))
  const networks = selectedNetworks(data, f)
  const sites = selectedSites(data, f)
  const siteIds = new Set(sites.map((s) => s.id))
  const netIds = new Set(networks.map((n) => n.id))
  const artisan = networks.filter((n) => n.type === 'artisan')
  const csink = networks.filter((n) => n.type === 'csink')
  return {
    biocharT: rows.reduce((a, p) => a + p.biocharT, 0),
    co2T: rows.reduce((a, p) => a + p.co2T, 0),
    creditsT: rows.reduce((a, p) => a + eligibleCredits(p, f, nets), 0),
    biomassT: rows.reduce((a, p) => a + p.biomassT, 0),
    artisanNetworks: artisan.length,
    artisanSites: sites.filter((s) => artisan.some((n) => n.id === s.networkId)).length,
    csinkNetworks: csink.length,
    farmers: data.users.filter((u) => u.role === 'farmer' && u.active && u.networkIds.some((id) => netIds.has(id))).length,
    activeKilns: data.kilns.filter((k) => k.active && siteIds.has(k.siteId)).length,
    sites: sites.length,
  }
}

export type Grain = 'week' | 'month'

/**
 * Production chart data: one point per bucket (a week's Monday or a YYYY-MM),
 * for the selected networks/sites. Empty buckets stay at 0 so the time axis is continuous.
 */
export function timeSeries(data: DashboardData, f: Filters, grain: Grain, buckets: string[]) {
  const nets = new Map(data.networks.map((n) => [n.id, n]))
  const siteIds = new Set(selectedSites(data, f).map((s) => s.id))
  const rows = new Map(buckets.map((key) => [key, { key, biomass: 0, biochar: 0, credits: 0 }]))
  for (const p of data.production) {
    if (!siteIds.has(p.siteId)) continue
    const r = rows.get(grain === 'week' ? p.week : p.month)
    if (!r) continue
    r.biomass += p.biomassT
    r.biochar += p.biocharT
    r.credits += eligibleCredits(p, f, nets)
  }
  return [...rows.values()].map((r) => ({ ...r, biomass: +r.biomass.toFixed(2), biochar: +r.biochar.toFixed(2), credits: +r.credits.toFixed(2) }))
}

/** People on an outdated field-app version (drives an Action Center alert). */
export const outdatedUsers = (data: DashboardData) =>
  data.users.filter((u) => u.active && u.device && versionLess(u.device.version, LATEST_APP_VERSION))

/** Production years present in the data, for the Vintage picker. */
export const vintageYears = (data: DashboardData) =>
  [...new Set(data.production.map((p) => Number(p.month.slice(0, 4))))].sort()

export type Metric = 'biochar' | 'co2' | 'credits' | 'biomass'

/** Months covered by the current period ("All" compares the last 12 months). */
function windowMonths(all: string[], f: Filters): string[] {
  const p = f.period
  if (p.kind === 'month') return [thisMonth()]
  if (p.kind === 'year') return all.filter((m) => m.slice(0, 4) === thisMonth().slice(0, 4) && m <= thisMonth())
  if (p.kind === 'custom') return all.filter((m) => (!p.from || m >= p.from.slice(0, 7)) && (!p.to || m <= p.to.slice(0, 7)))
  return all.filter((m) => m <= thisMonth()).slice(-12)
}

const shiftMonth = (m: string, by: number) => {
  const [y, mo] = m.split('-').map(Number)
  const d = new Date(y, mo - 1 + by, 1)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`
}

/**
 * For each headline metric: the monthly values of the current window (sparkline)
 * and the change against the same number of months just before it.
 */
export function comparison(data: DashboardData, f: Filters) {
  const nets = new Map(data.networks.map((n) => [n.id, n]))
  const siteIds = new Set(selectedSites(data, f).map((s) => s.id))
  const byMonth = new Map<string, Record<Metric, number>>()
  for (const p of data.production) {
    if (!siteIds.has(p.siteId)) continue
    const m = byMonth.get(p.month) ?? { biochar: 0, co2: 0, credits: 0, biomass: 0 }
    m.biochar += p.biocharT
    m.co2 += p.co2T
    m.credits += eligibleCredits(p, f, nets)
    m.biomass += p.biomassT
    byMonth.set(p.month, m)
  }
  const allMonths = monthRange()
  const current = windowMonths(allMonths, f)
  const previous = current.length ? current.map((m) => shiftMonth(m, -current.length)) : []
  const sum = (months: string[], k: Metric) => months.reduce((a, m) => a + (byMonth.get(m)?.[k] ?? 0), 0)

  const out = {} as Record<Metric, { spark: number[]; delta: number | null }>
  for (const k of ['biochar', 'co2', 'credits', 'biomass'] as Metric[]) {
    const now = sum(current, k)
    const before = sum(previous, k)
    out[k] = { spark: current.map((m) => byMonth.get(m)?.[k] ?? 0), delta: before > 0 ? ((now - before) / before) * 100 : null }
  }
  return { metrics: out, label: f.period.kind === 'all' ? 'last 12 months vs previous 12' : f.period.kind === 'month' ? 'vs last month' : 'vs previous period' }
}

