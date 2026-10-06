'use client'

import { BadgeCheck, CircleDashed, Layers } from 'lucide-react'
import { useState, type ReactNode } from 'react'

import { Badge, Popover, PopoverContent, PopoverTrigger, Spinner, Tooltip } from '../components/ui'
import { unwrap } from '../lib/unwrap'
import { batchCodes, type BatchRow, type CollectionRow, type MixingRow, type PackagingRow } from '../server/production'
import { cn, num } from '../lib/utils'
import type { FileRef } from '../server/production-extra'
import { KILN_TYPE, statusOf, utcDate, utcTime } from './format'
import { MediaStrip } from './media'
import type { Names } from './names'

/* ------------------------------------------------------------------ */
/* Table primitives                                                    */
/* ------------------------------------------------------------------ */

export function Table({ minWidth, head, children }: { minWidth: number; head: ReactNode; children: ReactNode }) {
  return (
    <div className="scroll-thin max-h-[70vh] overflow-auto">
      <table className="w-full border-separate border-spacing-0 text-[13px]" style={{ minWidth }}>
        <thead>
          <tr>{head}</tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  )
}

export function Th({ children, right, className }: { children?: ReactNode; right?: boolean; className?: string }) {
  return (
    <th
      scope="col"
      className={cn(
        'sticky top-0 z-10 border-b border-line bg-muted px-3 py-2.5 text-left text-xs font-semibold whitespace-nowrap text-ink-muted first:pl-4 last:pr-4',
        right && 'text-right',
        className,
      )}
    >
      {children}
    </th>
  )
}

export function Td({ children, right, className }: { children?: ReactNode; right?: boolean; className?: string }) {
  return (
    <td
      className={cn(
        'border-b border-line px-3 py-2.5 align-middle first:pl-4 last:pr-4 group-last:border-0',
        right && 'text-right whitespace-nowrap tabular-nums',
        className,
      )}
    >
      {children}
    </td>
  )
}

export const rowClass = 'group transition-colors hover:bg-muted/70'

export const DateCell = ({ iso }: { iso: string }) => (
  <Td className="whitespace-nowrap">
    <div className="font-medium">{utcDate(iso)}</div>
    <div className="text-xs text-ink-subtle tabular-nums">{utcTime(iso)}</div>
  </Td>
)

export const PlaceCell = ({ names, networkId, siteId }: { names: Names; networkId: string | null; siteId: string | null }) => (
  <Td className="max-w-56">
    <div className="truncate font-medium" title={names.network(networkId)}>
      {names.network(networkId)}
    </div>
    <div className="truncate text-xs text-ink-muted" title={names.site(siteId)}>
      {names.site(siteId)}
    </div>
  </Td>
)

export const Text = ({ children, className }: { children: string; className?: string }) => (
  <Td className={cn('whitespace-nowrap', className)}>{children || <span className="text-ink-subtle">—</span>}</Td>
)

function Description({ text }: { text: string }) {
  if (!text) return <Td className="text-ink-subtle">—</Td>
  return (
    <Td className="max-w-60">
      <Tooltip content={<span className="whitespace-pre-wrap">{text}</span>}>
        <span tabIndex={0} className="block truncate rounded text-ink-2 outline-none focus-visible:ring-2 focus-visible:ring-brand/40">
          {text}
        </span>
      </Tooltip>
    </Td>
  )
}

/** Small "Sink" / "Registry" flags: icon + text, so meaning never relies on colour alone. */
function Flag({ on, label }: { on: boolean; label: string }) {
  const Icon = on ? BadgeCheck : CircleDashed
  return (
    <span className={cn('inline-flex items-center gap-1 text-xs whitespace-nowrap', on ? 'font-semibold text-success' : 'text-ink-subtle')}>
      <Icon className="size-3.5" aria-hidden />
      {label}
      <span className="sr-only">{on ? 'yes' : 'no'}</span>
    </span>
  )
}

export function StatusBadge({ status }: { status: string }) {
  const s = statusOf(status)
  return <Badge tone={s.tone} className="whitespace-nowrap">{s.label}</Badge>
}

/* ------------------------------------------------------------------ */
/* Batches                                                             */
/* ------------------------------------------------------------------ */

export function BatchesTable({ rows, names, onOpen }: { rows: BatchRow[]; names: Names; onOpen: (id: string) => void }) {
  return (
    <Table
      minWidth={1180}
      head={
        <>
          <Th>Date</Th>
          <Th>Batch ID</Th>
          <Th>Network / Site</Th>
          <Th>Kiln</Th>
          <Th>Feedstock</Th>
          <Th right>Biomass (kg)</Th>
          <Th right>Biochar (L)</Th>
          <Th right>C-sink (t CO₂e)</Th>
          <Th>Status</Th>
          <Th>Checks</Th>
        </>
      }
    >
      {rows.map((r) => {
        const kiln = names.kiln(r.kilnId)
        return (
          <tr
            key={r.id}
            tabIndex={0}
            aria-label={`Batch ${r.code}, open details`}
            onClick={() => onOpen(r.id)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                onOpen(r.id)
              }
            }}
            className={cn(rowClass, 'cursor-pointer outline-none focus-visible:bg-brand-soft/60 focus-visible:ring-2 focus-visible:ring-brand/40 focus-visible:ring-inset')}
          >
            <DateCell iso={r.date} />
            <Td className="font-mono text-xs whitespace-nowrap text-ink-2">{r.code || '—'}</Td>
            <PlaceCell names={names} networkId={r.networkId} siteId={r.siteId} />
            <Td className="whitespace-nowrap">
              {kiln ? (
                <>
                  <div className="font-medium">{kiln.name}</div>
                  <div className="text-xs text-ink-muted">{KILN_TYPE[kiln.type] ?? kiln.type}</div>
                </>
              ) : (
                <span className="text-ink-subtle">—</span>
              )}
            </Td>
            <Text>{r.feedstock}</Text>
            <Td right>{num(r.biomassKg, 1)}</Td>
            <Td right>{num(r.biocharL, 1)}</Td>
            <Td right>{r.csinkT.toFixed(3)}</Td>
            <Td>
              <StatusBadge status={r.status} />
            </Td>
            <Td>
              <div className="flex flex-col gap-0.5">
                <Flag on={r.sinkApproved} label="Sink" />
                <Flag on={r.registered} label="Registry" />
              </div>
            </Td>
          </tr>
        )
      })}
    </Table>
  )
}

/* ------------------------------------------------------------------ */
/* Biomass collection                                                  */
/* ------------------------------------------------------------------ */

export const transportLabel = (r: CollectionRow) => {
  const t = r.transport.trim()
  if (!t || /manual/i.test(t)) return r.vehicleDetails ? `Manual · ${r.vehicleDetails}` : 'Manual'
  return r.vehicleDetails ? `${t} · ${r.vehicleDetails}` : t
}

export function CollectionsTable({ rows, names }: { rows: CollectionRow[]; names: Names }) {
  return (
    <Table
      minWidth={1100}
      head={
        <>
          <Th>Date</Th>
          <Th>Network / Site</Th>
          <Th>Farmer</Th>
          <Th>Feedstock</Th>
          <Th>Source</Th>
          <Th right>Quantity (kg)</Th>
          <Th>Transport</Th>
          <Th right>Distance (km)</Th>
          <Th right>Emissions</Th>
        </>
      }
    >
      {rows.map((r) => (
        <tr key={r.id} className={rowClass}>
          <DateCell iso={r.date} />
          <PlaceCell names={names} networkId={r.networkId} siteId={r.siteId} />
          <Text>{names.person(r.farmerId) === '—' ? '' : names.person(r.farmerId)}</Text>
          <Text>{r.feedstock}</Text>
          <Text>{r.source}</Text>
          <Td right>{num(r.quantityKg, 1)}</Td>
          <Td className="max-w-56">
            <span className="block truncate" title={transportLabel(r)}>
              {transportLabel(r)}
            </span>
          </Td>
          <Td right>{num(r.distanceKm, 1)}</Td>
          <Td right>{num(r.emissions, 3)}</Td>
        </tr>
      ))}
    </Table>
  )
}

/* ------------------------------------------------------------------ */
/* Mixing                                                              */
/* ------------------------------------------------------------------ */

/** Count chip that loads and lists the linked batch codes on open. */
export function BatchesChip({ ids }: { ids: string[] }) {
  const [codes, setCodes] = useState<Record<string, string> | null>(null)
  const [error, setError] = useState(false)
  if (!ids.length) return <span className="text-ink-subtle">0</span>
  const load = (open: boolean) => {
    if (!open || codes) return
    setError(false)
    batchCodes(ids)
      .then(unwrap)
      .then(setCodes)
      .catch(() => setError(true))
  }
  return (
    <Popover onOpenChange={load}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`Show ${ids.length} linked batches`}
          className="inline-flex cursor-pointer items-center gap-1 rounded-md bg-brand-soft px-2 py-0.5 text-xs font-bold text-brand tabular-nums outline-none hover:bg-brand-soft/70 focus-visible:ring-2 focus-visible:ring-brand/40"
        >
          <Layers className="size-3" aria-hidden />
          {ids.length}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-3">
        <div className="mb-2 text-xs font-bold tracking-wide text-ink-muted uppercase">Linked batches</div>
        {error ? (
          <div className="text-sm text-danger">Could not load batch codes.</div>
        ) : !codes ? (
          <div className="flex items-center gap-2 text-sm text-ink-muted">
            <Spinner /> Loading…
          </div>
        ) : (
          <ul className="scroll-thin flex max-h-64 flex-col gap-1 overflow-y-auto">
            {ids.map((id) => (
              <li key={id} className="rounded-md bg-muted px-2 py-1 font-mono text-xs text-ink-2">
                {codes[id] ?? id}
              </li>
            ))}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  )
}

export function MixingTable({ rows, names, media }: { rows: MixingRow[]; names: Names; media?: Record<string, FileRef[]> }) {
  return (
    <Table
      minWidth={1320}
      head={
        <>
          <Th>Date</Th>
          <Th>Network / Site</Th>
          <Th>Mixing type</Th>
          <Th>Batches</Th>
          <Th right>Biochar (L)</Th>
          <Th right>Other material (kg)</Th>
          <Th right>Total (kg)</Th>
          <Th right>Bags</Th>
          <Th right>Rejected biochar (L)</Th>
          <Th>Media</Th>
          <Th>Description</Th>
        </>
      }
    >
      {rows.map((r) => (
        <tr key={r.id} className={rowClass}>
          <DateCell iso={r.date} />
          <PlaceCell names={names} networkId={r.networkId} siteId={r.siteId} />
          <Text>{r.mixingType}</Text>
          <Td>
            <BatchesChip ids={r.batchIds} />
          </Td>
          <Td right>{num(r.biocharL, 1)}</Td>
          <Td right>{num(r.otherMaterialKg, 1)}</Td>
          <Td right>{num(r.totalKg, 1)}</Td>
          <Td right>{num(r.bagsCreated, 0)}</Td>
          <Td right>{num(r.rejectedBiocharL, 1)}</Td>
          <Td>
            <MediaStrip files={media?.[r.id] ?? []} />
          </Td>
          <Description text={r.description} />
        </tr>
      ))}
    </Table>
  )
}

/* ------------------------------------------------------------------ */
/* Packaging                                                           */
/* ------------------------------------------------------------------ */

export function PackagingTable({ rows, names, media }: { rows: PackagingRow[]; names: Names; media?: Record<string, FileRef[]> }) {
  return (
    <Table
      minWidth={1320}
      head={
        <>
          <Th>Date</Th>
          <Th>Network / Site</Th>
          <Th>Packaging type</Th>
          <Th right>Biochar (kg)</Th>
          <Th right>Mix (kg)</Th>
          <Th>Bag details</Th>
          <Th right>Bags created</Th>
          <Th right>Distributed</Th>
          <Th right>Remaining</Th>
          <Th>Media</Th>
          <Th>Description</Th>
        </>
      }
    >
      {rows.map((r) => (
        <tr key={r.id} className={rowClass}>
          <DateCell iso={r.date} />
          <PlaceCell names={names} networkId={r.networkId} siteId={r.siteId} />
          <Text>{r.packagingType}</Text>
          <Td right>{num(r.biocharKg, 1)}</Td>
          <Td right>{num(r.mixKg, 1)}</Td>
          <Description text={r.bagDetails} />
          <Td right>{num(r.bagsCreated, 0)}</Td>
          <Td right>{num(r.bagsDistributed, 0)}</Td>
          <Td right>{num(r.bagsRemaining, 0)}</Td>
          <Td>
            <MediaStrip files={media?.[r.id] ?? []} />
          </Td>
          <Description text={r.description} />
        </tr>
      ))}
    </Table>
  )
}
