'use client'

import { ChevronLeft, ChevronRight, Download, Inbox, Search, X } from 'lucide-react'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useRef, useState, useTransition } from 'react'

import { PageHeader } from '../components/shell/PageHeader'
import { Button, Card, EmptyState, Input, NativeSelect, Segmented, Spinner } from '../components/ui'
import { useDashboard } from '../data/store'
import { cn, num } from '../lib/utils'
import type { ProductionResult } from '../server/production'
import type { BatchStats, CollectionStats } from '../server/production-stats'
import type { ExtraResult, FileRef, ViewQuery, ViewTab } from '../server/production-extra'
import { BatchAnalytics, CollectionAnalytics } from './Analytics'
import { BatchSheet } from './BatchSheet'
import { KILN_TYPE, STATUS, downloadCsv, statusOf, utcDate, utcTime } from './format'
import { useNames, type Names } from './names'
import { InventoryTable, SinkTable, TrackingGrid, bagLabel, modeLabel } from './extra-tables'
import { BatchesTable, CollectionsTable, MixingTable, PackagingTable, transportLabel } from './tables'

const TABS: { value: ViewTab; label: string; noun: string; search: string }[] = [
  { value: 'batches', label: 'Batches', noun: 'batches', search: 'Search batch ID, feedstock, operator' },
  { value: 'collections', label: 'Biomass collection', noun: 'biomass collections', search: 'Search feedstock, source, vehicle' },
  { value: 'mixing', label: 'Mixing', noun: 'mixings', search: 'Search mixing type, description' },
  { value: 'packaging', label: 'Packaging', noun: 'packagings', search: 'Search packaging type, bags' },
  { value: 'inventory', label: 'Inventory', noun: 'inventory', search: 'Search inventory ID, packaging, bag type' },
  { value: 'sink', label: 'Sink', noun: 'applications', search: 'Search recipient, phone, address' },
  { value: 'tracking', label: 'Biochar tracking', noun: 'mixes', search: 'Search mix type, bags' },
]

const LIMITS = [25, 50, 100]

type Params = Partial<Record<'tab' | 'q' | 'network' | 'site' | 'status' | 'from' | 'to' | 'page' | 'limit', string>>

const toParams = (q: ViewQuery): Params => ({
  tab: q.tab,
  q: q.q,
  network: q.networkId,
  site: q.siteId,
  status: q.status,
  from: q.from,
  to: q.to,
  page: q.page ? String(q.page) : undefined,
  limit: q.limit ? String(q.limit) : undefined,
})

export function ProductionPage({
  query,
  result,
  media,
  stats,
}: {
  query: ViewQuery
  result: ProductionResult | ExtraResult
  /** Files of the rows on this page (mixing and packaging tabs), keyed by row id. */
  media?: Record<string, FileRef[]>
  /** Analytics shown above the table (batches and biomass collection). */
  stats?: { tab: 'batches'; stats: BatchStats } | { tab: 'collections'; stats: CollectionStats }
}) {
  const router = useRouter()
  const pathname = usePathname()
  const { data } = useDashboard()
  const names = useNames()
  const [pending, startTransition] = useTransition()
  const [openBatch, setOpenBatch] = useState<string | null>(null)

  /** Merge changes into the URL. Any filter change goes back to page 1 unless `page` is given. */
  const go = (changes: Params) => {
    const next: Params = { ...toParams(query), page: undefined, ...changes }
    const sp = new URLSearchParams()
    for (const [k, v] of Object.entries(next)) {
      if (!v) continue
      if (k === 'tab' && v === 'batches') continue
      if (k === 'page' && v === '1') continue
      if (k === 'limit' && v === '25') continue
      sp.set(k, v)
    }
    const qs = sp.toString()
    startTransition(() => router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false }))
  }

  /* Search box: local text, pushed to the URL after 300 ms of quiet. */
  const [text, setText] = useState(query.q ?? '')
  const [prevQ, setPrevQ] = useState(query.q)
  if (query.q !== prevQ) {
    setPrevQ(query.q)
    setText(query.q ?? '')
  }
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  useEffect(() => () => clearTimeout(timer.current), [])
  const onSearch = (v: string) => {
    setText(v)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => go({ q: v.trim() || undefined }), 300)
  }

  const tab = query.tab
  const sites = query.networkId ? data.sites.filter((s) => s.networkId === query.networkId) : []
  const networks = [...data.networks].sort((a, b) => a.name.localeCompare(b.name))
  const filtered = !!(query.q || query.networkId || query.siteId || (tab === 'batches' && query.status) || query.from || query.to)
  const limit = query.limit ?? 25
  const first = result.total ? (result.page - 1) * limit + 1 : 0
  const last = Math.min(result.page * limit, result.total)
  const tabInfo = TABS.find((t) => t.value === tab)!
  const noun = tabInfo.noun
  const batch = result.tab === 'batches' ? (result.rows.find((r) => r.id === openBatch) ?? null) : null

  const clear = () => {
    clearTimeout(timer.current)
    setText('')
    go({ q: undefined, network: undefined, site: undefined, status: undefined, from: undefined, to: undefined })
  }

  return (
    <>
      <PageHeader
        title="Production"
        description="Every kiln firing, biomass delivery and biochar product, from the field records."
        actions={
          <Button onClick={() => exportCsv(result, names)} disabled={!result.rows.length} aria-label="Export current page as CSV">
            <Download /> Export CSV
          </Button>
        }
      />

      <div className="flex flex-col gap-3 px-3 pb-6 sm:gap-4 sm:px-4 md:px-6">
        <div className="flex flex-wrap items-center gap-3">
          <div className="max-w-full overflow-x-auto">
            <Segmented
              size="lg"
              value={tab}
              onChange={(t) => go({ tab: t, status: undefined })}
              options={TABS.map((t) => ({
                value: t.value,
                label: (
                  <span className="flex items-center gap-1.5 whitespace-nowrap">
                    {t.label}
                    {t.value === tab && (
                      <span className="rounded-md bg-brand-soft px-1.5 text-xs text-brand tabular-nums">{num(result.total, 0)}</span>
                    )}
                  </span>
                ),
              }))}
            />
          </div>
          {pending && (
            <span className="flex items-center gap-2 text-xs text-ink-muted" role="status">
              <Spinner /> Updating…
            </span>
          )}
        </div>

        {stats && (
          <div className={cn('transition-opacity', pending && 'opacity-60')}>
            {stats.tab === 'batches' ? <BatchAnalytics stats={stats.stats} /> : <CollectionAnalytics stats={stats.stats} />}
          </div>
        )}

        <Card className="overflow-hidden">
          {/* Filters */}
          <div className="grid grid-cols-2 gap-2 border-b border-line p-3 sm:flex sm:flex-wrap sm:items-end">
            <div className="relative col-span-2 sm:min-w-56 sm:flex-[2_1_14rem]">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-subtle" aria-hidden />
              <Input
                type="search"
                value={text}
                onChange={(e) => onSearch(e.target.value)}
                placeholder={tabInfo.search}
                className="pl-9"
                aria-label={`Search ${noun}`}
              />
            </div>
            <NativeSelect
              aria-label="Network"
              value={query.networkId ?? ''}
              onChange={(e) => go({ network: e.target.value || undefined, site: undefined })}
              className="sm:min-w-40 sm:flex-[1_1_10rem]"
            >
              <option value="">All networks</option>
              {networks.map((n) => (
                <option key={n.id} value={n.id}>
                  {n.name}
                </option>
              ))}
            </NativeSelect>
            <NativeSelect
              aria-label="Site"
              value={query.siteId ?? ''}
              onChange={(e) => go({ site: e.target.value || undefined })}
              disabled={!query.networkId}
              title={query.networkId ? undefined : 'Choose a network first'}
              className="sm:min-w-36 sm:flex-[1_1_9rem] disabled:cursor-not-allowed disabled:opacity-60"
            >
              <option value="">{query.networkId ? 'All sites' : 'All sites'}</option>
              {sites.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </NativeSelect>
            {tab === 'batches' && (
              <NativeSelect
                aria-label="Status"
                value={query.status ?? ''}
                onChange={(e) => go({ status: e.target.value || undefined })}
                className="col-span-2 sm:min-w-44 sm:flex-[1_1_11rem]"
              >
                <option value="">All statuses</option>
                {Object.entries(STATUS).map(([v, s]) => (
                  <option key={v} value={v}>
                    {s.label}
                  </option>
                ))}
              </NativeSelect>
            )}
            <div className="col-span-2 flex items-center gap-2 sm:flex-[1_1_18rem]">
              <Input
                type="date"
                aria-label={tab === 'inventory' ? 'Packed from date' : 'From date'}
                value={query.from ?? ''}
                max={query.to}
                onChange={(e) => go({ from: e.target.value || undefined })}
                className="min-w-0 flex-1"
              />
              <span className="text-xs text-ink-subtle" aria-hidden>
                to
              </span>
              <Input
                type="date"
                aria-label="To date"
                value={query.to ?? ''}
                min={query.from}
                onChange={(e) => go({ to: e.target.value || undefined })}
                className="min-w-0 flex-1"
              />
            </div>
            {filtered && (
              <Button variant="ghost" className="col-span-2 justify-self-start" onClick={clear}>
                <X /> Clear
              </Button>
            )}
          </div>

          {/* Table */}
          <div className={cn('relative transition-opacity', pending && 'pointer-events-none opacity-60')} aria-busy={pending}>
            {result.rows.length === 0 ? (
              <EmptyState
                icon={<Inbox />}
                title={`No ${noun} found`}
                sub={filtered ? 'Try a different search or clear the filters.' : 'Records appear here once they are synced from the field app.'}
              />
            ) : result.tab === 'batches' ? (
              <BatchesTable rows={result.rows} names={names} onOpen={setOpenBatch} />
            ) : result.tab === 'collections' ? (
              <CollectionsTable rows={result.rows} names={names} />
            ) : result.tab === 'mixing' ? (
              <MixingTable rows={result.rows} names={names} media={media} />
            ) : result.tab === 'packaging' ? (
              <PackagingTable rows={result.rows} names={names} media={media} />
            ) : result.tab === 'inventory' ? (
              <InventoryTable rows={result.rows} names={names} />
            ) : result.tab === 'sink' ? (
              <SinkTable rows={result.rows} names={names} />
            ) : (
              <TrackingGrid rows={result.rows} names={names} />
            )}
          </div>

          {/* Pagination */}
          <div className="flex flex-wrap items-center justify-end gap-x-5 gap-y-2 border-t border-line px-4 py-2.5 text-xs text-ink-muted">
            <label className="flex items-center gap-2">
              Rows per page
              <NativeSelect
                value={String(limit)}
                onChange={(e) => go({ limit: e.target.value })}
                className="h-8 w-auto rounded-lg px-2 text-xs"
              >
                {LIMITS.map((l) => (
                  <option key={l} value={l}>
                    {l}
                  </option>
                ))}
              </NativeSelect>
            </label>
            <span className="tabular-nums" aria-live="polite">
              {num(first, 0)}–{num(last, 0)} of {num(result.total, 0)}
            </span>
            <div className="flex items-center gap-1">
              <Button
                size="icon-sm"
                aria-label="Previous page"
                disabled={result.page <= 1 || pending}
                onClick={() => go({ page: String(result.page - 1) })}
              >
                <ChevronLeft />
              </Button>
              <Button
                size="icon-sm"
                aria-label="Next page"
                disabled={result.page >= result.pages || pending}
                onClick={() => go({ page: String(result.page + 1) })}
              >
                <ChevronRight />
              </Button>
            </div>
          </div>
        </Card>
      </div>

      <BatchSheet batch={batch} names={names} onOpenChange={(o) => !o && setOpenBatch(null)} />
    </>
  )
}

/** CSV of the rows on the current page, with ids resolved to names. */
function exportCsv(result: ProductionResult | ExtraResult, names: Names) {
  const stamp = new Date().toISOString().slice(0, 10)
  const when = (iso: string) => `${utcDate(iso)} ${utcTime(iso)}`
  const place = (r: { networkId: string | null; siteId: string | null }) => [names.network(r.networkId), names.site(r.siteId)]
  switch (result.tab) {
    case 'batches':
      return downloadCsv(
        `batches-${stamp}.csv`,
        ['Date (UTC)', 'Batch ID', 'Network', 'Site', 'Kiln', 'Kiln type', 'Feedstock', 'Biomass (kg)', 'Biochar (L)', 'C-sink (t CO2e)', 'Status', 'Sink approved', 'Registered', 'Operator', 'Assessed by', 'Rejection reason', 'UUID'],
        result.rows.map((r) => {
          const k = names.kiln(r.kilnId)
          return [
            when(r.date), r.code, ...place(r), k?.name ?? '', k ? KILN_TYPE[k.type] ?? k.type : '', r.feedstock, r.biomassKg, r.biocharL, r.csinkT.toFixed(3),
            statusOf(r.status).label, r.sinkApproved ? 'Yes' : 'No', r.registered ? 'Yes' : 'No', r.operatorName, r.assessedBy, r.rejectionReason, r.id,
          ]
        }),
      )
    case 'collections':
      return downloadCsv(
        `biomass-collections-${stamp}.csv`,
        ['Date (UTC)', 'Network', 'Site', 'Farmer', 'Feedstock', 'Source', 'Quantity (kg)', 'Transport', 'Distance (km)', 'Emissions'],
        result.rows.map((r) => [when(r.date), ...place(r), names.person(r.farmerId), r.feedstock, r.source, r.quantityKg, transportLabel(r), r.distanceKm, r.emissions]),
      )
    case 'mixing':
      return downloadCsv(
        `mixings-${stamp}.csv`,
        ['Date (UTC)', 'Network', 'Site', 'Mixing type', 'Batches', 'Biochar (L)', 'Other material (kg)', 'Total (kg)', 'Bags', 'Rejected biochar (L)', 'Description'],
        result.rows.map((r) => [when(r.date), ...place(r), r.mixingType, r.batchIds.length, r.biocharL, r.otherMaterialKg, r.totalKg, r.bagsCreated, r.rejectedBiocharL, r.description]),
      )
    case 'packaging':
      return downloadCsv(
        `packagings-${stamp}.csv`,
        ['Date (UTC)', 'Network', 'Site', 'Packaging type', 'Biochar (kg)', 'Mix (kg)', 'Bag details', 'Bags created', 'Bags distributed', 'Bags remaining', 'Description'],
        result.rows.map((r) => [when(r.date), ...place(r), r.packagingType, r.biocharKg, r.mixKg, r.bagDetails, r.bagsCreated, r.bagsDistributed, r.bagsRemaining, r.description]),
      )
    case 'inventory':
      return downloadCsv(
        `inventory-${stamp}.csv`,
        ['Inventory ID', 'Partner org', 'Network', 'Site', 'Batches', 'Packaging type', 'Bag details', 'Actual quantity', 'Packed (UTC)', 'Status'],
        result.rows.map((r) => [
          r.code, names.org(r.networkId), ...place(r), r.batchCodes.join(' '), r.packagingType, bagLabel(r), r.actualQuantity ?? '', r.date ? utcDate(r.date) : '', r.status,
        ]),
      )
    case 'sink':
      return downloadCsv(
        `sink-applications-${stamp}.csv`,
        ['Date (UTC)', 'Network', 'Site', 'Recipient', 'Phone', 'Address', 'Latitude', 'Longitude', 'Type', 'Kind', 'Mode', 'Fully sinked', 'Media files'],
        result.rows.map((r) => [
          when(r.date), ...place(r), r.recipientName, r.recipientPhone, r.recipientAddress, r.lat ?? '', r.lng ?? '', r.mixTypes.join('; '), r.kind, modeLabel(r),
          r.fullySinked ? 'Yes' : 'No', r.files.length,
        ]),
      )
    case 'tracking':
      return downloadCsv(
        `biochar-tracking-${stamp}.csv`,
        ['Date (UTC)', 'Network', 'Site', 'Mix type', 'Matrix code', 'Biochar (L)', 'Total mixed (kg)', 'Composition', 'Bags', 'Bags available', 'Bag details', 'Batches', 'Shipments', 'Media files'],
        result.rows.map((r) => [
          when(r.date), ...place(r), r.mixingType, r.matrixCode, r.biocharL, r.totalKg, r.composition.join('; '), r.bagsCreated, r.bagsAvailable, r.bagDetails,
          r.batchIds.length, r.shipments ?? '', r.mediaCount,
        ]),
      )
  }
}
