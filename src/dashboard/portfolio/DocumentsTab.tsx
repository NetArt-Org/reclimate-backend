'use client'

import { Download, FileText, FolderOpen, Globe2, Link2, MoreVertical, Pencil, Plus, Trash2, Upload, X } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'

import { Badge, Button, Card, ConfirmDialog, EmptyState, Field, Input, Menu, MenuContent, MenuItem, MenuTrigger, Modal, NativeSelect } from '../components/ui'
import { fileSize } from '../lib/files'
import { day } from '../lib/utils'
import { unwrap } from '../lib/unwrap'
import { useDashboard } from '../data/store'
import { addDocument, deleteDocument, setDocumentProject, updateDocument, type PortfolioDocument } from '../server/portfolio'

const CATEGORY: Record<string, string> = { 'csi-compliance': 'CSI compliance', certificate: 'Certificate', other: 'Other' }

export function DocumentsTab({ documents: all }: { documents: PortfolioDocument[] }) {
  const { data, filters } = useDashboard()
  // The projects in the current selection: the Organisation dropdown, or else the projects of the chosen networks/sites.
  const chosenNetworks = filters.networkIds.length
    ? filters.networkIds
    : filters.siteIds.length
      ? data.sites.filter((x) => filters.siteIds.includes(x.id)).map((x) => x.networkId)
      : []
  const orgIds = filters.orgId ? [filters.orgId] : [...new Set(data.networks.filter((n) => chosenNetworks.includes(n.id)).map((n) => n.orgId))]
  const projects = data.orgs.filter((o) => orgIds.includes(o.id))
  const project = projects.length ? { id: projects[0].id, name: projects.map((o) => o.name).join(', ') } : null
  // A document is for one project, or for all projects (no project set: certificates that cover every project).
  const isShared = (d: PortfolioDocument) => !d.organizationId || !data.orgs.some((o) => o.id === d.organizationId)
  const shared = all.filter(isShared)
  const own = all.filter((d) => !!d.organizationId && orgIds.includes(d.organizationId))
  const documents = project ? [...own, ...shared] : all
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState<PortfolioDocument | null>(null)
  const [removing, setRemoving] = useState<PortfolioDocument | null>(null)
  const router = useRouter()

  const remove = async (d: PortfolioDocument) => {
    try {
      unwrap(await deleteDocument(d.id))
      toast.success('Document deleted')
      router.refresh()
    } catch (err) {
      toast.error('Could not delete the document', { description: err instanceof Error ? err.message : String(err) })
    }
  }
  const link = async (d: PortfolioDocument, orgId: string | null) => {
    try {
      unwrap(await setDocumentProject(d.id, orgId))
      const name = data.orgs.find((o) => o.id === orgId)?.name
      toast.success(name ? `Moved to ${name}` : 'Now for all projects', { description: d.title })
      router.refresh()
    } catch (err) {
      toast.error('Could not change the project', { description: err instanceof Error ? err.message : String(err) })
    }
  }
  const card = (d: PortfolioDocument) => (
    <DocCard key={d.id} doc={d} onEdit={() => setEditing(d)} onRemove={() => setRemoving(d)} onLink={(orgId) => void link(d, orgId)} />
  )

  // Sections: documents for all projects first, then each project's own (only the chosen one when a project is picked).
  const sections = [
    { key: 'all', title: 'All projects', sub: 'Shown under every project', docs: shared },
    ...(projects.length ? projects : data.orgs).map((o) => ({ key: o.id, title: o.name, sub: 'Only this project', docs: all.filter((d) => d.organizationId === o.id) })),
  ].filter((g) => g.docs.length || orgIds.includes(g.key))

  return (
    <Card className="p-3 sm:p-4">
      <div className="flex flex-wrap items-center gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-clay-soft text-clay">
          <FileText className="size-[18px]" />
        </span>
        <div className="min-w-[12rem] flex-1">
          <h2 className="font-bold">Compliance documents{project ? ` · ${project.name}` : ''}</h2>
          <p className="text-sm text-ink-muted">
            {project
              ? `${project.name}'s documents and the ones for all projects. Clear the selection at the top to see every project.`
              : 'Every project’s documents. Choose a project or network at the top to see only its documents.'}
          </p>
        </div>
        <Badge>{documents.length} docs</Badge>
        <Button size="sm" variant="primary" onClick={() => setAdding(true)}>
          <Plus /> Add document
        </Button>
      </div>

      {all.length ? (
        <div className="mt-5 flex flex-col gap-5">
          {sections.map((g) => (
            <section key={g.key}>
              <h3 className="mb-2 flex items-center gap-2 text-xs font-bold tracking-wide text-ink-muted uppercase">
                {g.key === 'all' ? <Globe2 className="size-3.5" /> : <FolderOpen className="size-3.5" />}
                {g.title}
                <span className="rounded-full bg-muted px-2 py-px text-[11px] font-semibold tracking-normal normal-case">{g.docs.length}</span>
                <span className="font-medium tracking-normal normal-case text-ink-subtle">· {g.sub}</span>
              </h3>
              {g.docs.length ? (
                <ul className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">{g.docs.map(card)}</ul>
              ) : (
                <p className="rounded-xl border border-dashed border-line p-4 text-sm text-ink-muted">
                  No documents only for {g.title} yet. Add one, or use ⋮ → “Move to {g.title}” on a document above.
                </p>
              )}
            </section>
          ))}
        </div>
      ) : (
        <EmptyState icon={<FileText />} title="No documents yet" sub="Add the CSI certificate, verification statements and producer lists." />
      )}

      <DocumentForm key={`new-${orgIds.join()}`} defaultOrg={projects.length === 1 ? projects[0].id : null} open={adding} onOpenChange={setAdding} />
      <DocumentForm key={editing?.id} doc={editing ?? undefined} open={!!editing} onOpenChange={(o) => !o && setEditing(null)} />
      <ConfirmDialog
        open={!!removing}
        onOpenChange={(o) => !o && setRemoving(null)}
        title="Delete this document?"
        message={`“${removing?.title}” and its file are deleted permanently.`}
        confirmLabel="Delete"
        onConfirm={() => removing && void remove(removing)}
      />
    </Card>
  )
}

/** One document: title, details, download, and a menu to edit, change its project or delete it. */
function DocCard({
  doc: d,
  onEdit,
  onRemove,
  onLink,
}: {
  doc: PortfolioDocument
  onEdit: () => void
  onRemove: () => void
  onLink: (orgId: string | null) => void
}) {
  const { data } = useDashboard()
  return (
    <li className="flex min-w-0 items-center gap-3 rounded-xl border border-line bg-surface p-3.5 transition-colors hover:border-line-strong">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-clay-soft text-clay">
        <FileText className="size-[18px]" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold" title={d.title}>
          {d.title}
        </div>
        <div className="truncate text-xs text-ink-muted">
          {[d.issuedAt && day(d.issuedAt), d.reference, CATEGORY[d.category]].filter(Boolean).join(' · ')}
          {d.file ? ` · ${fileSize(d.file.size)}` : ' · no file attached'}
        </div>
      </div>
      {d.file && (
        <a
          href={`/admin/files/${d.file.id}`}
          target="_blank"
          rel="noopener"
          aria-label={`Download ${d.title}`}
          className="flex size-8 items-center justify-center rounded-full text-ink-2 outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-brand/40"
        >
          <Download className="size-4" />
        </a>
      )}
      <Menu>
        <MenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label={`More for ${d.title}`}>
            <MoreVertical />
          </Button>
        </MenuTrigger>
        <MenuContent>
          <MenuItem onSelect={onEdit}>
            <Pencil /> Edit or replace file
          </MenuItem>
          {data.orgs
            .filter((o) => o.id !== d.organizationId)
            .map((o) => (
              <MenuItem key={o.id} onSelect={() => onLink(o.id)}>
                <Link2 /> Move to {o.name}
              </MenuItem>
            ))}
          {d.organizationId && (
            <MenuItem onSelect={() => onLink(null)}>
              <Globe2 /> Make it for all projects
            </MenuItem>
          )}
          <MenuItem onSelect={onRemove} className="text-danger [&_svg]:text-danger">
            <Trash2 /> Delete
          </MenuItem>
        </MenuContent>
      </Menu>
    </li>
  )
}

/** Add a document, or edit one (details, replace or remove its file). */
function DocumentForm({ doc, defaultOrg, open, onOpenChange }: { doc?: PortfolioDocument; defaultOrg?: string | null; open: boolean; onOpenChange: (o: boolean) => void }) {
  const { data } = useDashboard()
  const router = useRouter()
  const [pending, start] = useTransition()
  const [file, setFile] = useState<File | null>(null)
  const [dropFile, setDropFile] = useState(false)
  const editing = !!doc
  const current = doc?.file && !dropFile ? doc.file : null

  const submit = (form: FormData) =>
    start(async () => {
      if (file) form.set('file', file)
      if (editing && dropFile && !file) form.set('removeFile', '1')
      try {
        unwrap(editing ? await updateDocument(doc.id, form) : await addDocument(form))
        toast.success(editing ? 'Document updated' : 'Document added')
        setFile(null)
        setDropFile(false)
        onOpenChange(false)
        router.refresh()
      } catch (err) {
        toast.error(editing ? 'Could not update the document' : 'Could not add the document', {
          description: err instanceof Error ? err.message : String(err),
        })
      }
    })

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={editing ? 'Edit document' : 'Add document'}
      description="The file is stored in Firebase Storage (4 MB max)."
    >
      <form action={submit} className="flex flex-col gap-4">
        <Field label="Title">
          <Input name="title" required maxLength={200} defaultValue={doc?.title} placeholder="Verification Statement GCSP1039" />
        </Field>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Field label="Reference">
            <Input name="reference" maxLength={100} defaultValue={doc?.reference} placeholder="CC-0922" />
          </Field>
          <Field label="Issued on">
            <Input name="issuedAt" type="date" defaultValue={doc?.issuedAt?.slice(0, 10)} />
          </Field>
          <Field label="Expires on">
            <Input name="expiresAt" type="date" defaultValue={doc?.expiresAt?.slice(0, 10)} />
          </Field>
        </div>
        <Field label="Project" hint="All projects: shown whichever project is chosen at the top. A project: shown only when that project is chosen.">
          <NativeSelect name="organization" defaultValue={doc ? (doc.organizationId ?? '') : (defaultOrg ?? '')}>
            <option value="">All projects (shown under every project)</option>
            {data.orgs.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name} ({o.code})
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label="Category">
          <NativeSelect name="category" defaultValue={doc?.category ?? 'csi-compliance'}>
            {Object.entries(CATEGORY).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </NativeSelect>
        </Field>
        {current && !file && (
          <div className="flex items-center gap-3 rounded-xl border border-line p-3">
            <FileText className="size-5 text-clay" />
            <span className="min-w-0 flex-1 text-sm">
              <span className="block truncate font-semibold">{current.name}</span>
              <span className="text-xs text-ink-muted">Current file · {fileSize(current.size)}</span>
            </span>
            <Button variant="ghost" size="icon-sm" aria-label="Remove the current file" onClick={() => setDropFile(true)}>
              <X />
            </Button>
          </div>
        )}
        {editing && dropFile && !file && (
          <p className="text-xs text-warn">The current file will be deleted when you save.{' '}
            <button type="button" className="cursor-pointer font-semibold underline" onClick={() => setDropFile(false)}>Undo</button>
          </p>
        )}
        <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-line-strong p-4 hover:bg-muted">
          <Upload className="size-5 text-ink-muted" />
          <span className="min-w-0 flex-1 text-sm">
            {file ? (
              <>
                <span className="block truncate font-semibold">{file.name}</span>
                <span className="text-xs text-ink-muted">
                  {fileSize(file.size)}
                  {editing && doc?.file ? ' · replaces the current file' : ''}
                </span>
              </>
            ) : (
              <span className="text-ink-muted">{editing && doc?.file ? 'Choose a file to replace it' : 'Choose a file (PDF, image, spreadsheet)'}</span>
            )}
          </span>
          <input
            type="file"
            className="sr-only"
            accept=".pdf,.png,.jpg,.jpeg,.webp,.xlsx,.xls,.csv,.doc,.docx"
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
        <div className="flex justify-end gap-2">
          <Button onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button type="submit" variant="primary" disabled={pending}>
            {pending ? 'Saving…' : editing ? 'Save changes' : 'Add document'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
