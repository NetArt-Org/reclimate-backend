'use client'

import {
  ArrowDownRight,
  ArrowUpRight,
  ArrowUpRight as Open,
  Award,
  CloudRain,
  Flame,
  Info,
  Sprout,
} from 'lucide-react'
import Link from 'next/link'
import type { ReactNode } from 'react'

import { Card, Tooltip } from '../components/ui'
import { comparison, kpis, type Metric } from '../data/selectors'
import { useDashboard } from '../data/store'
import { cn, num } from '../lib/utils'

/**
 * Where each card leads — the same screens as the Circonomy admin (the place selected on the map is carried over):
 * biochar → production & quality analytics, CO₂ and credits → projects portfolio, biomass → biomass collection analytics.
 */
const REPORT: Record<Metric, { path: string; tab?: string; name: string }> = {
  biochar: { path: '/admin/production', name: 'production' },
  co2: { path: '/admin/portfolio', name: 'projects portfolio' },
  credits: { path: '/admin/portfolio', name: 'projects portfolio' },
  biomass: { path: '/admin/production', tab: 'collections', name: 'biomass collection' },
}

const CARDS: {
  key: Metric
  label: ReactNode
  unit: string
  icon: ReactNode
  color: string
  help: string
}[] = [
  {
    key: 'biochar',
    label: 'Biochar produced',
    unit: 't',
    icon: <Flame />,
    color: '#e07a2e',
    help: 'Dry biochar from all burns in the selection.',
  },
  {
    key: 'co2',
    label: <>CO₂ removed</>,
    unit: 'tCO₂',
    icon: <CloudRain />,
    color: '#2a64b8',
    help: 'Total carbon sink (C-sink) of that biochar.',
  },
  {
    key: 'credits',
    label: 'Credits',
    unit: 'tCO₂e',
    icon: <Award />,
    color: '#1f5a3d',
    help: 'C-sink 1000+ credits. Cut-off and vintage filters apply here.',
  },
  {
    key: 'biomass',
    label: 'Biomass processed',
    unit: 't',
    icon: <Sprout />,
    color: '#1b8a8a',
    help: 'Raw feedstock that went into the kilns.',
  },
]

export function KpiCards() {
  const { data, filters, setFilters } = useDashboard()
  // Production pages take the place from the URL; the portfolio reads the shared filters directly.
  const scope = new URLSearchParams()
  if (filters.networkIds.length === 1) scope.set('network', filters.networkIds[0])
  if (filters.siteIds.length === 1) scope.set('site', filters.siteIds[0])
  const href = (path: string, tab?: string) => {
    const q = new URLSearchParams(path.endsWith('production') ? scope : undefined)
    if (tab) q.set('tab', tab)
    return q.size ? `${path}?${q}` : path
  }
  const k = kpis(data, filters)
  const cmp = comparison(data, filters)
  const values: Record<Metric, number> = {
    biochar: k.biocharT,
    co2: k.co2T,
    credits: k.creditsT,
    biomass: k.biomassT,
  }
  const creditNote = [
    filters.cutoff && 'after cut-off',
    filters.vintages.length && `vintage ${filters.vintages.join(', ')}`,
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <div className="flex flex-col gap-3 sm:gap-4">
      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        {CARDS.map((c) => {
          const m = cmp.metrics[c.key]
          const report = REPORT[c.key]
          return (
            <Link
              key={c.key}
              href={href(report.path, report.tab)}
              aria-label={`${typeof c.label === 'string' ? c.label : 'CO₂ removed'}: open ${report.name}`}
              className="group rounded-card outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
            >
              <Card className="flex h-full flex-col p-3 transition-colors group-hover:border-line-strong group-hover:shadow-sm sm:p-4">
                <div className="flex items-center gap-2 text-sm font-medium text-ink-muted">
                  <span
                    className="flex size-8 items-center justify-center rounded-lg [&_svg]:size-4"
                    style={{ background: `${c.color}14`, color: c.color }}
                  >
                    {c.icon}
                  </span>
                  <span className="truncate">{c.label}</span>
                  <span className="ml-auto flex items-center gap-1.5">
                    <span className="hidden sm:inline-flex">
                      <Delta value={m.delta} label={cmp.label} />
                    </span>
                    <Tooltip content={c.help}>
                      <Info className="size-3.5 text-ink-subtle" aria-label={c.help} />
                    </Tooltip>
                  </span>
                </div>
                <div className="mt-3 flex items-end justify-between gap-2 sm:mt-4">
                  <div className="text-xl leading-none font-bold tracking-tight tabular-nums sm:text-[26px]">
                    {num(values[c.key], values[c.key] >= 1000 ? 0 : 1)}
                    <span className="ml-1.5 text-sm font-medium text-ink-muted">{c.unit}</span>
                  </div>
                  <span className="hidden sm:block">
                    <Sparkline values={m.spark} color={c.color} />
                  </span>
                </div>
                <div className="mt-auto flex items-center gap-1 pt-2 text-xs font-semibold text-ink-subtle group-hover:text-brand">
                  View {report.name} <Open className="size-3" />
                </div>
                {c.key === 'credits' && creditNote && (
                  <div className="mt-2 w-fit rounded-md bg-brand-soft px-2 py-0.5 text-xs font-semibold text-brand">
                    {creditNote}
                  </div>
                )}
              </Card>
            </Link>
          )
        })}
      </div>

      {/* As in Circonomy: the network tiles narrow the whole overview to that network type (click again for both). */}
      <Card className="grid grid-cols-2 divide-line overflow-hidden sm:grid-cols-4 sm:divide-x">
        <Stat
          label="Artisan Pro networks"
          value={k.artisanNetworks}
          sub={`${k.artisanSites} sites`}
          active={filters.networkType === 'artisan'}
          onClick={() => setFilters({ networkType: filters.networkType === 'artisan' ? null : 'artisan', networkIds: [], siteIds: [] })}
        />
        <Stat
          label="C-sink networks"
          value={k.csinkNetworks}
          sub={`${k.farmers} active farmers`}
          active={filters.networkType === 'csink'}
          onClick={() => setFilters({ networkType: filters.networkType === 'csink' ? null : 'csink', networkIds: [], siteIds: [] })}
        />
        <Stat label="Sites" value={k.sites} sub="in this selection" />
        <Stat label="Kilns" value={k.activeKilns} sub="active" />
      </Card>
    </div>
  )
}

function Stat({
  label,
  value,
  sub,
  active,
  onClick,
}: {
  label: string
  value: number
  sub: string
  active?: boolean
  onClick?: () => void
}) {
  const body = (
    <>
      <div className="text-xs font-medium text-ink-muted">{label}</div>
      <div className="mt-1 flex items-baseline gap-2">
        <span className="text-xl font-bold tabular-nums">{value}</span>
        <span className="truncate text-xs text-ink-subtle">{sub}</span>
      </div>
    </>
  )
  if (!onClick) return <div className="px-3 py-3 sm:px-4">{body}</div>
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'block cursor-pointer px-3 py-3 text-left outline-none transition-colors hover:bg-muted/70 focus-visible:bg-muted sm:px-4',
        active && 'bg-brand-soft hover:bg-brand-soft',
      )}
    >
      {body}
    </button>
  )
}

/** Change against the previous period, as a small pill; the comparison is explained on hover. */
function Delta({ value, label }: { value: number | null; label: string }) {
  if (value == null) return null
  const up = value >= 0
  return (
    <Tooltip content={`${up ? 'Up' : 'Down'} ${Math.abs(value) > 999 ? '>999' : Math.abs(value).toFixed(1)}% · ${label}`}>
      <span
        className={cn(
          'flex items-center rounded-md px-1.5 py-0.5 text-xs font-semibold tabular-nums',
          up ? 'bg-success-soft text-success' : 'bg-danger-soft text-danger',
        )}
      >
        {up ? <ArrowUpRight className="size-3" /> : <ArrowDownRight className="size-3" />}
        {Math.abs(value) > 999 ? '>999' : Math.abs(value).toFixed(1)}%
      </span>
    </Tooltip>
  )
}

/** Tiny trend line for a KPI card. */
function Sparkline({ values, color }: { values: number[]; color: string }) {
  if (values.length < 2) return null
  const w = 96
  const h = 36
  const max = Math.max(...values, 1e-9)
  const pts = values.map(
    (v, i) => `${(i / (values.length - 1)) * w},${h - 2 - (v / max) * (h - 4)}`,
  )
  const id = `sp-${color.slice(1)}`
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="shrink-0" aria-hidden>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.25} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      <polygon points={`0,${h} ${pts.join(' ')} ${w},${h}`} fill={`url(#${id})`} />
      <polyline
        points={pts.join(' ')}
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  )
}
