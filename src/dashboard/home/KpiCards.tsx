'use client'

import { ArrowDownRight, ArrowUpRight, Award, CloudRain, Flame, Info, Sprout } from 'lucide-react'
import type { ReactNode } from 'react'

import { Card, Tooltip } from '../components/ui'
import { comparison, kpis, type Metric } from '../data/selectors'
import { useDashboard } from '../data/store'
import { cn, num } from '../lib/utils'

const CARDS: { key: Metric; label: ReactNode; unit: string; icon: ReactNode; color: string; help: string }[] = [
  { key: 'biochar', label: 'Biochar produced', unit: 't', icon: <Flame />, color: '#e07a2e', help: 'Dry biochar from all burns in the selection.' },
  { key: 'co2', label: <>CO₂ removed</>, unit: 'tCO₂', icon: <CloudRain />, color: '#2a64b8', help: 'Total carbon sink (C-sink) of that biochar.' },
  { key: 'credits', label: 'Credits', unit: 'tCO₂e', icon: <Award />, color: '#1f5a3d', help: 'C-sink 1000+ credits. Cut-off and vintage filters apply here.' },
  { key: 'biomass', label: 'Biomass processed', unit: 't', icon: <Sprout />, color: '#1b8a8a', help: 'Raw feedstock that went into the kilns.' },
]

export function KpiCards() {
  const { data, filters } = useDashboard()
  const k = kpis(data, filters)
  const cmp = comparison(data, filters)
  const values: Record<Metric, number> = { biochar: k.biocharT, co2: k.co2T, credits: k.creditsT, biomass: k.biomassT }
  const creditNote = [filters.cutoff && 'after cut-off', filters.vintages.length && `vintage ${filters.vintages.join(', ')}`].filter(Boolean).join(' · ')

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {CARDS.map((c) => {
          const m = cmp.metrics[c.key]
          return (
            <Card key={c.key} className="flex flex-col p-3 sm:p-4">
              <div className="flex items-center gap-2 text-sm font-medium text-ink-muted">
                <span className="flex size-8 items-center justify-center rounded-lg [&_svg]:size-4" style={{ background: `${c.color}14`, color: c.color }}>
                  {c.icon}
                </span>
                <span className="truncate">{c.label}</span>
                <span className="ml-auto flex items-center gap-1.5">
                  <Delta value={m.delta} label={cmp.label} />
                  <Tooltip content={c.help}>
                    <Info className="size-3.5 text-ink-subtle" aria-label={c.help} />
                  </Tooltip>
                </span>
              </div>
              <div className="mt-5 flex items-end justify-between gap-3">
                <div className="text-[28px] leading-none font-bold tracking-tight tabular-nums">
                  {num(values[c.key], values[c.key] >= 1000 ? 0 : 1)}
                  <span className="ml-1.5 text-sm font-medium text-ink-muted">{c.unit}</span>
                </div>
                <Sparkline values={m.spark} color={c.color} />
              </div>
              {c.key === 'credits' && creditNote && <div className="mt-3 w-fit rounded-md bg-brand-soft px-2 py-0.5 text-xs font-semibold text-brand">{creditNote}</div>}
            </Card>
          )
        })}
      </div>

      <Card className="grid grid-cols-2 divide-line md:grid-cols-4 md:divide-x">
        <Stat label="Artisan Pro networks" value={k.artisanNetworks} sub={`${k.artisanSites} sites`} />
        <Stat label="C-sink networks" value={k.csinkNetworks} sub={`${k.farmers} active farmers`} />
        <Stat label="Sites" value={k.sites} sub="in this selection" />
        <Stat label="Kontiki kilns" value={k.activeKilns} sub="active" />
      </Card>
    </div>
  )
}

function Stat({ label, value, sub }: { label: string; value: number; sub: string }) {
  return (
    <div className="px-3 py-3 sm:px-4">
      <div className="text-xs font-medium text-ink-muted">{label}</div>
      <div className="mt-1 flex items-baseline gap-2">
        <span className="text-xl font-bold tabular-nums">{value}</span>
        <span className="text-xs text-ink-subtle">{sub}</span>
      </div>
    </div>
  )
}

/** Change against the previous period, as a small pill; the comparison is explained on hover. */
function Delta({ value, label }: { value: number | null; label: string }) {
  if (value == null) return null
  const up = value >= 0
  return (
    <Tooltip content={`${up ? 'Up' : 'Down'} ${Math.abs(value).toFixed(1)}% · ${label}`}>
      <span
        className={cn(
          'flex items-center rounded-md px-1.5 py-0.5 text-xs font-semibold tabular-nums',
          up ? 'bg-success-soft text-success' : 'bg-danger-soft text-danger',
        )}
      >
        {up ? <ArrowUpRight className="size-3" /> : <ArrowDownRight className="size-3" />}
        {Math.abs(value).toFixed(1)}%
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
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * w},${h - 2 - (v / max) * (h - 4)}`)
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
      <polyline points={pts.join(' ')} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  )
}
