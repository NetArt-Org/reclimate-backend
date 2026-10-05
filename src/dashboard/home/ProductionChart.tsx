'use client'

import { ChevronLeft, ChevronRight, Download, LineChart } from 'lucide-react'
import { useState } from 'react'
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

import { Button, Card, EmptyState, Segmented } from '../components/ui'
import { monthRange, weekRange } from '../data/mock'
import { timeSeries, type Grain } from '../data/selectors'
import { useDashboard } from '../data/store'
import { num } from '../lib/utils'

const SERIES = {
  biomass: { label: 'Biomass', unit: 't', color: '#1b8a8a', axis: 'left' },
  biochar: { label: 'Biochar', unit: 't', color: '#e07a2e', axis: 'right' },
  credits: { label: 'Credits', unit: 'tCO₂e', color: '#1f5a3d', axis: 'right' },
} as const
type Key = keyof typeof SERIES
type Metric = Key | 'all'

/** How many buckets one screen shows. */
const WINDOW: Record<Grain, number> = { month: 12, week: 12 }

const label = (key: string, grain: Grain, long = false) => {
  const d = new Date(`${grain === 'week' ? key : `${key}-01`}T00:00:00`)
  if (grain === 'week') return long ? `Week of ${d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}` : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
  return d.toLocaleDateString('en-GB', long ? { month: 'long', year: 'numeric' } : { month: 'short', year: '2-digit' })
}

/**
 * Production over time. Always opens on the current window (latest 12 months or
 * 12 weeks); the arrows page back. A Custom period pins the chart to that range.
 */
export function ProductionChart() {
  const { data, filters } = useDashboard()
  const [metric, setMetric] = useState<Metric>('all')
  const [grain, setGrain] = useState<Grain>('month')
  const [page, setPage] = useState(0)

  const all = grain === 'week' ? weekRange() : monthRange()
  const p = filters.period
  const custom = p.kind === 'custom'
  let buckets: string[]
  if (custom) {
    const inRange = (k: string) => {
      const m = k.slice(0, 7)
      return (!p.from || m >= p.from.slice(0, 7)) && (!p.to || m <= p.to.slice(0, 7))
    }
    buckets = all.filter(inRange)
  } else {
    const end = all.length - page * WINDOW[grain]
    buckets = all.slice(Math.max(0, end - WINDOW[grain]), end)
  }
  const canBack = !custom && all.length - (page + 1) * WINDOW[grain] > 0
  const rows = timeSeries(data, filters, grain, buckets)
  const keys: Key[] = metric === 'all' ? ['biomass', 'biochar', 'credits'] : [metric]
  const hasData = rows.some((r) => keys.some((k) => r[k] > 0))
  const range = rows.length ? `${label(rows[0].key, grain, true)} – ${label(rows[rows.length - 1].key, grain, true)}` : ''

  const changeGrain = (g: Grain) => {
    setGrain(g)
    setPage(0)
  }

  const exportCsv = () => {
    const csv = [`${grain === 'week' ? 'Week' : 'Month'},Biomass (t),Biochar (t),Credits (tCO2e)`, ...rows.map((r) => `${r.key},${r.biomass},${r.biochar},${r.credits}`)].join('\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    Object.assign(document.createElement('a'), { href: url, download: `production-by-${grain}.csv` }).click()
    URL.revokeObjectURL(url)
  }

  const axis = { tick: { fontSize: 12, fill: '#6b726d' }, axisLine: false, tickLine: false }
  const twoAxes = metric === 'all'

  return (
    <Card className="flex flex-col p-5">
      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-0">
          <h2 className="text-base font-semibold">Production growth</h2>
          <p className="mt-0.5 text-sm text-ink-muted">{range}</p>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Segmented
            value={metric}
            onChange={setMetric}
            options={[{ value: 'all' as Metric, label: 'All' }, ...(Object.keys(SERIES) as Key[]).map((k) => ({ value: k as Metric, label: SERIES[k].label }))]}
          />
          <Segmented
            value={grain}
            onChange={changeGrain}
            options={[
              { value: 'week', label: 'Week' },
              { value: 'month', label: 'Month' },
            ]}
          />
          {!custom && (
            <div className="flex">
              <Button variant="ghost" size="icon-sm" disabled={!canBack} onClick={() => setPage((n) => n + 1)} aria-label="Earlier">
                <ChevronLeft />
              </Button>
              <Button variant="ghost" size="icon-sm" disabled={page === 0} onClick={() => setPage((n) => Math.max(0, n - 1))} aria-label="Later">
                <ChevronRight />
              </Button>
            </div>
          )}
          <Button size="sm" onClick={exportCsv} disabled={!hasData} className="rounded-lg">
            <Download /> CSV
          </Button>
        </div>
      </div>

      <div className="mt-5 h-72">
        {!hasData ? (
          <EmptyState icon={<LineChart />} title="No production in this window" sub={custom ? 'Pick a different custom range.' : 'Use the arrows to look at an earlier period.'} />
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={rows} margin={{ top: 6, right: 6, left: 0, bottom: 0 }}>
              <defs>
                {keys.map((k) => (
                  <linearGradient key={k} id={`fill-${k}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={SERIES[k].color} stopOpacity={twoAxes ? 0.14 : 0.25} />
                    <stop offset="100%" stopColor={SERIES[k].color} stopOpacity={0} />
                  </linearGradient>
                ))}
              </defs>
              <CartesianGrid stroke="#e9ede7" vertical={false} />
              <XAxis dataKey="key" tickFormatter={(k) => label(String(k), grain)} minTickGap={24} {...axis} />
              <YAxis yAxisId="left" width={52} tickFormatter={(v) => num(v, 0)} {...axis} hide={!twoAxes && SERIES[keys[0]].axis !== 'left'} />
              <YAxis yAxisId="right" orientation={twoAxes ? 'right' : 'left'} width={52} tickFormatter={(v) => num(v, 0)} {...axis} hide={!twoAxes && SERIES[keys[0]].axis !== 'right'} />
              <Tooltip
                labelFormatter={(k) => label(String(k), grain, true)}
                formatter={(v, name) => {
                  const s = SERIES[name as Key]
                  return [`${num(Number(v), 2)} ${s.unit}`, s.label]
                }}
                contentStyle={{ borderRadius: 12, border: '1px solid #e3e7e1', boxShadow: '0 8px 24px rgb(0 0 0 / 0.08)', fontSize: 13 }}
              />
              {keys.map((k) => (
                <Area
                  key={k}
                  yAxisId={SERIES[k].axis}
                  type="monotone"
                  dataKey={k}
                  stroke={SERIES[k].color}
                  strokeWidth={2.25}
                  fill={`url(#fill-${k})`}
                  dot={rows.length <= 2 ? { r: 3 } : false}
                  activeDot={{ r: 4 }}
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {twoAxes && hasData && (
        <div className="mt-3 flex flex-wrap items-center justify-center gap-x-5 gap-y-1 text-xs text-ink-muted">
          {keys.map((k) => (
            <span key={k} className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-full" style={{ background: SERIES[k].color }} />
              {SERIES[k].label} ({SERIES[k].unit}){SERIES[k].axis === 'left' ? ' · left axis' : ' · right axis'}
            </span>
          ))}
        </div>
      )}
    </Card>
  )
}
