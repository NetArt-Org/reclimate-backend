'use client'

import { FileUp, Trash2 } from 'lucide-react'
import dynamic from 'next/dynamic'
import { useRef, useState, type FormEvent } from 'react'
import { toast } from 'sonner'

import { Button, Field, Input, Modal, NativeSelect, Switch } from '../components/ui'
import { NETWORK_TYPE_LABEL, ROLE_LABEL } from '../data/catalog'
import { useDashboard } from '../data/store'
import type { Network, NetworkType, PartnerOrg, Role, User } from '../data/types'
import { parseKml } from '../lib/files'
import { day } from '../lib/utils'

const MapView = dynamic(() => import('../home/MapView').then((m) => m.MapView), { ssr: false })

/* ------------------------------------------------------------------ */
/* Partner organisation                                                */
/* ------------------------------------------------------------------ */

export function OrgDialog({ open, onOpenChange, org }: { open: boolean; onOpenChange: (o: boolean) => void; org?: PartnerOrg }) {
  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={org ? `Edit ${org.name}` : 'New partner organisation'}
      description={org ? undefined : 'The company or cooperative that runs one or more networks.'}
    >
      {open && <OrgForm key={org?.id ?? 'new'} org={org} onDone={() => onOpenChange(false)} />}
    </Modal>
  )
}

function OrgForm({ org, onDone }: { org?: PartnerOrg; onDone: () => void }) {
  const { data, addOrg, updateOrg } = useDashboard()
  const [f, setF] = useState({ name: org?.name ?? '', code: org?.code ?? '', country: org?.country ?? '', address: org?.address ?? '' })
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF((x) => ({ ...x, [k]: e.target.value }))

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const c = f.code.trim().toUpperCase()
    const name = f.name.trim()
    if (data.orgs.some((o) => o.id !== org?.id && o.code === c)) return toast.error(`Code ${c} is already used`)
    const fields = { name, code: c, country: f.country.trim() || undefined, address: f.address.trim() || undefined }
    if (org) {
      updateOrg(org.id, (o) => void Object.assign(o, fields))
      toast.success('Saved')
    } else {
      addOrg({ ...fields, active: true })
      toast.success(`${name} added`)
    }
    onDone()
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <Field label="Name">
        <Input required autoFocus value={f.name} onChange={set('name')} placeholder="e.g. Sabah Biochar Cooperative" />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Code" hint="Short, unique, e.g. MY02">
          <Input required maxLength={6} value={f.code} onChange={set('code')} placeholder="MY02" className="uppercase" />
        </Field>
        <Field label="Country">
          <Input value={f.country} onChange={set('country')} placeholder="Malaysia" />
        </Field>
      </div>
      <Field label="Address">
        <Input value={f.address} onChange={set('address')} />
      </Field>
      {org && org.code !== f.code.trim().toUpperCase() && (
        <p className="rounded-lg bg-warn-soft px-3 py-2 text-xs text-warn">Batch codes already issued keep the old code; new ones use the new code.</p>
      )}
      <div className="flex justify-end gap-2 pt-2">
        <Button onClick={onDone}>Cancel</Button>
        <Button type="submit" variant="primary">
          {org ? 'Save changes' : 'Add organisation'}
        </Button>
      </div>
    </form>
  )
}

/* ------------------------------------------------------------------ */
/* Network (Artisan Pro / C-sink)                                      */
/* ------------------------------------------------------------------ */

export function NetworkDialog({
  type,
  open,
  onOpenChange,
  onCreated,
  network,
}: {
  type: NetworkType
  open: boolean
  onOpenChange: (o: boolean) => void
  onCreated?: (id: string) => void
  /** Edit this network instead of creating one. */
  network?: Network
}) {
  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={network ? `Edit ${network.name}` : `New ${NETWORK_TYPE_LABEL[type]} network`}
      description={network ? undefined : type === 'artisan' ? 'A group of kiln sites run by artisans.' : 'A network of farmers who apply biochar.'}
    >
      {open && <NetworkForm key={network?.id ?? 'new'} type={type} network={network} onCreated={onCreated} onDone={() => onOpenChange(false)} />}
    </Modal>
  )
}

function NetworkForm({ type, network, onCreated, onDone }: { type: NetworkType; network?: Network; onCreated?: (id: string) => void; onDone: () => void }) {
  const { data, filters, addNetwork, updateNetwork } = useDashboard()
  const [form, setForm] = useState({
    name: network?.name ?? '',
    orgId: network?.orgId ?? '',
    code: network?.code ?? '',
    location: network?.location ?? '',
    lat: network?.lat != null ? String(network.lat) : '',
    lng: network?.lng != null ? String(network.lng) : '',
  })
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }))
  const orgId = form.orgId || filters.orgId || data.orgs.find((o) => o.active)?.id || ''

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const lat = form.lat.trim() === '' ? null : Number(form.lat)
    const lng = form.lng.trim() === '' ? null : Number(form.lng)
    if ((lat == null) !== (lng == null)) return toast.error('Enter both latitude and longitude, or neither')
    if ((lat != null && (Number.isNaN(lat) || Math.abs(lat) > 90)) || (lng != null && (Number.isNaN(lng) || Math.abs(lng) > 180))) {
      return toast.error('Latitude must be −90…90 and longitude −180…180')
    }
    const fields = { orgId, name: form.name.trim(), code: form.code.trim() || undefined, location: form.location.trim(), lat, lng }
    if (network) {
      updateNetwork(network.id, fields)
      toast.success('Saved')
      onDone()
      return
    }
    if (lat == null) return toast.error('Enter the location coordinates')
    const id = addNetwork({ ...fields, type, active: true, ceresApproved: false })
    toast.success(`${fields.name} added — set its feedstocks with "Edit config"`)
    onDone()
    onCreated?.(id)
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <Field label="Name">
        <Input required autoFocus value={form.name} onChange={set('name')} placeholder="e.g. Tawau Kiln Group" />
      </Field>
      <Field label="Partner organisation">
        <NativeSelect required value={orgId} onChange={set('orgId')}>
          {data.orgs.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name} ({o.code}){o.active ? '' : ' — inactive'}
            </option>
          ))}
        </NativeSelect>
      </Field>
      {network && (
        <Field label="Code" hint="Used in batch IDs, e.g. MY01A001P04">
          <Input value={form.code} onChange={set('code')} />
        </Field>
      )}
      <Field label="Location">
        <Input required value={form.location} onChange={set('location')} placeholder="Village, district" />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Latitude">
          <Input required={!network} type="number" step="any" value={form.lat} onChange={set('lat')} placeholder="4.2448" />
        </Field>
        <Field label="Longitude">
          <Input required={!network} type="number" step="any" value={form.lng} onChange={set('lng')} placeholder="117.8912" />
        </Field>
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <Button onClick={onDone}>Cancel</Button>
        <Button type="submit" variant="primary">
          {network ? 'Save changes' : 'Add network'}
        </Button>
      </div>
    </form>
  )
}

/* ------------------------------------------------------------------ */
/* Person (create + edit)                                              */
/* ------------------------------------------------------------------ */

export function UserDialog({
  open,
  onOpenChange,
  user,
  defaultNetworkId,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  user?: User
  defaultNetworkId?: string
}) {
  return (
    <Modal open={open} onOpenChange={onOpenChange} title={user ? `Edit ${user.name}` : 'New person'} description={user ? undefined : 'They sign in to the app with this phone number.'}>
      {open && <UserForm user={user} defaultNetworkId={defaultNetworkId} onDone={() => onOpenChange(false)} />}
    </Modal>
  )
}

function UserForm({ user, defaultNetworkId, onDone }: { user?: User; defaultNetworkId?: string; onDone: () => void }) {
  const { data, filters, addUser, updateUser } = useDashboard()
  const defaultNet = data.networks.find((n) => n.id === defaultNetworkId)
  const [form, setForm] = useState({
    name: user?.name ?? '',
    role: (user?.role ?? 'operator') as Role,
    phone: user?.phone ?? '',
    email: user?.email ?? '',
    orgId: user?.orgId ?? defaultNet?.orgId ?? filters.orgId ?? data.orgs[0]?.id ?? '',
    networkId: user?.networkIds[0] ?? defaultNet?.id ?? '',
    active: user?.active ?? true,
  })
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }))
  const networks = data.networks.filter((n) => n.orgId === form.orgId)

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const digits = form.phone.replace(/\D/g, '')
    if (digits.length < 8) return toast.error('Enter a full phone number with country code')
    const clash = data.users.find((u) => u.id !== user?.id && u.phone.replace(/\D/g, '') === digits)
    if (clash) return toast.error(`${clash.name} already uses this phone number`)
    const base = {
      name: form.name.trim(),
      role: form.role,
      phone: form.phone.trim(),
      email: form.email.trim() || undefined,
      orgId: form.orgId,
      active: form.active,
    }
    if (user) {
      updateUser(user.id, base)
      toast.success('Saved')
    } else {
      addUser({ ...base, networkIds: form.networkId ? [form.networkId] : [], siteIds: [] })
      toast.success(`${base.name} added`)
    }
    onDone()
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <Field label="Full name">
        <Input required autoFocus value={form.name} onChange={set('name')} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Role">
          <NativeSelect value={form.role} onChange={set('role')}>
            {(Object.keys(ROLE_LABEL) as Role[]).map((r) => (
              <option key={r} value={r}>
                {ROLE_LABEL[r]}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label="Phone">
          <Input required type="tel" value={form.phone} onChange={set('phone')} placeholder="+62 812-…" />
        </Field>
      </div>
      <Field label="Email (optional)">
        <Input type="email" value={form.email} onChange={set('email')} />
      </Field>
      <Field label="Partner organisation">
        <NativeSelect value={form.orgId} onChange={(e) => setForm((f) => ({ ...f, orgId: e.target.value, networkId: '' }))}>
          {data.orgs.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name} ({o.code})
            </option>
          ))}
        </NativeSelect>
      </Field>
      {!user && (
        <Field label="Network" hint="More networks and sites can be assigned from their profile.">
          <NativeSelect value={form.networkId} onChange={set('networkId')}>
            <option value="">— None yet —</option>
            {networks.map((n) => (
              <option key={n.id} value={n.id}>
                {n.name}
              </option>
            ))}
          </NativeSelect>
        </Field>
      )}
      <label className="flex cursor-pointer items-center justify-between rounded-xl border border-line px-3.5 py-3 text-sm font-semibold">
        Active — can sign in
        <Switch checked={form.active} onCheckedChange={(active) => setForm((f) => ({ ...f, active }))} />
      </label>
      <div className="flex justify-end gap-2 pt-2">
        <Button onClick={onDone}>Cancel</Button>
        <Button type="submit" variant="primary">
          {user ? 'Save changes' : 'Add person'}
        </Button>
      </div>
    </form>
  )
}

/* ------------------------------------------------------------------ */
/* KML boundaries                                                      */
/* ------------------------------------------------------------------ */

export function KmlPanel({ network }: { network: Network }) {
  const { updateNetwork } = useDashboard()
  const file = useRef<HTMLInputElement>(null)
  const kml = network.kml

  const pick = async (f: File | undefined) => {
    if (!f) return
    try {
      const { placemarks, polygons } = await parseKml(f)
      updateNetwork(network.id, { kml: { fileName: f.name, uploadedAt: new Date().toISOString(), placemarks, polygons } })
      toast.success(`${polygons.length} boundar${polygons.length === 1 ? 'y' : 'ies'} loaded`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not read this file')
    }
  }

  return (
    <div>
      <input
        ref={file}
        type="file"
        accept=".kml,application/vnd.google-earth.kml+xml"
        hidden
        onChange={(e) => {
          void pick(e.target.files?.[0])
          e.target.value = ''
        }}
      />
      {kml ? (
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-3 rounded-xl border border-line px-4 py-3">
            <FileUp className="size-5 text-brand" />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold">{kml.fileName}</div>
              <div className="text-xs text-ink-muted">
                {kml.polygons.length} boundaries · {kml.placemarks} placemarks · uploaded {day(kml.uploadedAt)}
              </div>
            </div>
            <Button size="sm" className="rounded-lg" onClick={() => file.current?.click()}>
              Replace
            </Button>
            <Button variant="ghost" size="icon-sm" className="text-danger" aria-label="Remove KML" onClick={() => updateNetwork(network.id, { kml: undefined })}>
              <Trash2 />
            </Button>
          </div>
          <div className="h-96">
            <MapView points={[]} polygons={kml.polygons} legend={false} />
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => file.current?.click()}
          className="flex w-full cursor-pointer flex-col items-center gap-2 rounded-xl border border-dashed border-line-strong px-6 py-14 text-center transition-colors hover:border-brand hover:bg-brand-soft/40"
        >
          <FileUp className="size-7 text-ink-muted" />
          <span className="font-semibold">Upload a KML file</span>
          <span className="max-w-sm text-sm text-ink-muted">Field or site boundaries exported from Google Earth or Google My Maps. They are drawn on a map here.</span>
        </button>
      )}
    </div>
  )
}
