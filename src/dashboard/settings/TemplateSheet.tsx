'use client'

import { AlertTriangle, Save } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'sonner'

import { Button, Field, Input, NativeSelect, Sheet } from '../components/ui'
import { useDashboard } from '../data/store'
import { cn, num } from '../lib/utils'
import { unwrap } from '../lib/unwrap'
import { saveTemplate, type Template } from '../server/settings'
import { MIN_VOLUME_L, shapeDef, shapesFor, UNITS, volumeLitres, type TemplateKind, type Unit } from './volume'

export const KILN_TYPE_LABEL: Record<'kontiki' | 'pit', string> = { kontiki: 'Kon-Tiki', pit: 'Pit' }

/** Add or edit a kiln or measuring-container template. */
export function TemplateSheet({
  kind,
  template,
  open,
  onOpenChange,
}: {
  kind: TemplateKind
  /** null = add a new one */
  template: Template | null
  open: boolean
  onOpenChange: (o: boolean) => void
}) {
  const noun = kind === 'kiln' ? 'kiln' : 'container'
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title={template ? `Edit ${noun} template` : `Add ${noun} template`}>
      {open && <Editor kind={kind} template={template} onDone={() => onOpenChange(false)} />}
    </Sheet>
  )
}

function Editor({ kind, template, onDone }: { kind: TemplateKind; template: Template | null; onDone: () => void }) {
  const router = useRouter()
  const { data } = useDashboard()
  const shapes = shapesFor(kind)

  const [sourceKilnId, setSourceKilnId] = useState('')
  const [name, setName] = useState(template?.name ?? '')
  const [kilnType, setKilnType] = useState<'kontiki' | 'pit'>(template?.kilnType ?? 'kontiki')
  const [shape, setShape] = useState<string>(template?.shape ?? shapes[0].value)
  const [unit, setUnit] = useState<Unit>(template?.unit ?? 'cm')
  const [dims, setDims] = useState<Record<string, string>>(() =>
    Object.fromEntries(Object.entries(template?.dimensions ?? {}).map(([k, v]) => [k, String(v)])),
  )
  const [saving, setSaving] = useState(false)

  const def = shapeDef(kind, shape) ?? shapes[0]
  const values: Record<string, number | undefined> = Object.fromEntries(
    def.fields.map((f) => [f.key, dims[f.key]?.trim() ? Number(dims[f.key]) : undefined]),
  )
  const volumeL = volumeLitres(def.value, values, unit)
  const missing = !name.trim() || def.fields.some((f) => !(values[f.key]! > 0))
  const tooLow = volumeL > 0 && volumeL < MIN_VOLUME_L[kind]
  const canSave = !missing && volumeL > 0 && !saving

  const sourceKiln = data.kilns.find((k) => k.id === sourceKilnId)
  const siteName = (siteId: string) => data.sites.find((s) => s.id === siteId)?.name ?? 'Unknown site'

  const pickKiln = (id: string) => {
    setSourceKilnId(id)
    const k = data.kilns.find((x) => x.id === id)
    if (!k) return
    setName(k.name)
    setKilnType(k.type)
  }

  const save = async () => {
    if (!canSave) return
    setSaving(true)
    try {
      unwrap(await saveTemplate({
        id: template?.id,
        kind,
        name: name.trim(),
        kilnType: kind === 'kiln' ? kilnType : null,
        shape: def.value,
        unit,
        dimensions: Object.fromEntries(def.fields.map((f) => [f.key, values[f.key] as number])),
        volumeL: Math.round(volumeL * 10) / 10,
      }))
      toast.success(template ? 'Template saved' : 'Template added')
      router.refresh()
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
        {kind === 'kiln' && !template && data.kilns.length > 0 && (
          <Field
            label="Start from an existing kiln"
            hint={
              sourceKiln?.volumeM3
                ? `Recorded volume: ${num(sourceKiln.volumeM3, 3)} m³ = ${num(sourceKiln.volumeM3 * 1000, 1)} L`
                : sourceKiln
                  ? 'No volume recorded for this kiln.'
                  : 'Optional. Copies the name and type.'
            }
          >
            <NativeSelect value={sourceKilnId} onChange={(e) => pickKiln(e.target.value)}>
              <option value="">None</option>
              {data.kilns.map((k) => (
                <option key={k.id} value={k.id}>
                  {k.name} · {siteName(k.siteId)} · {KILN_TYPE_LABEL[k.type]}
                </option>
              ))}
            </NativeSelect>
          </Field>
        )}

        <Field label="Name *">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={kind === 'kiln' ? 'e.g. Standard Kon-Tiki' : 'e.g. 20 L bucket'} required />
        </Field>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {kind === 'kiln' && (
            <Field label="Kiln type *">
              <NativeSelect value={kilnType} onChange={(e) => setKilnType(e.target.value as 'kontiki' | 'pit')}>
                <option value="kontiki">Kon-Tiki</option>
                <option value="pit">Pit</option>
              </NativeSelect>
            </Field>
          )}
          <Field label="Shape *">
            <NativeSelect value={def.value} onChange={(e) => setShape(e.target.value)}>
              {shapes.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Measuring unit">
            <NativeSelect value={unit} onChange={(e) => setUnit(e.target.value as Unit)}>
              {UNITS.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </NativeSelect>
          </Field>
        </div>

        <fieldset className="flex flex-col gap-4 rounded-2xl border border-line p-4">
          <legend className="px-1 text-xs font-bold tracking-wide text-ink-muted uppercase">Dimensions ({unit})</legend>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {def.fields.map((f) => {
              const raw = dims[f.key] ?? ''
              const invalid = raw.trim() !== '' && !(Number(raw) > 0)
              return (
                <div key={f.key} className="flex flex-col gap-1">
                  <Field label={`${f.label} *`}>
                    <div className="relative">
                      <Input
                        type="number"
                        inputMode="decimal"
                        min={0}
                        step="any"
                        value={raw}
                        onChange={(e) => setDims((d) => ({ ...d, [f.key]: e.target.value }))}
                        aria-invalid={invalid}
                        className="pr-12 tabular-nums"
                        required
                      />
                      <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-xs text-ink-subtle">{unit}</span>
                    </div>
                  </Field>
                  {invalid && <span className="text-xs text-danger">Enter a positive number</span>}
                </div>
              )
            })}
          </div>

          <div className={cn('flex flex-col gap-1 rounded-xl px-3 py-2.5', tooLow ? 'bg-danger-soft' : 'bg-muted')} aria-live="polite">
            <div className="text-sm">
              Total volume: <span className="font-bold tabular-nums">{num(volumeL, 1)} L</span>
            </div>
            {tooLow && (
              <div className="flex items-center gap-1.5 text-xs font-semibold text-danger">
                <AlertTriangle className="size-3.5" aria-hidden />
                {kind === 'kiln' ? 'Volume of the kiln is too low' : 'Volume of the container is too low'}
              </div>
            )}
          </div>
        </fieldset>
      </div>

      <div className="sticky bottom-0 flex justify-end gap-2 border-t border-line bg-surface px-4 py-3">
        <Button variant="outline" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" disabled={!canSave}>
          <Save /> {saving ? 'Saving…' : template ? 'Save' : 'Add'}
        </Button>
      </div>
    </form>
  )
}
