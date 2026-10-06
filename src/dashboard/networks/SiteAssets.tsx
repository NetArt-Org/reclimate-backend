'use client'

import {
  AlertTriangle,
  Beaker,
  Box,
  Camera,
  ChevronDown,
  Flame,
  ImageOff,
  Leaf,
  Map as MapIcon,
  MapPin,
  Pencil,
  Phone,
  Plus,
  RefreshCw,
  Truck,
  Users,
} from 'lucide-react'
import dynamic from 'next/dynamic'
import { useCallback, useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from 'react'

import { Badge, Button, EmptyState, Switch, Tooltip } from '../components/ui'
import { ROLE_LABEL } from '../data/catalog'
import { useDashboard } from '../data/store'
import type { Kiln, Network, Site } from '../data/types'
import type { MapPoint } from '../home/MapView'
import { cn, day, num } from '../lib/utils'
import { unwrap } from '../lib/unwrap'
import { getNetworkExtras, type BiomassSourceRow, type Dimensions, type NetworkExtras, type Photo, type VehicleRow } from '../server/networks-extra'
import { ROLE_TONE } from './PeopleTable'
import { SourceSheet, VehicleSheet } from './AssetSheets'

const MapView = dynamic(() => import('../home/MapView').then((m) => m.MapView), {
  ssr: false,
  loading: () => <div className="size-full animate-pulse rounded-2xl bg-muted" />,
})

/* ------------------------------------------------------------------ */
/* Data                                                                */
/* ------------------------------------------------------------------ */

export interface ExtrasState {
  data: NetworkExtras | null
  loading: boolean
  error: string | null
  reload: () => void
  /** Local patch after a save, so the list updates without a refetch. */
  patch: (fn: (d: NetworkExtras) => NetworkExtras) => void
}

/** Loads kilns, containers, vehicles, biomass sources and field people for one network. Kept out of the global store. */
export function useNetworkExtras(networkId: string): ExtrasState {
  const [data, setData] = useState<NetworkExtras | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [nonce, setNonce] = useState(0)

  useEffect(() => {
    let live = true
    // eslint-disable-next-line react-hooks/set-state-in-effect -- show the skeleton while a (re)load runs
    setLoading(true)
    setError(null)
    getNetworkExtras(networkId)
      .then(unwrap)
      .then((d) => live && setData(d))
      .catch((e: unknown) => live && setError(e instanceof Error ? e.message : 'Could not load this network'))
      .finally(() => live && setLoading(false))
    return () => {
      live = false
    }
  }, [networkId, nonce])

  const reload = useCallback(() => setNonce((x) => x + 1), [])
  const patch = useCallback((fn: (d: NetworkExtras) => NetworkExtras) => setData((d) => (d ? fn(d) : d)), [])
  return { data, loading, error, reload, patch }
}

/* ------------------------------------------------------------------ */
/* Formatting                                                          */
/* ------------------------------------------------------------------ */

const KILN_TYPE: Record<Kiln['type'], string> = { kontiki: 'Kon-Tiki', pit: 'Pit' }

const isDiameter = (k: string) => /diam/i.test(k)
const diameterRank = (k: string) => (/upper|top/i.test(k) ? 0 : /lower|bottom|base/i.test(k) ? 2 : 1)
const restRank = (k: string) => (/length/i.test(k) ? 0 : /width/i.test(k) ? 1 : /height|depth/i.test(k) ? 2 : 3)
const human = (k: string) => {
  const t = k.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[_-]+/g, ' ').toLowerCase()
  return t.charAt(0).toUpperCase() + t.slice(1)
}
const mm = (v: number) => num(v, 0)

/** { upperDiameter: 2000, lowerDiameter: 1000, depth: 1000 } → "Ø 2000 / 1000 × 1000 mm" */
export function formatDims(d: Dimensions): { short: string; long: string } {
  const entries = Object.entries(d)
  if (!entries.length) return { short: '', long: '' }
  const diam = entries.filter(([k]) => isDiameter(k)).sort(([a], [b]) => diameterRank(a) - diameterRank(b))
  const rest = entries.filter(([k]) => !isDiameter(k)).sort(([a], [b]) => restRank(a) - restRank(b))
  const parts: string[] = []
  if (diam.length) parts.push(`Ø ${diam.map(([, v]) => mm(v)).join(' / ')}`)
  if (rest.length) parts.push(rest.map(([, v]) => mm(v)).join(' × '))
  return {
    short: `${parts.join(' × ')} mm`,
    long: [...diam, ...rest].map(([k, v]) => `${human(k)} ${mm(v)} mm`).join(' · '),
  }
}

const shapeLabel = (s: string) => (s ? human(s) : '')
const litres = (v: number | null) => (v == null ? '—' : `${num(v, 0)} L`)
const coords = (lat: number | null, lng: number | null) => (lat != null && lng != null ? `${lat.toFixed(5)}, ${lng.toFixed(5)}` : '')

/* ------------------------------------------------------------------ */
/* Site tabs                                                           */
/* ------------------------------------------------------------------ */

const NO_SITE = '__network'

/** Sites & kilns tab: one sub-tab per site (as in Circonomy), each with kilns, containers, vehicles, sources and people. */
export function SiteAssets({ network: n, extras }: { network: Network; extras: ExtrasState }) {
  const { data } = useDashboard()
  const sites = data.sites.filter((s) => s.networkId === n.id)
  const siteIds = new Set(sites.map((s) => s.id))
  const x = extras.data

  // Records that are linked to the network but not to one of its sites.
  const orphan = (id: string | null) => !id || !siteIds.has(id)
  const unassigned = x
    ? x.measuring.filter((c) => orphan(c.siteId)).length +
      x.sampling.filter((c) => orphan(c.siteId)).length +
      x.vehicles.filter((v) => orphan(v.siteId)).length +
      x.sources.filter((b) => orphan(b.siteId)).length +
      x.people.filter((p) => !p.siteIds.some((s) => siteIds.has(s))).length
    : 0

  const tabs = [...sites.map((s) => ({ id: s.id, label: s.name, active: s.active })), ...(unassigned ? [{ id: NO_SITE, label: 'No site', active: true }] : [])]
  const [picked, setPicked] = useState<string | null>(null)
  const current = tabs.find((t) => t.id === picked)?.id ?? tabs[0]?.id
  const refs = useRef<Record<string, HTMLButtonElement | null>>({})

  if (!tabs.length) {
    return <EmptyState icon={<MapPin />} title="No sites yet" sub="Sites are created when the field team registers them in the app." />
  }

  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const i = tabs.findIndex((t) => t.id === current)
    let next = -1
    if (e.key === 'ArrowRight') next = (i + 1) % tabs.length
    else if (e.key === 'ArrowLeft') next = (i - 1 + tabs.length) % tabs.length
    else if (e.key === 'Home') next = 0
    else if (e.key === 'End') next = tabs.length - 1
    if (next < 0) return
    e.preventDefault()
    setPicked(tabs[next].id)
    refs.current[tabs[next].id]?.focus()
  }

  const site = sites.find((s) => s.id === current)

  return (
    <div className="flex flex-col gap-4">
      {extras.error && (
        <div role="alert" className="flex flex-wrap items-center gap-3 rounded-xl border border-danger/30 bg-danger-soft px-4 py-3 text-sm text-danger">
          <AlertTriangle className="size-4 shrink-0" />
          <span className="min-w-0 flex-1">Could not load kilns, containers and vehicles. {extras.error}</span>
          <Button size="sm" className="rounded-lg" onClick={extras.reload}>
            <RefreshCw /> Retry
          </Button>
        </div>
      )}

      {tabs.length > 1 && (
        <div role="tablist" aria-label="Sites" onKeyDown={onKey} className="scroll-thin -mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
          {tabs.map((t) => (
            <button
              key={t.id}
              ref={(el) => {
                refs.current[t.id] = el
              }}
              type="button"
              role="tab"
              id={`site-tab-${t.id}`}
              aria-selected={t.id === current}
              aria-controls={`site-panel-${t.id}`}
              tabIndex={t.id === current ? 0 : -1}
              onClick={() => setPicked(t.id)}
              className={cn(
                'flex h-9 shrink-0 cursor-pointer items-center gap-2 rounded-lg border px-3 text-sm font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-brand/40',
                t.id === current ? 'border-brand bg-brand-soft text-brand' : 'border-line text-ink-muted hover:bg-muted hover:text-ink',
              )}
            >
              {t.id === NO_SITE ? <Box className="size-3.5" /> : <span className={cn('size-1.5 rounded-full', t.active ? 'bg-success' : 'bg-line-strong')} />}
              {t.label}
            </button>
          ))}
        </div>
      )}

      <div role={tabs.length > 1 ? 'tabpanel' : undefined} id={`site-panel-${current}`} aria-labelledby={tabs.length > 1 ? `site-tab-${current}` : undefined}>
        <SitePanel key={current} network={n} site={site ?? null} siteIds={siteIds} extras={extras} />
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* One site                                                            */
/* ------------------------------------------------------------------ */

function SitePanel({ network: n, site, siteIds, extras }: { network: Network; site: Site | null; siteIds: Set<string>; extras: ExtrasState }) {
  const { data, updateSite } = useDashboard()
  const x = extras.data
  const loading = extras.loading && !x
  const [vehicle, setVehicle] = useState<VehicleRow | 'new' | null>(null)
  const [source, setSource] = useState<BiomassSourceRow | 'new' | null>(null)

  const mine = (id: string | null) => (site ? id === site.id : !id || !siteIds.has(id))
  const kilns = site ? data.kilns.filter((k) => k.siteId === site.id) : []
  const measuring = x?.measuring.filter((c) => mine(c.siteId)) ?? []
  const sampling = x?.sampling.filter((c) => mine(c.siteId)) ?? []
  const vehicles = x?.vehicles.filter((v) => mine(v.siteId)) ?? []
  const sources = x?.sources.filter((b) => mine(b.siteId)) ?? []
  const people = x?.people.filter((p) => (site ? p.siteIds.includes(site.id) : !p.siteIds.some((s) => siteIds.has(s)))) ?? []
  const address = site ? x?.sites.find((s) => s.id === site.id)?.address : ''
  const dueCount = sampling.filter((c) => c.due).length

  return (
    <div className="flex flex-col gap-3">
      {site ? (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-line px-4 py-3">
          <MapPin className="size-4 shrink-0 text-ink-muted" />
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold">{site.name}</div>
            <div className="text-xs text-ink-muted tabular-nums">
              {address ? `${address} · ` : ''}
              {coords(site.lat, site.lng) || 'Location not set'}
            </div>
          </div>
          {dueCount > 0 && (
            <Badge tone="warn">
              <AlertTriangle /> {dueCount} sampling due
            </Badge>
          )}
          <label className="flex cursor-pointer items-center gap-2 text-xs font-medium text-ink-muted">
            {site.active ? 'Active' : 'Inactive'}
            <Switch checked={site.active} onCheckedChange={(active) => updateSite(site.id, { active })} aria-label={`${site.name} active`} />
          </label>
        </div>
      ) : (
        <p className="text-sm text-ink-muted">Records linked to {n.name} but not to one of its sites.</p>
      )}

      {site && (n.type === 'artisan' || kilns.length > 0) && (
        <Section icon={<Flame />} title="Kilns" count={kilns.length}>
          {kilns.length ? (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {kilns.map((k) => (
                <KilnCard key={k.id} kiln={k} extra={x?.kilns.find((e) => e.id === k.id)} loading={loading} />
              ))}
            </div>
          ) : (
            <EmptyState icon={<Flame />} title="No kilns" sub="Kilns are registered from the field app." />
          )}
        </Section>
      )}

      <Section icon={<Beaker />} title="Measuring containers" count={x ? measuring.length : undefined} defaultOpen={!!site}>
        {loading ? (
          <SkeletonRows />
        ) : (
          <Table
            rows={measuring}
            empty={<EmptyState icon={<Beaker />} title="No measuring containers" />}
            columns={[
              { label: 'Container', track: 'minmax(0,1.4fr)', cell: (c) => <Thumbed photo={c.photo} title={c.code || c.name || 'Container'} sub={c.code && c.name !== c.code ? c.name : ''} /> },
              { label: 'Shape', track: '110px', cell: (c) => shapeLabel(c.shape) || '—' },
              { label: 'Dimensions', track: 'minmax(0,1.2fr)', cell: (c) => <DimsText d={c.dimensions} /> },
              { label: 'Volume', track: '90px', align: 'right', cell: (c) => litres(c.volumeL) },
              { label: 'Status', track: '90px', cell: (c) => <Badge tone={c.inUse ? 'success' : 'neutral'}>{c.inUse ? 'In use' : 'Idle'}</Badge> },
            ]}
          />
        )}
      </Section>

      <SamplingSection rows={sampling} loading={loading} loaded={!!x} />

      <Section
        icon={<Truck />}
        title="Vehicles"
        count={x ? vehicles.length : undefined}
        action={
          x && (
            <Button size="sm" variant="soft" className="rounded-lg" onClick={() => setVehicle('new')}>
              <Plus /> Add<span className="sr-only"> vehicle</span>
            </Button>
          )
        }
      >
        {loading ? (
          <SkeletonRows />
        ) : (
          <Table
            rows={vehicles}
            empty={<EmptyState icon={<Truck />} title="No vehicles" sub="Vehicles used to bring biomass to the site." />}
            columns={[
              { label: 'Vehicle', track: 'minmax(0,1.3fr)', cell: (v) => <Thumbed photo={v.photo} title={v.name || v.plate} sub={v.name ? v.plate : ''} /> },
              { label: 'Plate', track: '120px', cell: (v) => <span className="font-semibold">{v.plate}</span> },
              { label: 'Type', track: 'minmax(0,0.8fr)', cell: (v) => v.type || '—' },
              { label: 'Fuel', track: '90px', cell: (v) => v.fuel || '—' },
              { label: 'CO₂ factor', track: '90px', align: 'right', cell: (v) => (v.emissionFactor == null ? '—' : num(v.emissionFactor, 4)) },
              {
                label: '',
                track: '40px',
                cell: (v) => (
                  <Button variant="ghost" size="icon-sm" aria-label={`Edit ${v.name || v.plate}`} onClick={() => setVehicle(v)}>
                    <Pencil />
                  </Button>
                ),
              },
            ]}
          />
        )}
      </Section>

      <SourcesSection site={site} rows={sources} loading={loading} loaded={!!x} onEdit={setSource} />

      <Section icon={<Users />} title="Farmers & operators" count={x ? people.length : undefined}>
        {loading ? (
          <SkeletonRows />
        ) : (
          <Table
            rows={people}
            empty={<EmptyState icon={<Users />} title="No farmers or operators" sub="Add them from the People tab." />}
            columns={[
              {
                label: 'Name',
                track: 'minmax(0,1.2fr)',
                cell: (p) => (
                  <span className={cn('flex min-w-0 items-center gap-2', !p.active && 'opacity-60')}>
                    <span className={cn('size-2 shrink-0 rounded-full', p.active ? 'bg-success' : 'bg-line-strong')} aria-hidden />
                    <span className="truncate font-semibold">{p.name}</span>
                    {!p.active && <span className="sr-only">(inactive)</span>}
                  </span>
                ),
              },
              { label: 'Role', track: '100px', cell: (p) => <Badge tone={ROLE_TONE[p.role]}>{ROLE_LABEL[p.role]}</Badge> },
              {
                label: 'Phone',
                track: '150px',
                cell: (p) =>
                  p.phone ? (
                    <a href={`tel:${p.phone.replace(/\s+/g, '')}`} className="inline-flex items-center gap-1.5 rounded text-ink-2 outline-none hover:text-brand focus-visible:ring-2 focus-visible:ring-brand/40">
                      <Phone className="size-3.5" /> {p.phone}
                    </a>
                  ) : (
                    '—'
                  ),
              },
              { label: 'Address', track: 'minmax(0,1.6fr)', cell: (p) => <span className="line-clamp-2 text-ink-2">{p.address || '—'}</span> },
            ]}
          />
        )}
      </Section>

      <VehicleSheet
        open={vehicle !== null}
        onOpenChange={(o) => !o && setVehicle(null)}
        network={n}
        vehicle={vehicle === 'new' ? null : vehicle}
        defaultSiteId={site?.id ?? null}
        onSaved={(row, isNew) =>
          extras.patch((d) => ({ ...d, vehicles: isNew ? [...d.vehicles, row] : d.vehicles.map((v) => (v.id === row.id ? { ...row, photo: v.photo } : v)) }))
        }
      />
      <SourceSheet
        open={source !== null}
        onOpenChange={(o) => !o && setSource(null)}
        network={n}
        source={source === 'new' ? null : source}
        defaultSiteId={site?.id ?? null}
        onSaved={(row, isNew) => extras.patch((d) => ({ ...d, sources: isNew ? [...d.sources, row] : d.sources.map((b) => (b.id === row.id ? row : b)) }))}
      />
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Sections                                                            */
/* ------------------------------------------------------------------ */

function SamplingSection({ rows, loading, loaded }: { rows: NetworkExtras['sampling']; loading: boolean; loaded: boolean }) {
  const [dueOnly, setDueOnly] = useState(false)
  const due = rows.filter((c) => c.due).length
  const shown = dueOnly ? rows.filter((c) => c.due) : rows
  return (
    <Section
      icon={<Beaker />}
      title="Sampling containers"
      count={loaded ? rows.length : undefined}
      warn={due}
      action={
        loaded &&
        rows.length > 0 && (
          <button
            type="button"
            aria-pressed={dueOnly}
            onClick={() => setDueOnly((v) => !v)}
            className={cn(
              'inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-full border px-3 text-xs font-semibold transition-colors outline-none focus-visible:ring-2 focus-visible:ring-brand/40',
              dueOnly ? 'border-warn bg-warn-soft text-warn' : 'border-line text-ink-muted hover:bg-muted',
            )}
          >
            <AlertTriangle className="size-3.5" /> Due only
            <span className="tabular-nums">({due})</span>
          </button>
        )
      }
    >
      {loading ? (
        <SkeletonRows />
      ) : (
        <Table
          rows={shown}
          empty={
            <EmptyState
              icon={<Beaker />}
              title={dueOnly ? 'Nothing due' : 'No sampling containers'}
              sub={dueOnly ? 'No sample has reached 6 months yet.' : 'Lab samples are kept for 6 months in a sampling container.'}
            />
          }
          columns={[
            { label: 'Container', track: 'minmax(0,1.3fr)', cell: (c) => <Thumbed photo={c.photo} title={c.code || c.name || 'Container'} sub={c.code && c.name !== c.code ? c.name : ''} /> },
            { label: 'Volume', track: '90px', align: 'right', cell: (c) => litres(c.volumeL) },
            { label: 'Filled', track: '80px', cell: (c) => <Badge tone={c.filled ? 'info' : 'neutral'}>{c.filled ? 'Filled' : 'Empty'}</Badge> },
            { label: 'Added', track: '110px', cell: (c) => (c.addedAt ? day(c.addedAt) : '—') },
            {
              label: '6-month sampling',
              track: '150px',
              cell: (c) =>
                !c.dueAt ? (
                  <span className="text-ink-subtle">No date</span>
                ) : c.due ? (
                  <Tooltip content={`6 months since ${day(c.addedAt!)} — reached ${day(c.dueAt)}`}>
                    <span tabIndex={0} className="rounded-md outline-none focus-visible:ring-2 focus-visible:ring-brand/40">
                      <Badge tone="warn">
                        <AlertTriangle /> Sampling due
                      </Badge>
                    </span>
                  </Tooltip>
                ) : (
                  <span className="text-ink-muted">Due {day(c.dueAt)}</span>
                ),
            },
          ]}
        />
      )}
    </Section>
  )
}

function SourcesSection({
  site,
  rows,
  loading,
  loaded,
  onEdit,
}: {
  site: Site | null
  rows: BiomassSourceRow[]
  loading: boolean
  loaded: boolean
  onEdit: (b: BiomassSourceRow | 'new') => void
}) {
  const [showMap, setShowMap] = useState(false)
  const points: MapPoint[] = [
    ...(site && site.lat != null && site.lng != null ? [{ id: site.id, kind: 'site' as const, lat: site.lat, lng: site.lng, label: site.name, sub: 'Site', active: site.active }] : []),
    ...rows
      .filter((b) => b.lat != null && b.lng != null)
      .map((b) => ({ id: b.id, kind: 'farmer' as const, lat: b.lat!, lng: b.lng!, label: b.name, sub: 'Biomass source', active: b.active })),
  ]
  const mappable = points.some((p) => p.kind === 'farmer')

  return (
    <Section
      icon={<Leaf />}
      title="Biomass sources"
      count={loaded ? rows.length : undefined}
      action={
        loaded && (
          <div className="flex items-center gap-1.5">
            {mappable && (
              <Button size="sm" className="rounded-lg" aria-expanded={showMap} onClick={() => setShowMap((v) => !v)}>
                <MapIcon /> {showMap ? 'Hide map' : 'Map'}
              </Button>
            )}
            <Button size="sm" variant="soft" className="rounded-lg" onClick={() => onEdit('new')}>
              <Plus /> Add<span className="sr-only"> biomass source</span>
            </Button>
          </div>
        )
      }
    >
      {loading ? (
        <SkeletonRows />
      ) : (
        <div className="flex flex-col gap-3">
          {showMap && mappable && (
            <div className="h-72">
              <MapView points={points} labels legend={false} />
            </div>
          )}
          <Table
            rows={rows}
            empty={<EmptyState icon={<Leaf />} title="No biomass sources" sub="Farms, plantations or mills that supply biomass (FPUs in Circonomy)." />}
            columns={[
              {
                label: 'Source',
                track: 'minmax(0,1.2fr)',
                cell: (b) => (
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="truncate font-semibold">{b.name}</span>
                    {!b.active && <Badge tone="neutral">Inactive</Badge>}
                  </span>
                ),
              },
              { label: 'Address', track: 'minmax(0,1.6fr)', cell: (b) => <span className="line-clamp-2 text-ink-2">{b.address || '—'}</span> },
              { label: 'Coordinates', track: '170px', cell: (b) => coords(b.lat, b.lng) || <span className="text-ink-subtle">Not set</span> },
              {
                label: '',
                track: '40px',
                cell: (b) => (
                  <Button variant="ghost" size="icon-sm" aria-label={`Edit ${b.name}`} onClick={() => onEdit(b)}>
                    <Pencil />
                  </Button>
                ),
              },
            ]}
          />
        </div>
      )}
    </Section>
  )
}

/* ------------------------------------------------------------------ */
/* Building blocks                                                     */
/* ------------------------------------------------------------------ */

function Section({
  icon,
  title,
  count,
  warn = 0,
  action,
  defaultOpen = true,
  children,
}: {
  icon: ReactNode
  title: string
  /** undefined while loading */
  count?: number
  warn?: number
  action?: ReactNode
  defaultOpen?: boolean
  children: ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  const id = `sec-${title.toLowerCase().replace(/\W+/g, '-')}`
  return (
    <section className="rounded-xl border border-line" aria-labelledby={`${id}-h`}>
      <div className="flex items-center gap-2 px-2 py-1.5">
        <button
          type="button"
          aria-expanded={open}
          aria-controls={id}
          onClick={() => setOpen((v) => !v)}
          className="flex min-h-10 min-w-0 flex-1 cursor-pointer items-center gap-2.5 rounded-lg px-2 text-left outline-none hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-brand/40"
        >
          <ChevronDown className={cn('size-4 shrink-0 text-ink-subtle transition-transform', !open && '-rotate-90')} />
          <span className="text-ink-muted [&_svg]:size-4">{icon}</span>
          <h3 id={`${id}-h`} className="truncate text-sm font-semibold">
            {title}
          </h3>
          {count === undefined ? (
            <span className="h-4 w-6 animate-pulse rounded-md bg-muted" aria-hidden />
          ) : (
            <span className="rounded-md bg-muted px-1.5 text-xs text-ink-muted tabular-nums">{count}</span>
          )}
          {warn > 0 && (
            <span className="rounded-md bg-warn-soft px-1.5 text-xs font-semibold text-warn tabular-nums">
              {warn} due
            </span>
          )}
        </button>
        {action}
      </div>
      {open && (
        <div id={id} className="border-t border-line p-3">
          {children}
        </div>
      )}
    </section>
  )
}

interface Column<T> {
  label: string
  /** CSS grid track on md+ */
  track: string
  align?: 'right'
  cell: (row: T) => ReactNode
}

/** Responsive list: a grid table from md up, label/value cards below. */
function Table<T extends { id: string }>({ rows, columns, empty }: { rows: T[]; columns: Column<T>[]; empty: ReactNode }) {
  if (!rows.length) return <>{empty}</>
  const template = { '--cols': columns.map((c) => c.track).join(' ') } as CSSProperties
  return (
    <div className="overflow-hidden rounded-lg border border-line" style={template} role="table">
      <div role="row" className="hidden gap-3 border-b border-line bg-muted px-3 py-2 text-xs font-semibold text-ink-muted md:grid md:grid-cols-[var(--cols)]">
        {columns.map((c, i) => (
          <span key={i} role="columnheader" className={cn(c.align === 'right' && 'text-right')}>
            {c.label || <span className="sr-only">Actions</span>}
          </span>
        ))}
      </div>
      <div role="rowgroup" className="divide-y divide-line">
      {rows.map((r) => (
        <div
          key={r.id}
          role="row"
          className="grid grid-cols-2 items-center gap-x-3 gap-y-1.5 px-3 py-2.5 text-sm tabular-nums md:grid-cols-[var(--cols)]"
        >
          {columns.map((c, i) => (
            <div
              key={i}
              role="cell"
              className={cn('min-w-0', i === 0 && 'col-span-2 md:col-span-1', !c.label && 'col-span-2 flex justify-end md:col-span-1', c.align === 'right' && 'md:text-right')}
            >
              {c.label && i > 0 && <span className="mr-1.5 text-xs text-ink-muted md:hidden">{c.label}</span>}
              {c.cell(r)}
            </div>
          ))}
        </div>
      ))}
      </div>
    </div>
  )
}

function SkeletonRows({ n = 3 }: { n?: number }) {
  return (
    <div className="flex flex-col gap-2" aria-busy="true" aria-label="Loading">
      {Array.from({ length: n }, (_, i) => (
        <div key={i} className="h-10 animate-pulse rounded-lg bg-muted" />
      ))}
    </div>
  )
}

function DimsText({ d }: { d: Dimensions }) {
  const f = formatDims(d)
  if (!f.short) return <span className="text-ink-subtle">—</span>
  return (
    <Tooltip content={f.long}>
      <span tabIndex={0} className="truncate rounded text-ink-2 outline-none focus-visible:ring-2 focus-visible:ring-brand/40">
        {f.short}
      </span>
    </Tooltip>
  )
}

/** Photo thumbnail: the stored file, or a neutral placeholder while it has not been copied from Circonomy. */
function Thumb({ photo, label, size = 'sm' }: { photo: Photo | null; label: string; size?: 'sm' | 'lg' }) {
  const box = size === 'lg' ? 'size-16 rounded-xl' : 'size-9 rounded-lg'
  if (photo?.stored) {
    return (
      <a
        href={`/admin/files/${photo.id}`}
        target="_blank"
        rel="noreferrer"
        className={cn('block shrink-0 overflow-hidden bg-muted outline-none focus-visible:ring-2 focus-visible:ring-brand/40', box)}
        aria-label={`Open photo of ${label}`}
      >
        {/* Private file route behind admin auth; next/image cannot optimise it. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`/admin/files/${photo.id}`} alt="" loading="lazy" className="size-full object-cover" />
      </a>
    )
  }
  const text = photo ? 'Photo not copied yet' : 'No photo'
  return (
    <Tooltip content={text}>
      <span tabIndex={0} className={cn('flex shrink-0 items-center justify-center bg-muted text-ink-subtle outline-none focus-visible:ring-2 focus-visible:ring-brand/40', box)} aria-label={text}>
        {photo ? <ImageOff className="size-4" /> : <Camera className="size-4" />}
      </span>
    </Tooltip>
  )
}

function Thumbed({ photo, title, sub }: { photo: Photo | null; title: string; sub?: string }) {
  return (
    <span className="flex min-w-0 items-center gap-2.5">
      <Thumb photo={photo} label={title} />
      <span className="min-w-0">
        <span className="block truncate font-semibold">{title}</span>
        {sub && <span className="block truncate text-xs text-ink-muted">{sub}</span>}
      </span>
    </span>
  )
}

function KilnCard({ kiln: k, extra, loading }: { kiln: Kiln; extra?: NetworkExtras['kilns'][number]; loading: boolean }) {
  const { updateKiln } = useDashboard()
  const dims = extra ? formatDims(extra.dimensions) : null
  const volumeL = extra?.volumeL ?? (k.volumeM3 != null ? Math.round(k.volumeM3 * 1000) : null)
  return (
    <div className={cn('flex gap-3 rounded-xl border p-3', k.active ? 'border-line' : 'border-dashed border-line-strong')}>
      {loading ? <div className="size-16 shrink-0 animate-pulse rounded-xl bg-muted" /> : <Thumb photo={extra?.photo ?? null} label={k.name} size="lg" />}
      <div className="min-w-0 flex-1">
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <div className={cn('truncate text-sm font-semibold', !k.active && 'text-ink-muted')}>{k.name}</div>
            <div className="truncate text-xs text-ink-muted">{k.code || 'No code'}</div>
          </div>
          <Switch
            checked={k.active}
            onCheckedChange={(active) => updateKiln(k.id, { active })}
            aria-label={`${k.name} in service`}
            title={k.active ? 'In service — switch off to mark out of service' : 'Out of service — switch on to mark in service'}
          />
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <Badge tone="artisan">{KILN_TYPE[k.type]}</Badge>
          {extra?.shape && <Badge tone="neutral">{shapeLabel(extra.shape)}</Badge>}
          {!k.active && <Badge tone="neutral">Out of service</Badge>}
        </div>
        <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-xs tabular-nums">
          <dt className="text-ink-muted">Size</dt>
          <dd className="min-w-0 truncate text-ink-2">
            {loading ? <span className="inline-block h-3 w-24 animate-pulse rounded bg-muted align-middle" /> : dims?.short ? <DimsText d={extra!.dimensions} /> : '—'}
          </dd>
          <dt className="text-ink-muted">Volume</dt>
          <dd className="text-ink-2">{litres(volumeL)}</dd>
        </dl>
      </div>
    </div>
  )
}
