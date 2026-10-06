'use client'

import { ChevronDown, ChevronLeft, ChevronRight, Pencil, Search, Sprout } from 'lucide-react'
import { Fragment, useState } from 'react'
import { toast } from 'sonner'

import { Badge, Button, Card, EmptyState, Input, Switch, Tooltip } from '../components/ui'
import { useDashboard } from '../data/store'
import type { Feedstock } from '../data/types'
import { cn, num } from '../lib/utils'
import { unwrap } from '../lib/unwrap'
import { saveFeedstock } from '../server/settings'

const PAGE_SIZE = 25

function StrategyBadge({ f }: { f: Feedstock }) {
  switch (f.strategy) {
    case 'methane':
      return <Badge tone="info">Methane config strategy</Badge>
    case 'compensation':
      return <Badge tone="warn">Compensation{f.spc ? ' · SPC' : ''}</Badge>
    case 'avoidance':
      return <Badge tone="success">Avoidance</Badge>
    default:
      return <span className="text-sm text-ink-subtle">Not set</span>
  }
}

const dash = (v: number | null | undefined, digits = 2) => (v === null || v === undefined ? '—' : num(v, digits))

/** Feedstock list with methane strategy, lab values and per-network reference values. */
export function FeedstocksSection({ onEdit }: { onEdit: (f: Feedstock) => void }) {
  const { data, reload } = useDashboard()
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(0)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  // Optimistic volume-tracking values while a save is in flight.
  const [tracking, setTracking] = useState<Record<string, boolean>>({})

  const q = query.trim().toLowerCase()
  const rows = data.feedstocks.filter((f) => f.name.toLowerCase().includes(q)).sort((a, b) => a.name.localeCompare(b.name))
  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE))
  const current = Math.min(page, pages - 1)
  const shown = rows.slice(current * PAGE_SIZE, (current + 1) * PAGE_SIZE)
  const from = rows.length ? current * PAGE_SIZE + 1 : 0
  const to = current * PAGE_SIZE + shown.length

  const toggleExpand = (id: string) =>
    setExpanded((s) => {
      const n = new Set(s)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })

  const setVolumeTracking = async (f: Feedstock, on: boolean) => {
    setTracking((t) => ({ ...t, [f.id]: on }))
    try {
      unwrap(await saveFeedstock({ ...f, volumeTracking: on }))
      toast.success(`Volume tracking ${on ? 'on' : 'off'} for ${f.name}`)
      reload()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err))
      setTracking((t) => {
        const n = { ...t }
        delete n[f.id]
        return n
      })
    }
  }

  const cols = 'grid-cols-[minmax(180px,1.6fr)_minmax(220px,1.6fr)_120px_120px_120px_40px]'

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-center gap-2 border-b border-line p-3">
        <div className="relative min-w-0 flex-1 sm:max-w-sm">
          <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-subtle" aria-hidden />
          <Input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setPage(0)
            }}
            placeholder="Search feedstocks"
            className="pl-9"
            aria-label="Search feedstocks"
          />
        </div>
      </div>

      <div className="overflow-x-auto">
        <div className="min-w-[860px]" role="table" aria-label="Feedstocks">
          <div role="row" className={cn('grid items-center gap-4 border-b border-line bg-muted px-4 py-2.5 text-xs font-semibold text-ink-muted', cols)}>
            <span role="columnheader">Feedstock</span>
            <span role="columnheader">Methane strategy</span>
            <span role="columnheader" className="text-right">
              Bulk density
            </span>
            <span role="columnheader" className="text-right">
              Carbon content
            </span>
            <span role="columnheader">Volume tracking</span>
            <span role="columnheader" className="sr-only">
              Details
            </span>
          </div>

          {shown.map((f) => {
            const open = expanded.has(f.id)
            const on = tracking[f.id] ?? f.volumeTracking
            const nets = data.networks.filter((n) => n.config.feedstocks.includes(f.name))
            const panelId = `fs-panel-${f.id}`
            return (
              <Fragment key={f.id}>
                <div
                  role="row"
                  className={cn('grid items-center gap-4 border-b border-line px-4 py-2.5 text-[13px] transition-colors hover:bg-muted/70', cols, open && 'bg-muted/50')}
                >
                  <span role="cell" className="flex min-w-0 items-center gap-2.5">
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-success-soft text-success">
                      <Sprout className="size-4" aria-hidden />
                    </span>
                    <span className="truncate font-semibold">{f.name}</span>
                  </span>
                  <span role="cell" className="flex min-w-0 items-center gap-1.5">
                    <StrategyBadge f={f} />
                    <Tooltip content="Edit feedstock">
                      <Button variant="ghost" size="icon-sm" className="size-7" onClick={() => onEdit(f)} aria-label={`Edit ${f.name}`}>
                        <Pencil className="size-3.5" />
                      </Button>
                    </Tooltip>
                  </span>
                  <span role="cell" className="text-right tabular-nums">
                    {f.bulkDensity === null ? '—' : `${num(f.bulkDensity, 1)} kg/m³`}
                  </span>
                  <span role="cell" className="text-right tabular-nums">
                    {f.carbonContent === null ? '—' : `${num(f.carbonContent, 2)} %`}
                  </span>
                  <span role="cell">
                    <Switch
                      checked={on}
                      onCheckedChange={(v) => void setVolumeTracking(f, v)}
                      aria-label={`Volume tracking for ${f.name}`}
                      className="outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
                    />
                  </span>
                  <span role="cell" className="flex justify-end">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => toggleExpand(f.id)}
                      aria-expanded={open}
                      aria-controls={panelId}
                      aria-label={`${open ? 'Hide' : 'Show'} network values for ${f.name}`}
                    >
                      <ChevronDown className={cn('transition-transform', open && 'rotate-180')} />
                    </Button>
                  </span>
                </div>

                {open && (
                  <div id={panelId} role="row" className="border-b border-line bg-muted/40 px-4 py-3">
                    <div role="cell">
                      {nets.length === 0 ? (
                        <p className="py-1 pl-11 text-[13px] text-ink-muted">Not assigned to any network yet.</p>
                      ) : (
                        <div className="ml-11 overflow-hidden rounded-xl border border-line bg-surface">
                          <table className="w-full text-[13px]">
                            <thead>
                              <tr className="border-b border-line text-xs text-ink-muted">
                                <th className="px-3 py-2 text-left font-semibold">Network</th>
                                <th className="px-3 py-2 text-right font-semibold">Bulk density (kg/m³)</th>
                                <th className="px-3 py-2 text-right font-semibold">Carbon content (%)</th>
                                <th className="px-3 py-2 text-right font-semibold">Moisture (%)</th>
                              </tr>
                            </thead>
                            <tbody>
                              {nets.map((n) => {
                                const ref = n.config.references.find((r) => r.feedstock === f.name)
                                return (
                                  <tr key={n.id} className="border-b border-line last:border-0">
                                    <td className="px-3 py-2 font-medium">{n.name}</td>
                                    <td className="px-3 py-2 text-right tabular-nums">{dash(ref?.bulkDensity, 1)}</td>
                                    <td className="px-3 py-2 text-right tabular-nums">{dash(ref?.carbonContent)}</td>
                                    <td className="px-3 py-2 text-right tabular-nums">{dash(ref?.moisture)}</td>
                                  </tr>
                                )
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </Fragment>
            )
          })}
        </div>
      </div>

      {rows.length === 0 && (
        <EmptyState
          icon={<Sprout />}
          title={data.feedstocks.length ? 'No feedstocks match' : 'No feedstocks yet'}
          sub={data.feedstocks.length ? 'Try a different search.' : 'Add a feedstock to use it in network configurations.'}
        />
      )}

      <div className="flex flex-wrap items-center justify-end gap-x-6 gap-y-2 border-t border-line px-4 py-2.5 text-xs text-ink-muted">
        <span>Rows per page: {PAGE_SIZE}</span>
        <span className="tabular-nums">
          {from}–{to} of {rows.length}
        </span>
        <span className="flex items-center gap-1">
          <Button variant="ghost" size="icon-sm" onClick={() => setPage(current - 1)} disabled={current === 0} aria-label="Previous page">
            <ChevronLeft />
          </Button>
          <Button variant="ghost" size="icon-sm" onClick={() => setPage(current + 1)} disabled={current >= pages - 1} aria-label="Next page">
            <ChevronRight />
          </Button>
        </span>
      </div>
    </Card>
  )
}
