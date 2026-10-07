'use client'

import { Globe2, Layers, MousePointerClick, X } from 'lucide-react'
import dynamic from 'next/dynamic'
import { useState } from 'react'

import { Button, Card, Checkbox, Popover, PopoverContent, PopoverTrigger, Switch } from '../components/ui'
import { scopedNetworks } from '../data/selectors'
import { useDashboard } from '../data/store'
import { cn } from '../lib/utils'
import type { MapPoint } from './MapView'

// Leaflet touches `window`, so the map only renders in the browser.
const MapView = dynamic(() => import('./MapView').then((m) => m.MapView), {
  ssr: false,
  loading: () => <div className="size-full animate-pulse rounded-2xl bg-muted" />,
})

const LAYERS = [
  { key: 'artisan', label: 'Artisan Pro' },
  { key: 'csink', label: 'C-sink Network' },
  { key: 'site', label: 'Sites' },
  { key: 'kiln', label: 'Kilns' },
  { key: 'farmer', label: 'Farmers' },
] as const
type Layer = (typeof LAYERS)[number]['key']

/**
 * Map of every network in the current organisation/type scope. Clicking a network, site, kiln or farmer
 * selects that place — the KPIs, chart and capture status follow — and clicking it again clears it.
 */
export function ActivityMap({ className }: { className?: string }) {
  const { data, filters, setFilters } = useDashboard()
  const [labels, setLabels] = useState(false)
  const [layers, setLayers] = useState<Layer[]>(['artisan', 'csink', 'site', 'kiln', 'farmer'])

  const networks = scopedNetworks(data, filters)
  const netIds = new Set(networks.map((n) => n.id))
  const sites = data.sites.filter((s) => netIds.has(s.networkId))
  const siteIds = new Set(sites.map((s) => s.id))
  const siteNet = new Map(sites.map((s) => [s.id, s.networkId]))

  type Maybe = Omit<MapPoint, 'lat' | 'lng'> & { lat: number | null | undefined; lng: number | null | undefined }
  // (0, 0) is a missing-location placeholder in the migrated data, not a real place.
  const located = (p: Maybe): p is MapPoint => p.lat != null && p.lng != null && !(p.lat === 0 && p.lng === 0)
  // Places without known coordinates are left off the map.
  const all: MapPoint[] = (
    [
      ...networks.map((n) => ({ id: n.id, kind: n.type, lat: n.lat, lng: n.lng, label: n.name, sub: n.location, active: n.active })),
      ...sites.map((s) => ({ id: s.id, kind: 'site' as const, lat: s.lat, lng: s.lng, label: s.name, sub: 'Site', active: s.active })),
      ...data.kilns
        .filter((k) => siteIds.has(k.siteId))
        .map((k) => ({ id: k.id, kind: 'kiln' as const, lat: k.lat, lng: k.lng, label: k.name, sub: data.sites.find((s) => s.id === k.siteId)?.name, active: k.active })),
      ...data.users
        .filter((u) => u.role === 'farmer' && u.lat != null && u.networkIds.some((id) => netIds.has(id)))
        .map((u) => ({ id: u.id, kind: 'farmer' as const, lat: u.lat!, lng: u.lng!, label: u.name, sub: 'Farmer', active: u.active })),
    ] as Maybe[]
  ).filter(located)
  const counts = Object.fromEntries(LAYERS.map((l) => [l.key, all.filter((p) => p.kind === l.key).length])) as Record<Layer, number>
  const points = all.filter((p) => layers.includes(p.kind))

  // Current selection, as map ids.
  const selected = new Set<string>([...filters.siteIds, ...(filters.siteIds.length ? [] : filters.networkIds)])
  const selectedLabel = filters.siteIds.length
    ? filters.siteIds.map((id) => data.sites.find((s) => s.id === id)?.name).filter(Boolean).join(', ')
    : filters.networkIds.map((id) => data.networks.find((n) => n.id === id)?.name).filter(Boolean).join(', ')

  const clear = () => setFilters({ networkIds: [], siteIds: [] })
  const select = (p: MapPoint) => {
    if (selected.has(p.id)) return clear()
    if (p.kind === 'artisan' || p.kind === 'csink') return setFilters({ networkIds: [p.id], siteIds: [] })
    const siteId = p.kind === 'site' ? p.id : p.kind === 'kiln' ? data.kilns.find((k) => k.id === p.id)?.siteId : undefined
    if (siteId) {
      if (selected.has(siteId)) return clear()
      return setFilters({ networkIds: [siteNet.get(siteId)!], siteIds: [siteId] })
    }
    // A farmer: select their network.
    const net = data.users.find((u) => u.id === p.id)?.networkIds.find((id) => netIds.has(id))
    if (net) setFilters({ networkIds: [net], siteIds: [] })
  }

  return (
    <Card className={cn('flex min-h-[360px] flex-col p-3 sm:p-4', className)}>
      <div className="flex flex-wrap items-center gap-2">
        <Globe2 className="size-4 text-ink-muted" />
        <h2 className="text-sm font-semibold">Where the work happens</h2>
        <div className="ml-auto flex items-center gap-1.5">
          <Popover>
            <PopoverTrigger asChild>
              <Button size="sm">
                <Layers /> Layers
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-56 p-1.5">
              <label className="flex cursor-pointer items-center justify-between rounded-lg px-2.5 py-2 text-sm font-medium hover:bg-muted">
                Labels
                <Switch checked={labels} onCheckedChange={setLabels} className="h-5 w-9 [&>span]:size-4 [&>span]:data-[state=checked]:translate-x-[18px]" />
              </label>
              {LAYERS.map((l) => (
                <label key={l.key} className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm hover:bg-muted">
                  <Checkbox
                    checked={layers.includes(l.key)}
                    onCheckedChange={(on) => setLayers((ls) => (on ? [...ls, l.key] : ls.filter((x) => x !== l.key)))}
                    className="size-4"
                  />
                  <span className="flex-1">{l.label}</span>
                  <span className="text-xs font-semibold text-ink-subtle tabular-nums">{counts[l.key]}</span>
                </label>
              ))}
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {/* What the numbers next to the map are showing. */}
      <div className="mt-2 flex min-h-8 items-center gap-2 text-xs">
        {selected.size ? (
          <>
            <span className="text-ink-muted">Showing</span>
            <span className="inline-flex min-w-0 items-center gap-1 rounded-md bg-brand-soft py-1 pr-1 pl-2 font-semibold text-brand">
              <span className="truncate">{selectedLabel}</span>
              <button type="button" onClick={clear} aria-label="Clear map selection" className="flex size-5 cursor-pointer items-center justify-center rounded hover:bg-brand/10">
                <X className="size-3.5" />
              </button>
            </span>
          </>
        ) : (
          <span className="flex items-center gap-1.5 text-ink-muted">
            <MousePointerClick className="size-3.5" /> Click a network, site or kiln to focus the numbers on it.
          </span>
        )}
      </div>

      <div className="mt-2 min-h-[280px] flex-1">
        <MapView points={points} labels={labels} onSelect={select} selected={selected} />
      </div>
    </Card>
  )
}
