import type { Metadata } from 'next'

import { NetworksPage } from '@/dashboard/networks/NetworksPage'

export const metadata: Metadata = { title: 'Networks & people' }

export default function Networks() {
  return <NetworksPage />
}
