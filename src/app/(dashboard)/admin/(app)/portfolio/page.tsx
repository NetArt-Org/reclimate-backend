import type { Metadata } from 'next'

import { unwrap } from '@/dashboard/lib/unwrap'
import { PortfolioPage } from '@/dashboard/portfolio/PortfolioPage'
import { loadPortfolioExtras } from '@/dashboard/server/portfolio'

export const metadata: Metadata = { title: 'Projects portfolio' }

export default async function Portfolio() {
  return <PortfolioPage extras={unwrap(await loadPortfolioExtras())} />
}
