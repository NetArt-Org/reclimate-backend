'use client'

import { Trash2 } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { toast } from 'sonner'

import { HistoryList } from '../components/HistoryPanel'
import { Button, ConfirmDialog, Field, Input, NativeSelect, Sheet } from '../components/ui'
import { useDashboard } from '../data/store'
import type { Kiln, Network, Site } from '../data/types'
import { unwrap } from '../lib/unwrap'
import {
  deleteSiteListItem,
  saveContainer,
  saveSiteListItem,
  type MeasuringContainer,
  type SamplingContainer,
  type SiteListItem,
} from '../server/networks-extra'
import { listTemplates, type Template } from '../server/settings'
import { ActiveSwitch, Footer, parseNum, SiteSelect } from './AssetSheets'

/** A form, and under it the record's history when it already exists. */
function WithHistory({ entity, id, children }: { entity: string; id?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-6">
      {children}
      {id && (
        <section className="border-t border-line pt-4">
          <h3 className="mb-3 text-xs font-bold tracking-wide text-ink-muted uppercase">History</h3>
          <HistoryList entity={entity} entityId={id} />
        </section>
      )}
    </div>
  )
}

const coord = (lat: number | null, lng: number | null): string | null => {
  if (Number.isNaN(lat) || Number.isNaN(lng)) return 'Coordinates must be numbers, e.g. 6.30520'
  if ((lat == null) !== (lng == null)) return 'Enter both latitude and longitude, or neither'
  if (lat != null && Math.abs(lat) > 90) return 'Latitude must be between -90 and 90'
  if (lng != null && Math.abs(lng) > 180) return 'Longitude must be between -180 and 180'
  return null
}

/* ------------------------------------------------------------------ */
/* Site                                                                */
/* ------------------------------------------------------------------ */

export function SiteSheet({ open, onOpenChange, network, site, onCreated }: { open: boolean; onOpenChange: (o: boolean) => void; network: Network; site: Site | null; onCreated?: (id: string) => void }) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title={site ? `Edit ${site.name}` : `Add a site to ${network.name}`}>
      {open && (
        <WithHistory entity="sites" id={site?.id}>
          <SiteForm key={site?.id ?? 'new'} network={network} site={site} onDone={(id) => (onOpenChange(false), id && onCreated?.(id))} />
        </WithHistory>
      )}
    </Sheet>
  )
}

function SiteForm({ network, site, onDone }: { network: Network; site: Site | null; onDone: (createdId?: string) => void }) {
  const { data, addSite, updateSite } = useDashboard()
  const [f, setF] = useState({
    name: site?.name ?? '',
    code: site?.code ?? '',
    address: site?.address ?? '',
    lat: site?.lat != null ? String(site.lat) : '',
    lng: site?.lng != null ? String(site.lng) : '',
  })
  const [active, setActive] = useState(site?.active ?? true)
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF((x) => ({ ...x, [k]: e.target.value }))

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const name = f.name.trim()
    if (!name) return toast.error('Give the site a name')
    const lat = parseNum(f.lat)
    const lng = parseNum(f.lng)
    const bad = coord(lat, lng)
    if (bad) return toast.error(bad)
    const code = f.code.trim().toUpperCase()
    if (code && data.sites.some((s) => s.id !== site?.id && s.code?.toUpperCase() === code)) return toast.error(`Code ${code} is already used by another site`)
    const fields = { name, code: code || undefined, address: f.address.trim() || undefined, lat, lng, active }
    if (site) {
      updateSite(site.id, fields)
      toast.success('Site saved')
      onDone()
    } else {
      const id = addSite({ ...fields, networkId: network.id })
      toast.success(`${name} added`)
      onDone(id)
    }
  }

  return (
    <form id="site-form" onSubmit={submit} className="flex flex-col gap-4">
      <Field label="Name">
        <Input required autoFocus value={f.name} onChange={set('name')} placeholder="e.g. Kota Marudu kiln site" />
      </Field>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Code" hint="Optional, unique, e.g. MY01-S04">
          <Input value={f.code} onChange={set('code')} className="uppercase" maxLength={20} />
        </Field>
        <Field label="Address">
          <Input value={f.address} onChange={set('address')} placeholder="Village, district" />
        </Field>
        <Field label="Latitude">
          <Input value={f.lat} onChange={set('lat')} inputMode="decimal" className="tabular-nums" placeholder="6.30520" />
        </Field>
        <Field label="Longitude">
          <Input value={f.lng} onChange={set('lng')} inputMode="decimal" className="tabular-nums" placeholder="116.74710" />
        </Field>
      </div>
      <ActiveSwitch checked={active} onChange={setActive} label="Active" hint="Inactive sites are hidden from the field app's site list; their records stay." />
      <div className="mt-2 border-t border-line pt-4">
        <Footer formId="site-form" saving={false} onCancel={() => onDone()} label={site ? 'Save site' : 'Add site'} />
      </div>
    </form>
  )
}

/* ------------------------------------------------------------------ */
/* Kiln                                                                */
/* ------------------------------------------------------------------ */

const TO_MM = { mm: 1, cm: 10, m: 1000 } as const

export function KilnSheet({ open, onOpenChange, network, siteId, kiln }: { open: boolean; onOpenChange: (o: boolean) => void; network: Network; siteId: string; kiln: Kiln | null }) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title={kiln ? `Edit ${kiln.name}` : 'Add kiln'}>
      {open && (
        <WithHistory entity="kilns" id={kiln?.id}>
          <KilnForm key={kiln?.id ?? 'new'} network={network} siteId={siteId} kiln={kiln} onDone={() => onOpenChange(false)} />
        </WithHistory>
      )}
    </Sheet>
  )
}

function KilnForm({ network, siteId, kiln: k, onDone }: { network: Network; siteId: string; kiln: Kiln | null; onDone: () => void }) {
  const { data, addKiln, updateKiln } = useDashboard()
  const [templates, setTemplates] = useState<Template[]>([])
  const [f, setF] = useState({
    siteId: k?.siteId ?? siteId,
    name: k?.name ?? '',
    code: k?.code ?? '',
    type: (k?.type ?? 'kontiki') as Kiln['type'],
    volumeM3: k?.volumeM3 != null ? String(k.volumeM3) : '',
    lat: k?.lat != null ? String(k.lat) : '',
    lng: k?.lng != null ? String(k.lng) : '',
  })
  const [shape, setShape] = useState<{ shape?: string; dimensions?: Record<string, number> }>({ shape: k?.shape, dimensions: k?.dimensions })
  const [active, setActive] = useState(k?.active ?? true)
  const set = (key: keyof typeof f) => (e: { target: { value: string } }) => setF((x) => ({ ...x, [key]: e.target.value }))
  const sites = data.sites.filter((s) => s.networkId === network.id)

  useEffect(() => {
    listTemplates()
      .then(unwrap)
      .then((t) => setTemplates(t.filter((x) => x.kind === 'kiln')))
      .catch(() => setTemplates([]))
  }, [])

  const applyTemplate = (id: string) => {
    const t = templates.find((x) => x.id === id)
    if (!t) return
    const mm = Object.fromEntries(Object.entries(t.dimensions).map(([key, v]) => [key, Math.round(v * TO_MM[t.unit])]))
    setShape({ shape: t.shape, dimensions: mm })
    setF((x) => ({ ...x, type: t.kilnType ?? x.type, volumeM3: String(+(t.volumeL / 1000).toFixed(3)) }))
  }

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const name = f.name.trim()
    if (!name) return toast.error('Give the kiln a name')
    if (!f.siteId) return toast.error('Choose the site')
    const volume = parseNum(f.volumeM3)
    if (volume != null && (Number.isNaN(volume) || volume < 0 || volume > 1000)) return toast.error('The volume must be between 0 and 1000 m³')
    const lat = parseNum(f.lat)
    const lng = parseNum(f.lng)
    const bad = coord(lat, lng)
    if (bad) return toast.error(bad)
    const fields = { siteId: f.siteId, name, code: f.code.trim() || undefined, type: f.type, volumeM3: volume ?? undefined, shape: shape.shape, dimensions: shape.dimensions, lat, lng, active }
    if (k) {
      updateKiln(k.id, fields)
      toast.success('Kiln saved')
    } else {
      addKiln(fields)
      toast.success(`${name} added`)
    }
    onDone()
  }

  return (
    <form id="kiln-form" onSubmit={submit} className="flex flex-col gap-4">
      {templates.length > 0 && (
        <Field label="Start from a template" hint="Fills in the type, shape, size and volume (Settings → Templates).">
          <NativeSelect defaultValue="" onChange={(e) => applyTemplate(e.target.value)}>
            <option value="">— Choose a kiln template —</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} · {Math.round(t.volumeL)} L
              </option>
            ))}
          </NativeSelect>
        </Field>
      )}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Name">
          <Input required autoFocus value={f.name} onChange={set('name')} placeholder="Kon-Tiki 1" />
        </Field>
        <Field label="Code">
          <Input value={f.code} onChange={set('code')} placeholder="Optional" />
        </Field>
        <Field label="Type">
          <NativeSelect value={f.type} onChange={set('type')}>
            <option value="kontiki">Kon-Tiki</option>
            <option value="pit">Pit</option>
          </NativeSelect>
        </Field>
        <Field label="Volume (m³)">
          <Input value={f.volumeM3} onChange={set('volumeM3')} inputMode="decimal" className="tabular-nums" placeholder="0.5" />
        </Field>
        <Field label="Site">
          <NativeSelect value={f.siteId} onChange={set('siteId')}>
            {sites.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <div />
        <Field label="Latitude">
          <Input value={f.lat} onChange={set('lat')} inputMode="decimal" className="tabular-nums" />
        </Field>
        <Field label="Longitude">
          <Input value={f.lng} onChange={set('lng')} inputMode="decimal" className="tabular-nums" />
        </Field>
      </div>
      {shape.shape && (
        <p className="text-xs text-ink-muted">
          Shape: {shape.shape}
          {shape.dimensions && Object.keys(shape.dimensions).length > 0 && ` · ${Object.entries(shape.dimensions).map(([key, v]) => `${key} ${v} mm`).join(', ')}`}
        </p>
      )}
      <ActiveSwitch checked={active} onChange={setActive} label="In service" hint="Out-of-service kilns are not offered in the field app; their batches stay." />
      <div className="mt-2 border-t border-line pt-4">
        <Footer formId="kiln-form" saving={false} onCancel={onDone} label={k ? 'Save kiln' : 'Add kiln'} />
      </div>
    </form>
  )
}

/* ------------------------------------------------------------------ */
/* Measuring / sampling container                                      */
/* ------------------------------------------------------------------ */

export type AnyContainer = (MeasuringContainer & { kind: 'measuring' }) | (SamplingContainer & { kind: 'sampling' })

export function ContainerSheet({
  open,
  onOpenChange,
  network,
  kind,
  container,
  defaultSiteId,
  onSaved,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  network: Network
  kind: 'measuring' | 'sampling'
  container: AnyContainer | null
  defaultSiteId: string | null
  onSaved: () => void
}) {
  const what = kind === 'sampling' ? 'sampling container' : 'measuring container'
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title={container ? `Edit ${what}` : `Add ${what}`}>
      {open && (
        <WithHistory entity="containers" id={container?.id}>
          <ContainerForm key={container?.id ?? 'new'} network={network} kind={kind} c={container} defaultSiteId={defaultSiteId} onDone={(saved) => (saved && onSaved(), onOpenChange(false))} />
        </WithHistory>
      )}
    </Sheet>
  )
}

function ContainerForm({ network, kind, c, defaultSiteId, onDone }: { network: Network; kind: 'measuring' | 'sampling'; c: AnyContainer | null; defaultSiteId: string | null; onDone: (saved: boolean) => void }) {
  const [f, setF] = useState({
    siteId: c ? (c.siteId ?? '') : (defaultSiteId ?? ''),
    code: c?.code ?? '',
    name: c?.name ?? '',
    shape: c?.kind === 'measuring' ? c.shape : '',
    volumeL: c?.volumeL != null ? String(c.volumeL) : '',
    addedAt: c?.kind === 'sampling' && c.addedAt ? c.addedAt.slice(0, 10) : '',
  })
  const [flag, setFlag] = useState(c ? (c.kind === 'measuring' ? c.inUse : c.filled) : false)
  const [active, setActive] = useState(c?.active ?? true)
  const [saving, setSaving] = useState(false)
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF((x) => ({ ...x, [k]: e.target.value }))

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!f.code.trim() && !f.name.trim()) return toast.error('Enter a code or a name')
    const volumeL = parseNum(f.volumeL)
    if (volumeL != null && (Number.isNaN(volumeL) || volumeL < 0)) return toast.error('The volume must be a positive number of litres')
    setSaving(true)
    try {
      unwrap(
        await saveContainer({
          id: c?.id,
          networkId: network.id,
          siteId: f.siteId || null,
          kind,
          code: f.code,
          name: f.name,
          shape: f.shape,
          dimensions: c?.kind === 'measuring' ? c.dimensions : {},
          volumeL,
          inUse: kind === 'measuring' && flag,
          filled: kind === 'sampling' && flag,
          addedAt: f.addedAt ? new Date(f.addedAt).toISOString() : null,
          active,
        }),
      )
      toast.success(c ? 'Container saved' : 'Container added')
      onDone(true)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not save the container')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form id="container-form" onSubmit={submit} className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Code">
          <Input autoFocus value={f.code} onChange={set('code')} placeholder="MC-01" />
        </Field>
        <Field label="Name">
          <Input value={f.name} onChange={set('name')} placeholder="20 L bucket" />
        </Field>
        {kind === 'measuring' && (
          <Field label="Shape">
            <Input value={f.shape} onChange={set('shape')} placeholder="cylinder, cuboid…" />
          </Field>
        )}
        <Field label="Volume (L)">
          <Input value={f.volumeL} onChange={set('volumeL')} inputMode="decimal" className="tabular-nums" />
        </Field>
        {kind === 'sampling' && (
          <Field label="Sample added on" hint="Sampling is due 6 months later.">
            <Input type="date" value={f.addedAt} onChange={set('addedAt')} />
          </Field>
        )}
        <Field label="Site">
          <SiteSelect network={network} value={f.siteId} onChange={(v) => setF((x) => ({ ...x, siteId: v }))} />
        </Field>
      </div>
      <ActiveSwitch
        checked={flag}
        onChange={setFlag}
        label={kind === 'measuring' ? 'In use' : 'Filled'}
        hint={kind === 'measuring' ? 'Currently used to measure biochar.' : 'Holds a lab sample.'}
      />
      <ActiveSwitch checked={active} onChange={setActive} label="Active" hint="Switch off a container that is lost or retired; past batches keep it." />
      <div className="mt-2 border-t border-line pt-4">
        <Footer formId="container-form" saving={saving} onCancel={() => onDone(false)} label={c ? 'Save container' : 'Add container'} />
      </div>
    </form>
  )
}

/* ------------------------------------------------------------------ */
/* Site pick lists (packaging bags, preferred crops, buyers)            */
/* ------------------------------------------------------------------ */

export const LIST_TITLE: Record<SiteListItem['category'], string> = { bags: 'Packaging bags', crops: 'Preferred crops', buyers: 'Buyers' }
const LIST_ONE: Record<SiteListItem['category'], string> = { bags: 'packaging bag', crops: 'preferred crop', buyers: 'buyer' }
const LIST_DETAIL: Record<SiteListItem['category'], string> = { bags: 'Size / capacity, e.g. 25 kg', crops: 'Note', buyers: 'Contact (phone or email)' }

export function ListItemSheet({
  open,
  onOpenChange,
  network,
  siteId,
  category,
  item,
  onSaved,
  onDeleted,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  network: Network
  siteId: string
  category: SiteListItem['category']
  item: SiteListItem | null
  onSaved: (row: SiteListItem, isNew: boolean) => void
  onDeleted: (id: string) => void
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title={item ? `Edit ${LIST_ONE[category]}` : `Add ${LIST_ONE[category]}`}>
      {open && (
        <WithHistory entity="site-lists" id={item?.id}>
          <ListItemForm key={item?.id ?? 'new'} network={network} siteId={siteId} category={category} item={item} onSaved={onSaved} onDeleted={onDeleted} onDone={() => onOpenChange(false)} />
        </WithHistory>
      )}
    </Sheet>
  )
}

function ListItemForm({
  network,
  siteId,
  category,
  item,
  onSaved,
  onDeleted,
  onDone,
}: {
  network: Network
  siteId: string
  category: SiteListItem['category']
  item: SiteListItem | null
  onSaved: (row: SiteListItem, isNew: boolean) => void
  onDeleted: (id: string) => void
  onDone: () => void
}) {
  const [name, setName] = useState(item?.name ?? '')
  const [detail, setDetail] = useState(item?.detail ?? '')
  const [saving, setSaving] = useState(false)
  const [confirm, setConfirm] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return toast.error('Enter a name')
    setSaving(true)
    try {
      const row = unwrap(await saveSiteListItem({ id: item?.id, networkId: network.id, siteId, category, name, detail }))
      onSaved(row, !item)
      toast.success('Saved')
      onDone()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not save')
    } finally {
      setSaving(false)
    }
  }

  const remove = async () => {
    if (!item) return
    try {
      unwrap(await deleteSiteListItem(item.id, network.id))
      onDeleted(item.id)
      toast.success(`${item.name} removed`)
      onDone()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not remove it')
    }
  }

  return (
    <form id="list-form" onSubmit={submit} className="flex flex-col gap-4">
      <Field label="Name">
        <Input required autoFocus value={name} onChange={(e) => setName(e.target.value)} />
      </Field>
      <Field label={LIST_DETAIL[category]}>
        <Input value={detail} onChange={(e) => setDetail(e.target.value)} />
      </Field>
      <div className="mt-2 flex items-center justify-between gap-2 border-t border-line pt-4">
        {item ? (
          <Button variant="ghost" className="text-danger" onClick={() => setConfirm(true)}>
            <Trash2 /> Remove
          </Button>
        ) : (
          <span />
        )}
        <Footer formId="list-form" saving={saving} onCancel={onDone} label={item ? 'Save' : 'Add'} />
      </div>
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title={`Remove ${item?.name ?? ''}?`}
        message="It is no longer offered in the field app. Records that already use it keep their value."
        confirmLabel="Remove"
        onConfirm={() => void remove()}
      />
    </form>
  )
}
