import { notFound } from 'next/navigation'

import { ComingSoon } from '@/dashboard/components/shell/ComingSoon'
import { SECTIONS } from '@/dashboard/components/shell/nav'

export default async function SectionPage({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params
  const item = SECTIONS.flatMap((g) => g.items).find((s) => s.href === `/admin/${section}` && s.soon)
  if (!item) notFound()
  return <ComingSoon title={item.label} />
}
