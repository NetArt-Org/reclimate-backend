'use client'

import { useState, type FormEvent } from 'react'
import { toast } from 'sonner'

import { Button, Field, Input, NativeSelect, Sheet, Spinner, Switch } from '../components/ui'
import { useDashboard } from '../data/store'
import type { Network } from '../data/types'
import { unwrap } from '../lib/unwrap'
import { saveBiomassSource, saveVehicle, type BiomassSourceRow, type VehicleRow } from '../server/networks-extra'

const FUELS = ['Diesel', 'Petrol', 'CNG', 'LPG', 'Electric', 'None']

/** "" → null, "1,5" → 1.5, garbage → NaN (rejected on submit). */
const parseNum = (v: string) => {
  const t = v.trim().replace(',', '.')
  return t === '' ? null : Number(t)
}

function SiteSelect({ network, value, onChange }: { network: Network; value: string; onChange: (v: string) => void }) {
  const { data } = useDashboard()
  const sites = data.sites.filter((s) => s.networkId === network.id)
  return (
    <NativeSelect value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">Whole network (no site)</option>
      {sites.map((s) => (
        <option key={s.id} value={s.id}>
          {s.name}
        </option>
      ))}
    </NativeSelect>
  )
}

function Footer({ formId, saving, onCancel, label }: { formId: string; saving: boolean; onCancel: () => void; label: string }) {
  return (
    <div className="flex justify-end gap-2">
      <Button onClick={onCancel} disabled={saving}>
        Cancel
      </Button>
      <Button type="submit" form={formId} variant="primary" disabled={saving}>
        {saving && <Spinner className="text-white" />} {label}
      </Button>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Vehicle                                                             */
/* ------------------------------------------------------------------ */

export function VehicleSheet(props: {
  open: boolean
  onOpenChange: (o: boolean) => void
  network: Network
  vehicle: VehicleRow | null
  defaultSiteId: string | null
  onSaved: (row: VehicleRow, isNew: boolean) => void
}) {
  // Remount the form for each vehicle so its fields start from that record.
  return (
    <Sheet open={props.open} onOpenChange={props.onOpenChange} title={props.vehicle ? 'Edit vehicle' : 'Add vehicle'}>
      {props.open && <VehicleForm key={props.vehicle?.id ?? 'new'} {...props} />}
    </Sheet>
  )
}

function VehicleForm({
  onOpenChange,
  network,
  vehicle: v,
  defaultSiteId,
  onSaved,
}: {
  onOpenChange: (o: boolean) => void
  network: Network
  vehicle: VehicleRow | null
  defaultSiteId: string | null
  onSaved: (row: VehicleRow, isNew: boolean) => void
}) {
  const [f, setF] = useState({
    siteId: v ? (v.siteId ?? '') : (defaultSiteId ?? ''),
    name: v?.name ?? '',
    plate: v?.plate ?? '',
    type: v?.type ?? '',
    fuel: v?.fuel ?? '',
    factor: v?.emissionFactor != null ? String(v.emissionFactor) : '',
  })
  const [saving, setSaving] = useState(false)
  const set = (k: keyof typeof f) => (val: string) => setF((x) => ({ ...x, [k]: val }))

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const factor = parseNum(f.factor)
    if (!f.plate.trim()) return toast.error('Enter the number plate')
    if (factor != null && (Number.isNaN(factor) || factor < 0)) return toast.error('The CO₂ factor must be a positive number')
    setSaving(true)
    try {
      const row = unwrap(await saveVehicle({
        id: v?.id,
        networkId: network.id,
        siteId: f.siteId || null,
        name: f.name,
        plate: f.plate,
        type: f.type,
        fuel: f.fuel,
        emissionFactor: factor,
      }))
      onSaved(row, !v)
      toast.success(v ? 'Vehicle saved' : 'Vehicle added')
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not save the vehicle')
    } finally {
      setSaving(false)
    }
  }

  const fuels = f.fuel && !FUELS.includes(f.fuel) ? [f.fuel, ...FUELS] : FUELS
  return (
    <form id="vehicle-form" onSubmit={submit} className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Number plate">
          <Input value={f.plate} onChange={(e) => set('plate')(e.target.value)} required autoFocus placeholder="B 1234 XYZ" />
        </Field>
        <Field label="Name">
          <Input value={f.name} onChange={(e) => set('name')(e.target.value)} placeholder="Pickup truck" />
        </Field>
        <Field label="Type">
          <Input value={f.type} onChange={(e) => set('type')(e.target.value)} placeholder="Truck, tractor, motorbike…" />
        </Field>
        <Field label="Fuel">
          <NativeSelect value={f.fuel} onChange={(e) => set('fuel')(e.target.value)}>
            <option value="">Not set</option>
            {fuels.map((x) => (
              <option key={x} value={x}>
                {x}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label="CO₂ emission factor" hint="As used for transport emissions in biomass collections.">
          <Input value={f.factor} onChange={(e) => set('factor')(e.target.value)} inputMode="decimal" className="tabular-nums" placeholder="0.25" />
        </Field>
        <Field label="Site">
          <SiteSelect network={network} value={f.siteId} onChange={set('siteId')} />
        </Field>
      </div>
      <div className="mt-2 border-t border-line pt-4">
        <Footer formId="vehicle-form" saving={saving} onCancel={() => onOpenChange(false)} label={v ? 'Save vehicle' : 'Add vehicle'} />
      </div>
    </form>
  )
}

/* ------------------------------------------------------------------ */
/* Biomass source                                                      */
/* ------------------------------------------------------------------ */

export function SourceSheet(props: {
  open: boolean
  onOpenChange: (o: boolean) => void
  network: Network
  source: BiomassSourceRow | null
  defaultSiteId: string | null
  onSaved: (row: BiomassSourceRow, isNew: boolean) => void
}) {
  return (
    <Sheet open={props.open} onOpenChange={props.onOpenChange} title={props.source ? 'Edit biomass source' : 'Add biomass source'}>
      {props.open && <SourceForm key={props.source?.id ?? 'new'} {...props} />}
    </Sheet>
  )
}

function SourceForm({
  onOpenChange,
  network,
  source: b,
  defaultSiteId,
  onSaved,
}: {
  onOpenChange: (o: boolean) => void
  network: Network
  source: BiomassSourceRow | null
  defaultSiteId: string | null
  onSaved: (row: BiomassSourceRow, isNew: boolean) => void
}) {
  const [f, setF] = useState({
    siteId: b ? (b.siteId ?? '') : (defaultSiteId ?? ''),
    name: b?.name ?? '',
    address: b?.address ?? '',
    lat: b?.lat != null ? String(b.lat) : '',
    lng: b?.lng != null ? String(b.lng) : '',
  })
  const [active, setActive] = useState(b?.active ?? true)
  const [saving, setSaving] = useState(false)
  const set = (k: keyof typeof f) => (val: string) => setF((x) => ({ ...x, [k]: val }))

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const lat = parseNum(f.lat)
    const lng = parseNum(f.lng)
    if (!f.name.trim()) return toast.error('Enter a name')
    if (Number.isNaN(lat) || Number.isNaN(lng)) return toast.error('Coordinates must be numbers, e.g. -6.20000')
    if ((lat == null) !== (lng == null)) return toast.error('Enter both latitude and longitude, or neither')
    setSaving(true)
    try {
      const row = unwrap(await saveBiomassSource({ id: b?.id, networkId: network.id, siteId: f.siteId || null, name: f.name, address: f.address, lat, lng, active }))
      onSaved(row, !b)
      toast.success(b ? 'Biomass source saved' : 'Biomass source added')
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not save the biomass source')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form id="source-form" onSubmit={submit} className="flex flex-col gap-4">
      <Field label="Name">
        <Input value={f.name} onChange={(e) => set('name')(e.target.value)} required autoFocus placeholder="Sawmill Sukamaju" />
      </Field>
      <Field label="Address">
        <Input value={f.address} onChange={(e) => set('address')(e.target.value)} placeholder="Village, district, province" />
      </Field>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Latitude">
          <Input value={f.lat} onChange={(e) => set('lat')(e.target.value)} inputMode="decimal" className="tabular-nums" placeholder="-6.20000" />
        </Field>
        <Field label="Longitude">
          <Input value={f.lng} onChange={(e) => set('lng')(e.target.value)} inputMode="decimal" className="tabular-nums" placeholder="106.81667" />
        </Field>
      </div>
      <Field label="Site">
        <SiteSelect network={network} value={f.siteId} onChange={set('siteId')} />
      </Field>
      <label className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-line px-4 py-3">
        <span>
          <span className="block text-sm font-semibold">Active</span>
          <span className="block text-xs text-ink-muted">Turn off when this source no longer supplies biomass.</span>
        </span>
        <Switch checked={active} onCheckedChange={setActive} aria-label="Active" />
      </label>
      <div className="mt-2 border-t border-line pt-4">
        <Footer formId="source-form" saving={saving} onCancel={() => onOpenChange(false)} label={b ? 'Save source' : 'Add source'} />
      </div>
    </form>
  )
}
