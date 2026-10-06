'use client'

import { Globe2 } from 'lucide-react'
import dynamic from 'next/dynamic'
import { useState } from 'react'

import { Card, Checkbox, Switch } from '../components/ui'
import { selectedNetworks, selectedSites } from '../data/selectors'
import { useDashboard } from '../data/store'
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

export function ActivityMap() {
  const { data, filters } = useDashboard()
  const [labels, setLabels] = useState(false)
  const [layers, setLayers] = useState<Layer[]>(['artisan', 'csink', 'site', 'kiln', 'farmer'])

  const networks = selectedNetworks(data, filters)
  const sites = selectedSites(data, filters)
  const siteIds = new Set(sites.map((s) => s.id))
  const netIds = new Set(networks.map((n) => n.id))

  type Maybe = Omit<MapPoint, 'lat' | 'lng'> & { lat: number | null | undefined; lng: number | null | undefined }
  const located = (p: Maybe): p is MapPoint => p.lat != null && p.lng != null
  // Places without known coordinates are left off the map.
  const all: MapPoint[] = ([
    ...networks.map((n) => ({ id: n.id, kind: n.type, lat: n.lat, lng: n.lng, label: n.name, sub: n.location, active: n.active })),
    ...sites.map((s) => ({ id: s.id, kind: 'site' as const, lat: s.lat, lng: s.lng, label: s.name, sub: 'Site', active: s.active })),
    ...data.kilns
      .filter((k) => siteIds.has(k.siteId))
      .map((k) => ({ id: k.id, kind: 'kiln' as const, lat: k.lat, lng: k.lng, label: k.name, sub: data.sites.find((s) => s.id === k.siteId)?.name, active: k.active })),
    ...data.users
      .filter((u) => u.role === 'farmer' && u.lat != null && u.networkIds.some((id) => netIds.has(id)))
      .map((u) => ({ id: u.id, kind: 'farmer' as const, lat: u.lat!, lng: u.lng!, label: u.name, sub: 'Farmer', active: u.active })),
  ] as Maybe[]).filter(located)
  const counts = Object.fromEntries(LAYERS.map((l) => [l.key, all.filter((p) => p.kind === l.key).length])) as Record<Layer, number>
  const points = all.filter((p) => layers.includes(p.kind))

  return (
    <Card className="p-3 sm:p-4">
      <div className="flex flex-wrap items-center gap-3">
        <Globe2 className="size-4 text-ink-muted" />
        <h2 className="text-base font-semibold">Where the work happens</h2>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <label className="flex h-9 cursor-pointer items-center gap-2 rounded-lg border border-line px-3 text-xs font-semibold">
            <Switch checked={labels} onCheckedChange={setLabels} className="h-5 w-9 [&>span]:size-4 [&>span]:data-[state=checked]:translate-x-[18px]" />
            Labels
          </label>
          {LAYERS.map((l) => (
            <label key={l.key} className="flex h-9 cursor-pointer items-center gap-2 rounded-lg border border-line px-3 text-xs font-semibold">
              <Checkbox
                checked={layers.includes(l.key)}
                onCheckedChange={(on) => setLayers((ls) => (on ? [...ls, l.key] : ls.filter((x) => x !== l.key)))}
                className="size-4"
              />
              {l.label}
              <span className="font-semibold text-ink-subtle">{counts[l.key]}</span>
            </label>
          ))}
        </div>
      </div>
      <div className="mt-4 h-[420px]">
        <MapView points={points} labels={labels} />
      </div>
    </Card>
  )
}
