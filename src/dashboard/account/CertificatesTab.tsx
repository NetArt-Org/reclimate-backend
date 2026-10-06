'use client'

import { Award, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

import { useSession } from '../components/shell/session'
import {
  Badge,
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  Field,
  Input,
  Modal,
} from '../components/ui'
import { useDashboard } from '../data/store'
import type { Certificate } from '../data/types'
import { day, uid } from '../lib/utils'

/** Days from today until a YYYY-MM-DD date (negative when past). */
const daysUntil = (iso: string) =>
  Math.ceil((new Date(`${iso}T23:59:59`).getTime() - Date.now()) / 86400000)

function status(c: Certificate) {
  const left = daysUntil(c.validTo)
  if (left < 0) return { label: 'Expired', tone: 'danger' as const }
  if (left <= 60) return { label: `Expires in ${left} days`, tone: 'warn' as const }
  return { label: 'Valid', tone: 'success' as const }
}

/** Certification of the company (e.g. CERES / CSI), with expiry warnings. */
export function CertificatesTab() {
  const { data, updateCompany } = useDashboard()
  const { user } = useSession()
  const [adding, setAdding] = useState(false)
  const [removing, setRemoving] = useState<Certificate | null>(null)
  const list = data.company.certificates

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <p className="flex-1 text-sm text-ink-muted">
          The cut-off date on the Overview uses these dates to decide which credits are eligible.
        </p>
        <Button variant="primary" className="rounded-xl" onClick={() => setAdding(true)}>
          <Plus /> Add certificate
        </Button>
      </div>

      {list.length === 0 && (
        <Card>
          <EmptyState
            icon={<Award />}
            title="No certificates yet"
            sub="Add the company's certification so credits can be counted."
          />
        </Card>
      )}

      {list.map((c) => {
        const s = status(c)
        return (
          <Card key={c.id} className="p-3 sm:p-4">
            <div className="flex flex-wrap items-start gap-4">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand">
                <Award className="size-5" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-base font-semibold">{c.issuer}</h3>
                  <Badge tone={s.tone}>{s.label}</Badge>
                </div>
                <div className="mt-0.5 text-sm text-ink-muted">No. {c.number}</div>
              </div>
              <Button
                variant="ghost"
                size="icon-sm"
                className="text-danger"
                aria-label="Remove certificate"
                onClick={() => setRemoving(c)}
              >
                <Trash2 />
              </Button>
            </div>
            <dl className="mt-5 grid grid-cols-1 gap-4 text-sm sm:grid-cols-2 lg:grid-cols-5">
              <Item label="Company name">{c.companyName}</Item>
              <Item label="Company email">{c.email || '—'}</Item>
              <Item label="Company phone">{c.phone || '—'}</Item>
              <Item label="Valid from">{day(c.validFrom)}</Item>
              <Item label="Valid until">{day(c.validTo)}</Item>
            </dl>
          </Card>
        )
      })}

      <CertificateDialog
        open={adding}
        onOpenChange={setAdding}
        defaults={{
          companyName: data.company.name,
          email: data.company.email,
          phone: data.company.phone,
        }}
        onSave={(c) => {
          updateCompany((x) => void x.certificates.unshift(c), {
            by: user.name,
            change: `Certificate added: ${c.issuer} ${c.number}`,
          })
          toast.success('Certificate added')
        }}
      />
      <ConfirmDialog
        open={!!removing}
        onOpenChange={(o) => !o && setRemoving(null)}
        title="Remove this certificate?"
        message="Credits that relied on it will no longer pass the cut-off date check."
        confirmLabel="Remove"
        onConfirm={() => {
          if (!removing) return
          updateCompany(
            (x) => void (x.certificates = x.certificates.filter((y) => y.id !== removing.id)),
            { by: user.name, change: `Certificate removed: ${removing.issuer} ${removing.number}` },
          )
        }}
      />
    </div>
  )
}

function Item({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-ink-muted">{label}</dt>
      <dd className="mt-0.5 font-medium">{children}</dd>
    </div>
  )
}

function CertificateDialog({
  open,
  onOpenChange,
  defaults,
  onSave,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  defaults: { companyName: string; email: string; phone: string }
  onSave: (c: Certificate) => void
}) {
  return (
    <Modal open={open} onOpenChange={onOpenChange} title="Add certificate">
      {open && (
        <CertificateForm
          defaults={defaults}
          onCancel={() => onOpenChange(false)}
          onSave={(c) => (onSave(c), onOpenChange(false))}
        />
      )}
    </Modal>
  )
}

function CertificateForm({
  defaults,
  onCancel,
  onSave,
}: {
  defaults: { companyName: string; email: string; phone: string }
  onCancel: () => void
  onSave: (c: Certificate) => void
}) {
  const [f, setF] = useState({
    ...defaults,
    issuer: 'Carbon Standards International',
    number: '',
    validFrom: '',
    validTo: '',
  })
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) =>
    setF({ ...f, [k]: e.target.value })
  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault()
        if (f.validTo <= f.validFrom) return toast.error('"Valid until" must be after "Valid from"')
        onSave({ id: uid('ce-'), ...f, companyName: f.companyName.trim(), number: f.number.trim() })
      }}
    >
      <div className="grid grid-cols-2 gap-3">
        <Field label="Issuer">
          <Input required value={f.issuer} onChange={set('issuer')} />
        </Field>
        <Field label="Certificate number">
          <Input required value={f.number} onChange={set('number')} />
        </Field>
      </div>
      <Field label="Company name">
        <Input required value={f.companyName} onChange={set('companyName')} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Company email">
          <Input type="email" value={f.email} onChange={set('email')} />
        </Field>
        <Field label="Company phone">
          <Input type="tel" value={f.phone} onChange={set('phone')} />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Valid from">
          <Input required type="date" value={f.validFrom} onChange={set('validFrom')} />
        </Field>
        <Field label="Valid until">
          <Input
            required
            type="date"
            value={f.validTo}
            min={f.validFrom || undefined}
            onChange={set('validTo')}
          />
        </Field>
      </div>
      <div className="flex justify-end gap-2 pt-1">
        <Button onClick={onCancel}>Cancel</Button>
        <Button type="submit" variant="primary">
          Add certificate
        </Button>
      </div>
    </form>
  )
}
