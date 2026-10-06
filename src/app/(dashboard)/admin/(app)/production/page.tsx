import type { Metadata } from 'next'

import { unwrap } from '@/dashboard/lib/unwrap'
import { ProductionPage } from '@/dashboard/production/ProductionPage'
import { queryProduction, type ProductionTab } from '@/dashboard/server/production'
import { ownerFiles, queryProductionExtra, type ExtraTab, type FileRef, type ViewQuery, type ViewTab } from '@/dashboard/server/production-extra'

export const metadata: Metadata = { title: 'Production' }

const BASE: ProductionTab[] = ['batches', 'collections', 'mixing', 'packaging']
const EXTRA: ExtraTab[] = ['inventory', 'sink', 'tracking']

/** Filters live in the URL (?tab=&q=&network=&site=&status=&from=&to=&page=&limit=) so views can be shared. */
export default async function Production({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams
  const tab: ViewTab = [...BASE, ...EXTRA].includes(sp.tab as ViewTab) ? (sp.tab as ViewTab) : 'batches'
  const query: ViewQuery = {
    tab,
    q: sp.q,
    networkId: sp.network,
    siteId: sp.site,
    status: sp.status,
    from: sp.from,
    to: sp.to,
    page: Number(sp.page) || 1,
    limit: Number(sp.limit) || 25,
  }

  if (EXTRA.includes(tab as ExtraTab)) {
    const result = unwrap(await queryProductionExtra({ ...query, tab: tab as ExtraTab }))
    return <ProductionPage query={query} result={result} />
  }

  const result = unwrap(await queryProduction({ ...query, tab: tab as ProductionTab }))
  let media: Record<string, FileRef[]> | undefined
  if (result.tab === 'mixing' || result.tab === 'packaging') {
    media = unwrap(await ownerFiles(result.tab === 'mixing' ? 'mixings' : 'packagings', result.rows.map((r) => r.id)))
  }
  return <ProductionPage query={query} result={result} media={media} />
}
