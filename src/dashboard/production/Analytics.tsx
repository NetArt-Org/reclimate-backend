'use client'

import { BarChart3, CircleCheck, CircleSlash, Clock3, Layers, PieChart as PieIcon, Sprout } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

import { Card, EmptyState, Segmented } from '../components/ui'
import { num } from '../lib/utils'
import type { BatchStats, CollectionStats } from '../server/production-stats'

/** Charts show at most the latest 12 months of the filtered records. */
const LAST = 12
const monthLabel = (m: string, long = false) =>
  new Date(`${m}-01T00:00:00Z`).toLocaleDateString('en-GB', { timeZone: 'UTC', month: long ? 'long' : 'short', year: long ? 'numeric' : '2-digit' })

/** Axis ticks stay short (1.2k, 35k) so they never get clipped. */
const compact = (v: number) => new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(v)

const axis = { tick: { fontSize: 11, fill: '#6b726d' }, axisLine: false, tickLine: false } as const
const tooltipStyle = { borderRadius: 12, border: '1px solid #e3e7e1', boxShadow: '0 8px 24px rgb(0 0 0 / 0.08)', fontSize: 12 }

function Panel({ icon, title, sub, actions, children, className }: { icon: ReactNode; title: string; sub?: string; actions?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <Card className={`flex min-w-0 flex-col p-3 sm:p-4 ${className ?? ''}`}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-ink-muted [&_svg]:size-4">{icon}</span>
        <h2 className="text-sm font-semibold">{title}</h2>
        {sub && <span className="text-xs text-ink-subtle">{sub}</span>}
        {actions && <div className="ml-auto">{actions}</div>}
      </div>
      {children}
    </Card>
  )
}

/* ------------------------------------------------------------------ batches */

const QUALITY = [
  { key: 'approved', label: 'Approved', color: '#23804d', icon: CircleCheck },
  { key: 'pending', label: 'Pending', color: '#e0a33a', icon: Clock3 },
  { key: 'rejected', label: 'Rejected', color: '#c03a2b', icon: CircleSlash },
] as const

const PRODUCTION = [
  { key: 'biomass', label: 'Biomass', unit: 't', color: '#1b8a8a', axis: 'left' },
  { key: 'biochar', label: 'Biochar', unit: 't', color: '#e07a2e', axis: 'left' },
  { key: 'credits', label: 'Credits', unit: 'tCO₂e', color: '#1f5a3d', axis: 'right' },
] as const

/** Production & quality assessment: biochar by outcome, the outcome split, and production & credits per month. */
export function BatchAnalytics({ stats }: { stats: BatchStats }) {
  const [unit, setUnit] = useState<'m3' | 't'>('m3')
  const q = stats.quality
  const total = q.approved[unit] + q.pending[unit] + q.rejected[unit]
  const u = unit === 'm3' ? 'm³' : 't'
  const months = stats.months.slice(-LAST)
  const pie = QUALITY.map((s) => ({ name: s.label, value: q[s.key][unit], color: s.color })).filter((s) => s.value > 0)

  return (
    <div className="flex flex-col gap-3 sm:gap-4">
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <Tile label="Total biochar" value={total} unit={u} icon={<Layers />} color="#3b3f3c" action={
          <Segmented<'m3' | 't'> value={unit} onChange={setUnit} options={[{ value: 'm3', label: 'm³' }, { value: 't', label: 't' }]} />
        } />
        {QUALITY.map((s) => (
          <Tile key={s.key} label={s.label} value={q[s.key][unit]} unit={u} icon={<s.icon />} color={s.color} share={total ? (q[s.key][unit] / total) * 100 : 0} />
        ))}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <Panel icon={<PieIcon />} title="Quality assessment">
          {pie.length ? (
            <div className="relative mt-2 h-56">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie isAnimationActive={false} data={pie} dataKey="value" nameKey="name" innerRadius="58%" outerRadius="85%" paddingAngle={1.5} stroke="none">
                    {pie.map((p) => (
                      <Cell key={p.name} fill={p.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v) => `${num(Number(v), 2)} ${u}`} contentStyle={tooltipStyle} />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-x-0 top-[calc(50%-14px)] -translate-y-1/2 text-center">
                <div className="text-lg font-bold tabular-nums">{total ? ((q.approved[unit] / total) * 100).toFixed(0) : 0}%</div>
                <div className="text-[11px] text-ink-subtle">approved</div>
              </div>
            </div>
          ) : (
            <EmptyState icon={<PieIcon />} title="No batches" sub="Nothing matches these filters." />
          )}
        </Panel>

        <Panel icon={<BarChart3 />} title="Production & credits" sub={months.length ? `${monthLabel(months[0].month, true)} – ${monthLabel(months[months.length - 1].month, true)}` : undefined}>
          {months.length ? (
            <div className="mt-2 h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={months} margin={{ top: 6, right: 0, left: 0, bottom: 0 }} barGap={2} barCategoryGap="22%">
                  <CartesianGrid stroke="#e9ede7" vertical={false} />
                  <XAxis dataKey="month" tickFormatter={(m) => monthLabel(String(m))} minTickGap={8} {...axis} />
                  <YAxis yAxisId="left" width={40} tickFormatter={compact} {...axis} />
                  <YAxis yAxisId="right" orientation="right" width={40} tickFormatter={compact} {...axis} />
                  <Tooltip
                    cursor={{ fill: '#f2f4f1' }}
                    labelFormatter={(m) => monthLabel(String(m), true)}
                    formatter={(v, name) => {
                      const s = PRODUCTION.find((p) => p.key === name)!
                      return [`${num(Number(v), 2)} ${s.unit}`, s.label]
                    }}
                    contentStyle={tooltipStyle}
                  />
                  {PRODUCTION.map((s) => (
                    <Bar isAnimationActive={false} key={s.key} yAxisId={s.axis} dataKey={s.key} fill={s.color} radius={[3, 3, 0, 0]} maxBarSize={18} />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <EmptyState icon={<BarChart3 />} title="No production" sub="Nothing matches these filters." />
          )}
          <div className="mt-2 flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs text-ink-muted">
            {PRODUCTION.map((s) => (
              <span key={s.key} className="flex items-center gap-1.5">
                <span className="size-2.5 rounded-full" style={{ background: s.color }} />
                {s.label}: {num(months.reduce((t, m) => t + m[s.key], 0), 1)} {s.unit}
              </span>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  )
}

function Tile({ label, value, unit, icon, color, share, action }: { label: string; value: number; unit: string; icon: ReactNode; color: string; share?: number; action?: ReactNode }) {
  return (
    <Card className="flex min-w-0 flex-col p-3 sm:p-4">
      <div className="flex items-center gap-1.5 text-xs font-medium text-ink-muted">
        <span className="[&_svg]:size-3.5" style={{ color }}>
          {icon}
        </span>
        <span className="truncate">{label}</span>
        {action && <span className="ml-auto">{action}</span>}
      </div>
      <div className="mt-2 flex items-baseline gap-1">
        <span className="truncate text-xl font-bold tracking-tight tabular-nums">{num(value, value >= 1000 ? 0 : 2)}</span>
        <span className="text-xs text-ink-muted">{unit}</span>
      </div>
      {share != null && <div className="text-[11px] text-ink-subtle tabular-nums">{share.toFixed(1)}% of total</div>}
    </Card>
  )
}

/* -------------------------------------------------------------- collections */

const FEED_COLORS = ['#8b3f3a', '#e0a33a', '#1b8a8a', '#2a64b8', '#7a5bb5', '#23804d', '#c06a2b', '#6b726d']
const NETWORK = [
  { key: 'artisan', label: 'Artisan Pro', color: '#8b3f3a' },
  { key: 'csink', label: 'C-sink network', color: '#2a64b8' },
] as const

/** Biomass collected: total, split by feedstock, and the monthly collection trend. */
export function CollectionAnalytics({ stats }: { stats: CollectionStats }) {
  const months = stats.months.slice(-LAST)
  const max = Math.max(...stats.byFeedstock.map((f) => f.t), 1e-9)
  const shown = stats.byFeedstock.slice(0, 6)
  const rest = stats.byFeedstock.slice(6).reduce((t, f) => t + f.t, 0)
  const series = NETWORK.filter((s) => months.some((m) => m[s.key] > 0))

  return (
    <div className="grid grid-cols-1 gap-3 sm:gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
      <div className="flex min-w-0 flex-col gap-3 sm:gap-4">
        <Card className="p-3 text-center sm:p-4">
          <div className="text-xs font-medium tracking-wide text-ink-muted uppercase">Total biomass collected</div>
          <div className="mt-1 text-2xl font-bold tracking-tight tabular-nums sm:text-[28px]">
            {num(stats.totalT, 3)} <span className="text-sm font-medium text-ink-muted">t</span>
          </div>
        </Card>
        <Panel icon={<Sprout />} title="Collection by type" className="flex-1">
          {shown.length ? (
            <ul className="mt-3 flex flex-col gap-3">
              {shown.map((f, i) => (
                <li key={f.feedstock}>
                  <div className="flex items-baseline justify-between gap-2 text-[13px]">
                    <span className="truncate font-medium">{f.feedstock}</span>
                    <span className="shrink-0 text-ink-muted tabular-nums">{num(f.t, 3)} t</span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full" style={{ width: `${(f.t / max) * 100}%`, background: FEED_COLORS[i % FEED_COLORS.length] }} />
                  </div>
                </li>
              ))}
              {rest > 0 && (
                <li className="flex justify-between text-xs text-ink-subtle">
                  <span>{stats.byFeedstock.length - shown.length} more types</span>
                  <span className="tabular-nums">{num(rest, 3)} t</span>
                </li>
              )}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-ink-muted">No biomass collected for these filters.</p>
          )}
        </Panel>
      </div>

      <Panel icon={<BarChart3 />} title="Collection trend" sub={months.length ? `${monthLabel(months[0].month, true)} – ${monthLabel(months[months.length - 1].month, true)}` : undefined}>
        {months.length ? (
          <div className="mt-2 h-64 lg:h-auto lg:min-h-64 lg:flex-1">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={months} margin={{ top: 6, right: 0, left: 0, bottom: 0 }} barCategoryGap="28%">
                <CartesianGrid stroke="#e9ede7" vertical={false} />
                <XAxis dataKey="month" tickFormatter={(m) => monthLabel(String(m))} minTickGap={8} {...axis} />
                <YAxis width={40} tickFormatter={compact} {...axis} />
                <Tooltip
                  cursor={{ fill: '#f2f4f1' }}
                  labelFormatter={(m) => monthLabel(String(m), true)}
                  formatter={(v, name) => [`${num(Number(v), 3)} t`, NETWORK.find((s) => s.key === name)?.label ?? String(name)]}
                  contentStyle={tooltipStyle}
                />
                {series.map((s, i) => (
                  <Bar isAnimationActive={false} key={s.key} dataKey={s.key} stackId="n" fill={s.color} maxBarSize={36} radius={i === series.length - 1 ? [3, 3, 0, 0] : 0} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <EmptyState icon={<BarChart3 />} title="No collections" sub="Nothing matches these filters." />
        )}
        <div className="mt-2 flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs text-ink-muted">
          {series.map((s) => (
            <span key={s.key} className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-full" style={{ background: s.color }} />
              {s.label}
            </span>
          ))}
        </div>
      </Panel>
    </div>
  )
}
