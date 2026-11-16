'use client'

import { ArrowLeft, ChevronDown, Cog, Download, FileText, FlaskConical, LineChart as LineChartIcon, Plus, Scale, SlidersHorizontal, Trash2 } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Fragment, useState } from 'react'
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { toast } from 'sonner'

import { Badge, Button, buttonVariants, Card, ConfirmDialog, EmptyState, Tooltip as Tip } from '../components/ui'
import { ANALYSIS_EVERY_DAYS, ANALYSIS_FIELDS, BULK_DENSITY_EVERY_M3, type LabKind, type LabReport, type LabStatus } from '../data/lab'
import { useDashboard } from '../data/store'
import type { PreprocessStep } from '../data/types'
import { fileSize } from '../lib/files'
import { cn, day, num } from '../lib/utils'
import { unwrap } from '../lib/unwrap'
import { deleteLabReport } from '../server/lab-reports'
import { UploadLabReport } from './LabReports'

const SERIES = [
  { key: 'density', label: 'Density (kg/m³)', color: '#8b3a2f', axis: 'left' },
  { key: 'carbon', label: 'Total carbon (%)', color: '#3b6fd8', axis: 'right' },
  { key: 'hc', label: 'H/C ratio', color: '#2e8b57', axis: 'right' },
  { key: 'ph', label: 'pH', color: '#d99a2b', axis: 'right' },
] as const

const METHOD: Record<PreprocessStep['method'], string> = { machine: 'Machine', sun: 'Sun', manual: 'Manual' }

/**
 * One feedstock at one network (Settings → Feedstock management → a network's row): how its lab values moved, the
 * bulk-density audit (every 100 m³), the network's pre-processing, and the archive of lab reports with every value.
 */
export function LabReportPage({
  feedstock,
  networkId,
  reports,
  status,
}: {
  feedstock: { id: string; name: string }
  networkId: string
  reports: LabReport[]
  status: LabStatus | undefined
}) {
  const { data } = useDashboard()
  const router = useRouter()
  const [uploading, setUploading] = useState<LabKind | null>(null)
  const [open, setOpen] = useState<Set<string>>(new Set())
  const [removing, setRemoving] = useState<LabReport | null>(null)
  const net = data.networks.find((n) => n.id === networkId)
  const ref = net?.config.references.find((r) => r.feedstock === feedstock.name)
  const since = status?.sinceBulkDensityM3 ?? 0
  const pct = Math.min(100, (since / BULK_DENSITY_EVERY_M3) * 100)
  const bulk = reports.filter((r) => r.kind === 'bulk-density')
  const analyses = reports.filter((r) => r.kind === 'analysis')
  const changed = () => router.refresh()

  // Oldest first, one point per report.
  const trend = [...reports]
    .sort((a, b) => a.reportDate.localeCompare(b.reportDate))
    .map((r) => ({ date: day(r.reportDate), density: r.bulkDensity, carbon: r.values.carbonTotal ?? null, hc: r.values.hcRatio ?? null, ph: r.values.ph ?? null }))

  const remove = async (r: LabReport) => {
    try {
      unwrap(await deleteLabReport(r.id))
      toast.success('Lab report removed')
      changed()
    } catch (err) {
      toast.error('Could not remove the report', { description: err instanceof Error ? err.message : String(err) })
    }
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-3 px-4 pt-4 pb-3 md:px-6 md:pt-5">
        <Tip content="Back to Feedstock management">
          <Link href="/admin/settings?section=feedstocks" aria-label="Back to Feedstock management" className={cn(buttonVariants({ variant: 'outline', size: 'icon' }), 'rounded-full')}>
            <ArrowLeft />
          </Link>
        </Tip>
        <div className="min-w-0">
          <h1 className="text-xl font-bold tracking-tight">{feedstock.name}</h1>
          <p className="text-[13px] text-ink-muted">
            {net ? `${net.name} · ${net.type === 'csink' ? 'C-sink' : 'Artisan Pro'}` : 'Network'}
          </p>
        </div>
        <div className="ml-auto flex flex-wrap gap-2">
          <Button variant={status?.bulkDensityDue ? 'primary' : 'outline'} onClick={() => setUploading('bulk-density')}>
            <Scale /> Upload bulk density report
          </Button>
          <Button variant={status?.analysisDue ? 'primary' : 'outline'} onClick={() => setUploading('analysis')}>
            <FlaskConical /> Upload lab analysis
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-4 px-3 pb-6 sm:px-4 md:px-6">
        {/* ---------- trend ---------- */}
        <Card className="p-4">
          <SectionTitle icon={<LineChartIcon />} title="Lab values over time" sub="From every report uploaded for this feedstock at this network." />
          {trend.length ? (
            <div className="mt-3 h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trend} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-line)" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                  <YAxis yAxisId="left" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={44} />
                  <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={36} />
                  <Tooltip contentStyle={{ borderRadius: 12, fontSize: 12 }} />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                  {SERIES.map((s) => (
                    <Line key={s.key} yAxisId={s.axis} type="monotone" dataKey={s.key} name={s.label} stroke={s.color} strokeWidth={2} dot={{ r: 3 }} connectNulls />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <EmptyState icon={<LineChartIcon />} title="No lab values yet" sub="Upload a bulk density report or a lab analysis to start the trend." />
          )}
        </Card>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {/* ---------- bulk density audit ---------- */}
          <Card className="flex flex-col gap-4 p-4">
            <div className="flex items-start gap-3">
              <SectionTitle icon={<SlidersHorizontal />} title="Bulk density audit" sub={`Required every ${BULK_DENSITY_EVERY_M3} m³ of biochar produced.`} />
              <div className="ml-auto text-right">
                <div className="text-[11px] font-bold tracking-wide text-ink-muted uppercase">Current active</div>
                <div className="font-bold tabular-nums">{ref?.bulkDensity ? `${num(ref.bulkDensity, 0)} kg/m³` : '—'}</div>
                <div className="text-xs text-ink-muted">{status?.lastBulkDensity ? `Report of ${day(status.lastBulkDensity.date)}` : 'No report yet'}</div>
              </div>
              <Tip content="Upload a bulk density report">
                <Button variant="outline" size="icon-sm" aria-label="Upload a bulk density report" onClick={() => setUploading('bulk-density')}>
                  <Plus />
                </Button>
              </Tip>
            </div>
            <div>
              <div className="flex items-baseline justify-between text-xs font-bold tracking-wide text-ink-muted uppercase">
                <span>Volume processed</span>
                <span className={cn('tabular-nums normal-case', status?.bulkDensityDue ? 'text-danger' : 'text-ink')}>
                  {num(since, 2)} / {BULK_DENSITY_EVERY_M3} m³ limit
                </span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted" aria-hidden>
                <div className={cn('h-full rounded-full', status?.bulkDensityDue ? 'bg-danger' : pct >= 75 ? 'bg-warn' : 'bg-info')} style={{ width: `${pct}%` }} />
              </div>
              {status?.bulkDensityDue && <div className="mt-1.5 text-xs font-semibold text-danger">A new bulk-density report is due.</div>}
            </div>
            <div>
              <div className="mb-2 text-xs font-bold tracking-wide text-ink-muted uppercase">Recent audit ledger</div>
              {bulk.length ? (
                <ul className="flex flex-col gap-2">
                  {bulk.map((r) => (
                    <li key={r.id} className="flex items-center gap-3 rounded-xl border border-line p-3">
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-ink-muted">
                        <Scale className="size-4" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-bold tabular-nums">{r.bulkDensity != null ? `${num(r.bulkDensity, 0)} kg/m³` : '—'}</span>
                          {r.producedM3 != null && <Badge tone="neutral">Vol: {num(r.producedM3, 2)} m³</Badge>}
                        </div>
                        <div className="text-xs text-ink-muted">
                          {day(r.reportDate)}
                          {r.note ? ` · ${r.note}` : ''}
                        </div>
                      </div>
                      <Proof report={r} />
                      <RemoveButton onClick={() => setRemoving(r)} />
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-ink-subtle">No bulk density report yet.</p>
              )}
            </div>
          </Card>

          {/* ---------- pre-processing ---------- */}
          <Card className="flex flex-col gap-4 p-4">
            <div className="flex items-start gap-3">
              <SectionTitle icon={<Cog />} title="Pre-processing" sub="How this network prepares biomass before burning." />
              <Link href="/admin/networks" className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'ml-auto')}>
                Edit in network
              </Link>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {(['drying', 'shredding'] as const).map((k) => {
                const step = net?.config[k]
                return (
                  <div key={k} className={cn('flex min-h-32 flex-col items-center justify-center gap-1.5 rounded-xl border p-4 text-center', step ? 'border-clay/40 bg-clay-soft/40' : 'border-line bg-muted/50')}>
                    <SlidersHorizontal className="size-5 text-ink-muted" />
                    <div className="text-xs font-bold tracking-wide uppercase">{k === 'drying' ? 'Drying process' : 'Shredding process'}</div>
                    <div className="text-sm text-ink-2">{step ? `${METHOD[step.method]}${step.description ? ` · ${step.description}` : ''}` : '—'}</div>
                    {step?.documents.length ? <div className="text-xs text-ink-muted">{step.documents.length} document{step.documents.length === 1 ? '' : 's'}</div> : null}
                  </div>
                )
              })}
            </div>
          </Card>
        </div>

        {/* ---------- lab analysis archive ---------- */}
        <Card className="p-4">
          <div className="flex items-start gap-3">
            <SectionTitle
              icon={<FileText />}
              title="Lab analysis archive"
              sub={status?.analysisDue ? 'A new lab analysis is due: one is needed every year.' : `One is needed every ${ANALYSIS_EVERY_DAYS === 365 ? 'year' : `${ANALYSIS_EVERY_DAYS} days`}.`}
              danger={status?.analysisDue}
            />
          </div>
          {analyses.length ? (
            <div className="mt-3 overflow-x-auto rounded-xl border border-line">
              <table className="w-full min-w-[720px] text-[13px]">
                <thead>
                  <tr className="border-b border-line bg-muted text-xs text-ink-muted uppercase">
                    <th className="px-3 py-2.5 text-left font-semibold">Report date</th>
                    <th className="px-3 py-2.5 text-left font-semibold">Attached proof</th>
                    <th className="px-3 py-2.5 text-right font-semibold">Total carbon</th>
                    <th className="px-3 py-2.5 text-right font-semibold">Density (kg/m³)</th>
                    <th className="px-3 py-2.5 text-right font-semibold">H/C ratio</th>
                    <th className="px-3 py-2.5 text-right font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {analyses.map((r) => {
                    const shown = open.has(r.id)
                    const toggle = () =>
                      setOpen((s) => {
                        const n = new Set(s)
                        if (n.has(r.id)) n.delete(r.id)
                        else n.add(r.id)
                        return n
                      })
                    return (
                      <Fragment key={r.id}>
                        <tr className={cn('cursor-pointer border-b border-line last:border-0 hover:bg-muted/60', shown && 'bg-clay-soft/30')} onClick={toggle}>
                          <td className="px-3 py-3 font-medium">{day(r.reportDate)}</td>
                          <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
                            <Proof report={r} wide />
                          </td>
                          <td className="px-3 py-3 text-right tabular-nums">{r.values.carbonTotal != null ? `${num(r.values.carbonTotal, 2)}%` : '—'}</td>
                          <td className="px-3 py-3 text-right tabular-nums">{r.bulkDensity != null ? num(r.bulkDensity, 0) : '—'}</td>
                          <td className="px-3 py-3 text-right tabular-nums">{r.values.hcRatio != null ? num(r.values.hcRatio, 2) : '—'}</td>
                          <td className="px-3 py-3 text-right">
                            <span className="inline-flex items-center gap-1">
                              <Button variant="ghost" size="sm" aria-expanded={shown} onClick={(e) => (e.stopPropagation(), toggle())}>
                                {shown ? 'Hide' : 'View'} <ChevronDown className={cn('transition-transform', shown && 'rotate-180')} />
                              </Button>
                              <RemoveButton onClick={(e) => (e.stopPropagation(), setRemoving(r))} />
                            </span>
                          </td>
                        </tr>
                        {shown && (
                          <tr className="border-b border-line bg-clay-soft/20 last:border-0">
                            <td colSpan={6} className="p-3">
                              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                                {ANALYSIS_FIELDS.map((f) => (
                                  <Value key={f.key} label={f.label} value={r.values[f.key] != null ? `${num(r.values[f.key]!, 2)}${f.unit ? ` ${f.unit}` : ''}` : '—'} />
                                ))}
                                <Value label="Density" value={r.bulkDensity != null ? `${num(r.bulkDensity, 0)} kg/m³` : '—'} />
                              </div>
                              {(r.note || r.uploadedBy) && (
                                <div className="mt-2 text-xs text-ink-muted">{[r.note, r.uploadedBy && `Added by ${r.uploadedBy}`].filter(Boolean).join(' · ')}</div>
                              )}
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    )
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState icon={<FlaskConical />} title="No lab analysis yet" sub="Upload the yearly analysis: carbon, organic carbon, hydrogen, H/C ratio, ash, pH and water holding capacity." />
          )}
        </Card>
      </div>

      <UploadLabReport
        key={uploading ?? 'none'}
        kind={uploading}
        onClose={() => setUploading(null)}
        feedstock={feedstock.name}
        feedstockId={feedstock.id}
        network={{ id: networkId, name: net?.name ?? 'this network' }}
        onSaved={changed}
      />
      <ConfirmDialog
        open={!!removing}
        onOpenChange={(o) => !o && setRemoving(null)}
        title="Remove this lab report?"
        message="The report and its file are deleted. The bulk density in use stays as it is."
        confirmLabel="Remove"
        onConfirm={() => removing && void remove(removing)}
      />
    </>
  )
}

function SectionTitle({ icon, title, sub, danger }: { icon: React.ReactNode; title: string; sub: string; danger?: boolean }) {
  return (
    <div className="flex min-w-0 items-start gap-3">
      <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-clay-soft text-clay [&_svg]:size-4">{icon}</span>
      <div className="min-w-0">
        <h2 className="font-bold">{title}</h2>
        <p className={cn('text-sm', danger ? 'font-semibold text-danger' : 'text-ink-muted')}>{sub}</p>
      </div>
    </div>
  )
}

function Proof({ report, wide }: { report: LabReport; wide?: boolean }) {
  if (!report.file) return <span className="text-xs text-ink-subtle">No file</span>
  return (
    <a
      href={`/admin/files/${report.file.id}`}
      target="_blank"
      rel="noopener"
      title={`${report.file.name} · ${fileSize(report.file.size)}`}
      className={cn('inline-flex max-w-full items-center gap-1.5 rounded-lg bg-clay-soft px-2.5 py-1 text-xs font-semibold text-clay hover:underline', wide ? 'max-w-[260px]' : '')}
    >
      <Download className="size-3.5 shrink-0" />
      <span className="truncate">{wide ? report.file.name : 'Proof'}</span>
    </a>
  )
}

function RemoveButton({ onClick }: { onClick: (e: React.MouseEvent) => void }) {
  return (
    <Tip content="Remove this report">
      <Button variant="ghost" size="icon-sm" aria-label="Remove this report" onClick={onClick}>
        <Trash2 />
      </Button>
    </Tip>
  )
}

function Value({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-line bg-surface px-3 py-2">
      <div className="text-[11px] font-bold tracking-wide text-ink-muted uppercase">{label}</div>
      <div className="text-sm font-semibold tabular-nums">{value}</div>
    </div>
  )
}
