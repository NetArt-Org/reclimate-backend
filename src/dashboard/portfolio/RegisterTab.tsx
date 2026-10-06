'use client'

import { Check, ListChecks, Network, SlidersVertical, X } from 'lucide-react'
import Link from 'next/link'

import { Card, Tooltip } from '../components/ui'
import { useDashboard } from '../data/store'
import type { DashboardData } from '../data/types'
import { cn } from '../lib/utils'
import type { PortfolioExtras, Telemetry } from '../server/portfolio'
import { tco2 } from './buckets'

export interface Check {
  title: string
  ok: boolean
  detail: string
  fix?: string
}

/** What must be in place before credits can be registered. */
export function readiness(data: DashboardData): Check[] {
  const c = data.company
  const csi = c.projects.filter((p) => /csi/i.test(p.registry))
  return [
    {
      title: 'Assign dMRV provider',
      ok: !!c.dmrvProvider,
      detail: c.dmrvProvider ? `${c.dmrvProvider} verifies the field data.` : 'No digital MRV provider set.',
      fix: '/admin/account',
    },
    {
      title: 'Company profile details',
      ok: !!(c.name && c.email && c.address),
      detail: c.name && c.email && c.address ? 'Organisational details are complete.' : 'Add the company address and email.',
      fix: '/admin/account',
    },
    {
      title: 'CSI project details',
      ok: csi.length > 0,
      detail: csi.length ? `${csi.map((p) => p.name).join(', ')}.` : 'Add a project registered under CSI.',
      fix: '/admin/account',
    },
  ]
}

const STEPS: { key: keyof Telemetry; label: string }[] = [
  { key: 'collections', label: 'Biomass collected' },
  { key: 'batches', label: 'Batches recorded' },
  { key: 'assessed', label: 'Batches assessed' },
  { key: 'processed', label: 'Mixed or packaged' },
  { key: 'sinkApproved', label: 'Sink approved' },
  { key: 'registered', label: 'Registered' },
]

export function RegisterTab({ extras, checks }: { extras: PortfolioExtras; checks: Check[] }) {
  const { data } = useDashboard()
  const rows = extras.telemetry
    .filter((t) => t.batches > 0)
    .map((t) => ({ t, network: data.networks.find((n) => n.id === t.networkId) }))
    .filter((r) => r.network)
    .sort((a, b) => b.t.readyT - a.t.readyT || b.t.batches - a.t.batches)

  return (
    <Card className="p-3 sm:p-4">
      <div className="flex items-start gap-3">
        <span className="flex size-9 items-center justify-center rounded-xl bg-brand-soft text-brand">
          <SlidersVertical className="size-[18px]" />
        </span>
        <div>
          <h2 className="font-bold">System readiness</h2>
          <p className="text-sm text-ink-muted">Project set-up and each network&apos;s records are checked before credits are registered.</p>
        </div>
      </div>

      <h3 className="mt-6 mb-3 flex items-center gap-2 text-xs font-bold tracking-wider text-ink-muted uppercase">
        <ListChecks className="size-4" /> Global project set-up
      </h3>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {checks.map((c) => (
          <div key={c.title} className={cn('flex items-start gap-3 rounded-xl border p-4', c.ok ? 'border-line' : 'border-warn/40 bg-warn-soft/40')}>
            <span className={cn('mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full text-white', c.ok ? 'bg-success' : 'bg-warn')}>
              {c.ok ? <Check className="size-3.5" strokeWidth={3} /> : <X className="size-3.5" strokeWidth={3} />}
            </span>
            <div className="min-w-0">
              <div className="text-sm font-semibold">
                {c.title} <span className="sr-only">{c.ok ? '(done)' : '(needs attention)'}</span>
              </div>
              <div className="mt-0.5 text-xs text-ink-muted">{c.detail}</div>
              {!c.ok && c.fix && (
                <Link href={c.fix} className="mt-1.5 inline-block text-xs font-semibold text-brand hover:underline">
                  Fix in Account &amp; company →
                </Link>
              )}
            </div>
          </div>
        ))}
      </div>

      <h3 className="mt-7 mb-3 flex items-center gap-2 text-xs font-bold tracking-wider text-ink-muted uppercase">
        <Network className="size-4" /> Network records
      </h3>
      <div className="overflow-x-auto">
        <div className="min-w-[760px]">
          <div className="grid grid-cols-[minmax(200px,1.2fr)_repeat(6,minmax(70px,1fr))_110px] gap-2 px-4 pb-2 text-[11px] font-semibold text-ink-subtle uppercase">
            <span>Network</span>
            {STEPS.map((s) => (
              <span key={s.key} className="text-center">
                {s.label}
              </span>
            ))}
            <span className="text-right">Ready</span>
          </div>
          <div className="flex flex-col gap-2">
            {rows.map(({ t, network }) => (
              <div
                key={t.networkId}
                className="grid grid-cols-[minmax(200px,1.2fr)_repeat(6,minmax(70px,1fr))_110px] items-center gap-2 rounded-xl border border-line px-4 py-3"
              >
                <span className="truncate text-sm font-semibold">{network!.name}</span>
                {STEPS.map((s, i) => {
                  const count = t[s.key] as number
                  const done = count > 0
                  const nextDone = i < STEPS.length - 1 && (t[STEPS[i + 1].key] as number) > 0
                  return (
                    <span key={s.key} className="relative flex justify-center">
                      {i < STEPS.length - 1 && (
                        <span className={cn('absolute top-1/2 left-1/2 h-0.5 w-full -translate-y-1/2', done && nextDone ? 'bg-brand' : 'bg-line')} aria-hidden />
                      )}
                      <Tooltip content={`${s.label}: ${count.toLocaleString('en-US')}`}>
                        <span
                          tabIndex={0}
                          className={cn(
                            'relative flex size-7 items-center justify-center rounded-full border-2 bg-surface',
                            done ? 'border-brand text-brand' : 'border-line-strong text-ink-subtle',
                          )}
                          aria-label={`${s.label}: ${count}`}
                        >
                          {done ? <Check className="size-3.5" strokeWidth={3} /> : <span className="size-1.5 rounded-full bg-current" />}
                        </span>
                      </Tooltip>
                    </span>
                  )
                })}
                <span className={cn('text-right text-sm font-semibold tabular-nums', t.readyT ? 'text-brand' : 'text-ink-subtle')}>
                  {tco2(t.readyT)} t
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Card>
  )
}
