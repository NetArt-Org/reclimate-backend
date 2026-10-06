'use client'

import { ChevronRight, FileText, FlaskConical, Hand, Save, Sun, Trash2, Upload, Wind, Zap } from 'lucide-react'
import { useRef, useState, type ReactNode } from 'react'
import { toast } from 'sonner'

import { Button, Checkbox, Input, Segmented, Sheet, Textarea } from '../components/ui'
import { APPLICATION_TYPES, MIXING_TYPES, referenceDefaults } from '../data/catalog'
import { useDashboard } from '../data/store'
import type { Network, NetworkConfig, PreprocessStep } from '../data/types'
import { fileSize, readDoc } from '../lib/files'
import { cn } from '../lib/utils'

type View = 'main' | 'preprocess' | 'reference'

/** "Edit config" side panel, with drill-in pages for pre-processing and biomass reference values. */
export function EditConfigSheet({ network, open, onOpenChange }: { network: Network; open: boolean; onOpenChange: (o: boolean) => void }) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title="Edit configuration" className="max-w-2xl">
      {/* Remount the editor each time it opens, so it starts from the saved config. */}
      {open && <Editor network={network} onDone={() => onOpenChange(false)} />}
    </Sheet>
  )
}

function Editor({ network, onDone }: { network: Network; onDone: () => void }) {
  const { data, updateConfig } = useDashboard()
  const FEEDSTOCKS = data.feedstocks.map((f) => f.name)
  const [draft, setDraft] = useState<NetworkConfig>(() => structuredClone(network.config))
  const [view, setView] = useState<View>('main')
  const dirty = JSON.stringify(draft) !== JSON.stringify(network.config)

  const toggle = (key: 'feedstocks' | 'mixingTypes' | 'applicationTypes', item: string) =>
    setDraft((d) => {
      const list = d[key].includes(item) ? d[key].filter((x) => x !== item) : [...d[key], item]
      const next = { ...d, [key]: list }
      // A newly assigned feedstock gets typical reference values to start from.
      if (key === 'feedstocks' && !d.references.some((r) => r.feedstock === item) && list.includes(item)) {
        next.references = [...d.references, { feedstock: item, ...referenceDefaults(data.feedstocks, item) }]
      }
      return next
    })

  const save = () => {
    if (!draft.feedstocks.length) {
      toast.error('Assign at least one feedstock')
      return
    }
    updateConfig(network.id, draft)
    toast.success('Configuration saved')
    onDone()
  }

  if (view === 'preprocess') return <PreprocessView draft={draft} setDraft={setDraft} onBack={() => setView('main')} />
  if (view === 'reference') return <ReferenceView draft={draft} setDraft={setDraft} onBack={() => setView('main')} />

  return (
    <div className="-mx-4 -my-3 flex min-h-full flex-col">
      <div className="px-6 pt-1 pb-5">
        <div className="text-xl font-bold">{network.name}</div>
        <div className="mt-0.5 text-sm text-ink-muted">Configuration</div>
      </div>
      <div className="flex-1 px-6">
        <Section label="Assigned feedstocks">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {FEEDSTOCKS.map((f) => {
              const on = draft.feedstocks.includes(f)
              return (
                <label
                  key={f}
                  className={cn(
                    'flex cursor-pointer items-center gap-3 rounded-2xl border px-3.5 py-3 text-sm font-bold transition-colors',
                    on ? 'border-amber-300 bg-amber-50' : 'border-transparent bg-muted hover:border-line',
                  )}
                >
                  <Checkbox checked={on} onCheckedChange={() => toggle('feedstocks', f)} className="data-[state=checked]:border-amber-500 data-[state=checked]:bg-amber-500" />
                  <span className="flex size-7 items-center justify-center rounded-full bg-surface text-xs text-ink-muted">{f[0]}</span>
                  <span className="truncate">{f}</span>
                </label>
              )
            })}
          </div>
        </Section>

        <Section label="Mixing type">
          <div className="flex flex-col gap-2">
            {MIXING_TYPES.map((m) => (
              <CheckRow key={m} on={draft.mixingTypes.includes(m)} onToggle={() => toggle('mixingTypes', m)} tone="info">
                {m}
              </CheckRow>
            ))}
          </div>
        </Section>

        <Section label="Application category">
          <div className="flex flex-wrap gap-2">
            {APPLICATION_TYPES.map((a) => (
              <CheckRow key={a} on={draft.applicationTypes.includes(a)} onToggle={() => toggle('applicationTypes', a)} tone="success" inline>
                {a}
              </CheckRow>
            ))}
          </div>
        </Section>

        <Section label="Advanced configuration">
          <div className="flex flex-col gap-2">
            <DrillRow
              icon={<Wind />}
              tone="bg-amber-50 text-amber-600"
              title="Biomass pre-processing"
              sub={[draft.drying && `Drying: ${METHOD_LABEL[draft.drying.method]}`, draft.shredding && `Shredding: ${METHOD_LABEL[draft.shredding.method]}`].filter(Boolean).join(' · ') || 'Not configured'}
              onClick={() => setView('preprocess')}
            />
            <DrillRow
              icon={<FlaskConical />}
              tone="bg-success-soft text-success"
              title="Biomass reference"
              sub={draft.references.length ? `${draft.references.length} feedstock values` : 'Not configured'}
              onClick={() => setView('reference')}
            />
          </div>
        </Section>
      </div>
      <div className="sticky bottom-0 mt-6 border-t border-line bg-surface px-4 py-3">
        <Button variant="dark" size="lg" className="w-full rounded-2xl" onClick={save} disabled={!dirty}>
          <Save /> {dirty ? 'Save configuration' : 'No changes'}
        </Button>
      </div>
    </div>
  )
}

const METHOD_LABEL: Record<PreprocessStep['method'], string> = { machine: 'Machine', sun: 'Sun', manual: 'Manual' }

function PreprocessView({
  draft,
  setDraft,
  onBack,
}: {
  draft: NetworkConfig
  setDraft: React.Dispatch<React.SetStateAction<NetworkConfig>>
  onBack: () => void
}) {
  const [step, setStep] = useState<'drying' | 'shredding'>('drying')
  const file = useRef<HTMLInputElement>(null)
  const [local, setLocal] = useState<Record<'drying' | 'shredding', PreprocessStep>>({
    drying: draft.drying ?? { method: 'machine', description: '', documents: [] },
    shredding: draft.shredding ?? { method: 'machine', description: '', documents: [] },
  })
  const s = local[step]
  const set = (patch: Partial<PreprocessStep>) => setLocal((l) => ({ ...l, [step]: { ...l[step], ...patch } }))

  const options =
    step === 'drying'
      ? [
          { value: 'machine' as const, label: 'Machine drying', icon: <Zap /> },
          { value: 'sun' as const, label: 'Sun drying', icon: <Sun /> },
        ]
      : [
          { value: 'machine' as const, label: 'Machine', icon: <Zap /> },
          { value: 'manual' as const, label: 'Manual', icon: <Hand /> },
        ]

  const apply = () => {
    setDraft((d) => ({ ...d, [step]: s }))
    toast.success(`${step === 'drying' ? 'Drying' : 'Shredding'} updated — remember to save the configuration`)
    onBack()
  }

  return (
    <SubView title="Pre-processing" onBack={onBack}>
      <Section label="Process type">
        <Segmented
          className="flex w-full [&>button]:flex-1 [&>button]:py-2.5"
          value={step}
          onChange={setStep}
          options={[
            { value: 'drying', label: 'Drying' },
            { value: 'shredding', label: 'Shredding' },
          ]}
        />
      </Section>
      <Section label={step === 'drying' ? 'Drying type' : 'Shredding type'}>
        <div className="grid grid-cols-2 gap-3">
          {options.map((o) => (
            <button
              key={o.value}
              type="button"
              onClick={() => set({ method: o.value })}
              className={cn(
                'flex cursor-pointer flex-col items-center gap-3 rounded-2xl border px-4 py-6 text-sm font-semibold transition-colors [&_svg]:size-4',
                s.method === o.value ? 'border-amber-300 bg-amber-50' : 'border-line hover:bg-muted',
              )}
            >
              <span className={cn('flex size-10 items-center justify-center rounded-full', s.method === o.value ? 'bg-danger-soft text-danger' : 'bg-muted text-ink-muted')}>
                {o.icon}
              </span>
              {o.label}
            </button>
          ))}
        </div>
      </Section>
      <Section label="Description">
        <Textarea value={s.description} onChange={(e) => set({ description: e.target.value })} placeholder="Describe the method: equipment, duration, target moisture…" />
      </Section>
      <Section label="Documents">
        <button
          type="button"
          onClick={() => file.current?.click()}
          className="flex w-full cursor-pointer items-center gap-3 rounded-2xl border border-dashed border-line-strong bg-muted px-4 py-3.5 text-sm text-ink-muted hover:border-clay"
        >
          <Upload className="size-4" />
          <span className="flex-1 text-left">Select files to upload</span>
          <span className="font-bold text-clay">Browse</span>
        </button>
        <input
          ref={file}
          type="file"
          multiple
          hidden
          accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
          onChange={async (e) => {
            const files = [...(e.target.files ?? [])]
            e.target.value = ''
            try {
              const docs = await Promise.all(files.map(readDoc))
              set({ documents: [...s.documents, ...docs] })
            } catch (err) {
              toast.error('Could not upload the document', { description: err instanceof Error ? err.message : String(err) })
            }
          }}
        />
        <div className="mt-1.5 text-xs font-semibold text-info">Accepted: PDF, JPEG, JPG, PNG, DOC and DOCX, up to 4 MB each.</div>
        <div className="mt-3 flex flex-col gap-2">
          {s.documents.map((d) => (
            <div key={d.id} className="flex items-center gap-3 rounded-xl border border-line px-3 py-2">
              <FileText className="size-4 text-ink-muted" />
              <span className="flex-1 truncate text-sm font-semibold">{d.name}</span>
              <span className="text-xs text-ink-subtle">{fileSize(d.size)}</span>
              <Button variant="ghost" size="icon-sm" aria-label={`Remove ${d.name}`} onClick={() => set({ documents: s.documents.filter((x) => x.id !== d.id) })}>
                <Trash2 />
              </Button>
            </div>
          ))}
        </div>
      </Section>
      <Button variant="dark" size="lg" className="mt-6 w-full rounded-2xl" onClick={apply}>
        Update process configuration
      </Button>
    </SubView>
  )
}

function ReferenceView({
  draft,
  setDraft,
  onBack,
}: {
  draft: NetworkConfig
  setDraft: React.Dispatch<React.SetStateAction<NetworkConfig>>
  onBack: () => void
}) {
  const [rows, setRows] = useState(() => draft.references.filter((r) => draft.feedstocks.includes(r.feedstock)))
  const set = (i: number, key: 'bulkDensity' | 'moisture' | 'carbonContent', v: string) =>
    setRows((rs) => rs.map((r, j) => (j === i ? { ...r, [key]: Number(v) } : r)))

  return (
    <SubView title="Biomass reference" onBack={onBack}>
      <p className="mb-4 text-sm text-ink-muted">Lab values used to convert measured volume and weight. One row per assigned feedstock.</p>
      {rows.length === 0 && <div className="rounded-2xl bg-muted p-6 text-center text-sm text-ink-muted">Assign a feedstock first.</div>}
      <div className="flex flex-col gap-3">
        {rows.map((r, i) => (
          <div key={r.feedstock} className="rounded-2xl border border-line p-4">
            <div className="mb-3 font-bold">{r.feedstock}</div>
            <div className="grid grid-cols-3 gap-3">
              <NumberField label="Bulk density" unit="kg/m³" value={r.bulkDensity} onChange={(v) => set(i, 'bulkDensity', v)} />
              <NumberField label="Moisture" unit="%" value={r.moisture} onChange={(v) => set(i, 'moisture', v)} />
              <NumberField label="Carbon" unit="%" value={r.carbonContent} onChange={(v) => set(i, 'carbonContent', v)} />
            </div>
          </div>
        ))}
      </div>
      <Button
        variant="dark"
        size="lg"
        className="mt-6 w-full rounded-2xl"
        disabled={!rows.length}
        onClick={() => {
          setDraft((d) => ({ ...d, references: [...d.references.filter((r) => !rows.some((x) => x.feedstock === r.feedstock)), ...rows] }))
          toast.success('Reference values updated — remember to save the configuration')
          onBack()
        }}
      >
        Update reference values
      </Button>
    </SubView>
  )
}

/* ---------------- small building blocks ---------------- */

function SubView({ title, onBack, children }: { title: string; onBack: () => void; children: ReactNode }) {
  return (
    <div>
      <button type="button" onClick={onBack} className="-mt-1 mb-4 flex cursor-pointer items-center gap-2 text-sm font-semibold text-ink-muted hover:text-ink">
        <span aria-hidden>←</span> Back to configuration
      </button>
      <div className="mb-2 text-xl font-bold">{title}</div>
      {children}
    </div>
  )
}

function Section({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="mt-6 first:mt-0">
      <div className="mb-2.5 text-xs font-bold tracking-[.1em] text-ink-muted uppercase">{label}</div>
      {children}
    </div>
  )
}

function CheckRow({ on, onToggle, tone, inline, children }: { on: boolean; onToggle: () => void; tone: 'info' | 'success'; inline?: boolean; children: ReactNode }) {
  return (
    <label
      className={cn(
        'flex cursor-pointer items-center gap-2.5 rounded-xl border px-3 py-2 text-sm font-semibold',
        inline && 'inline-flex',
        on ? (tone === 'info' ? 'border-info/30 bg-info-soft text-info' : 'border-success/30 bg-success-soft text-success') : 'border-line hover:bg-muted',
      )}
    >
      <Checkbox
        checked={on}
        onCheckedChange={onToggle}
        className={tone === 'info' ? 'data-[state=checked]:border-info data-[state=checked]:bg-info' : 'data-[state=checked]:border-success data-[state=checked]:bg-success'}
      />
      {children}
    </label>
  )
}

function DrillRow({ icon, tone, title, sub, onClick }: { icon: ReactNode; tone: string; title: string; sub: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="flex w-full cursor-pointer items-center gap-3 rounded-2xl border border-line px-4 py-3.5 text-left hover:bg-muted">
      <span className={cn('flex size-10 items-center justify-center rounded-xl [&_svg]:size-4', tone)}>{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-bold">{title}</span>
        <span className="block truncate text-xs text-ink-muted">{sub}</span>
      </span>
      <ChevronRight className="size-4 text-ink-subtle" />
    </button>
  )
}

function NumberField({ label, unit, value, onChange }: { label: string; unit: string; value: number | undefined; onChange: (v: string) => void }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-semibold text-ink-muted">{label}</span>
      <div className="relative">
        <Input type="number" inputMode="decimal" min={0} value={value != null && Number.isFinite(value) ? value : ''} onChange={(e) => onChange(e.target.value)} className="pr-14" />
        <span className="absolute top-1/2 right-3 -translate-y-1/2 text-xs text-ink-subtle">{unit}</span>
      </div>
    </label>
  )
}
