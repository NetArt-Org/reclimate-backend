'use client'

import { ArrowUpRight, BadgeCheck, CircleSlash, Clock3, Flame, MapPin, Target } from 'lucide-react'
import Link from 'next/link'
import { useState } from 'react'

import { Card, Segmented, Tooltip } from '../components/ui'
import { portfolioSummary, selectedSites } from '../data/selectors'
import { useDashboard } from '../data/store'
import { cn } from '../lib/utils'
import { tco2 } from '../portfolio/buckets'

/**
 * The first thing on the Overview: how much carbon is already captured vs still on its way vs lost,
 * and which places have stopped recording field data. Both follow the filters and the map selection.
 */
export function CaptureOverview() {
  return (
    <div className="grid grid-cols-1 gap-3 sm:gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
      <CarbonCapture />
      <ReportingGaps />
    </div>
  )
}

const PARTS = [
  {
    key: 'captured',
    label: 'Captured',
    help: 'Registered on the registry — credits secured.',
    color: '#23804d',
    icon: BadgeCheck,
  },
  {
    key: 'progress',
    label: 'In progress',
    help: 'Recorded, but still waiting for assessment, the sink (application) or CERES verification.',
    color: '#e0a33a',
    icon: Clock3,
  },
  {
    key: 'lost',
    label: 'Not captured',
    help: 'Rejected batches and rejected sinks — no credits.',
    color: '#c03a2b',
    icon: CircleSlash,
  },
] as const

function CarbonCapture() {
  const { data, filters } = useDashboard()
  const { totals: t } = portfolioSummary(data, filters)
  const value = {
    captured: t.registered + t.compensated,
    progress: t.pendingCirconomy + t.pendingSink + t.pendingCeres,
    lost: t.lost + t.sinkRejected,
  }
  const total = value.captured + value.progress + value.lost
  const pct = (v: number) => (total > 0 ? (v / total) * 100 : 0)

  return (
    <Card className="flex flex-col p-3 sm:p-4">
      <div className="flex items-center gap-2">
        <Target className="size-4 text-brand" />
        <h2 className="text-sm font-semibold">Carbon capture</h2>
        <Link href="/admin/portfolio" className="ml-auto flex items-center gap-1 text-xs font-semibold text-ink-subtle hover:text-brand">
          Portfolio <ArrowUpRight className="size-3" />
        </Link>
      </div>

      <div className="mt-3 flex flex-wrap items-baseline gap-x-2">
        <span className="text-2xl leading-none font-bold tracking-tight tabular-nums sm:text-[28px]">{pct(value.captured).toFixed(1)}%</span>
        <span className="text-sm text-ink-muted">
          captured · {tco2(value.captured)} of {tco2(total)} t CO₂e
        </span>
      </div>

      {/* One bar: captured | in progress | not captured. */}
      <div className="mt-3 flex h-3 w-full overflow-hidden rounded-full bg-muted" role="img" aria-label={`Captured ${pct(value.captured).toFixed(1)}%, in progress ${pct(value.progress).toFixed(1)}%, not captured ${pct(value.lost).toFixed(1)}%`}>
        {PARTS.map((p) =>
          value[p.key] > 0 ? <span key={p.key} className="h-full transition-[width] duration-300" style={{ width: `${pct(value[p.key])}%`, background: p.color }} /> : null,
        )}
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2">
        {PARTS.map((p) => {
          const Icon = p.icon
          return (
            <Tooltip key={p.key} content={p.help}>
              <div tabIndex={0} className="min-w-0 rounded-lg border border-line px-2.5 py-2 outline-none focus-visible:ring-2 focus-visible:ring-brand/40">
                <div className="flex items-center gap-1.5 text-xs font-medium text-ink-muted">
                  <Icon className="size-3.5 shrink-0" style={{ color: p.color }} />
                  <span className="truncate">{p.label}</span>
                </div>
                <div className="mt-1 truncate text-[15px] font-bold tabular-nums">{tco2(value[p.key])}</div>
                <div className="text-[11px] text-ink-subtle tabular-nums">{pct(value[p.key]).toFixed(1)}%</div>
              </div>
            </Tooltip>
          )
        })}
      </div>
    </Card>
  )
}

const DAY = 86_400_000
const WINDOWS = [7, 14, 30] as const

/** Active kilns and sites with no batch recorded in the chosen window — places that stopped reporting. */
function ReportingGaps() {
  const { data, filters } = useDashboard()
  const [days, setDays] = useState<(typeof WINDOWS)[number]>(14)
  // "Now" is fixed when the panel mounts, so the render stays pure.
  const [now] = useState(() => Date.now())
  const since = now - days * DAY

  const sites = selectedSites(data, filters).filter((s) => s.active)
  const siteIds = new Set(sites.map((s) => s.id))
  const kilns = data.kilns.filter((k) => k.active && siteIds.has(k.siteId))
  const quietKilns = kilns.filter((k) => !k.lastBatchAt || Date.parse(k.lastBatchAt) < since)
  const quietSites = sites.filter((s) => !s.lastBatchAt || Date.parse(s.lastBatchAt) < since)
  const reporting = kilns.length - quietKilns.length

  const ago = (iso?: string) => (iso ? `${Math.floor((now - Date.parse(iso)) / DAY)} days ago` : 'never')
  const siteName = (id: string) => data.sites.find((s) => s.id === id)?.name ?? ''
  // Kilns that went quiet most recently first (most actionable); kilns that never reported last.
  const list = [...quietKilns].sort((a, b) => (b.lastBatchAt ?? '').localeCompare(a.lastBatchAt ?? '')).slice(0, 4)

  return (
    <Card className="flex flex-col p-3 sm:p-4">
      <div className="flex items-center gap-2">
        <Flame className="size-4 text-flame" />
        <h2 className="text-sm font-semibold">Field reporting</h2>
        <Segmented<string>
          className="ml-auto"
          value={String(days)}
          onChange={(v) => setDays(Number(v) as (typeof WINDOWS)[number])}
          options={WINDOWS.map((d) => ({ value: String(d), label: `${d}d` }))}
        />
      </div>

      <div className="mt-3 flex flex-wrap items-baseline gap-x-2">
        <span className="text-2xl leading-none font-bold tracking-tight tabular-nums sm:text-[28px]">
          {reporting}/{kilns.length}
        </span>
        <span className="text-sm text-ink-muted">active kilns recorded a batch in {days} days</span>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5 text-xs">
        <span className={cn('rounded-md px-2 py-1 font-semibold', quietKilns.length ? 'bg-warn-soft text-warn' : 'bg-success-soft text-success')}>
          {quietKilns.length} quiet kiln{quietKilns.length === 1 ? '' : 's'}
        </span>
        <span className={cn('rounded-md px-2 py-1 font-semibold', quietSites.length ? 'bg-warn-soft text-warn' : 'bg-success-soft text-success')}>
          {quietSites.length} quiet site{quietSites.length === 1 ? '' : 's'}
        </span>
      </div>

      {list.length ? (
        <ul className="mt-3 flex flex-col divide-y divide-line rounded-lg border border-line">
          {list.map((k) => (
            <li key={k.id}>
              <Link href="/admin/networks" className="flex items-center gap-2 px-2.5 py-2 text-[13px] hover:bg-muted/70">
                <MapPin className="size-3.5 shrink-0 text-ink-subtle" />
                <span className="min-w-0 flex-1 truncate">
                  <span className="font-semibold">{k.name}</span>
                  <span className="text-ink-muted"> · {siteName(k.siteId)}</span>
                </span>
                <span className="shrink-0 text-xs text-ink-subtle tabular-nums">{ago(k.lastBatchAt)}</span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-success">Every active kiln in this selection reported within {days} days.</p>
      )}
      {quietKilns.length > list.length && (
        <Link href="/admin/networks" className="mt-2 text-xs font-semibold text-ink-subtle hover:text-brand">
          +{quietKilns.length - list.length} more in Networks →
        </Link>
      )}
    </Card>
  )
}
