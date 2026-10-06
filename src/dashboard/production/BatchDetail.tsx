'use client'

import {
  ArrowLeft,
  BadgeCheck,
  Blend,
  CircleDashed,
  Droplets,
  Factory,
  Flame,
  ImageOff,
  Images,
  Leaf,
  Package,
  Sprout,
  Thermometer,
  Truck,
} from 'lucide-react'
import Link from 'next/link'
import { useMemo, useState, type ReactNode } from 'react'

import { Card, EmptyState } from '../components/ui'
import { cn, num } from '../lib/utils'
import type { BatchDetail, FileRef, SinkEvent } from '../server/production-extra'
import { AssessActions, canAssess } from './Assess'
import { KILN_TYPE, utcDate, utcDateTime } from './format'
import { Lightbox, MediaGrid, MediaTile, categoryLabel, isImage } from './media'
import { useNames } from './names'
import { StatusBadge } from './tables'

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

type Stage = 'collected' | 'prep' | 'production'

/** Which production step a file category belongs to (null: gallery only). */
const stageOf = (category: string): Stage | null => {
  const c = category.toLowerCase()
  if (/transport|vehicle|collection|fpu|source/.test(c)) return 'collected'
  if (/moisture|biomass|feedstock|shred|dry/.test(c)) return 'prep'
  if (/fir|temp|quench|chimney|flame|kiln|biochar|smoke|measur|container|sampl|ignit|burn|batch|production/.test(c)) return 'production'
  return null
}

const duration = (from: string | null, to: string | null) => {
  if (!from || !to) return ''
  const mins = Math.round((Date.parse(to) - Date.parse(from)) / 60000)
  if (!Number.isFinite(mins) || mins < 0) return ''
  const d = Math.floor(mins / 1440)
  const h = Math.floor((mins % 1440) / 60)
  const m = mins % 60
  return [d ? `${d} d` : '', h ? `${h} h` : '', m || (!d && !h) ? `${m} min` : ''].filter(Boolean).join(' ')
}

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null)

/* ------------------------------------------------------------------ */
/* Building blocks                                                     */
/* ------------------------------------------------------------------ */

function Tile({ label, value, sub, accent, className }: { label: string; value: ReactNode; sub?: ReactNode; accent?: boolean; className?: string }) {
  const empty = value === '' || value == null
  return (
    <div className={cn('flex min-w-0 flex-col gap-0.5 rounded-2xl border border-line bg-surface px-4 py-3', accent && 'border-brand/20 bg-brand-soft', className)}>
      <dt className="truncate text-[11px] font-bold tracking-wide text-ink-muted uppercase">{label}</dt>
      <dd className={cn('min-w-0 font-bold tabular-nums break-words', accent && 'text-brand', empty && 'font-normal text-ink-subtle')}>{empty ? '—' : value}</dd>
      {sub && <dd className="min-w-0 truncate text-xs text-ink-muted">{sub}</dd>}
    </div>
  )
}

const Unit = ({ children }: { children: ReactNode }) => <span className="ml-1 text-xs font-medium text-ink-muted">{children}</span>

function Chip({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'brand' | 'flame' | 'info' }) {
  const tones = {
    neutral: 'bg-muted text-ink-2',
    brand: 'bg-brand-soft text-brand',
    flame: 'bg-flame-soft text-clay',
    info: 'bg-info-soft text-info',
  }
  return <span className={cn('inline-flex items-center rounded-md px-1.5 py-0.5 text-xs font-semibold tabular-nums', tones[tone])}>{children}</span>
}

function SectionCard({ title, icon, children, id, aside }: { title: string; icon: ReactNode; children: ReactNode; id?: string; aside?: ReactNode }) {
  return (
    <Card className="min-w-0 p-4 md:p-5" id={id}>
      <h2 className="mb-4 flex items-center gap-2 text-base font-bold">
        <span className="flex size-7 items-center justify-center rounded-lg bg-brand-soft text-brand [&_svg]:size-4" aria-hidden>
          {icon}
        </span>
        {title}
        {aside && <span className="ml-auto text-xs font-medium text-ink-muted">{aside}</span>}
      </h2>
      {children}
    </Card>
  )
}

/** One step of a vertical timeline; the connector line is drawn by the list. */
function Step({ icon, title, when, children, last }: { icon: ReactNode; title: string; when?: string; children: ReactNode; last?: boolean }) {
  return (
    <li className="relative flex gap-3 pb-6 last:pb-0">
      {!last && <span className="absolute top-9 bottom-0 left-[17px] w-px bg-line" aria-hidden />}
      <span className="relative z-[1] flex size-9 shrink-0 items-center justify-center rounded-full border border-line bg-surface text-brand shadow-sm [&_svg]:size-4" aria-hidden>
        {icon}
      </span>
      <div className="min-w-0 flex-1 pt-1">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
          <h3 className="font-bold">{title}</h3>
          {when && <span className="text-xs text-ink-muted tabular-nums">{when}</span>}
        </div>
        <div className="mt-2 flex flex-col gap-3 text-sm">{children}</div>
      </div>
    </li>
  )
}

function Muted({ children }: { children: ReactNode }) {
  return <p className="text-sm text-ink-subtle">{children}</p>
}

/** Thumbnails for a timeline step, with a jump to the full gallery when there are more. */
function StepMedia({ files, onOpen }: { files: FileRef[]; onOpen: (f: FileRef) => void }) {
  if (!files.length) return null
  const shown = files.slice(0, 6)
  return (
    <div className="flex flex-col gap-1.5">
      <ul className="grid grid-cols-3 gap-1.5 sm:grid-cols-6">
        {shown.map((f) => (
          <li key={f.id}>
            <MediaTile f={f} onOpen={() => onOpen(f)} />
          </li>
        ))}
      </ul>
      {files.length > shown.length && (
        <a href="#media" className="self-start rounded text-xs font-semibold text-brand outline-none hover:underline focus-visible:ring-2 focus-visible:ring-brand/40">
          +{files.length - shown.length} more in the media gallery
        </a>
      )}
    </div>
  )
}

function EventList({ events, empty }: { events: SinkEvent[]; empty: string }) {
  if (!events.length) return <Muted>{empty}</Muted>
  return (
    <ul className="flex flex-col divide-y divide-line rounded-xl border border-line">
      {events.map((e) => (
        <li key={e.id} className="flex items-start gap-3 px-3 py-2.5">
          <div className="min-w-0 flex-1">
            <div className="truncate font-semibold" title={e.title}>
              {e.title}
            </div>
            <div className="text-xs text-ink-muted">
              {[e.at ? utcDate(e.at) : '', e.detail].filter(Boolean).join(' · ') || '—'}
            </div>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1">
            {e.quantity && <span className="text-sm font-bold whitespace-nowrap tabular-nums">{e.quantity}</span>}
            {e.status && <Chip>{e.status.replace(/[_-]+/g, ' ').toLowerCase()}</Chip>}
          </div>
        </li>
      ))}
    </ul>
  )
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export function BatchDetailPage({ detail }: { detail: BatchDetail }) {
  const { batch: b, collections, additions, temperatures, containers, mixing, packing, distribution, files } = detail
  const names = useNames()
  const kiln = names.kiln(b.kilnId)
  const kilnL = b.kilnVolumeL ?? (kiln?.volumeM3 != null ? kiln.volumeM3 * 1000 : null)

  const images = useMemo(() => files.filter((f) => f.status === 'stored' && isImage(f)), [files])
  const [index, setIndex] = useState<number | null>(null)
  const open = (f: FileRef) => {
    const i = images.indexOf(f)
    if (i >= 0) setIndex(i)
  }

  const byStage = useMemo(() => {
    const m: Record<Stage, FileRef[]> = { collected: [], prep: [], production: [] }
    for (const f of files) {
      const s = stageOf(f.category)
      if (s) m[s].push(f)
    }
    return m
  }, [files])
  const groups = useMemo(() => {
    const m = new Map<string, FileRef[]>()
    for (const f of files) m.set(f.category, [...(m.get(f.category) ?? []), f])
    return [...m.entries()].sort((a, z) => a[0].localeCompare(z[0]))
  }, [files])

  const moistureAvg = avg(b.moistureReadings)
  const maxTemp = b.temperatureC ?? (temperatures.length ? Math.max(...temperatures.map((t) => t.value)) : null)
  const tempUnit = temperatures[0]?.unit || '°C'
  const totalCollected = collections.reduce((t, c) => t + (c.quantityKg ?? 0), 0)
  const pendingFiles = files.filter((f) => f.status !== 'stored').length

  return (
    <div className="flex flex-col gap-5 px-4 pt-5 pb-10 md:px-6">
      {/* Header */}
      <div className="flex flex-col gap-3">
        <Link
          href="/admin/production"
          className="inline-flex items-center gap-1.5 self-start rounded-full py-1 pr-2 text-sm font-semibold text-ink-muted outline-none hover:text-ink focus-visible:ring-2 focus-visible:ring-brand/40"
        >
          <ArrowLeft className="size-4" aria-hidden /> Production
        </Link>
        <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-mono text-base font-bold tracking-tight break-all sm:text-xl">{b.code || 'Batch'}</h1>
              <StatusBadge status={b.status} />
            </div>
            <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink-muted">
              <span>{utcDateTime(b.date)}</span>
              <Flag on={b.sinkApproved} label="Sink approved" />
              <Flag on={b.registered} label="Registered" />
              <span className="font-mono text-xs text-ink-subtle">{b.id}</span>
            </p>
          </div>
          {canAssess(b.status) && (
            <div className="ml-auto w-full sm:w-auto sm:min-w-80">
              <AssessActions key={b.id} id={b.id} code={b.code} />
            </div>
          )}
        </div>
      </div>

      {/* Summary */}
      <dl className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-6">
        <Tile label="Partner org" value={names.org(b.networkId)} sub={names.network(b.networkId)} />
        <Tile label="Site" value={names.site(b.siteId)} sub={b.operatorName ? `Operator: ${b.operatorName}` : undefined} />
        <Tile
          label="Kiln"
          value={kiln ? kiln.name : ''}
          sub={[kiln ? (KILN_TYPE[kiln.type] ?? kiln.type) : '', kilnL != null ? `${num(kilnL, 0)} L` : ''].filter(Boolean).join(' · ') || undefined}
        />
        <Tile label="Feedstock" value={b.feedstock} sub={b.bulkDensity ? `Bulk density ${num(b.bulkDensity, 3)} kg/L` : undefined} />
        <Tile label="Carbon content" value={b.carbonContent ? <>{num(b.carbonContent * 100, 1)}<Unit>%</Unit></> : ''} />
        <Tile label="Biomass" value={<>{num(b.biomassKg, 1)}<Unit>kg</Unit></>} />
        <Tile label="Biochar" value={<>{num(b.biocharL, 1)}<Unit>L</Unit></>} />
        <Tile accent label="Carbon credits" value={<>{b.csinkT.toFixed(3)}<Unit>t CO₂e</Unit></>} />
        <Tile label="Short-term sink" value={b.shortTermSinkT != null ? <>{b.shortTermSinkT.toFixed(3)}<Unit>t CO₂e</Unit></> : ''} />
        <Tile
          label="Emissions"
          value={b.co2EmissionKg != null ? <>{num(b.co2EmissionKg, 2)}<Unit>kg CO₂</Unit></> : ''}
          sub={b.methaneEmissionKg != null ? `${num(b.methaneEmissionKg, 3)} kg CH₄` : undefined}
        />
        <Tile
          label="Production time"
          value={duration(b.startDate, b.endedAt)}
          sub={b.startDate ? `${utcDateTime(b.startDate)}${b.endedAt ? ` – ${utcDateTime(b.endedAt)}` : ''}` : undefined}
        />
        <Tile label="Max temperature" value={maxTemp != null ? <>{num(maxTemp, 0)}<Unit>{tempUnit}</Unit></> : ''} />
        <Tile label="Assessed by" value={b.assessedBy} sub={b.assessedAt ? utcDateTime(b.assessedAt) : undefined} />
        {b.samplingContainer && <Tile label="Sampling container" value={b.samplingContainer} />}
        {b.rejectionReason && (
          <div className="col-span-2 flex min-w-0 flex-col gap-0.5 rounded-2xl border border-danger/20 bg-danger-soft px-4 py-3 sm:col-span-3 lg:col-span-4 2xl:col-span-6">
            <dt className="text-[11px] font-bold tracking-wide text-danger uppercase">Rejection reason</dt>
            <dd className="text-sm font-medium break-words whitespace-pre-wrap text-ink">{b.rejectionReason}</dd>
          </div>
        )}
      </dl>

      {/* Timelines */}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <SectionCard title="Biochar production timeline" icon={<Factory />}>
          <ol>
            <Step icon={<Truck />} title="Biomass collected" when={totalCollected ? `${num(totalCollected, 1)} kg` : undefined}>
              {collections.length ? (
                <ul className="flex flex-col gap-1.5">
                  {collections.map((c, i) => (
                    <li key={i} className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                      <span className="font-semibold">{c.source || 'Unknown source'}</span>
                      {c.crop && <Chip tone="brand">{c.crop}</Chip>}
                      {c.quantityKg != null && <span className="tabular-nums">{num(c.quantityKg, 1)} kg</span>}
                      {(c.vehicle || c.site) && <span className="text-xs text-ink-muted">{[c.vehicle, c.site].filter(Boolean).join(' · ')}</span>}
                    </li>
                  ))}
                </ul>
              ) : (
                <Muted>No biomass collection was linked to this batch.</Muted>
              )}
              <StepMedia files={byStage.collected} onOpen={open} />
            </Step>

            <Step
              icon={<Droplets />}
              title="Feedstock preparation"
              when={moistureAvg != null ? `Avg. moisture ${num(moistureAvg, 1)}%` : undefined}
            >
              {additions.length > 0 && (
                <ul className="flex flex-col gap-1.5">
                  {additions.map((a, i) => (
                    <li key={i} className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                      <span className="font-semibold">{a.source || b.feedstock || 'Biomass'}</span>
                      {a.quantityKg != null && <span className="tabular-nums">{num(a.quantityKg, 1)} kg</span>}
                      {a.at && <span className="text-xs text-ink-muted">dropped {utcDateTime(a.at)}</span>}
                    </li>
                  ))}
                </ul>
              )}
              {b.moistureReadings.length ? (
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-ink-muted">Moisture readings ({b.moistureReadings.length})</span>
                  <div className="flex flex-wrap gap-1" aria-label="Moisture readings">
                    {b.moistureReadings.map((m, i) => (
                      <Chip key={i} tone="info">
                        {num(m, 1)}%
                      </Chip>
                    ))}
                  </div>
                </div>
              ) : (
                !additions.length && <Muted>No moisture readings were recorded.</Muted>
              )}
              <StepMedia files={byStage.prep} onOpen={open} />
            </Step>

            <Step
              icon={<Flame />}
              title="Biochar production"
              when={b.startDate ? `${utcDateTime(b.startDate)}${b.endedAt ? ` – ${utcDateTime(b.endedAt)}` : ''}` : undefined}
              last
            >
              <div className="flex flex-wrap gap-x-5 gap-y-1">
                <span>
                  <span className="text-ink-muted">Duration </span>
                  <span className="font-semibold tabular-nums">{duration(b.startDate, b.endedAt) || '—'}</span>
                </span>
                <span>
                  <span className="text-ink-muted">Biochar </span>
                  <span className="font-semibold tabular-nums">{num(b.biocharL, 1)} L</span>
                </span>
                {maxTemp != null && (
                  <span>
                    <span className="text-ink-muted">Max </span>
                    <span className="font-semibold tabular-nums">
                      {num(maxTemp, 0)} {tempUnit}
                    </span>
                  </span>
                )}
              </div>
              {temperatures.length > 0 && (
                <div className="flex flex-col gap-1">
                  <span className="inline-flex items-center gap-1 text-xs text-ink-muted">
                    <Thermometer className="size-3.5" aria-hidden /> Temperature readings
                  </span>
                  <div className="flex flex-wrap gap-1">
                    {temperatures.map((t, i) => (
                      <Chip key={i} tone="flame">
                        {num(t.value, 0)} {t.unit}
                      </Chip>
                    ))}
                  </div>
                </div>
              )}
              {containers.length > 0 && (
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-ink-muted">Measuring containers</span>
                  <ul className="flex flex-wrap gap-1.5">
                    {containers.map((c, i) => (
                      <li key={i} className="rounded-lg border border-line px-2 py-1 text-xs">
                        <span className="font-semibold">{c.name || 'Container'}</span>
                        {c.count != null && <span className="tabular-nums"> × {num(c.count, 0)}</span>}
                        <span className="text-ink-muted">
                          {[
                            c.volume != null ? ` · vol. ${num(c.volume, 2)}` : '',
                            c.shape ? ` · ${c.shape}` : '',
                            c.diameter != null && c.height != null ? ` · ${num(c.diameter, 1)} × ${num(c.height, 1)}` : '',
                          ].join('')}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <StepMedia files={byStage.production} onOpen={open} />
            </Step>
          </ol>
        </SectionCard>

        <SectionCard title="C-sink timeline" icon={<Sprout />}>
          <ol>
            <Step icon={<Blend />} title="Mixing" when={mixing.length ? `${mixing.length} ${mixing.length === 1 ? 'entry' : 'entries'}` : undefined}>
              <EventList events={mixing} empty="Not mixed yet." />
            </Step>
            <Step icon={<Package />} title="Packaging & inventory" when={packing.length ? `${packing.length} ${packing.length === 1 ? 'entry' : 'entries'}` : undefined}>
              <EventList events={packing} empty="Not packed yet." />
            </Step>
            <Step
              icon={<Leaf />}
              title="Application & distribution"
              when={distribution.length ? `${distribution.length} ${distribution.length === 1 ? 'entry' : 'entries'}` : undefined}
              last
            >
              <EventList events={distribution} empty="Not distributed or applied yet." />
            </Step>
          </ol>
        </SectionCard>
      </div>

      {/* Media gallery */}
      <SectionCard
        id="media"
        title="Media"
        icon={<Images />}
        aside={files.length ? `${files.length} files${pendingFiles ? ` · ${pendingFiles} not copied yet` : ''}` : undefined}
      >
        {files.length ? (
          <div className="flex flex-col gap-5">
            {groups.map(([cat, list]) => (
              <section key={cat} aria-label={categoryLabel(cat)}>
                <h3 className="mb-2 flex items-center gap-2 text-xs font-bold tracking-wide text-ink-muted uppercase">
                  {categoryLabel(cat)}
                  <span className="rounded-md bg-muted px-1.5 font-semibold text-ink-subtle tabular-nums">{list.length}</span>
                </h3>
                <MediaGrid files={list} onOpen={open} />
              </section>
            ))}
          </div>
        ) : (
          <EmptyState icon={<ImageOff />} title="No media" sub="No photos, videos or documents were recorded for this batch." />
        )}
      </SectionCard>

      <Lightbox images={images} index={index} onIndex={setIndex} />
    </div>
  )
}

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

/** Placeholder while the batch record loads. */
export function BatchDetailSkeleton() {
  const block = 'animate-pulse rounded-2xl bg-muted'
  return (
    <div className="flex flex-col gap-5 px-4 pt-5 pb-10 md:px-6" aria-busy="true" aria-label="Loading batch">
      <div className="flex flex-col gap-3">
        <div className={cn(block, 'h-5 w-28 rounded-full')} />
        <div className={cn(block, 'h-8 w-64')} />
        <div className={cn(block, 'h-4 w-80 max-w-full')} />
      </div>
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-6">
        {Array.from({ length: 12 }, (_, i) => (
          <div key={i} className={cn(block, 'h-[74px]')} />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className={cn(block, 'h-96')} />
        <div className={cn(block, 'h-96')} />
      </div>
      <div className={cn(block, 'h-64')} />
    </div>
  )
}
