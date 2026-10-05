'use client'

import { FileText, Plus, Trash2, Upload, X } from 'lucide-react'
import { useRef, useState, type ReactNode } from 'react'
import { toast } from 'sonner'

import { OptionRow } from '../components/shell/PageHeader'
import {
  Avatar,
  Button,
  Card,
  Field,
  Input,
  Modal,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Tooltip,
} from '../components/ui'
import type { Contact, DocFile } from '../data/types'
import { fileSize, readDoc } from '../lib/files'
import { day, uid } from '../lib/utils'

/** A titled card with an optional action on the right. */
export function Section({
  title,
  description,
  action,
  children,
  className,
}: {
  title: string
  description?: string
  action?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <Card className={className}>
      <div className="flex items-start gap-3 border-b border-line px-5 py-4">
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-semibold">{title}</h2>
          {description && <p className="mt-0.5 text-sm text-ink-muted">{description}</p>}
        </div>
        {action}
      </div>
      <div className="p-5">{children}</div>
    </Card>
  )
}

export function AddIconButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <Tooltip content={label}>
      <Button variant="ghost" size="icon-sm" onClick={onClick} aria-label={label}>
        <Plus />
      </Button>
    </Tooltip>
  )
}

/** People listed on a company/organisation, with add and remove. */
export function ContactList({
  contacts,
  onChange,
  role,
  empty,
}: {
  contacts: Contact[]
  onChange: (c: Contact[]) => void
  role: string
  empty: string
}) {
  const [adding, setAdding] = useState(false)
  return (
    <>
      <div className="flex flex-col gap-1">
        {contacts.length === 0 && <div className="text-sm text-ink-subtle">{empty}</div>}
        {contacts.map((c) => (
          <div
            key={c.id}
            className="group flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-muted"
          >
            <Avatar name={c.name} size={36} />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold">{c.name}</div>
              <div className="truncate text-xs text-ink-muted">
                {[c.role, c.email].filter(Boolean).join(' · ')}
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon-sm"
              className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
              aria-label={`Remove ${c.name}`}
              onClick={() => onChange(contacts.filter((x) => x.id !== c.id))}
            >
              <X />
            </Button>
          </div>
        ))}
      </div>
      <Button size="sm" variant="ghost" className="mt-2 rounded-lg" onClick={() => setAdding(true)}>
        <Plus /> Add {role.toLowerCase()}
      </Button>
      <ContactDialog
        open={adding}
        onOpenChange={setAdding}
        role={role}
        onSave={(c) => {
          onChange([...contacts, c])
          toast.success(`${c.name} added`)
        }}
      />
    </>
  )
}

function ContactDialog({
  open,
  onOpenChange,
  role,
  onSave,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  role: string
  onSave: (c: Contact) => void
}) {
  const [form, setForm] = useState({ name: '', email: '', phone: '' })
  return (
    <Modal open={open} onOpenChange={onOpenChange} title={`Add ${role.toLowerCase()}`}>
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault()
          onSave({
            id: uid('c-'),
            role,
            name: form.name.trim(),
            email: form.email.trim() || undefined,
            phone: form.phone.trim() || undefined,
          })
          setForm({ name: '', email: '', phone: '' })
          onOpenChange(false)
        }}
      >
        <Field label="Name">
          <Input
            required
            autoFocus
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
        </Field>
        <Field label="Email">
          <Input
            required
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
        </Field>
        <Field label="Phone (optional)">
          <Input
            type="tel"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
          />
        </Field>
        <div className="flex justify-end gap-2 pt-1">
          <Button onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button type="submit" variant="primary">
            Add
          </Button>
        </div>
      </form>
    </Modal>
  )
}

/** Uploaded documents with upload and remove. */
export function DocList({
  docs,
  onChange,
  empty = 'No documents yet.',
}: {
  docs: DocFile[]
  onChange: (d: DocFile[]) => void
  empty?: string
}) {
  const file = useRef<HTMLInputElement>(null)
  return (
    <>
      <div className="flex flex-col gap-1">
        {docs.length === 0 && <div className="text-sm text-ink-subtle">{empty}</div>}
        {docs.map((d) => (
          <div
            key={d.id}
            className="group flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-muted"
          >
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-success-soft text-success">
              <FileText className="size-4" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold" title={d.name}>
                {d.name}
              </div>
              <div className="text-xs text-ink-muted">
                {day(d.addedAt)} · {fileSize(d.size)}
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon-sm"
              className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
              aria-label={`Remove ${d.name}`}
              onClick={() => onChange(docs.filter((x) => x.id !== d.id))}
            >
              <Trash2 />
            </Button>
          </div>
        ))}
      </div>
      <Button
        size="sm"
        variant="ghost"
        className="mt-2 rounded-lg"
        onClick={() => file.current?.click()}
      >
        <Upload /> Upload
      </Button>
      <input
        ref={file}
        type="file"
        multiple
        hidden
        onChange={async (e) => {
          const files = [...(e.target.files ?? [])]
          e.target.value = ''
          onChange([...docs, ...(await Promise.all(files.map(readDoc)))])
        }}
      />
    </>
  )
}

/** Removable chips plus a "+" popover listing what can be added. */
export function ChipPicker({
  items,
  options,
  onChange,
  empty = 'None',
}: {
  items: string[]
  options: string[]
  onChange: (v: string[]) => void
  empty?: string
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {items.length === 0 && <span className="text-sm text-ink-subtle">{empty}</span>}
      {items.map((i) => (
        <span
          key={i}
          className="group flex items-center gap-1 rounded-lg border border-line bg-surface py-1 pr-1.5 pl-2.5 text-sm font-medium"
        >
          {i}
          <button
            type="button"
            onClick={() => onChange(items.filter((x) => x !== i))}
            aria-label={`Remove ${i}`}
            className="cursor-pointer rounded text-ink-subtle hover:text-danger"
          >
            <X className="size-3.5" />
          </button>
        </span>
      ))}
      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="flex h-8 cursor-pointer items-center gap-1 rounded-lg border border-dashed border-line-strong px-2.5 text-sm font-medium text-ink-muted hover:border-brand hover:text-brand"
          >
            <Plus className="size-3.5" /> Add
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-64 p-1.5">
          {options.map((o) => (
            <OptionRow
              key={o}
              selected={items.includes(o)}
              onClick={() =>
                onChange(items.includes(o) ? items.filter((x) => x !== o) : [...items, o])
              }
            >
              {o}
            </OptionRow>
          ))}
        </PopoverContent>
      </Popover>
    </div>
  )
}
