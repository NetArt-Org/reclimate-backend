'use client'

import { ArrowUpRight, BadgeCheck, CircleDashed } from 'lucide-react'
import Link from 'next/link'
import type { ReactNode } from 'react'

import { Sheet } from '../components/ui'
import { cn, num } from '../lib/utils'
import type { BatchRow } from '../server/production'
import { AssessActions, canAssess } from './Assess'
import { KILN_TYPE, utcDateTime } from './format'
import type { Names } from './names'
import { StatusBadge } from './tables'

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-xs font-bold tracking-wide text-ink-muted uppercase">{title}</h3>
      <dl className="divide-y divide-line rounded-2xl border border-line">{children}</dl>
    </section>
  )
}

function Row({ label, children, mono }: { label: string; children: ReactNode; mono?: boolean }) {
  const empty = children === '' || children == null
  return (
    <div className="grid grid-cols-[minmax(0,140px)_minmax(0,1fr)] gap-3 px-4 py-2.5 text-sm">
      <dt className="text-ink-muted">{label}</dt>
      <dd className={cn('min-w-0 font-medium break-words', mono && 'font-mono text-xs', empty && 'font-normal text-ink-subtle')}>{empty ? '—' : children}</dd>
    </div>
  )
}

const YesNo = ({ on }: { on: boolean }) => (
  <span className={cn('inline-flex items-center gap-1.5', on ? 'text-success' : 'font-normal text-ink-muted')}>
    {on ? <BadgeCheck className="size-4" aria-hidden /> : <CircleDashed className="size-4" aria-hidden />}
    {on ? 'Yes' : 'No'}
  </span>
)

/** Right-hand panel with every field of one batch, and approve / reject when it is still open for assessment. */
export function BatchSheet({ batch, names, onOpenChange }: { batch: BatchRow | null; names: Names; onOpenChange: (open: boolean) => void }) {
  const kiln = batch ? names.kiln(batch.kilnId) : undefined
  const footer = batch && canAssess(batch.status) ? <AssessActions key={batch.id} id={batch.id} code={batch.code} /> : undefined

  return (
    <Sheet
      open={!!batch}
      onOpenChange={onOpenChange}
      title={
        <span className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-lg">{batch?.code || 'Batch'}</span>
          {batch && <StatusBadge status={batch.status} />}
          {batch && (
            <Link
              href={`/admin/production/batches/${batch.id}`}
              className="ml-auto inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold text-brand outline-none hover:bg-brand-soft focus-visible:ring-2 focus-visible:ring-brand/40"
            >
              Open full record <ArrowUpRight className="size-3.5" aria-hidden />
            </Link>
          )}
        </span>
      }
      footer={footer}
    >
      {batch && (
        <div className="flex flex-col gap-5">
          <Group title="Identity">
            <Row label="Batch ID" mono>
              {batch.code}
            </Row>
            <Row label="UUID" mono>
              {batch.id}
            </Row>
            <Row label="Date">{utcDateTime(batch.date)}</Row>
            <Row label="Started">{batch.startDate ? utcDateTime(batch.startDate) : ''}</Row>
            <Row label="Ended">{batch.endedAt ? utcDateTime(batch.endedAt) : ''}</Row>
          </Group>

          <Group title="Place">
            <Row label="Network">{names.network(batch.networkId)}</Row>
            <Row label="Site">{names.site(batch.siteId)}</Row>
            <Row label="Kiln">{kiln ? `${kiln.name} (${KILN_TYPE[kiln.type] ?? kiln.type})` : ''}</Row>
            <Row label="Kiln volume">{kiln?.volumeM3 != null ? `${num(kiln.volumeM3, 2)} m³` : ''}</Row>
          </Group>

          <Group title="Material">
            <Row label="Feedstock">{batch.feedstock}</Row>
            <Row label="Biomass">{`${num(batch.biomassKg, 1)} kg`}</Row>
            <Row label="Biochar">{`${num(batch.biocharL, 1)} L`}</Row>
            <Row label="Bulk density">{`${num(batch.bulkDensity, 3)} kg/L`}</Row>
            <Row label="Carbon content">{`${num(batch.carbonContent * 100, 1)} %`}</Row>
            <Row label="C-sink">{`${batch.csinkT.toFixed(3)} t CO₂e`}</Row>
          </Group>

          <Group title="Assessment">
            <Row label="Status">
              <StatusBadge status={batch.status} />
            </Row>
            <Row label="Assessed by">{batch.assessedBy}</Row>
            {batch.rejectionReason && <Row label="Rejection reason">{batch.rejectionReason}</Row>}
            <Row label="Sink approved">
              <YesNo on={batch.sinkApproved} />
            </Row>
            <Row label="Registered">
              <YesNo on={batch.registered} />
            </Row>
          </Group>

          <Group title="Operator">
            <Row label="Name">{batch.operatorName}</Row>
          </Group>
        </div>
      )}
    </Sheet>
  )
}
