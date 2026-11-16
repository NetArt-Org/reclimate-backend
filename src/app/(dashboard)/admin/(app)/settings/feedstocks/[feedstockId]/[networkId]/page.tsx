import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { unwrap } from '@/dashboard/lib/unwrap'
import { feedstockLab } from '@/dashboard/server/lab-reports'
import { LabReportPage } from '@/dashboard/settings/LabReportPage'

export const metadata: Metadata = { title: 'Lab reports' }

/** One feedstock's lab reports at one network (Settings → Feedstock management → a network's row). */
export default async function FeedstockLab({ params }: { params: Promise<{ feedstockId: string; networkId: string }> }) {
  const { feedstockId, networkId } = await params
  const lab = await feedstockLab(decodeURIComponent(feedstockId)).then(unwrap).catch(() => null)
  if (!lab) notFound()
  const net = decodeURIComponent(networkId)
  return (
    <LabReportPage
      feedstock={lab.feedstock}
      networkId={net}
      reports={lab.reports.filter((r) => r.networkId === net)}
      status={lab.statuses.find((s) => s.networkId === net)}
    />
  )
}
