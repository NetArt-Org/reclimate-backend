'use client'

import {
  Award, Building2, Globe, ImagePlus, MapPin, Network, Pencil, Phone, Printer, ShieldCheck, ShieldOff, Smartphone, Trash2,
  TriangleAlert, UserRoundPlus, X,
} from 'lucide-react'
import { useRef, useState, type ReactNode } from 'react'
import { toast } from 'sonner'

import { OptionRow } from '../components/shell/PageHeader'
import { Avatar, Badge, Button, ConfirmDialog, Modal, Popover, PopoverContent, PopoverTrigger, Sheet, Tooltip } from '../components/ui'
import { LATEST_APP_VERSION, NETWORK_TYPE_LABEL, ROLE_LABEL, ROLE_ORDER } from '../data/catalog'
import { useDashboard } from '../data/store'
import type { DocFile, User } from '../data/types'
import { readDoc } from '../lib/files'
import { day, versionLess } from '../lib/utils'
import { ROLE_TONE } from './PeopleTable'
import { UserDialog } from './Dialogs'

/** Person detail: role, contact, assignments, training documents and device. */
export function UserSheet({ userId, onClose }: { userId: string | null; onClose: () => void }) {
  const { data } = useDashboard()
  const user = data.users.find((u) => u.id === userId)
  return (
    <Sheet open={!!user} onOpenChange={(o) => !o && onClose()} title="Person">
      {user && <UserDetail user={user} onDeleted={onClose} />}
    </Sheet>
  )
}

function UserDetail({ user: u, onDeleted }: { user: User; onDeleted: () => void }) {
  const store = useDashboard()
  const { data, updateUser, deleteUser, promoteUser, addTrainingDoc, removeTrainingDoc } = store
  const [editing, setEditing] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [certificate, setCertificate] = useState(false)
  const [preview, setPreview] = useState<DocFile | null>(null)
  const upload = useRef<HTMLInputElement>(null)
  const photo = useRef<HTMLInputElement>(null)

  const org = data.orgs.find((o) => o.id === u.orgId)
  const networks = data.networks.filter((n) => u.networkIds.includes(n.id))
  const sites = data.sites.filter((s) => u.siteIds.includes(s.id))
  const nextRole = ROLE_ORDER[ROLE_ORDER.indexOf(u.role) + 1]
  const outdated = u.device && versionLess(u.device.version, LATEST_APP_VERSION)

  // Networks of the same organisation, and sites of the networks this person is in.
  const networkChoices = data.networks.filter((n) => n.orgId === u.orgId)
  const siteChoices = data.sites.filter((s) => u.networkIds.includes(s.networkId))

  return (
    <div className="flex flex-col gap-4">
      {/* ---- identity ---- */}
      <section className="rounded-card border border-line p-5">
        <div className="flex items-start gap-4">
          <button type="button" onClick={() => photo.current?.click()} className="group relative cursor-pointer rounded-full" aria-label="Change photo">
            <Avatar name={u.name} src={u.photo} size={72} />
            <span className="absolute inset-0 hidden items-center justify-center rounded-full bg-ink/50 text-white group-hover:flex">
              <ImagePlus className="size-5" />
            </span>
          </button>
          <input
            ref={photo}
            type="file"
            accept="image/*"
            hidden
            onChange={async (e) => {
              const f = e.target.files?.[0]
              e.target.value = ''
              if (!f) return
              const doc = await readDoc(f)
              if (!doc.url) return toast.error('Please pick an image under 1.5 MB')
              updateUser(u.id, { photo: doc.url })
            }}
          />
          <div className="min-w-0 flex-1">
            <div className="text-2xl font-bold">{u.name}</div>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              <Badge tone={ROLE_TONE[u.role]}>{ROLE_LABEL[u.role]}</Badge>
              <Badge tone={u.active ? 'success' : 'danger'}>{u.active ? 'Active' : 'Inactive'}</Badge>
            </div>
          </div>
          <div className="flex gap-1">
            <Tooltip content="Edit">
              <Button variant="ghost" size="icon-sm" onClick={() => setEditing(true)} aria-label="Edit">
                <Pencil />
              </Button>
            </Tooltip>
            <Tooltip content="Delete">
              <Button variant="ghost" size="icon-sm" className="text-danger" onClick={() => setConfirmDelete(true)} aria-label="Delete">
                <Trash2 />
              </Button>
            </Tooltip>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {nextRole && (
            <Button
              size="sm"
              variant="soft"
              onClick={() => {
                promoteUser(u.id)
                toast.success(`${u.name} is now ${ROLE_LABEL[nextRole].toLowerCase()}`)
              }}
            >
              <UserRoundPlus /> Promote to {ROLE_LABEL[nextRole].toLowerCase()}
            </Button>
          )}
          <Button size="sm" onClick={() => updateUser(u.id, { active: !u.active })}>
            {u.active ? 'Deactivate' : 'Activate'}
          </Button>
        </div>

        <div className="mt-5 flex flex-col gap-2.5 text-sm">
          <InfoRow icon={<Phone />}>
            {u.phone}
            <button
              type="button"
              onClick={() => {
                updateUser(u.id, { otpBypass: !u.otpBypass })
                toast.success(u.otpBypass ? 'SMS code required again' : 'Can now sign in without an SMS code')
              }}
              className={`ml-auto flex cursor-pointer items-center gap-1 text-xs font-bold ${u.otpBypass ? 'text-danger' : 'text-brand'}`}
            >
              {u.otpBypass ? <ShieldOff className="size-3.5" /> : <ShieldCheck className="size-3.5" />}
              {u.otpBypass ? 'Remove from OTP bypass' : 'Add to OTP bypass'}
            </button>
          </InfoRow>
          {u.email && <InfoRow icon={<Globe />}>{u.email}</InfoRow>}
          <InfoRow icon={<Building2 />}>
            {org ? `${org.name} (${org.code})` : '—'}
          </InfoRow>
        </div>
      </section>

      {/* ---- assignments ---- */}
      <AssignSection
        title="Assigned networks"
        icon={<Network />}
        items={networks.map((n) => ({ id: n.id, label: n.name, sub: NETWORK_TYPE_LABEL[n.type] }))}
        choices={networkChoices.map((n) => ({ id: n.id, label: n.name, active: n.active }))}
        selected={u.networkIds}
        onChange={(networkIds) =>
          // Leaving a network also drops that network's sites.
          updateUser(u.id, { networkIds, siteIds: u.siteIds.filter((sid) => networkIds.includes(data.sites.find((s) => s.id === sid)?.networkId ?? '')) })
        }
      />
      <AssignSection
        title="Assigned sites"
        icon={<MapPin />}
        items={sites.map((s) => ({ id: s.id, label: s.name, sub: data.networks.find((n) => n.id === s.networkId)?.name }))}
        choices={siteChoices.map((s) => ({ id: s.id, label: s.name, active: s.active }))}
        selected={u.siteIds}
        onChange={(siteIds) => updateUser(u.id, { siteIds })}
        emptyChoices="Assign a network first"
      />

      {/* ---- training ---- */}
      <section className="rounded-card border border-line">
        <SectionHead icon={<Award />} title="Training documents">
          <Button size="sm" variant="soft" onClick={() => upload.current?.click()}>
            + Upload
          </Button>
        </SectionHead>
        <input
          ref={upload}
          type="file"
          accept="image/*,.pdf"
          multiple
          hidden
          onChange={async (e) => {
            const files = [...(e.target.files ?? [])]
            e.target.value = ''
            for (const f of files) addTrainingDoc(u.id, await readDoc(f))
          }}
        />
        <div className="p-4">
          {u.trainingDocs.length === 0 ? (
            <div className="text-sm text-ink-subtle">No training documents yet.</div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {u.trainingDocs.map((d) => (
                <div key={d.id} className="group relative">
                  <button
                    type="button"
                    onClick={() => setPreview(d)}
                    className="flex size-16 cursor-pointer items-center justify-center overflow-hidden rounded-xl border border-line bg-muted text-[10px] font-bold text-ink-muted"
                    title={d.name}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {d.url ? <img src={d.url} alt="" className="size-full object-cover" /> : d.name.split('.').pop()?.toUpperCase()}
                  </button>
                  <button
                    type="button"
                    onClick={() => removeTrainingDoc(u.id, d.id)}
                    aria-label={`Remove ${d.name}`}
                    className="absolute -top-1.5 -right-1.5 hidden size-5 cursor-pointer items-center justify-center rounded-full bg-danger text-white group-hover:flex"
                  >
                    <X className="size-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
          <Button className="mt-4 w-full rounded-2xl border-0 bg-clay-soft text-clay hover:bg-clay-soft/70" onClick={() => setCertificate(true)}>
            View &amp; download certificate
          </Button>
        </div>
      </section>

      {/* ---- device ---- */}
      <section className="rounded-card border border-line">
        <SectionHead icon={<Smartphone />} title="Device" />
        <div className="p-4 text-sm">
          {u.device ? (
            <div className="flex items-center gap-3">
              <span className="size-2.5 rounded-full bg-success" />
              <div className="flex-1">
                <div className="font-bold">{u.device.model}</div>
                <div className="text-xs text-ink-muted">
                  {u.device.app === 'online' ? 'Online' : 'Offline'} app · last seen {day(u.device.lastSeen)}
                </div>
              </div>
              <Tooltip content={outdated ? `Older than ${LATEST_APP_VERSION} — ask them to update` : 'Up to date'}>
                <span>
                  <Badge tone={outdated ? 'warn' : 'success'}>v{u.device.version}</Badge>
                </span>
              </Tooltip>
            </div>
          ) : (
            <span className="text-ink-subtle">Has not signed in on the app yet.</span>
          )}
        </div>
      </section>

      <UserDialog open={editing} onOpenChange={setEditing} user={u} />
      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={`Delete ${u.name}?`}
        message="They lose access to the app straight away. Batches they recorded are kept."
        onConfirm={() => {
          deleteUser(u.id)
          toast.success(`${u.name} deleted`)
          onDeleted()
        }}
      />
      <Certificate open={certificate} onOpenChange={setCertificate} user={u} networkName={networks[0]?.name} />
      <Modal open={!!preview} onOpenChange={(o) => !o && setPreview(null)} title={preview?.name ?? ''} className="max-w-2xl">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {preview?.url ? <img src={preview.url} alt="" className="w-full rounded-xl" /> : <p className="text-sm text-ink-muted">Preview is available for images. This file is stored with the person.</p>}
      </Modal>
    </div>
  )
}

function SectionHead({ icon, title, children }: { icon: ReactNode; title: string; children?: ReactNode }) {
  return (
    <div className="flex items-center gap-2.5 border-b border-line px-4 py-3">
      <span className="text-info [&_svg]:size-4">{icon}</span>
      <span className="text-sm font-bold tracking-wide uppercase">{title}</span>
      <span className="ml-auto">{children}</span>
    </div>
  )
}

function InfoRow({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <div className="flex items-center gap-2.5 text-ink-2 [&>svg]:size-4 [&>svg]:shrink-0 [&>svg]:text-ink-subtle">
      {icon}
      {children}
    </div>
  )
}

function AssignSection({
  title,
  icon,
  items,
  choices,
  selected,
  onChange,
  emptyChoices = 'Nothing to assign',
}: {
  title: string
  icon: ReactNode
  items: { id: string; label: string; sub?: string }[]
  choices: { id: string; label: string; active: boolean }[]
  selected: string[]
  onChange: (ids: string[]) => void
  emptyChoices?: string
}) {
  return (
    <section className="rounded-card border border-line">
      <SectionHead icon={icon} title={title}>
        <Popover>
          <PopoverTrigger asChild>
            <Button size="sm" variant="danger-soft">
              + Assign
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-72">
            {choices.length === 0 && <div className="px-3 py-4 text-center text-sm text-ink-muted">{emptyChoices}</div>}
            {choices.map((c) => (
              <OptionRow
                key={c.id}
                status={c.active}
                selected={selected.includes(c.id)}
                onClick={() => onChange(selected.includes(c.id) ? selected.filter((x) => x !== c.id) : [...selected, c.id])}
              >
                {c.label}
              </OptionRow>
            ))}
          </PopoverContent>
        </Popover>
      </SectionHead>
      <div className="flex flex-col gap-2 p-4">
        {items.length === 0 && <div className="text-sm text-ink-subtle">None yet.</div>}
        {items.map((i) => (
          <div key={i.id} className="flex items-center gap-2 rounded-xl border border-line px-3.5 py-2.5 text-sm">
            <span className="font-bold">{i.label}</span>
            {i.sub && <span className="text-ink-muted">({i.sub})</span>}
            <button
              type="button"
              onClick={() => onChange(selected.filter((x) => x !== i.id))}
              className="ml-auto cursor-pointer text-ink-subtle hover:text-danger"
              aria-label={`Unassign ${i.label}`}
            >
              <X className="size-4" />
            </button>
          </div>
        ))}
      </div>
    </section>
  )
}

/** Names come from user input (the app's profile screen): escape before putting them in HTML. */
const esc = (v: string) =>
  v.replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]!)

/** Printable training certificate (Save as PDF from the print dialog). */
function Certificate({ open, onOpenChange, user, networkName }: { open: boolean; onOpenChange: (o: boolean) => void; user: User; networkName?: string }) {
  const issued = day(user.trainingDocs.at(-1)?.addedAt ?? new Date().toISOString())
  const body = `
    <div style="font-family:system-ui,sans-serif;border:10px solid #1f5a3d;border-radius:24px;padding:48px;text-align:center;color:#1c211e">
      <div style="letter-spacing:.3em;font-size:12px;font-weight:700;color:#a14a32">RECLIMATE dMRV</div>
      <h1 style="font-size:34px;margin:16px 0 8px">Certificate of Training</h1>
      <div style="color:#6b726d">This certifies that</div>
      <div style="font-size:30px;font-weight:800;margin:12px 0">${esc(user.name)}</div>
      <div style="color:#6b726d">has completed biochar production and dMRV data-capture training as</div>
      <div style="font-size:18px;font-weight:700;margin:8px 0">${ROLE_LABEL[user.role]}${networkName ? ` · ${esc(networkName)}` : ''}</div>
      <div style="margin-top:32px;color:#6b726d;font-size:14px">Issued ${issued}</div>
    </div>`
  const print = () => {
    const w = window.open('', '_blank', 'width=900,height=700')
    if (!w) return toast.error('Allow pop-ups to print the certificate')
    w.document.write(`<!doctype html><title>Certificate — ${esc(user.name)}</title><body style="margin:40px">${body}</body>`)
    w.document.close()
    w.focus()
    w.print()
  }
  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Training certificate"
      className="max-w-2xl"
      footer={
        <>
          <Button onClick={() => onOpenChange(false)}>Close</Button>
          <Button variant="primary" onClick={print}>
            <Printer /> Print / save as PDF
          </Button>
        </>
      }
    >
      <div dangerouslySetInnerHTML={{ __html: body }} />
      {user.trainingDocs.length === 0 && (
        <p className="mt-3 flex items-center gap-1.5 text-xs text-warn">
          <TriangleAlert className="size-3.5" /> No training documents uploaded yet — add evidence before issuing.
        </p>
      )}
    </Modal>
  )
}
