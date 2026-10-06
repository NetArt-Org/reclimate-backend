'use client'

import { ChevronDown, ChevronLeft, ChevronRight, FileBadge, Info, Layers, Printer, Recycle, RefreshCw, RotateCcw, Trash2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { Fragment, useState, useTransition, type ReactNode } from 'react'
import { toast } from 'sonner'

import { Badge, Button, Card, EmptyState, Modal, NativeSelect, Tooltip, type BadgeTone } from '../components/ui'
import { useDashboard } from '../data/store'
import { cn, day } from '../lib/utils'
import { unwrap } from '../lib/unwrap'
import { setLedgerDeleted, type SinkRow, type StockRow } from '../server/portfolio'
import { tco2 } from './buckets'

/* ------------------------------------------------------------------ */
/* Shared table frame: title, "Show deleted", rows per page, pager     */
/* ------------------------------------------------------------------ */

function usePaging<T>(rows: T[]) {
  const [per, setPer] = useState(25)
  const [page, setPage] = useState(1)
  const pages = Math.max(1, Math.ceil(rows.length / per))
  const p = Math.min(page, pages)
  return { per, setPer: (n: number) => (setPer(n), setPage(1)), page: p, pages, setPage, slice: rows.slice((p - 1) * per, p * per) }
}

function LedgerCard({
  icon,
  title,
  sub,
  actions,
  paging,
  total,
  children,
}: {
  icon: ReactNode
  title: string
  sub: string
  actions?: ReactNode
  paging: ReturnType<typeof usePaging<unknown>>
  total: number
  children: ReactNode
}) {
  const from = total ? (paging.page - 1) * paging.per + 1 : 0
  const to = Math.min(total, paging.page * paging.per)
  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-center gap-3 border-b border-line px-3 py-3 sm:px-4">
        <span className="flex size-9 items-center justify-center rounded-xl bg-brand-soft text-brand [&_svg]:size-[18px]">{icon}</span>
        <div className="min-w-0 flex-1">
          <h2 className="font-bold">{title}</h2>
          <p className="text-xs text-ink-muted">{sub}</p>
        </div>
        {actions}
        <label className="flex items-center gap-2 text-xs font-medium text-ink-muted">
          Rows per page
          <NativeSelect value={paging.per} onChange={(e) => paging.setPer(Number(e.target.value))} className="h-8 w-20 rounded-lg text-xs">
            {[25, 50, 100].map((n) => (
              <option key={n}>{n}</option>
            ))}
          </NativeSelect>
        </label>
        <span className="text-xs font-semibold text-ink-muted tabular-nums">
          {from}–{to} of {total}
        </span>
      </div>
      <div className="overflow-x-auto">{children}</div>
      {paging.pages > 1 && (
        <div className="flex items-center justify-center gap-2 border-t border-line py-3">
          <Button size="icon-sm" disabled={paging.page <= 1} onClick={() => paging.setPage(paging.page - 1)} aria-label="Previous page">
            <ChevronLeft />
          </Button>
          <span className="text-sm font-semibold tabular-nums">
            {paging.page} / {paging.pages}
          </span>
          <Button size="icon-sm" disabled={paging.page >= paging.pages} onClick={() => paging.setPage(paging.page + 1)} aria-label="Next page">
            <ChevronRight />
          </Button>
        </div>
      )}
    </Card>
  )
}

function ShowDeleted({ value, onChange, count }: { value: boolean; onChange: (v: boolean) => void; count: number }) {
  return (
    <Button size="sm" className={cn('rounded-lg', value && 'border-brand text-brand')} onClick={() => onChange(!value)} aria-pressed={value}>
      {value ? 'Hide deleted' : 'Show deleted'}
      {count > 0 && <span className="text-ink-subtle">· {count}</span>}
    </Button>
  )
}

function useSoftDelete(kind: 'stocks' | 'sinks') {
  const router = useRouter()
  const [pending, start] = useTransition()
  const toggle = (id: string, deleted: boolean) =>
    start(async () => {
      try {
        unwrap(await setLedgerDeleted(kind, id, deleted))
        toast.success(deleted ? 'Moved to deleted' : 'Restored')
        router.refresh()
      } catch (err) {
        toast.error('Could not save', { description: err instanceof Error ? err.message : String(err) })
      }
    })
  return { toggle, pending }
}

const th = 'px-4 py-3 text-left text-[11px] font-bold tracking-wider text-ink-muted uppercase whitespace-nowrap'
const td = 'px-4 py-3 align-middle'

const IdChip = ({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'brand' }) => (
  <span
    className={cn(
      'inline-flex rounded-md border px-2 py-0.5 font-mono text-xs font-semibold tabular-nums',
      tone === 'brand' ? 'border-brand/20 bg-brand-soft text-brand' : 'border-line bg-muted text-ink-2',
    )}
  >
    {children}
  </span>
)

/* ------------------------------------------------------------------ */
/* Stocks ledger                                                       */
/* ------------------------------------------------------------------ */

export function StocksLedger({ stocks }: { stocks: StockRow[] }) {
  const { data } = useDashboard()
  const [showDeleted, setShowDeleted] = useState(false)
  const [cert, setCert] = useState<StockRow | null>(null)
  const { toggle, pending } = useSoftDelete('stocks')
  const rows = stocks.filter((s) => showDeleted || !s.deleted)
  const paging = usePaging(rows)
  const netName = (id: string | null) => data.networks.find((n) => n.id === id)?.name

  return (
    <LedgerCard
      icon={<Layers />}
      title="Stocks ledger"
      sub="Unassigned carbon inventory on the registry"
      total={rows.length}
      paging={paging as never}
      actions={<ShowDeleted value={showDeleted} onChange={setShowDeleted} count={stocks.filter((s) => s.deleted).length} />}
    >
      {rows.length ? (
        <table className="w-full min-w-[900px] text-sm">
          <thead className="bg-muted/60">
            <tr>
              <th className={th}>Stock code</th>
              <th className={th}>Stock ID</th>
              <th className={th}>Details</th>
              <th className={cn(th, 'text-right')}>Biochar</th>
              <th className={cn(th, 'text-right')}>Carbon credits</th>
              <th className={th}>Dates</th>
              <th className={cn(th, 'text-right')}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {paging.slice.map((s) => (
              <tr key={s.id} className={cn('border-t border-line transition-colors hover:bg-muted/40', s.deleted && 'opacity-55')}>
                <td className={cn(td, 'font-mono text-xs font-semibold')}>
                  {s.code || <span className="font-sans font-normal text-ink-subtle">Not recorded</span>}
                  {s.partial && (
                    <Tooltip content="Imported from the sinks ledger: only the stock ID, biochar quantity and date are known.">
                      <span tabIndex={0} className="ml-2 inline-flex items-center gap-1 align-middle font-sans text-[11px] font-semibold text-warn">
                        <Info className="size-3" /> Partial
                      </span>
                    </Tooltip>
                  )}
                </td>
                <td className={td}>
                  <IdChip>{s.stockId}</IdChip>
                </td>
                <td className={td}>
                  <div className="font-medium">{netName(s.networkId) ?? '—'}</div>
                  <div className="text-xs text-ink-muted">{s.feedstock || '—'}</div>
                </td>
                <td className={cn(td, 'text-right tabular-nums')}>{tco2(s.biocharT)} t</td>
                <td className={cn(td, 'text-right font-semibold text-info tabular-nums')}>
                  {s.creditsT != null ? (
                    <>
                      {tco2(s.creditsT)} tCO<sub>2</sub>
                    </>
                  ) : (
                    <span className="font-normal text-ink-subtle">—</span>
                  )}
                </td>
                <td className={cn(td, 'text-xs whitespace-nowrap')}>
                  <div>Prod: {s.producedAt ? day(s.producedAt) : '—'}</div>
                  <div className="text-ink-muted">Gen: {s.generatedAt ? day(s.generatedAt) : '—'}</div>
                </td>
                <td className={cn(td, 'text-right whitespace-nowrap')}>
                  <Button size="sm" className="rounded-lg" onClick={() => setCert(s)}>
                    <FileBadge /> Certificate
                  </Button>
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    className="ml-1"
                    disabled={pending}
                    onClick={() => toggle(s.id, !s.deleted)}
                    aria-label={s.deleted ? `Restore stock ${s.stockId}` : `Delete stock ${s.stockId}`}
                  >
                    {s.deleted ? <RotateCcw /> : <Trash2 />}
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <EmptyState icon={<Layers />} title="No stocks" sub="Stocks appear here once credits are generated on the registry." />
      )}
      <StockCertificate stock={cert} network={netName(cert?.networkId ?? null)} onClose={() => setCert(null)} />
    </LedgerCard>
  )
}

/** Printable summary of one stock. */
function StockCertificate({ stock, network, onClose }: { stock: StockRow | null; network?: string; onClose: () => void }) {
  const { data } = useDashboard()
  return (
    <Modal
      open={!!stock}
      onOpenChange={(o) => !o && onClose()}
      title="Stock certificate"
      description={stock?.code || `Stock ${stock?.stockId ?? ''}`}
      footer={
        <>
          <Button onClick={onClose}>Close</Button>
          <Button variant="primary" onClick={() => window.print()}>
            <Printer /> Print
          </Button>
        </>
      }
    >
      {stock && (
        <dl className="grid grid-cols-[140px_1fr] gap-x-4 gap-y-2.5 text-sm">
          <dt className="text-ink-muted">Issued by</dt>
          <dd className="font-semibold">{data.company.name}</dd>
          <dt className="text-ink-muted">Stock ID</dt>
          <dd className="font-mono">{stock.stockId}</dd>
          <dt className="text-ink-muted">Stock code</dt>
          <dd className="font-mono">{stock.code || '—'}</dd>
          <dt className="text-ink-muted">Network</dt>
          <dd>{network ?? '—'}</dd>
          <dt className="text-ink-muted">Feedstock</dt>
          <dd>{stock.feedstock || '—'}</dd>
          <dt className="text-ink-muted">Biochar</dt>
          <dd className="tabular-nums">{tco2(stock.biocharT)} t</dd>
          <dt className="text-ink-muted">Carbon credits</dt>
          <dd className="font-semibold tabular-nums">{stock.creditsT != null ? `${tco2(stock.creditsT)} t CO₂e` : '—'}</dd>
          <dt className="text-ink-muted">Produced</dt>
          <dd>{stock.producedAt ? day(stock.producedAt) : '—'}</dd>
          <dt className="text-ink-muted">Generated</dt>
          <dd>{stock.generatedAt ? day(stock.generatedAt) : '—'}</dd>
        </dl>
      )}
    </Modal>
  )
}

/* ------------------------------------------------------------------ */
/* Sinks ledger                                                        */
/* ------------------------------------------------------------------ */

const SINK_STATUS: Record<SinkRow['status'], { label: string; tone: BadgeTone }> = {
  pending: { label: 'Pending', tone: 'warn' },
  approved: { label: 'Approved', tone: 'success' },
  rejected: { label: 'Rejected', tone: 'danger' },
}

export function SinksLedger({ sinks, stocks }: { sinks: SinkRow[]; stocks: StockRow[] }) {
  const { data } = useDashboard()
  const router = useRouter()
  const [refreshing, startRefresh] = useTransition()
  const [showDeleted, setShowDeleted] = useState(false)
  const [open, setOpen] = useState<string | null>(null)
  const { toggle, pending } = useSoftDelete('sinks')
  const rows = sinks.filter((s) => showDeleted || !s.deleted)
  const paging = usePaging(rows)

  return (
    <LedgerCard
      icon={<Recycle />}
      title="Sinks ledger"
      sub="Stocks assigned to a blending matrix"
      total={rows.length}
      paging={paging as never}
      actions={
        <>
          <Button size="sm" className="rounded-lg" disabled={refreshing} onClick={() => startRefresh(() => router.refresh())}>
            <RefreshCw className={cn(refreshing && 'animate-spin')} /> Refresh status
          </Button>
          <ShowDeleted value={showDeleted} onChange={setShowDeleted} count={sinks.filter((s) => s.deleted).length} />
        </>
      }
    >
      {rows.length ? (
        <table className="w-full min-w-[820px] text-sm">
          <thead className="bg-muted/60">
            <tr>
              <th className={th}>Date</th>
              <th className={th}>Sink ID</th>
              <th className={th}>Linked stock</th>
              <th className={cn(th, 'text-right')}>Biochar (t)</th>
              <th className={th}>Matrix ID</th>
              <th className={th}>Status</th>
              <th className={cn(th, 'text-right')}>
                <span className="sr-only">Details</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {paging.slice.map((s) => {
              const st = stocks.find((x) => x.id === s.stockId)
              const isOpen = open === s.id
              const status = SINK_STATUS[s.status]
              return (
                <Fragment key={s.id}>
                  <tr className={cn('border-t border-line transition-colors hover:bg-muted/40', s.deleted && 'opacity-55')}>
                    <td className={cn(td, 'whitespace-nowrap')}>{day(s.date)}</td>
                    <td className={cn(td, 'font-mono text-xs')}>{s.sinkId}</td>
                    <td className={td}>{s.stockRef ? <IdChip tone="brand">{s.stockRef}</IdChip> : '—'}</td>
                    <td className={cn(td, 'text-right tabular-nums')}>{tco2(s.biocharT)}</td>
                    <td className={cn(td, 'font-mono text-xs font-semibold text-brand')}>{s.matrixId || '—'}</td>
                    <td className={td}>
                      <Badge tone={status.tone}>{status.label}</Badge>
                    </td>
                    <td className={cn(td, 'text-right')}>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => setOpen(isOpen ? null : s.id)}
                        aria-expanded={isOpen}
                        aria-label={`${isOpen ? 'Hide' : 'Show'} details of sink ${s.sinkId}`}
                      >
                        <ChevronDown className={cn('transition-transform', isOpen && 'rotate-180')} />
                      </Button>
                    </td>
                  </tr>
                  {isOpen && (
                    <tr className="bg-muted/30">
                      <td colSpan={7} className="px-4 py-4">
                        <div className="flex flex-wrap items-start gap-x-10 gap-y-3 text-sm">
                          <Detail label="Stock code" value={st?.code || '—'} mono />
                          <Detail label="Network" value={data.networks.find((n) => n.id === st?.networkId)?.name ?? '—'} />
                          <Detail label="Feedstock" value={st?.feedstock || '—'} />
                          <Detail label="Stock credits" value={st?.creditsT != null ? `${tco2(st.creditsT)} t CO₂e` : '—'} />
                          <Detail label="Stock generated" value={st?.generatedAt ? day(st.generatedAt) : '—'} />
                          <Button size="sm" className="ml-auto rounded-lg" disabled={pending} onClick={() => toggle(s.id, !s.deleted)}>
                            {s.deleted ? <RotateCcw /> : <Trash2 />}
                            {s.deleted ? 'Restore' : 'Delete'}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              )
            })}
          </tbody>
        </table>
      ) : (
        <EmptyState icon={<Recycle />} title="No sinks" sub="Sinks appear when stocks are assigned to a blending matrix." />
      )}
    </LedgerCard>
  )
}

const Detail = ({ label, value, mono }: { label: string; value: string; mono?: boolean }) => (
  <div>
    <div className="text-[11px] font-semibold tracking-wide text-ink-subtle uppercase">{label}</div>
    <div className={cn('mt-0.5 font-medium', mono && 'font-mono text-xs')}>{value}</div>
  </div>
)
