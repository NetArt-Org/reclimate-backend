'use client'

import { Upload } from 'lucide-react'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'

import { Badge, Button, Input, Modal } from '../components/ui'
import { ANALYSIS_FIELDS, BULK_DENSITY_EVERY_M3, REQUIRED_ANALYSIS, type LabKind, type LabStatus } from '../data/lab'
import { fileSize } from '../lib/files'
import { cn, day, num } from '../lib/utils'
import { unwrap } from '../lib/unwrap'
import { addLabReport } from '../server/lab-reports'

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

/**
 * A form field whose label always fits on one line (name, unit, and an "Optional" tag on the right), so every input
 * in a row starts at the same height.
 */
function LabField({ label, unit, optional, children }: { label: string; unit?: string; optional?: boolean; children: React.ReactNode }) {
  return (
    <label className="flex min-w-0 flex-col gap-1.5">
      <span className="flex h-4 items-center gap-1.5 text-xs font-bold tracking-wide text-ink-muted uppercase">
        <span className="truncate" title={unit ? `${label} (${unit})` : label}>
          {label}
          {unit && <span className="font-semibold normal-case"> ({unit})</span>}
        </span>
        {optional && <span className="ml-auto shrink-0 rounded bg-muted px-1.5 py-px text-[10px] font-semibold tracking-normal normal-case text-ink-subtle">Optional</span>}
      </span>
      {children}
    </label>
  )
}

export function UploadLabReport({
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
        <div className="grid grid-cols-1 gap-x-3 gap-y-4 sm:grid-cols-2">
          <LabField label="Report date">
            <Input name="reportDate" type="date" required max={new Date().toISOString().slice(0, 10)} defaultValue={new Date().toISOString().slice(0, 10)} />
          </LabField>
          <LabField label="Bulk density" unit="kg/m³" optional={analysis}>
            <Input name="bulkDensity" inputMode="decimal" required={!analysis} placeholder="462" />
          </LabField>
        </div>
        {analysis && (
          <div className="grid grid-cols-2 gap-x-3 gap-y-4 sm:grid-cols-3">
            {ANALYSIS_FIELDS.map((f) => (
              <LabField key={f.key} label={f.label} unit={f.unit} optional={!REQUIRED_ANALYSIS.includes(f.key)}>
                <Input name={f.key} inputMode="decimal" required={REQUIRED_ANALYSIS.includes(f.key)} />
              </LabField>
            ))}
          </div>
        )}
        <LabField label="Note" optional>
          <Input name="note" maxLength={300} placeholder="Lab name, sample code…" />
        </LabField>
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
