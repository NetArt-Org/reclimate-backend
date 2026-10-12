import 'server-only'

import { APPLICATION_TYPES, MIXING_TYPES, withAppDefaults } from '@/dashboard/data/catalog'
import type { AppConfig } from '@/dashboard/data/types'
import type { FieldContext } from './auth'
import { memo, TTL } from './cache'
import { all } from './common'
import type { FeedstockInfo } from './lists'

/** The current network's settings: field-app rules and the choices the app offers (cached briefly per site). */
export const networkSettings = (ctx: FieldContext) => memo(`settings:${ctx.siteId ?? ctx.networkIds[0] ?? '-'}`, TTL.settings, () => loadSettings(ctx))

async function loadSettings(ctx: FieldContext) {
  const { payload, siteId } = ctx
  const site = siteId ? await payload.findByID({ collection: 'sites', id: siteId, ...all, select: { network: true, name: true } }) : null
  const networkId = site?.network ? String(typeof site.network === 'object' ? site.network.id : site.network) : ctx.networkIds[0]
  const [network, company, feedstockRows] = await Promise.all([
    networkId ? payload.findByID({ collection: 'networks', id: networkId, ...all, select: { raw: false } }).catch(() => null) : null,
    payload.findGlobal({ slug: 'company', ...all }),
    payload.find({ collection: 'feedstocks', ...all, pagination: false, sort: 'name', select: { name: true, bulkDensity: true, carbonContent: true } }),
  ])
  const profile = (company.profile ?? {}) as { appConfig?: Partial<Record<string, AppConfig>>; mixingTypes?: string[] }
  const rules = withAppDefaults(profile.appConfig?.[network?.type ?? 'artisan'] ?? profile.appConfig?.company)
  const config = (network?.config ?? {}) as {
    feedstocks?: string[]
    mixingTypes?: string[]
    applicationTypes?: string[]
    references?: { feedstock: string; bulkDensity?: number; carbonContent?: number }[]
  }
  const ref = new Map((config.references ?? []).map((r) => [r.feedstock, r]))
  const chosen = config.feedstocks?.length ? feedstockRows.docs.filter((f) => config.feedstocks!.includes(f.name)) : feedstockRows.docs
  const feedstocks: FeedstockInfo[] = chosen.map((f) => {
    const bulkDensity = ref.get(f.name)?.bulkDensity || f.bulkDensity || null
    const carbonContent = ref.get(f.name)?.carbonContent || f.carbonContent || null
    // t CO₂e per litre: litres → m³ × kg/m³ → t, × carbon share × 44/12.
    const creditsPerL = bulkDensity && carbonContent ? +((bulkDensity / 1_000_000) * (carbonContent / 100) * (44 / 12)).toFixed(8) : null
    return { name: f.name, bulkDensity, carbonContent, creditsPerL }
  })
  return {
    network: network ? { id: network.id, name: network.name, type: network.type } : null,
    rules,
    feedstocks,
    mixingTypes: config.mixingTypes?.length ? config.mixingTypes : profile.mixingTypes?.length ? profile.mixingTypes : MIXING_TYPES,
    applicationTypes: config.applicationTypes?.length ? config.applicationTypes : APPLICATION_TYPES,
  }
}
