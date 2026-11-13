'use client'

import { Download, FileText, FlaskConical, Scale, Trash2, Upload } from 'lucide-react'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'

import { Badge, Button, ConfirmDialog, EmptyState, Field, Input, Modal } from '../components/ui'
import { ANALYSIS_EVERY_DAYS, ANALYSIS_FIELDS, BULK_DENSITY_EVERY_M3, REQUIRED_ANALYSIS, type LabKind, type LabReport, type LabStatus } from '../data/lab'
import { fileSize } from '../lib/files'
import { cn, day, num } from '../lib/utils'
import { unwrap } from '../lib/unwrap'
import { addLabReport, deleteLabReport } from '../server/lab-reports'

/** Compact status for one network's row in the feedstock table. */
export function LabStatusCells({ status }: { status: LabStatus | undefined }) {
  const since = status?.sinceBulkDensityM3 ?? 0
  const pct = Math.min(100, (since / BULK_DENSITY_EVERY_M3) * 100)
  return (
    <>
      <td className="px-3 py-2">
        <div className="flex items-center gap-2">
          <div className="h-1.5 w-20 overflow-hidden rounded-full bg-muted" aria-hidden>
            <div className={cn('h-full rounded-full', status?.bulkDensityDue ? 'bg-danger' : 'bg-info')} style={{ width: `${pct}%` }} />
          </div>
          <span className={cn('text-xs tabular-nums', status?.bulkDensityDue ? 'font-semibold text-danger' : 'text-ink-muted')}>
            {num(since, 1)} / {BULK_DENSITY_EVERY_M3} m³
          </span>
        </div>
      </td>
      <td className="px-3 py-2 text-xs">
        {status?.analysisDue ? (
          <Badge tone="danger">Due</Badge>
        ) : status?.lastAnalysis ? (
          <span className="text-ink-muted">{day(status.lastAnalysis.date)}</span>
        ) : (
          <span className="text-ink-subtle">—</span>
        )}
      </td>
    </>
  )
}

/** One network's lab reports for a feedstock: where it stands, the archive, and uploading a new report. */
export function LabReportsModal({
  open,
  onOpenChange,
  feedstock,
  feedstockId,
  network,
  status,
  reports,
  reference,
  onChanged,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  feedstock: string
  feedstockId: string
  network: { id: string; name: string }
  status: LabStatus | undefined
  reports: LabReport[]
  reference: { bulkDensity?: number; carbonContent?: number } | undefined
  onChanged: () => void
}) {
  const [uploading, setUploading] = useState<LabKind | null>(null)
  const [removing, setRemoving] = useState<LabReport | null>(null)
  const since = status?.sinceBulkDensityM3 ?? 0
  const pct = Math.min(100, (since / BULK_DENSITY_EVERY_M3) * 100)

  const remove = async (r: LabReport) => {
    try {
      unwrap(await deleteLabReport(r.id))
      toast.success('Lab report removed')
      onChanged()
    } catch (err) {
      toast.error('Could not remove the report', { description: err instanceof Error ? err.message : String(err) })
    }
  }

  return (
    <Modal open={open} onOpenChange={onOpenChange} title={`${feedstock} · ${network.name}`} description="Lab reports for this feedstock at this network." className="max-w-3xl">
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-line p-3">
            <div className="text-xs font-semibold text-ink-muted">Bulk density in use</div>
            <div className="mt-1 text-lg font-bold tabular-nums">{reference?.bulkDensity ? `${num(reference.bulkDensity, 0)} kg/m³` : '—'}</div>
            <div className="text-xs text-ink-muted">{status?.lastBulkDensity ? `Report of ${day(status.lastBulkDensity.date)}` : 'No report uploaded yet'}</div>
          </div>
          <div className={cn('rounded-xl border p-3', status?.bulkDensityDue ? 'border-danger/40 bg-danger-soft/40' : 'border-line')}>
            <div className="text-xs font-semibold text-ink-muted">Biochar since the last bulk-density report</div>
            <div className={cn('mt-1 text-lg font-bold tabular-nums', status?.bulkDensityDue && 'text-danger')}>
              {num(since, 1)} / {BULK_DENSITY_EVERY_M3} m³
            </div>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden>
              <div className={cn('h-full rounded-full', status?.bulkDensityDue ? 'bg-danger' : 'bg-info')} style={{ width: `${pct}%` }} />
            </div>
            {status?.bulkDensityDue && <div className="mt-1.5 text-xs font-semibold text-danger">A new bulk-density report is due</div>}
          </div>
          <div className={cn('rounded-xl border p-3', status?.analysisDue ? 'border-danger/40 bg-danger-soft/40' : 'border-line')}>
            <div className="text-xs font-semibold text-ink-muted">Lab analysis</div>
            <div className="mt-1 text-lg font-bold">{status?.lastAnalysis ? day(status.lastAnalysis.date) : '—'}</div>
            <div className={cn('text-xs', status?.analysisDue ? 'font-semibold text-danger' : 'text-ink-muted')}>
              {status?.analysisDue ? 'Due: one is needed every year' : `Needed every ${ANALYSIS_EVERY_DAYS / 365 === 1 ? 'year' : `${ANALYSIS_EVERY_DAYS} days`}`}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant={status?.bulkDensityDue ? 'primary' : 'outline'} onClick={() => setUploading('bulk-density')}>
            <Scale /> Upload bulk density report
          </Button>
          <Button size="sm" variant={status?.analysisDue ? 'primary' : 'outline'} onClick={() => setUploading('analysis')}>
            <FlaskConical /> Upload lab analysis
          </Button>
        </div>

        <div>
          <h3 className="mb-2 text-sm font-bold">Report archive</h3>
          {reports.length ? (
            <ul className="flex flex-col gap-2">
              {reports.map((r) => (
                <li key={r.id} className="rounded-xl border border-line p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={r.kind === 'analysis' ? 'info' : 'neutral'}>{r.kind === 'analysis' ? 'Lab analysis' : 'Bulk density'}</Badge>
                    <span className="text-sm font-semibold">{day(r.reportDate)}</span>
                    {r.producedM3 != null && <span className="text-xs text-ink-muted">at {num(r.producedM3, 1)} m³ produced</span>}
                    <span className="flex-1" />
                    {r.file && (
                      <a
                        href={`/admin/files/${r.file.id}`}
                        target="_blank"
                        rel="noopener"
                        className="flex items-center gap-1 text-xs font-semibold text-brand hover:underline"
                        title={r.file.name}
                      >
                        <Download className="size-3.5" /> {fileSize(r.file.size)}
                      </a>
                    )}
                    <Button variant="ghost" size="icon-sm" aria-label="Remove this report" onClick={() => setRemoving(r)}>
                      <Trash2 />
                    </Button>
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-1.5 sm:grid-cols-4">
                    {r.bulkDensity != null && <Value label="Bulk density" value={`${num(r.bulkDensity, 0)} kg/m³`} />}
                    {ANALYSIS_FIELDS.filter((f) => r.values[f.key] != null).map((f) => (
                      <Value key={f.key} label={f.label} value={`${num(r.values[f.key]!, 2)}${f.unit ? ` ${f.unit}` : ''}`} />
                    ))}
                  </div>
                  {(r.note || r.uploadedBy) && <div className="mt-1.5 text-xs text-ink-muted">{[r.note, r.uploadedBy && `Added by ${r.uploadedBy}`].filter(Boolean).join(' · ')}</div>}
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState icon={<FileText />} title="No lab reports yet" sub="Upload the bulk density report and the yearly lab analysis." />
          )}
        </div>
      </div>

      <UploadLabReport
        key={uploading ?? 'none'}
        kind={uploading}
        onClose={() => setUploading(null)}
        feedstock={feedstock}
        feedstockId={feedstockId}
        network={network}
        onSaved={onChanged}
      />
      <ConfirmDialog
        open={!!removing}
        onOpenChange={(o) => !o && setRemoving(null)}
        title="Remove this lab report?"
        message="The report and its file are deleted. The bulk density in use stays as it is."
        confirmLabel="Remove"
        onConfirm={() => removing && void remove(removing)}
      />
    </Modal>
  )
}

function Value({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-muted px-2.5 py-1.5">
      <div className="text-[11px] font-semibold text-ink-muted uppercase">{label}</div>
      <div className="text-sm font-semibold tabular-nums">{value}</div>
    </div>
  )
}

function UploadLabReport({
  kind,
  onClose,
  feedstock,
  feedstockId,
  network,
  onSaved,
}: {
  kind: LabKind | null
  onClose: () => void
  feedstock: string
  feedstockId: string
  network: { id: string; name: string }
  onSaved: () => void
}) {
  const [pending, start] = useTransition()
  const [file, setFile] = useState<File | null>(null)
  const analysis = kind === 'analysis'

  const submit = (form: FormData) =>
    start(async () => {
      if (!kind) return
      form.set('kind', kind)
      form.set('feedstockId', feedstockId)
      form.set('networkId', network.id)
      if (file) form.set('file', file)
      try {
        unwrap(await addLabReport(form))
        toast.success(analysis ? 'Lab analysis added' : 'Bulk density report added', { description: `It is now the lab reference for ${feedstock} at ${network.name}.` })
        onClose()
        onSaved()
      } catch (err) {
        toast.error('Could not add the report', { description: err instanceof Error ? err.message : String(err) })
      }
    })

  return (
    <Modal
      open={!!kind}
      onOpenChange={(o) => !o && onClose()}
      title={analysis ? 'Upload lab analysis' : 'Upload bulk density report'}
      description={`${feedstock} · ${network.name}`}
      className={analysis ? 'max-w-2xl' : undefined}
    >
      <form action={submit} className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Report date">
            <Input name="reportDate" type="date" required max={new Date().toISOString().slice(0, 10)} defaultValue={new Date().toISOString().slice(0, 10)} />
          </Field>
          <Field label={analysis ? 'Bulk density (kg/m³, if reported)' : 'Bulk density (kg/m³)'}>
            <Input name="bulkDensity" inputMode="decimal" required={!analysis} placeholder="462" />
          </Field>
        </div>
        {analysis && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {ANALYSIS_FIELDS.map((f) => {
              const required = REQUIRED_ANALYSIS.includes(f.key)
              return (
                <Field key={f.key} label={`${f.label}${f.unit ? ` (${f.unit})` : ''}${required ? '' : ' · optional'}`}>
                  <Input name={f.key} inputMode="decimal" required={required} />
                </Field>
              )
            })}
          </div>
        )}
        <Field label="Note (optional)">
          <Input name="note" maxLength={300} placeholder="Lab name, sample code…" />
        </Field>
        <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-line-strong p-4 hover:bg-muted">
          <Upload className="size-5 text-ink-muted" />
          <span className="min-w-0 flex-1 text-sm">
            {file ? (
              <>
                <span className="block truncate font-semibold">{file.name}</span>
                <span className="text-xs text-ink-muted">{fileSize(file.size)}</span>
              </>
            ) : (
              <span className="text-ink-muted">Attach the lab report (PDF or image)</span>
            )}
          </span>
          <input
            type="file"
            className="sr-only"
            accept=".pdf,.png,.jpg,.jpeg,.webp,.xlsx,.xls,.csv"
            onChange={(e) => {
              const f = e.target.files?.[0] ?? null
              if (f && f.size > 4 * 1024 * 1024) {
                toast.error('Files can be at most 4 MB')
                e.target.value = ''
                return
              }
              setFile(f)
            }}
          />
        </label>
        <p className="text-xs text-ink-muted">
          Saving makes these values the lab reference for {feedstock} at {network.name}
          {analysis ? ' (total carbon becomes the carbon content)' : ''}. The next bulk-density report is due after another {BULK_DENSITY_EVERY_M3} m³ of biochar.
        </p>
        <div className="flex justify-end gap-2">
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary" disabled={pending || !file}>
            {pending ? 'Saving…' : 'Save report'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
