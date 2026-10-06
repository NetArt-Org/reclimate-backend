'use client'

import { BadgeCheck, Box, Calendar, ChevronDown, CircleDashed, Images, MapPin, Package, Phone, Truck, User } from 'lucide-react'
import { Fragment, useState, type ReactNode } from 'react'

import { Badge, type BadgeTone } from '../components/ui'
import { cn, num } from '../lib/utils'
import type { InventoryRow, SinkRow, TrackingRow } from '../server/production-extra'
import { utcDate } from './format'
import { MediaGallery } from './media'
import type { Names } from './names'
import { BatchesChip, DateCell, PlaceCell, Table, Td, Text, Th, rowClass } from './tables'

/* ------------------------------------------------------------------ */
/* Inventory                                                           */
/* ------------------------------------------------------------------ */

const inventoryTone = (s: string): BadgeTone => {
  if (/distribut|sold|applied|sink/i.test(s)) return 'success'
  if (/reject|cancel|lost|damag/i.test(s)) return 'danger'
  if (/pack|stock|avail|ready/i.test(s)) return 'info'
  return 'neutral'
}
const humanize = (s: string) => {
  const t = s.replace(/[_-]+/g, ' ').trim().toLowerCase()
  return t ? t[0].toUpperCase() + t.slice(1) : ''
}

export const bagLabel = (r: InventoryRow) =>
  [r.bagQuantity != null ? `${num(r.bagQuantity, 2)} ${r.bagUnit}`.trim() : '', r.bagType].filter(Boolean).join(' · ')

export function InventoryTable({ rows, names }: { rows: InventoryRow[]; names: Names }) {
  return (
    <Table
      minWidth={1180}
      head={
        <>
          <Th>Inventory ID</Th>
          <Th>Partner org / Network</Th>
          <Th>Site</Th>
          <Th>Batches</Th>
          <Th>Packaging type</Th>
          <Th>Bag details</Th>
          <Th right>Actual qty</Th>
          <Th>Packed</Th>
          <Th>Status</Th>
        </>
      }
    >
      {rows.map((r) => (
        <tr key={r.id} className={rowClass}>
          <Td className="font-mono text-xs whitespace-nowrap text-ink-2">{r.code || '—'}</Td>
          <Td className="max-w-56">
            <div className="truncate text-xs text-ink-muted" title={names.org(r.networkId)}>
              {names.org(r.networkId)}
            </div>
            <div className="truncate font-medium" title={names.network(r.networkId)}>
              {names.network(r.networkId)}
            </div>
          </Td>
          <Text>{names.site(r.siteId) === '—' ? '' : names.site(r.siteId)}</Text>
          <Td>
            <CodeList codes={r.batchCodes} />
          </Td>
          <Text>{r.packagingType}</Text>
          <Text>{bagLabel(r)}</Text>
          <Td right>{r.actualQuantity != null ? num(r.actualQuantity, 2) : '—'}</Td>
          <Td className="whitespace-nowrap">{r.date ? utcDate(r.date) : '—'}</Td>
          <Td>{r.status ? <Badge tone={inventoryTone(r.status)} className="whitespace-nowrap">{humanize(r.status)}</Badge> : <span className="text-ink-subtle">—</span>}</Td>
        </tr>
      ))}
    </Table>
  )
}

/** Batch codes inline (first two) with a "+N" overflow. */
function CodeList({ codes }: { codes: string[] }) {
  if (!codes.length) return <span className="text-ink-subtle">—</span>
  const shown = codes.slice(0, 2)
  return (
    <div className="flex flex-wrap items-center gap-1" title={codes.join(', ')}>
      {shown.map((c) => (
        <span key={c} className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-[11px] whitespace-nowrap text-ink-2">
          {c}
        </span>
      ))}
      {codes.length > 2 && <span className="text-xs font-semibold text-ink-muted tabular-nums">+{codes.length - 2}</span>}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Sink (applications)                                                 */
/* ------------------------------------------------------------------ */

export const modeLabel = (r: SinkRow) => (r.mode === 'vehicle' ? (r.vehicle ? `Vehicle · ${r.vehicle}` : 'Vehicle') : 'Manual')

export function SinkTable({ rows, names }: { rows: SinkRow[]; names: Names }) {
  const [open, setOpen] = useState<string | null>(null)
  return (
    <Table
      minWidth={1180}
      head={
        <>
          <Th className="w-10">
            <span className="sr-only">Expand</span>
          </Th>
          <Th>Date</Th>
          <Th>Network / Site</Th>
          <Th>Recipient</Th>
          <Th>Type</Th>
          <Th>Mode</Th>
          <Th>Sinked</Th>
          <Th right>Media</Th>
        </>
      }
    >
      {rows.map((r) => {
        const expanded = open === r.id
        const panel = `sink-${r.id}`
        return (
          <Fragment key={r.id}>
            <tr className={cn(rowClass, expanded && 'bg-muted/70')}>
              <Td className="w-10 pr-0">
                <button
                  type="button"
                  aria-expanded={expanded}
                  aria-controls={panel}
                  aria-label={`${expanded ? 'Hide' : 'Show'} details for ${r.recipientName || 'this application'}`}
                  onClick={() => setOpen(expanded ? null : r.id)}
                  className="flex size-7 cursor-pointer items-center justify-center rounded-lg text-ink-muted outline-none hover:bg-surface hover:text-ink focus-visible:ring-2 focus-visible:ring-brand/40"
                >
                  <ChevronDown className={cn('size-4 transition-transform', expanded && 'rotate-180')} aria-hidden />
                </button>
              </Td>
              <DateCell iso={r.date} />
              <PlaceCell names={names} networkId={r.networkId} siteId={r.siteId} />
              <Td className="max-w-64">
                <div className="truncate font-medium" title={r.recipientName}>
                  {r.recipientName || (r.open ? 'Open distribution' : '—')}
                </div>
                <div className="truncate text-xs text-ink-muted" title={[r.recipientPhone, r.recipientAddress].filter(Boolean).join(' · ')}>
                  {[r.recipientPhone, r.recipientAddress].filter(Boolean).join(' · ') || '—'}
                </div>
              </Td>
              <Td className="max-w-56">
                <div className="flex flex-wrap gap-1">
                  {r.mixTypes.length ? (
                    r.mixTypes.map((m) => (
                      <Badge key={m} tone="brand" className="normal-case">
                        {m}
                      </Badge>
                    ))
                  ) : (
                    <span className="text-ink-subtle">—</span>
                  )}
                </div>
                {r.kind && <div className="mt-0.5 truncate text-xs text-ink-muted">{humanize(r.kind)}</div>}
              </Td>
              <Td className="whitespace-nowrap">
                <span className="inline-flex items-center gap-1.5">
                  {r.mode === 'vehicle' ? <Truck className="size-3.5 text-ink-muted" aria-hidden /> : <User className="size-3.5 text-ink-muted" aria-hidden />}
                  {modeLabel(r)}
                </span>
              </Td>
              <Td>
                {r.fullySinked ? (
                  <Badge tone="success" className="whitespace-nowrap">
                    <BadgeCheck aria-hidden /> Sinked
                  </Badge>
                ) : (
                  <Badge tone="warn" className="whitespace-nowrap">
                    <CircleDashed aria-hidden /> Partial
                  </Badge>
                )}
              </Td>
              <Td right>
                <span className={cn('inline-flex items-center gap-1', !r.files.length && 'text-ink-subtle')}>
                  <Images className="size-3.5" aria-hidden />
                  {r.files.length}
                </span>
              </Td>
            </tr>
            {expanded && (
              <tr id={panel}>
                <td colSpan={8} className="border-b border-line bg-muted/40 px-4 py-4">
                  <div className="flex flex-col gap-4">
                    <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2 lg:grid-cols-4">
                      <Detail icon={<User />} label="Recipient" value={r.recipientName} />
                      <Detail icon={<Phone />} label="Phone" value={r.recipientPhone} />
                      <Detail icon={<MapPin />} label="Address" value={r.recipientAddress} />
                      <Detail
                        icon={<MapPin />}
                        label="Coordinates"
                        value={r.lat != null && r.lng != null ? `${r.lat.toFixed(5)}, ${r.lng.toFixed(5)}` : ''}
                        mono
                      />
                    </dl>
                    {r.files.length ? (
                      <MediaGallery files={r.files} />
                    ) : (
                      <p className="text-sm text-ink-muted">No photos were recorded for this application.</p>
                    )}
                  </div>
                </td>
              </tr>
            )}
          </Fragment>
        )
      })}
    </Table>
  )
}

function Detail({ icon, label, value, mono }: { icon: ReactNode; label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex min-w-0 items-start gap-2">
      <span className="mt-0.5 text-ink-subtle [&_svg]:size-3.5" aria-hidden>
        {icon}
      </span>
      <div className="min-w-0">
        <dt className="text-xs text-ink-muted">{label}</dt>
        <dd className={cn('break-words font-medium', mono && 'font-mono text-xs tabular-nums', !value && 'font-normal text-ink-subtle')}>{value || '—'}</dd>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Biochar tracking                                                    */
/* ------------------------------------------------------------------ */

export function TrackingGrid({ rows, names }: { rows: TrackingRow[]; names: Names }) {
  return (
    <ul className="grid grid-cols-1 gap-3 p-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
      {rows.map((r) => (
        <li key={r.id}>
          <article className="flex h-full flex-col gap-3 rounded-2xl border border-line bg-surface p-4 transition-shadow hover:shadow-md">
            <header className="flex items-start gap-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand" aria-hidden>
                <Package className="size-4" />
              </span>
              <div className="min-w-0 flex-1">
                <h3 className="truncate font-bold" title={r.mixingType}>
                  {r.mixingType || 'Mix'}
                </h3>
                <p className="truncate text-xs text-ink-muted" title={`${names.network(r.networkId)} · ${names.site(r.siteId)}`}>
                  {names.network(r.networkId)} · {names.site(r.siteId)}
                </p>
              </div>
              {r.matrixCode && <span className="shrink-0 rounded-md bg-muted px-1.5 py-0.5 font-mono text-[11px] text-ink-2">{r.matrixCode}</span>}
            </header>

            <dl className="grid grid-cols-3 gap-2">
              <Stat label="Biochar" value={num(r.biocharL, 1)} unit="L" />
              <Stat label="Total mixed" value={num(r.totalKg, r.totalKg >= 1000 ? 0 : 1)} unit="kg" />
              <Stat label="Bags" value={num(r.bagsCreated, 0)} unit={r.bagsAvailable ? `${num(r.bagsAvailable, 0)} left` : ''} />
            </dl>

            <div className="flex flex-col gap-1">
              <span className="text-[11px] font-bold tracking-wide text-ink-muted uppercase">Composition</span>
              <div className="flex flex-wrap gap-1">
                <Badge tone="brand" className="normal-case">
                  Biochar
                </Badge>
                {r.composition.map((c) => (
                  <Badge key={c} className="normal-case">
                    {c}
                  </Badge>
                ))}
                {!r.composition.length && r.otherMaterialKg > 0 && <Badge className="normal-case">Other material {num(r.otherMaterialKg, 1)} kg</Badge>}
              </div>
            </div>

            {r.bagDetails && (
              <p className="line-clamp-2 text-xs text-ink-2" title={r.bagDetails}>
                <Box className="mr-1 inline size-3 align-[-2px] text-ink-subtle" aria-hidden />
                {r.bagDetails}
              </p>
            )}

            <footer className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-line pt-3 text-xs text-ink-muted">
              <span className="inline-flex items-center gap-1">
                <Calendar className="size-3.5" aria-hidden />
                {utcDate(r.date)}
              </span>
              <span className="inline-flex items-center gap-1">
                Batches <BatchesChip ids={r.batchIds} />
              </span>
              {r.shipments != null && (
                <span className="inline-flex items-center gap-1 tabular-nums">
                  <Truck className="size-3.5" aria-hidden /> {num(r.shipments, 0)} shipments
                </span>
              )}
              <span className={cn('ml-auto inline-flex items-center gap-1 tabular-nums', !r.mediaCount && 'text-ink-subtle')}>
                <Images className="size-3.5" aria-hidden /> {r.mediaCount}
                <span className="sr-only">media files</span>
              </span>
            </footer>
          </article>
        </li>
      ))}
    </ul>
  )
}

function Stat({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <div className="min-w-0 rounded-lg bg-muted px-2 py-1.5">
      <dt className="truncate text-[11px] text-ink-muted">{label}</dt>
      <dd className="truncate text-sm font-bold tabular-nums">
        {value}
        {unit && <span className="ml-1 text-[11px] font-medium text-ink-muted">{unit}</span>}
      </dd>
    </div>
  )
}
