'use client'

import { Plus, Printer, RotateCcw, Save, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'

import { Button, Card, Field, Input, NativeSelect, Spinner } from '../components/ui'
import { unwrap } from '../lib/unwrap'
import { getCertificateSettings, saveCertificateSettings, type CertificateSettings, type SigningAuthority } from '../server/certificates'
import { CERTIFICATE_PRINT_CSS, CertificatePreview } from './CertificatePreview'
import { ImageUpload } from './ImageUpload'
import { COUNTRIES, joinPhone, splitPhone } from './phone'

/** Id of the certificate form, so the page header's Save button can submit it. */
export const CERTIFICATE_FORM_ID = 'certificate-settings-form'

const MAX_AUTHORITIES = 4
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const errMsg = (err: unknown) => (err instanceof Error ? err.message : String(err))

interface Draft {
  companyName: string
  email: string
  phoneIso: string
  phoneNumber: string
  logoFileId: string | null
  sideImageFileId: string | null
  signingAuthorities: (SigningAuthority & { key: number })[]
}

let nextKey = 1
const toDraft = (s: CertificateSettings): Draft => {
  const phone = splitPhone(s.phone)
  return {
    companyName: s.companyName,
    email: s.email,
    phoneIso: phone.iso,
    phoneNumber: phone.number,
    logoFileId: s.logoFileId,
    sideImageFileId: s.sideImageFileId ?? null,
    signingAuthorities: s.signingAuthorities.map((a) => ({ ...a, key: nextKey++ })),
  }
}
const fromDraft = (d: Draft): CertificateSettings => ({
  companyName: d.companyName,
  email: d.email,
  phone: joinPhone(d.phoneIso, d.phoneNumber),
  logoFileId: d.logoFileId,
  sideImageFileId: d.sideImageFileId,
  signingAuthorities: d.signingAuthorities.map(({ name, designation, signatureFileId }) => ({ name, designation, signatureFileId: signatureFileId ?? null })),
})

type Errors = Partial<Record<'companyName' | 'email' | 'phone' | 'logo', string>> & { authorities: { name?: string; designation?: string }[] }

function validate(d: Draft): Errors | null {
  const e: Errors = { authorities: [] }
  let bad = false
  const set = (k: keyof Omit<Errors, 'authorities'>, msg: string) => {
    e[k] = msg
    bad = true
  }
  if (!d.companyName.trim()) set('companyName', 'Enter the company name')
  if (!d.email.trim()) set('email', 'Enter an email address')
  else if (!EMAIL.test(d.email.trim())) set('email', 'Enter a valid email address')
  if (d.phoneNumber.replace(/\D/g, '').length < 4) set('phone', 'Enter a phone number')
  if (!d.logoFileId) set('logo', 'Upload a logo')
  d.signingAuthorities.forEach((a, i) => {
    const ae: { name?: string; designation?: string } = {}
    if (!a.name.trim()) ae.name = 'Enter a name'
    if (!a.designation.trim()) ae.designation = 'Enter a designation'
    if (ae.name || ae.designation) bad = true
    e.authorities[i] = ae
  })
  return bad ? e : null
}

const FieldError = ({ id, msg }: { id: string; msg?: string }) =>
  msg ? (
    <span id={id} className="text-xs text-danger">
      {msg}
    </span>
  ) : null

/** Settings → Certificate: details printed on carbon-removal certificates, with a live preview. */
export function CertificateSection({ onSavingChange }: { onSavingChange: (saving: boolean) => void }) {
  const [draft, setDraft] = useState<Draft | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [errors, setErrors] = useState<Errors | null>(null)
  const [submitted, setSubmitted] = useState(false)
  const [saving, setSaving] = useState(false)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let alive = true
    getCertificateSettings()
      .then(unwrap)
      .then((s) => alive && setDraft(toDraft(s)))
      .catch((err) => alive && setLoadError(errMsg(err)))
    return () => {
      alive = false
    }
  }, [attempt])

  if (!draft) {
    return (
      <Card className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-sm text-ink-muted">
        {loadError ? (
          <>
            <p className="text-danger" role="alert">
              {loadError}
            </p>
            <Button
              size="sm"
              onClick={() => {
                setLoadError(null)
                setAttempt((n) => n + 1)
              }}
            >
              <RotateCcw /> Try again
            </Button>
          </>
        ) : (
          <span className="flex items-center gap-2">
            <Spinner /> Loading certificate settings…
          </span>
        )}
      </Card>
    )
  }

  const update = (patch: Partial<Draft>) => {
    const next = { ...draft, ...patch }
    setDraft(next)
    if (submitted) setErrors(validate(next))
  }
  const updateAuthority = (i: number, patch: Partial<SigningAuthority>) =>
    update({ signingAuthorities: draft.signingAuthorities.map((a, j) => (j === i ? { ...a, ...patch } : a)) })

  const save = async () => {
    setSubmitted(true)
    const e = validate(draft)
    setErrors(e)
    if (e) {
      toast.error('Check the highlighted fields')
      return
    }
    setSaving(true)
    onSavingChange(true)
    try {
      unwrap(await saveCertificateSettings(fromDraft(draft)))
      toast.success('Certificate settings saved')
    } catch (err) {
      toast.error(errMsg(err))
    } finally {
      setSaving(false)
      onSavingChange(false)
    }
  }

  const err = errors ?? { authorities: [] }
  const settings = fromDraft(draft)

  return (
    <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      <style>{CERTIFICATE_PRINT_CSS}</style>

      <form
        id={CERTIFICATE_FORM_ID}
        noValidate
        className="flex min-w-0 flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault()
          if (!saving) void save()
        }}
      >
        <Card className="flex flex-col gap-4 p-4 md:p-5">
          <div>
            <h2 className="text-base font-bold">Company details</h2>
            <p className="text-sm text-ink-muted">Shown on every certificate you issue.</p>
          </div>

          <div className="flex flex-col gap-1">
            <Field label="Company name *">
              <Input
                value={draft.companyName}
                onChange={(e) => update({ companyName: e.target.value })}
                placeholder="e.g. Reclimate Pte Ltd"
                autoComplete="organization"
                aria-invalid={!!err.companyName}
                aria-describedby={err.companyName ? 'cert-name-error' : undefined}
              />
            </Field>
            <FieldError id="cert-name-error" msg={err.companyName} />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1">
              <Field label="Email *">
                <Input
                  type="email"
                  inputMode="email"
                  value={draft.email}
                  onChange={(e) => update({ email: e.target.value })}
                  placeholder="certificates@company.com"
                  autoComplete="email"
                  aria-invalid={!!err.email}
                  aria-describedby={err.email ? 'cert-email-error' : undefined}
                />
              </Field>
              <FieldError id="cert-email-error" msg={err.email} />
            </div>

            <div className="flex flex-col gap-1">
              <span id="cert-phone-label" className="text-xs font-bold tracking-wide text-ink-muted uppercase">
                Phone *
              </span>
              <div className="flex gap-2" role="group" aria-labelledby="cert-phone-label">
                <NativeSelect
                  aria-label="Country code"
                  className="w-[104px] shrink-0"
                  value={draft.phoneIso}
                  onChange={(e) => update({ phoneIso: e.target.value })}
                >
                  {COUNTRIES.map((c) => (
                    <option key={c.iso} value={c.iso}>
                      {c.iso} {c.dial}
                    </option>
                  ))}
                </NativeSelect>
                <Input
                  type="tel"
                  inputMode="tel"
                  aria-label="Phone number"
                  value={draft.phoneNumber}
                  onChange={(e) => update({ phoneNumber: e.target.value })}
                  placeholder="6123 4567"
                  autoComplete="tel-national"
                  aria-invalid={!!err.phone}
                  aria-describedby={err.phone ? 'cert-phone-error' : undefined}
                  className="min-w-0 tabular-nums"
                />
              </div>
              <FieldError id="cert-phone-error" msg={err.phone} />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <ImageUpload
              label="Logo *"
              hint="PNG with a transparent background works best."
              value={draft.logoFileId}
              onChange={(id) => update({ logoFileId: id })}
              error={err.logo}
            />
            <ImageUpload
              label="Side image"
              hint="Tall image for the left strip, e.g. a kiln or field photo."
              value={draft.sideImageFileId}
              onChange={(id) => update({ sideImageFileId: id })}
            />
          </div>
        </Card>

        <Card className="flex flex-col gap-4 p-4 md:p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-bold">Signing authorities</h2>
              <p className="text-sm text-ink-muted">People whose names and signatures appear on the certificate.</p>
            </div>
            <Button
              size="sm"
              variant="soft"
              disabled={draft.signingAuthorities.length >= MAX_AUTHORITIES}
              onClick={() => update({ signingAuthorities: [...draft.signingAuthorities, { key: nextKey++, name: '', designation: '', signatureFileId: null }] })}
            >
              <Plus /> Add authority
            </Button>
          </div>

          {draft.signingAuthorities.length === 0 ? (
            <p className="rounded-xl border border-dashed border-line px-4 py-6 text-center text-sm text-ink-muted">
              No signing authorities yet. Add up to {MAX_AUTHORITIES}.
            </p>
          ) : (
            <ol className="flex flex-col gap-3">
              {draft.signingAuthorities.map((a, i) => {
                const ae = err.authorities[i] ?? {}
                return (
                  <li key={a.key} className="flex flex-col gap-3 rounded-2xl border border-line p-3 md:p-4">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold">Authority {i + 1}</span>
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        className="hover:bg-danger-soft hover:text-danger"
                        aria-label={`Remove authority ${i + 1}`}
                        onClick={() => update({ signingAuthorities: draft.signingAuthorities.filter((_, j) => j !== i) })}
                      >
                        <Trash2 />
                      </Button>
                    </div>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div className="flex flex-col gap-1">
                        <Field label="Name *">
                          <Input
                            value={a.name}
                            onChange={(e) => updateAuthority(i, { name: e.target.value })}
                            placeholder="Full name"
                            aria-invalid={!!ae.name}
                            aria-describedby={ae.name ? `auth-${a.key}-name-error` : undefined}
                          />
                        </Field>
                        <FieldError id={`auth-${a.key}-name-error`} msg={ae.name} />
                      </div>
                      <div className="flex flex-col gap-1">
                        <Field label="Designation *">
                          <Input
                            value={a.designation}
                            onChange={(e) => updateAuthority(i, { designation: e.target.value })}
                            placeholder="e.g. Chief Executive Officer"
                            aria-invalid={!!ae.designation}
                            aria-describedby={ae.designation ? `auth-${a.key}-designation-error` : undefined}
                          />
                        </Field>
                        <FieldError id={`auth-${a.key}-designation-error`} msg={ae.designation} />
                      </div>
                    </div>
                    <ImageUpload
                      compact
                      label="Signature"
                      hint="Signature on a white or transparent background."
                      value={a.signatureFileId}
                      onChange={(id) => updateAuthority(i, { signatureFileId: id })}
                    />
                  </li>
                )
              })}
            </ol>
          )}
        </Card>

        <div className="flex justify-end">
          <Button type="submit" variant="primary" disabled={saving}>
            {saving ? <Spinner className="text-white" /> : <Save />} {saving ? 'Saving…' : 'Save settings'}
          </Button>
        </div>
      </form>

      <Card className="flex min-w-0 flex-col gap-3 p-4 md:p-5 xl:sticky xl:top-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-bold">Preview</h2>
            <p className="text-sm text-ink-muted">A4 landscape. Beneficiary and tonnes are filled in when a certificate is issued.</p>
          </div>
          <Button size="sm" onClick={() => window.print()}>
            <Printer /> Print preview
          </Button>
        </div>
        <div className="rounded-xl bg-muted p-2 sm:p-4">
          <CertificatePreview settings={settings} />
        </div>
      </Card>
    </div>
  )
}
