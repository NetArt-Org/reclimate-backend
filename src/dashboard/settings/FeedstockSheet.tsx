'use client'

import { Save } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

import { Button, Field, Input, NativeSelect, Sheet, Switch } from '../components/ui'
import { useDashboard } from '../data/store'
import type { Feedstock } from '../data/types'
import { unwrap } from '../lib/unwrap'
import { saveFeedstock } from '../server/settings'

export const STRATEGY_OPTIONS: { value: '' | NonNullable<Feedstock['strategy']>; label: string }[] = [
  { value: 'methane', label: 'Methane config strategy' },
  { value: 'compensation', label: 'Compensation' },
  { value: 'avoidance', label: 'Avoidance' },
  { value: '', label: 'Not set' },
]

/** Edit a feedstock's methane strategy and lab values, or add a new one (`feedstock` = null). */
export function FeedstockSheet({
  feedstock,
  open,
  onOpenChange,
}: {
  feedstock: Feedstock | null
  open: boolean
  onOpenChange: (o: boolean) => void
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title={feedstock ? feedstock.name : 'Add feedstock'}>
      {/* Remount on open so the form starts from the saved values. */}
      {open && <Editor feedstock={feedstock} onDone={() => onOpenChange(false)} />}
    </Sheet>
  )
}

const toNum = (s: string) => (s.trim() === '' ? null : Number(s))

function Editor({ feedstock, onDone }: { feedstock: Feedstock | null; onDone: () => void }) {
  const { reload } = useDashboard()
  const [name, setName] = useState(feedstock?.name ?? '')
  const [strategy, setStrategy] = useState<Feedstock['strategy']>(feedstock?.strategy ?? null)
  const [spc, setSpc] = useState(feedstock?.spc ?? false)
  const [bulk, setBulk] = useState(feedstock?.bulkDensity?.toString() ?? '')
  const [carbon, setCarbon] = useState(feedstock?.carbonContent?.toString() ?? '')
  const [tracking, setTracking] = useState(feedstock?.volumeTracking ?? false)
  const [saving, setSaving] = useState(false)

  const bulkN = toNum(bulk)
  const carbonN = toNum(carbon)
  const bulkError = bulkN !== null && (!Number.isFinite(bulkN) || bulkN <= 0) ? 'Enter a positive number' : null
  const carbonError =
    carbonN !== null && (!Number.isFinite(carbonN) || carbonN < 0 || carbonN > 100) ? 'Enter a percentage between 0 and 100' : null
  const nameError = !name.trim()
  const canSave = !nameError && !bulkError && !carbonError && !saving

  const save = async () => {
    if (!canSave) return
    setSaving(true)
    try {
      unwrap(await saveFeedstock({
        id: feedstock?.id,
        name: name.trim(),
        strategy,
        spc: strategy === 'compensation' ? spc : false,
        bulkDensity: bulkN,
        carbonContent: carbonN,
        volumeTracking: tracking,
      }))
      toast.success(feedstock ? 'Feedstock saved' : 'Feedstock added')
      reload()
      onDone()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err))
      setSaving(false)
    }
  }

  return (
    <form
      className="-mx-4 -my-3 flex min-h-full flex-col"
      onSubmit={(e) => {
        e.preventDefault()
        void save()
      }}
    >
      <div className="flex flex-1 flex-col gap-4 px-4 py-3">
        {!feedstock && (
          <Field label="Name *">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Rice husk" required autoFocus />
          </Field>
        )}

        <Field label="Methane strategy">
          <NativeSelect
            value={strategy ?? ''}
            onChange={(e) => setStrategy((e.target.value || null) as Feedstock['strategy'])}
          >
            {STRATEGY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </NativeSelect>
        </Field>

        <ToggleRow
          id="fs-spc"
          label="Site-specific carbon (SPC)"
          hint={strategy === 'compensation' ? 'Uses a site-specific carbon value for compensation.' : 'Only applies to the Compensation strategy.'}
          checked={strategy === 'compensation' && spc}
          onChange={setSpc}
          disabled={strategy !== 'compensation'}
        />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1">
            <Field label="Bulk density (kg/m³)">
              <Input
                type="number"
                inputMode="decimal"
                min={0}
                step="any"
                value={bulk}
                onChange={(e) => setBulk(e.target.value)}
                placeholder="—"
                aria-invalid={!!bulkError}
                className="tabular-nums"
              />
            </Field>
            {bulkError && <span className="text-xs text-danger">{bulkError}</span>}
          </div>
          <div className="flex flex-col gap-1">
            <Field label="Carbon content (%)">
              <Input
                type="number"
                inputMode="decimal"
                min={0}
                max={100}
                step="any"
                value={carbon}
                onChange={(e) => setCarbon(e.target.value)}
                placeholder="—"
                aria-invalid={!!carbonError}
                className="tabular-nums"
              />
            </Field>
            {carbonError && <span className="text-xs text-danger">{carbonError}</span>}
          </div>
        </div>

        <ToggleRow
          id="fs-tracking"
          label="Volume tracking"
          hint="The field app asks for the feedstock volume on each batch."
          checked={tracking}
          onChange={setTracking}
        />
      </div>

      <div className="sticky bottom-0 flex justify-end gap-2 border-t border-line bg-surface px-4 py-3">
        <Button variant="outline" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" disabled={!canSave}>
          <Save /> {saving ? 'Saving…' : feedstock ? 'Save' : 'Add feedstock'}
        </Button>
      </div>
    </form>
  )
}

export function ToggleRow({
  id,
  label,
  hint,
  checked,
  onChange,
  disabled,
}: {
  id: string
  label: string
  hint?: string
  checked: boolean
  onChange: (v: boolean) => void
  disabled?: boolean
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl border border-line px-4 py-3">
      <div className="min-w-0">
        <label htmlFor={id} className={disabled ? 'text-sm font-semibold text-ink-muted' : 'cursor-pointer text-sm font-semibold'}>
          {label}
        </label>
        {hint && <p className="mt-0.5 text-xs text-ink-muted">{hint}</p>}
      </div>
      <Switch id={id} checked={checked} onCheckedChange={onChange} disabled={disabled} className="disabled:cursor-not-allowed disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-brand/40 outline-none" />
    </div>
  )
}
