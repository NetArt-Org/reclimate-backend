'use client'

import 'leaflet/dist/leaflet.css'

import L from 'leaflet'
import { Crosshair, Maximize2, Minimize2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { CircleMarker, MapContainer, Polygon, TileLayer, Tooltip, useMap } from 'react-leaflet'

import { cn } from '../lib/utils'

export interface MapPoint {
  id: string
  kind: 'artisan' | 'csink' | 'site' | 'kiln' | 'farmer'
  lat: number
  lng: number
  label: string
  sub?: string
  active: boolean
}

const STYLE: Record<MapPoint['kind'], { color: string; radius: number }> = {
  artisan: { color: '#c4472f', radius: 10 },
  csink: { color: '#2f6fd6', radius: 10 },
  site: { color: '#1f5a3d', radius: 7 },
  kiln: { color: '#f08a3c', radius: 5 },
  farmer: { color: '#7c4dbe', radius: 5 },
}

// Free tiles, no API key: OpenStreetMap streets and Esri imagery.
const TILES = {
  map: { url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', attribution: '&copy; OpenStreetMap contributors' },
  satellite: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Imagery &copy; Esri',
  },
}

function FitBounds({ points, polygons, trigger }: { points: MapPoint[]; polygons: [number, number][][]; trigger: number }) {
  const map = useMap()
  useEffect(() => {
    const all = [...points.map((p) => [p.lat, p.lng] as [number, number]), ...polygons.flat()]
    if (all.length) map.fitBounds(L.latLngBounds(all), { padding: [40, 40], maxZoom: 11 })
    // Refit only when asked (initial load / recenter button / data set changes size).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, trigger, points.length, polygons.length])
  return null
}

function InvalidateOnResize({ dep }: { dep: unknown }) {
  const map = useMap()
  useEffect(() => {
    const t = setTimeout(() => map.invalidateSize(), 120)
    return () => clearTimeout(t)
  }, [map, dep])
  return null
}

/** Points (and optional KML boundaries) on a street / satellite map. */
export function MapView({
  points,
  labels = false,
  polygons = [],
  legend = true,
}: {
  points: MapPoint[]
  labels?: boolean
  polygons?: [number, number][][]
  legend?: boolean
}) {
  const [base, setBase] = useState<keyof typeof TILES>('map')
  const [full, setFull] = useState(false)
  const [fit, setFit] = useState(0)
  const box = useRef<HTMLDivElement>(null)

  return (
    <div ref={box} className={cn('relative size-full overflow-hidden rounded-2xl border border-line', full && 'fixed inset-4 z-40 size-auto shadow-2xl')}>
      <MapContainer center={[2, 108]} zoom={5} scrollWheelZoom className="size-full" zoomControl={false}>
        <TileLayer key={base} url={TILES[base].url} attribution={TILES[base].attribution} />
        <FitBounds points={points} polygons={polygons} trigger={fit} />
        <InvalidateOnResize dep={full} />
        {polygons.map((ring, i) => (
          <Polygon key={i} positions={ring} pathOptions={{ color: '#1f5a3d', weight: 2, fillOpacity: 0.15 }} />
        ))}
        {points.map((p) => {
          const s = STYLE[p.kind]
          return (
            <CircleMarker
              key={`${p.kind}-${p.id}-${labels}`}
              center={[p.lat, p.lng]}
              radius={s.radius}
              pathOptions={{ color: '#fff', weight: 2, fillColor: s.color, fillOpacity: p.active ? 0.95 : 0.35 }}
            >
              <Tooltip direction="top" offset={[0, -s.radius]} permanent={labels && (p.kind === 'artisan' || p.kind === 'csink' || p.kind === 'site')} className="map-label">
                {p.label}
                {!labels && p.sub ? <span className="font-normal text-ink-muted"> · {p.sub}</span> : null}
                {!p.active && <span className="font-normal text-danger"> · inactive</span>}
              </Tooltip>
            </CircleMarker>
          )
        })}
      </MapContainer>

      <div className="absolute top-3 left-3 z-[400] flex overflow-hidden rounded-xl bg-white shadow-md">
        {(['map', 'satellite'] as const).map((b) => (
          <button
            key={b}
            type="button"
            onClick={() => setBase(b)}
            className={cn('cursor-pointer px-3.5 py-2 text-sm font-semibold capitalize', base === b ? 'bg-ink text-white' : 'text-ink-2 hover:bg-muted')}
          >
            {b}
          </button>
        ))}
      </div>
      <div className="absolute top-3 right-3 z-[400] flex flex-col gap-2">
        <button type="button" onClick={() => setFull((f) => !f)} aria-label={full ? 'Exit full screen' : 'Full screen'} className="flex size-9 cursor-pointer items-center justify-center rounded-xl bg-white shadow-md hover:bg-muted">
          {full ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
        </button>
        <button type="button" onClick={() => setFit((n) => n + 1)} aria-label="Show everything" className="flex size-9 cursor-pointer items-center justify-center rounded-xl bg-white shadow-md hover:bg-muted">
          <Crosshair className="size-4" />
        </button>
      </div>
      {legend && (
        <div className="absolute bottom-4 left-3 z-[400] rounded-2xl bg-white/95 px-4 py-3 shadow-md">
          <div className="mb-1.5 text-[11px] font-bold tracking-[.12em] text-ink-muted uppercase">Legend</div>
          <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs font-semibold">
            {(
              [
                ['artisan', 'Artisan Pro'],
                ['csink', 'C-sink'],
                ['site', 'Site'],
                ['kiln', 'Kiln'],
                ['farmer', 'Farmer'],
              ] as const
            ).map(([k, label]) => (
              <span key={k} className="flex items-center gap-1.5">
                <span className="size-2.5 rounded-full" style={{ background: STYLE[k].color }} />
                {label}
              </span>
            ))}
          </div>
        </div>
      )}
      {points.length === 0 && polygons.length === 0 && (
        <div className="absolute inset-0 z-[400] flex items-center justify-center bg-white/60 text-sm font-semibold text-ink-muted">
          Nothing to show for this selection
        </div>
      )}
    </div>
  )
}
