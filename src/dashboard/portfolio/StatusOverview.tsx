'use client'

import { Globe2, Maximize2, Network as NetworkIcon, PieChart } from 'lucide-react'
import { useState } from 'react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip as ChartTooltip, XAxis, YAxis } from 'recharts'

import { Button, Card, Modal, Switch, Tooltip } from '../components/ui'
import { BUCKETS, portfolioSummary } from '../data/selectors'
import { useDashboard } from '../data/store'
import type { CreditBucket } from '../data/types'
import { cn } from '../lib/utils'
import { BUCKET_META, tco2 } from './buckets'

/** Global portfolio status: where every tonne of carbon stands, overall and per network. */
export function StatusOverview() {
  const { data, filters } = useDashboard()
  const { totals, networks } = portfolioSummary(data, filters)
  const [includeLost, setIncludeLost] = useState(false)
  const [expanded, setExpanded] = useState(false)

  const shown = BUCKETS.filter((b) => includeLost || b !== 'lost')
  const total = shown.reduce((a, b) => a + totals[b], 0)
  const pct = (v: number) => (total > 0 ? (v / total) * 100 : 0)

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-start gap-3 border-b border-line px-3 py-3 sm:px-4">
        <span className="flex size-9 items-center justify-center rounded-xl bg-brand-soft text-brand">
          <PieChart className="size-[18px]" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="font-bold">Global portfolio status</h2>
          <p className="text-sm text-ink-muted">Carbon across every project in the current selection, by where it stands.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 p-3 sm:p-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        {/* ---------- overall distribution ---------- */}
        <section aria-labelledby="dist-title" className="flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <Globe2 className="size-4 text-ink-muted" />
            <h3 id="dist-title" className="text-sm font-semibold">
              Overall distribution
            </h3>
            <label className="ml-auto flex cursor-pointer items-center gap-2 text-xs font-medium text-ink-muted">
              Include lost
              <Switch checked={includeLost} onCheckedChange={setIncludeLost} aria-label="Include lost carbon in the total" />
            </label>
          </div>

          <div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl leading-none font-bold tracking-tight tabular-nums sm:text-[32px]">{tco2(total)}</span>
              <span className="text-sm font-medium text-ink-muted">t CO₂e total</span>
            </div>
            {/* Stacked 100% bar — a donut cannot show seven buckets legibly. */}
            <div className="mt-3 flex h-3 w-full overflow-hidden rounded-full bg-muted" role="img" aria-label="Share of carbon by status">
              {shown.map((b) =>
                totals[b] > 0 ? (
                  <Tooltip key={b} content={`${BUCKET_META[b].label}: ${tco2(totals[b])} t (${pct(totals[b]).toFixed(1)}%)`}>
                    <span className="h-full transition-[width] duration-300" style={{ width: `${pct(totals[b])}%`, background: BUCKET_META[b].color }} />
                  </Tooltip>
                ) : null,
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {BUCKETS.map((b) => (
              <BucketTile key={b} bucket={b} value={totals[b]} share={b === 'lost' && !includeLost ? null : pct(totals[b])} />
            ))}
          </div>
        </section>

        {/* ---------- per network ---------- */}
        <section aria-labelledby="net-title" className="flex min-w-0 flex-col gap-3">
          <div className="flex items-center gap-2">
            <NetworkIcon className="size-4 text-ink-muted" />
            <h3 id="net-title" className="text-sm font-semibold">
              Network-wise breakdown
            </h3>
            <Button variant="ghost" size="icon-sm" className="ml-auto" onClick={() => setExpanded(true)} aria-label="Expand breakdown with table">
              <Maximize2 />
            </Button>
          </div>
          <NetworkChart rows={networks} buckets={shown} height={Math.max(260, networks.length * 44)} />
          <Legend buckets={shown} />
        </section>
      </div>

      <Modal open={expanded} onOpenChange={setExpanded} title="Network-wise breakdown" description="t CO₂e per network and status" className="max-w-5xl">
        <NetworkChart rows={networks} buckets={shown} height={Math.max(320, networks.length * 52)} />
        <Legend buckets={shown} />
        <div className="mt-5 overflow-x-auto rounded-xl border border-line">
          <table className="w-full text-sm">
            <thead className="bg-muted text-xs text-ink-muted">
              <tr>
                <th className="px-3 py-2 text-left font-semibold">Network</th>
                {shown.map((b) => (
                  <th key={b} className="px-3 py-2 text-right font-semibold whitespace-nowrap">
                    {BUCKET_META[b].label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {networks.map((r) => (
                <tr key={r.network.id} className="border-t border-line">
                  <td className="px-3 py-2 font-medium whitespace-nowrap">{r.network.name}</td>
                  {shown.map((b) => (
                    <td key={b} className="px-3 py-2 text-right tabular-nums">
                      {r.buckets[b] ? tco2(r.buckets[b]) : <span className="text-ink-subtle">—</span>}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Modal>
    </Card>
  )
}

function BucketTile({ bucket, value, share }: { bucket: CreditBucket; value: number; share: number | null }) {
  const m = BUCKET_META[bucket]
  const Icon = m.icon
  return (
    <Tooltip content={m.help}>
      <div
        className={cn('relative flex min-w-0 items-center gap-2.5 overflow-hidden rounded-lg border border-line bg-surface py-2 pr-2.5 pl-3.5 sm:py-2.5', !value && 'opacity-70')}
        tabIndex={0}
      >
        <span className="absolute inset-y-0 left-0 w-1" style={{ background: m.color }} aria-hidden />
        <span className="hidden size-8 shrink-0 items-center justify-center rounded-lg sm:flex" style={{ background: `${m.color}1a`, color: m.color }}>
          <Icon className="size-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-xs font-medium text-ink-muted">{m.label}</span>
          <span className="block text-[15px] leading-tight font-bold tabular-nums sm:text-lg">{tco2(value)}</span>
        </span>
        {share != null && <span className="text-xs font-semibold text-ink-muted tabular-nums">{share.toFixed(1)}%</span>}
      </div>
    </Tooltip>
  )
}

type Row = ReturnType<typeof portfolioSummary>['networks'][number]

function NetworkChart({ rows, buckets, height }: { rows: Row[]; buckets: CreditBucket[]; height: number }) {
  const chart = rows.map((r) => ({ name: r.network.name, ...Object.fromEntries(buckets.map((b) => [b, +r.buckets[b].toFixed(3)])) }))
  if (!rows.length) return <div className="flex h-64 items-center justify-center text-sm text-ink-muted">No networks in this selection.</div>
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chart} layout="vertical" margin={{ top: 4, right: 12, bottom: 4, left: 4 }} barCategoryGap={10}>
          <CartesianGrid horizontal={false} stroke="#e3e7e1" />
          <XAxis type="number" tick={{ fontSize: 11, fill: '#6b726d' }} axisLine={false} tickLine={false} />
          <YAxis
            type="category"
            dataKey="name"
            width={150}
            tick={{ fontSize: 12, fill: '#3f4742' }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v: string) => (v.length > 22 ? `${v.slice(0, 21)}…` : v)}
          />
          <ChartTooltip
            cursor={{ fill: '#f1f4f0' }}
            contentStyle={{ borderRadius: 12, border: '1px solid #e3e7e1', fontSize: 12 }}
            formatter={(v, key) => [`${tco2(Number(v))} t`, BUCKET_META[key as CreditBucket]?.label ?? String(key)]}
          />
          {buckets.map((b, i) => (
            <Bar
              key={b}
              dataKey={b}
              stackId="a"
              fill={BUCKET_META[b].color}
              radius={i === buckets.length - 1 ? [0, 6, 6, 0] : 0}
              isAnimationActive={false}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

function Legend({ buckets }: { buckets: CreditBucket[] }) {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-ink-muted">
      {buckets.map((b) => (
        <li key={b} className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm" style={{ background: BUCKET_META[b].color }} aria-hidden />
          {BUCKET_META[b].label}
        </li>
      ))}
    </ul>
  )
}
