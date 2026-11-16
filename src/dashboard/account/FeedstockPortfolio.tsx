'use client'

import { ChevronDown, FileText, Leaf, MoreVertical, Pencil, Plus, Shield, Trash2, Upload, Wind, X } from 'lucide-react'
import { useRef, useState } from 'react'
import { toast } from 'sonner'

import { useSession } from '../components/shell/session'
import { OptionRow } from '../components/shell/PageHeader'
import { Badge, Button, ConfirmDialog, Field, Input, Menu, MenuContent, MenuItem, MenuTrigger, Modal, Popover, PopoverContent, PopoverTrigger, Tooltip } from '../components/ui'
import { useDashboard } from '../data/store'
import type { Company, DocFile, MethaneStrategy, PortfolioFeedstock } from '../data/types'
import { fileSize, readDoc } from '../lib/files'
import { cn, uid } from '../lib/utils'
import { Section } from './parts'

type Kind = MethaneStrategy['kind']
const KIND: Record<Kind, { label: string; tone: string; soft: string; icon: typeof Shield }> = {
  avoidance: { label: 'Avoidance', tone: 'text-danger', soft: 'bg-danger-soft', icon: Shield },
  compensation: { label: 'Compensation', tone: 'text-info', soft: 'bg-info-soft', icon: Wind },
}
const ACCEPT = '.pdf,.png,.jpg,.jpeg,.webp,.doc,.docx,.xlsx,.xls'

/** Upload one or more files as DocFiles; files that fail are reported and skipped. */
async function readFiles(files: FileList | null): Promise<DocFile[]> {
  const out: DocFile[] = []
  for (const file of Array.from(files ?? [])) {
    try {
      out.push(await readDoc(file))
    } catch (err) {
      toast.error(`Could not upload ${file.name}`, { description: err instanceof Error ? err.message : String(err) })
    }
  }
  return out
}

/**
 * Feedstock portfolio: a library of methane strategies (each named, avoidance or compensation, with its supporting
 * documents for the registry), and the biomass types the programme accepts, each using one strategy from the library.
 */
export function FeedstockPortfolio() {
  const { data, updateCompany } = useDashboard()
  const { user } = useSession()
  const list = data.company.feedstocks
  const strategies = data.company.methaneStrategies ?? []
  const set = (recipe: (c: Company) => void, change: string) => updateCompany(recipe, { by: user.name, change })
  const missing = data.feedstocks.map((f) => f.name).filter((f) => !list.some((x) => x.name === f))

  const [editing, setEditing] = useState<MethaneStrategy | 'new' | null>(null)
  const [newFor, setNewFor] = useState<string | null>(null) // feedstock to assign a newly created strategy to
  const [removing, setRemoving] = useState<MethaneStrategy | null>(null)

  const saveStrategy = (s: MethaneStrategy) => {
    const isNew = !strategies.some((x) => x.id === s.id)
    set((c) => {
      c.methaneStrategies ??= []
      const i = c.methaneStrategies.findIndex((x) => x.id === s.id)
      if (i >= 0) c.methaneStrategies[i] = s
      else c.methaneStrategies.push(s)
      // Feedstocks using it follow its kind.
      for (const f of c.feedstocks) if (f.strategyId === s.id || (isNew && f.name === newFor)) Object.assign(f, { strategyId: s.id, strategy: s.kind })
    }, `Methane strategy ${isNew ? 'added' : 'updated'}: ${s.name}${isNew && newFor ? ` (used for ${newFor})` : ''}`)
    setEditing(null)
    setNewFor(null)
  }
  const removeStrategy = (s: MethaneStrategy) =>
    set((c) => {
      c.methaneStrategies = (c.methaneStrategies ?? []).filter((x) => x.id !== s.id)
      for (const f of c.feedstocks) if (f.strategyId === s.id) Object.assign(f, { strategyId: null, strategy: null })
    }, `Methane strategy removed: ${s.name}`)
  const pickStrategy = (f: PortfolioFeedstock, s: MethaneStrategy | null) =>
    set((c) => {
      const x = c.feedstocks.find((y) => y.name === f.name)
      if (x) Object.assign(x, { strategyId: s?.id ?? null, strategy: s?.kind ?? null })
    }, `${f.name}: ${s ? s.name : 'no strategy'}`)

  return (
    <Section
      title="Feedstock portfolio"
      description="Methane strategies with their documents for the registry, and the strategy each feedstock uses."
      action={
        <Popover>
          <PopoverTrigger asChild>
            <Button size="sm" className="rounded-lg" disabled={!missing.length}>
              <Plus /> Add feedstock
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-64 p-1.5">
            {missing.map((f) => (
              <OptionRow key={f} selected={false} onClick={() => set((c) => void c.feedstocks.push({ name: f, strategy: null, spc: false }), `Feedstock added: ${f}`)}>
                {f}
              </OptionRow>
            ))}
          </PopoverContent>
        </Popover>
      }
    >
      {/* Strategy library */}
      <div className="mb-4 rounded-xl border border-line bg-muted/40 p-3">
        <div className="mb-2.5 flex items-center gap-2">
          <h3 className="flex-1 text-xs font-bold tracking-wide text-ink-muted uppercase">Methane strategies</h3>
          <Button size="sm" className="rounded-lg" onClick={() => setEditing('new')}>
            <Plus /> New strategy
          </Button>
        </div>
        {strategies.length ? (
          <div className="flex flex-col gap-2">
            {strategies.map((s) => (
              <StrategyCard
                key={s.id}
                strategy={s}
                usedBy={list.filter((f) => f.strategyId === s.id).map((f) => f.name)}
                onChange={(docs, change) => set((c) => {
                  const x = (c.methaneStrategies ?? []).find((y) => y.id === s.id)
                  if (x) x.documents = docs
                }, `${s.name}: ${change}`)}
                onEdit={() => setEditing(s)}
                onRemove={() => setRemoving(s)}
              />
            ))}
          </div>
        ) : (
          <p className="rounded-lg border border-dashed border-line-strong bg-surface p-4 text-sm text-ink-muted">
            No strategies yet. Add one (for example “Avoidance – no open burning”) with its supporting documents, then choose it for each feedstock below.
          </p>
        )}
      </div>

      {/* Feedstocks */}
      <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2">
        {list.map((f) => {
          const s = strategies.find((x) => x.id === f.strategyId) ?? null
          const k = s ? KIND[s.kind] : null
          const noDocs = s && !s.documents.length
          return (
            <div key={f.name} className="group flex items-start gap-3 rounded-xl border border-line px-3.5 py-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand">
                <Leaf className="size-4" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm font-semibold">{f.name}</span>
                  {f.spc && (
                    <Tooltip content="Has a site-specific carbon value">
                      <span className="rounded bg-warn-soft px-1.5 py-0.5 text-[10px] font-bold text-warn">SPC</span>
                    </Tooltip>
                  )}
                </div>
                <Menu>
                  <MenuTrigger asChild>
                    <button type="button" className={cn('mt-0.5 flex max-w-full cursor-pointer items-center gap-1 text-xs font-semibold', k ? k.tone : 'text-ink-subtle')}>
                      {k && <k.icon className="size-3 shrink-0" />}
                      <span className="truncate">{s ? s.name : 'Choose methane strategy'}</span>
                      <ChevronDown className="size-3 shrink-0" />
                    </button>
                  </MenuTrigger>
                  <MenuContent align="start" className="max-w-80">
                    {strategies.map((x) => {
                      const K = KIND[x.kind]
                      return (
                        <MenuItem key={x.id} onSelect={() => pickStrategy(f, x)}>
                          <K.icon className={K.tone} />
                          <span className="truncate">{x.name}</span>
                          <span className="ml-auto pl-2 text-xs text-ink-subtle">{x.documents.length} doc{x.documents.length === 1 ? '' : 's'}</span>
                        </MenuItem>
                      )
                    })}
                    <MenuItem
                      onSelect={() => {
                        setNewFor(f.name)
                        setEditing('new')
                      }}
                    >
                      <Plus /> New strategy for {f.name}…
                    </MenuItem>
                    {s && <MenuItem onSelect={() => pickStrategy(f, null)}>No strategy</MenuItem>}
                    <MenuItem onSelect={() => set((c) => {
                      const x = c.feedstocks.find((y) => y.name === f.name)
                      if (x) x.spc = !f.spc
                    }, `${f.name}: SPC ${f.spc ? 'removed' : 'added'}`)}>
                      {f.spc ? 'Remove SPC' : 'Mark as SPC'}
                    </MenuItem>
                  </MenuContent>
                </Menu>
                {s && (
                  <div className={cn('mt-1 flex items-center gap-1 text-xs', noDocs ? 'text-warn' : 'text-ink-muted')}>
                    <FileText className="size-3.5 shrink-0" />
                    {noDocs ? (
                      <button type="button" className="cursor-pointer font-semibold underline" onClick={() => setEditing(s)}>
                        No document yet: upload one
                      </button>
                    ) : (
                      <span className="truncate">{s.documents.map((d) => d.name).join(', ')}</span>
                    )}
                  </div>
                )}
                {/* Documents uploaded on the feedstock itself before the strategy library existed. */}
                {!!f.documents?.length && (
                  <div className="mt-1 flex flex-col gap-0.5">
                    {f.documents.map((d) => (
                      <a key={d.id} href={d.url ?? `/admin/files/${d.id}`} target="_blank" rel="noopener" className="truncate text-xs font-semibold hover:underline" title={d.name}>
                        <FileText className="mr-1 inline size-3.5 text-success" />
                        {d.name}
                      </a>
                    ))}
                  </div>
                )}
              </div>
              <Button
                variant="ghost"
                size="icon-sm"
                className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
                aria-label={`Remove ${f.name}`}
                onClick={() => set((c) => void (c.feedstocks = c.feedstocks.filter((x) => x.name !== f.name)), `Feedstock removed: ${f.name}`)}
              >
                <Trash2 />
              </Button>
            </div>
          )
        })}
      </div>

      <StrategyDialog
        key={editing === 'new' ? `new-${newFor ?? ''}` : (editing?.id ?? 'closed')}
        strategy={editing}
        forFeedstock={editing === 'new' ? newFor : null}
        onClose={() => {
          setEditing(null)
          setNewFor(null)
        }}
        onSave={saveStrategy}
      />
      <ConfirmDialog
        open={!!removing}
        onOpenChange={(o) => !o && setRemoving(null)}
        title={`Remove “${removing?.name}”?`}
        message="Its documents are deleted, and feedstocks using it go back to “no strategy”."
        confirmLabel="Remove"
        onConfirm={() => removing && removeStrategy(removing)}
      />
    </Section>
  )
}

/** A strategy in the library: name, kind, which feedstocks use it, and its documents (upload several, remove). */
function StrategyCard({
  strategy: s,
  usedBy,
  onChange,
  onEdit,
  onRemove,
}: {
  strategy: MethaneStrategy
  usedBy: string[]
  onChange: (docs: DocFile[], change: string) => void
  onEdit: () => void
  onRemove: () => void
}) {
  const K = KIND[s.kind]
  const input = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  return (
    <div className="rounded-xl border border-line bg-surface p-3">
      <div className="flex items-start gap-2.5">
        <span className={cn('flex size-8 shrink-0 items-center justify-center rounded-full', K.soft, K.tone)}>
          <K.icon className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="truncate text-sm font-semibold">{s.name}</span>
            <Badge tone={s.kind === 'avoidance' ? 'danger' : 'info'}>{K.label}</Badge>
          </div>
          <div className="truncate text-xs text-ink-muted">{usedBy.length ? `Used for ${usedBy.join(', ')}` : 'Not used by any feedstock yet'}</div>
        </div>
        <Menu>
          <MenuTrigger asChild>
            <Button variant="ghost" size="icon-sm" aria-label={`More for ${s.name}`}>
              <MoreVertical />
            </Button>
          </MenuTrigger>
          <MenuContent align="end">
            <MenuItem onSelect={onEdit}>
              <Pencil /> Rename or change type
            </MenuItem>
            <MenuItem onSelect={onRemove} className="text-danger [&_svg]:text-danger">
              <Trash2 /> Remove strategy
            </MenuItem>
          </MenuContent>
        </Menu>
      </div>
      <div className="mt-2.5 flex flex-wrap items-center gap-1.5 pl-[42px]">
        {s.documents.map((d) => (
          <span key={d.id} className="group/doc flex max-w-full min-w-0 items-center gap-1.5 rounded-lg border border-line px-2 py-1 text-xs">
            <FileText className="size-3.5 shrink-0 text-success" />
            <a href={d.url ?? `/admin/files/${d.id}`} target="_blank" rel="noopener" className="min-w-0 truncate font-semibold hover:underline" title={d.name}>
              {d.name}
            </a>
            <span className="shrink-0 text-ink-subtle">{fileSize(d.size)}</span>
            <button
              type="button"
              aria-label={`Remove ${d.name}`}
              className="cursor-pointer text-ink-subtle hover:text-danger"
              onClick={() => onChange(s.documents.filter((x) => x.id !== d.id), `document ${d.name} removed`)}
            >
              <X className="size-3.5" />
            </button>
          </span>
        ))}
        <button
          type="button"
          disabled={busy}
          onClick={() => input.current?.click()}
          className={cn(
            'flex h-7 cursor-pointer items-center gap-1.5 rounded-lg border px-2.5 text-xs font-semibold disabled:cursor-wait disabled:opacity-60',
            s.documents.length ? 'border-dashed border-line-strong text-ink-2 hover:bg-muted' : 'border-warn/50 bg-warn-soft text-warn',
          )}
        >
          <Upload className="size-3.5" />
          {busy ? 'Uploading…' : s.documents.length ? 'Upload more' : 'Upload document (required by the registry)'}
        </button>
        <input
          ref={input}
          type="file"
          hidden
          multiple
          accept={ACCEPT}
          onChange={async (e) => {
            const files = e.target.files
            setBusy(true)
            const docs = await readFiles(files)
            e.target.value = ''
            setBusy(false)
            if (docs.length) onChange([...s.documents, ...docs], `${docs.length === 1 ? `document ${docs[0].name}` : `${docs.length} documents`} added`)
          }}
        />
      </div>
    </div>
  )
}

/** New strategy (name, type, documents), or rename / change the type of one. */
function StrategyDialog({
  strategy,
  forFeedstock,
  onClose,
  onSave,
}: {
  strategy: MethaneStrategy | 'new' | null
  forFeedstock: string | null
  onClose: () => void
  onSave: (s: MethaneStrategy) => void
}) {
  const existing = strategy && strategy !== 'new' ? strategy : null
  const [name, setName] = useState(existing?.name ?? '')
  const [kind, setKind] = useState<Kind | null>(existing?.kind ?? null)
  const [docs, setDocs] = useState<DocFile[]>(existing?.documents ?? [])
  const [busy, setBusy] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  const missing = !name.trim() ? 'Name the strategy' : !kind ? 'Choose the type' : !docs.length ? 'Upload its document' : null

  return (
    <Modal
      open={!!strategy}
      onOpenChange={(o) => !o && onClose()}
      title={existing ? 'Edit methane strategy' : 'New methane strategy'}
      description={forFeedstock ? `It will be used for ${forFeedstock}.` : 'Feedstocks can then use it.'}
    >
      <div className="flex flex-col gap-4">
        <Field label="Name">
          <Input autoFocus value={name} maxLength={120} onChange={(e) => setName(e.target.value)} placeholder="Avoidance – no open burning of husks" />
        </Field>
        <div>
          <div className="mb-1.5 text-xs font-bold tracking-wide text-ink-muted uppercase">Type</div>
          <div className="grid grid-cols-2 gap-2">
            {(Object.keys(KIND) as Kind[]).map((k) => {
              const K = KIND[k]
              return (
                <button
                  key={k}
                  type="button"
                  aria-pressed={kind === k}
                  onClick={() => setKind(k)}
                  className={cn(
                    'flex cursor-pointer items-center gap-2 rounded-xl border p-3 text-left text-sm font-semibold transition-colors outline-none focus-visible:ring-2 focus-visible:ring-brand/40',
                    kind === k ? 'border-brand bg-brand-soft' : 'border-line hover:bg-muted',
                  )}
                >
                  <K.icon className={cn('size-4', K.tone)} />
                  {K.label}
                </button>
              )
            })}
          </div>
        </div>
        <div>
          <div className="mb-1.5 text-xs font-bold tracking-wide text-ink-muted uppercase">Supporting documents</div>
          {docs.map((d) => (
            <div key={d.id} className="mb-2 flex min-w-0 items-center gap-2 rounded-xl border border-line p-2.5 text-sm">
              <FileText className="size-4 shrink-0 text-success" />
              <span className="min-w-0 flex-1 truncate font-semibold" title={d.name}>
                {d.name}
              </span>
              <span className="shrink-0 text-xs text-ink-subtle">{fileSize(d.size)}</span>
              <Button variant="ghost" size="icon-sm" aria-label={`Remove ${d.name}`} onClick={() => setDocs(docs.filter((x) => x.id !== d.id))}>
                <X />
              </Button>
            </div>
          ))}
          <button
            type="button"
            disabled={busy}
            onClick={() => input.current?.click()}
            className="flex w-full cursor-pointer items-center gap-3 rounded-xl border border-dashed border-line-strong p-4 text-left text-sm hover:bg-muted disabled:cursor-wait"
          >
            <Upload className="size-5 text-ink-muted" />
            <span className="text-ink-muted">{busy ? 'Uploading…' : docs.length ? 'Add more documents' : 'Choose files (PDF, image, Word, Excel · 4 MB each). You can pick several.'}</span>
          </button>
          <input
            ref={input}
            type="file"
            hidden
            multiple
            accept={ACCEPT}
            onChange={async (e) => {
              const files = e.target.files
              setBusy(true)
              const added = await readFiles(files)
              e.target.value = ''
              setBusy(false)
              setDocs((d) => [...d, ...added])
            }}
          />
        </div>
        <div className="flex items-center justify-end gap-2">
          {missing && !busy && <span className="mr-auto text-xs text-ink-muted">{missing} to save</span>}
          <Button onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            disabled={!!missing || busy}
            onClick={() => kind && onSave({ id: existing?.id ?? uid(), name: name.trim(), kind, documents: docs })}
          >
            {existing ? 'Save' : 'Add strategy'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
