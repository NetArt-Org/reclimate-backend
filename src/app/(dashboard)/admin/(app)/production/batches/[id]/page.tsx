import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { unwrap } from '@/dashboard/lib/unwrap'
import { BatchDetailPage } from '@/dashboard/production/BatchDetail'
import { getBatchDetail } from '@/dashboard/server/production-extra'

export const metadata: Metadata = { title: 'Batch record' }

/** Full record of one batch: summary, production and C-sink timelines, media. */
export default async function BatchRecord({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const detail = unwrap(await getBatchDetail(decodeURIComponent(id)))
  if (!detail) notFound()
  return <BatchDetailPage detail={detail} />
}
