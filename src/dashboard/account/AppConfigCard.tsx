'use client'

import { Camera, Check, Clock, Coins, Droplets, History, Pencil, Thermometer, X } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { toast } from 'sonner'

import { useSession } from '../components/shell/session'
import {
  Badge,
  Button,
  Checkbox,
  Field,
  Input,
  Modal,
  Segmented,
  Sheet,
  Switch,
} from '../components/ui'
import { QUENCH_STEPS } from '../data/catalog'
import { useDashboard } from '../data/store'
import type { AppConfig, AppConfigScope } from '../data/types'
import { cn, day } from '../lib/utils'

const SCOPE_LABEL: Record<AppConfigScope, string> = {
  artisan: 'Artisan Pro',
  csink: 'C-sink network',
  company: 'Company default',
}

/** Field-app rules. Changes go out only after a second admin approves them. */
export function AppConfigCard() {
  const { data, updateCompany } = useDashboard()
  const { user } = useSession()
  const c = data.company
  const [scope, setScope] = useState<AppConfigScope>('artisan')
  const [editing, setEditing] = useState(false)
  const [audit, setAudit] = useState(false)
  const cfg = c.appConfig[scope]
  const pending = c.pendingAppConfig
  const last = c.audit[0]

  const decide = (approve: boolean) => {
    if (!pending) return
    updateCompany(
      (x) => {
        if (approve) x.appConfig[pending.scope] = pending.config
        x.pendingAppConfig = undefined
      },
      {
        by: user.name,
        change: `${SCOPE_LABEL[pending.scope]} app settings ${approve ? 'approved' : 'rejected'} (requested by ${pending.by})`,
      },
    )
    toast.success(
      approve ? 'Approved — phones get the new settings on their next sync' : 'Change discarded',
    )
  }

  return (
    <div className="rounded-card border border-line bg-surface">
      <div className="flex flex-wrap items-start gap-3 border-b border-line px-3 py-3 sm:px-4">
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-semibold">Field app settings</h2>
          <p className="mt-0.5 text-sm text-ink-muted">
            What the dMRV app asks workers to capture. Changes need approval before they reach
            phones.
          </p>
        </div>
        <Button
          size="sm"
          className="rounded-lg"
          onClick={() => setEditing(true)}
          disabled={!!pending}
        >
          <Pencil /> Propose changes
        </Button>
      </div>

      <div className="p-3 sm:p-4">
        {pending && (
          <div className="mb-5 flex flex-wrap items-center gap-3 rounded-xl border border-warn/30 bg-warn-soft px-4 py-3">
            <Clock className="size-4 text-warn" />
            <div className="min-w-0 flex-1 text-sm">
              <span className="font-semibold">{SCOPE_LABEL[pending.scope]}</span> change from{' '}
              {pending.by} is waiting for approval ({day(pending.at)}).
            </div>
            <Button
              size="sm"
              variant="primary"
              className="rounded-lg"
              onClick={() => decide(true)}
              disabled={pending.by === user.name}
              title={
                pending.by === user.name
                  ? 'Another admin has to approve your own change'
                  : undefined
              }
            >
              <Check /> Approve
            </Button>
            <Button size="sm" className="rounded-lg" onClick={() => decide(false)}>
              <X /> {pending.by === user.name ? 'Withdraw' : 'Reject'}
            </Button>
          </div>
        )}

        <Segmented
          value={scope}
          onChange={setScope}
          options={(Object.keys(SCOPE_LABEL) as AppConfigScope[]).map((k) => ({
            value: k,
            label: SCOPE_LABEL[k],
          }))}
        />

        <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="rounded-xl border border-line p-4">
            <Heading icon={<Droplets />}>Sensor readings</Heading>
            <Sensor
              icon={<Droplets />}
              tone="bg-info-soft text-info"
              name="Moisture"
              rule={`Max ${cfg.moisture.max}% · ${cfg.moisture.readings} reading${cfg.moisture.readings === 1 ? '' : 's'}`}
              required={cfg.moisture.required}
            />
            <Sensor
              icon={<Thermometer />}
              tone="bg-flame-soft text-flame"
              name="Temperature"
              rule={`Min ${cfg.temperature.min} °C · ${cfg.temperature.readings} reading${cfg.temperature.readings === 1 ? '' : 's'}`}
              required={cfg.temperature.required}
            />
          </div>
          <div className="rounded-xl border border-line p-4">
            <Heading icon={<Camera />}>Photo &amp; video evidence</Heading>
            <dl className="flex flex-col divide-y divide-line text-sm">
              <Setting label="Minimum firing photos" value={String(cfg.minFiringImages)} />
              <Setting
                label="Record a firing video"
                value={cfg.recordVideo ? 'Yes' : 'No'}
                on={cfg.recordVideo}
              />
              <Setting label="Firing videos" value={cfg.recordVideo ? String(cfg.minFiringVideos) : '—'} />
              <Setting
                label="Minimum video length"
                value={cfg.recordVideo ? `${cfg.minVideoSeconds}s` : '—'}
              />
              <Setting label="Biomass photos" value={String(cfg.photos.biomass)} />
              <Setting label="Mixing photos" value={String(cfg.photos.mixing)} />
              <Setting label="Packing photos" value={String(cfg.photos.packing)} />
              <Setting label="Application photos" value={String(cfg.photos.application)} />
              <Setting
                label="Can apply open (unmixed) biochar"
                value={cfg.canApplyOpenBiochar ? 'Yes' : 'No'}
                on={cfg.canApplyOpenBiochar}
                note="online only"
              />
              <Setting
                label="Hide the mixing step"
                value={cfg.hideMixingTab ? 'Yes' : 'No'}
                on={cfg.hideMixingTab}
                note="online only"
              />
            </dl>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {cfg.quenchSteps.map((q) => (
                <span
                  key={q}
                  className="rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-ink-2"
                >
                  {q} photo
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-4 rounded-xl border border-line p-4">
          <Heading icon={<Coins />}>Credits shown in the app</Heading>
          <dl className="grid grid-cols-1 divide-y divide-line text-sm sm:grid-cols-3 sm:divide-x sm:divide-y-0">
            <Setting label="Price per credit" value={`${cfg.credits.currency} ${cfg.credits.price.toLocaleString('en')}`} />
            <Setting label="Payout goal" value={`${cfg.credits.payoutGoal.toLocaleString('en')} credits`} />
            <Setting label="Support phone" value={cfg.supportPhone || '—'} />
          </dl>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-ink-muted">
          <History className="size-3.5" />
          {last ? `Last change ${day(last.at)} by ${last.by}` : 'No changes yet'}
          <button
            type="button"
            onClick={() => setAudit(true)}
            className="ml-auto cursor-pointer font-semibold text-brand hover:underline"
          >
            View audit log
          </button>
        </div>
      </div>

      <Sheet
        open={editing}
        onOpenChange={setEditing}
        title={`Propose changes · ${SCOPE_LABEL[scope]}`}
        className="max-w-lg"
      >
        {editing && (
          <ConfigForm
            initial={cfg}
            onCancel={() => setEditing(false)}
            onSubmit={(config) => {
              updateCompany(
                (x) =>
                  void (x.pendingAppConfig = {
                    scope,
                    config,
                    by: user.name,
                    at: new Date().toISOString(),
                  }),
                {
                  by: user.name,
                  change: `${SCOPE_LABEL[scope]} app settings change proposed`,
                },
              )
              toast.success('Sent for approval')
              setEditing(false)
            }}
          />
        )}
      </Sheet>

      <Modal
        open={audit}
        onOpenChange={setAudit}
        title="Audit log"
        description="Every change to the company setup, newest first."
        className="max-w-xl"
      >
        <ol className="flex flex-col gap-3">
          {c.audit.map((a) => (
            <li key={a.id} className="flex gap-3 text-sm">
              <span className="mt-1.5 size-2 shrink-0 rounded-full bg-brand" />
              <div>
                <div className="text-ink-2">{a.change}</div>
                <div className="text-xs text-ink-muted">
                  {a.by} ·{' '}
                  {new Date(a.at).toLocaleString('en-GB', {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  })}
                </div>
              </div>
            </li>
          ))}
        </ol>
      </Modal>
    </div>
  )
}

function Heading({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <div className="mb-3 flex items-center gap-2 text-xs font-semibold tracking-wide text-ink-muted uppercase [&_svg]:size-4">
      {icon}
      {children}
    </div>
  )
}

function Sensor({
  icon,
  tone,
  name,
  rule,
  required,
}: {
  icon: ReactNode
  tone: string
  name: string
  rule: string
  required: boolean
}) {
  return (
    <div className="mb-2 flex items-center gap-3 rounded-lg bg-muted px-3 py-2.5 last:mb-0">
      <span
        className={cn('flex size-8 items-center justify-center rounded-lg [&_svg]:size-4', tone)}
      >
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold">{name}</div>
        <div className="text-xs text-ink-muted">{rule}</div>
      </div>
      <Badge tone={required ? 'danger' : 'neutral'}>{required ? 'Required' : 'Optional'}</Badge>
    </div>
  )
}

function Setting({
  label,
  value,
  on,
  note,
}: {
  label: string
  value: string
  on?: boolean
  note?: string
}) {
  return (
    <div className="flex items-center gap-3 py-2">
      <dt className="flex-1 text-ink-2">
        {label}
        {note && <span className="ml-1.5 text-xs text-ink-subtle">({note})</span>}
      </dt>
      <dd
        className={cn(
          'rounded-md px-2 py-0.5 text-xs font-bold tabular-nums',
          on === undefined
            ? 'bg-muted text-ink'
            : on
              ? 'bg-success-soft text-success'
              : 'bg-muted text-ink-muted',
        )}
      >
        {value}
      </dd>
    </div>
  )
}

function ConfigForm({
  initial,
  onCancel,
  onSubmit,
}: {
  initial: AppConfig
  onCancel: () => void
  onSubmit: (c: AppConfig) => void
}) {
  const [c, setC] = useState<AppConfig>(() => structuredClone(initial))
  const changed = JSON.stringify(c) !== JSON.stringify(initial)
  const n = (v: string) => Math.max(0, Number(v) || 0)
  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={(e) => {
        e.preventDefault()
        onSubmit(c)
      }}
    >
      <fieldset className="flex flex-col gap-3">
        <legend className="mb-2 text-xs font-semibold tracking-wide text-ink-muted uppercase">
          Moisture
        </legend>
        <Toggle
          label="Required"
          checked={c.moisture.required}
          onChange={(required) => setC({ ...c, moisture: { ...c.moisture, required } })}
        />
        <Field label="Maximum moisture (%)">
          <Input
            type="number"
            min={0}
            max={100}
            value={c.moisture.max}
            onChange={(e) => setC({ ...c, moisture: { ...c.moisture, max: n(e.target.value) } })}
          />
        </Field>
        <Field label="Readings (each with a meter photo)">
          <Input
            type="number"
            min={1}
            max={10}
            value={c.moisture.readings}
            onChange={(e) => setC({ ...c, moisture: { ...c.moisture, readings: Math.min(10, Math.max(1, n(e.target.value))) } })}
          />
        </Field>
      </fieldset>
      <fieldset className="flex flex-col gap-3">
        <legend className="mb-2 text-xs font-semibold tracking-wide text-ink-muted uppercase">
          Temperature
        </legend>
        <Toggle
          label="Required"
          checked={c.temperature.required}
          onChange={(required) => setC({ ...c, temperature: { ...c.temperature, required } })}
        />
        <div className="grid grid-cols-2 gap-3">
          <Field label="Minimum (°C)">
            <Input
              type="number"
              min={0}
              value={c.temperature.min}
              onChange={(e) =>
                setC({ ...c, temperature: { ...c.temperature, min: n(e.target.value) } })
              }
            />
          </Field>
          <Field label="Readings">
            <Input
              type="number"
              min={1}
              value={c.temperature.readings}
              onChange={(e) =>
                setC({
                  ...c,
                  temperature: { ...c.temperature, readings: Math.max(1, n(e.target.value)) },
                })
              }
            />
          </Field>
        </div>
      </fieldset>
      <fieldset className="flex flex-col gap-3">
        <legend className="mb-2 text-xs font-semibold tracking-wide text-ink-muted uppercase">
          Evidence
        </legend>
        <Field label="Minimum firing photos">
          <Input
            type="number"
            min={0}
            value={c.minFiringImages}
            onChange={(e) => setC({ ...c, minFiringImages: n(e.target.value) })}
          />
        </Field>
        <Toggle
          label="Record a firing video"
          checked={c.recordVideo}
          onChange={(recordVideo) => setC({ ...c, recordVideo })}
        />
        {c.recordVideo && (
          <Field label="Firing videos">
            <Input
              type="number"
              min={1}
              max={5}
              value={c.minFiringVideos}
              onChange={(e) => setC({ ...c, minFiringVideos: Math.min(5, Math.max(1, n(e.target.value))) })}
            />
          </Field>
        )}
        {c.recordVideo && (
          <Field label="Minimum video length (seconds)">
            <Input
              type="number"
              min={1}
              value={c.minVideoSeconds}
              onChange={(e) => setC({ ...c, minVideoSeconds: n(e.target.value) })}
            />
          </Field>
        )}
        <Toggle
          label="Allow applying open (unmixed) biochar"
          checked={c.canApplyOpenBiochar}
          onChange={(canApplyOpenBiochar) => setC({ ...c, canApplyOpenBiochar })}
        />
        <Toggle
          label="Hide the mixing step"
          checked={c.hideMixingTab}
          onChange={(hideMixingTab) => setC({ ...c, hideMixingTab })}
        />
        <div>
          <div className="mb-2 text-sm font-medium">Quench photos</div>
          <div className="flex flex-col gap-2">
            {QUENCH_STEPS.map((q) => (
              <label key={q} className="flex cursor-pointer items-center gap-2.5 text-sm">
                <Checkbox
                  checked={c.quenchSteps.includes(q)}
                  onCheckedChange={(on) =>
                    setC({
                      ...c,
                      quenchSteps: on
                        ? QUENCH_STEPS.filter((x) => x === q || c.quenchSteps.includes(x))
                        : c.quenchSteps.filter((x) => x !== q),
                    })
                  }
                />
                {q}
              </label>
            ))}
          </div>
        </div>
      </fieldset>
      <fieldset className="flex flex-col gap-3">
        <legend className="mb-2 text-xs font-semibold tracking-wide text-ink-muted uppercase">
          Minimum photos
        </legend>
        <div className="grid grid-cols-2 gap-3">
          {(
            [
              ['biomass', 'Biomass collection'],
              ['mixing', 'Mixing'],
              ['packing', 'Packing'],
              ['application', 'Application'],
            ] as const
          ).map(([k, label]) => (
            <Field key={k} label={label}>
              <Input
                type="number"
                min={0}
                max={10}
                value={c.photos[k]}
                onChange={(e) => setC({ ...c, photos: { ...c.photos, [k]: Math.min(10, n(e.target.value)) } })}
              />
            </Field>
          ))}
        </div>
      </fieldset>
      <fieldset className="flex flex-col gap-3">
        <legend className="mb-2 text-xs font-semibold tracking-wide text-ink-muted uppercase">
          Credits &amp; support
        </legend>
        <div className="grid grid-cols-[1fr_2fr] gap-3">
          <Field label="Currency">
            <Input
              value={c.credits.currency}
              maxLength={3}
              onChange={(e) => setC({ ...c, credits: { ...c.credits, currency: e.target.value.toUpperCase().slice(0, 3) } })}
            />
          </Field>
          <Field label="Price per credit">
            <Input
              type="number"
              min={0}
              value={c.credits.price}
              onChange={(e) => setC({ ...c, credits: { ...c.credits, price: n(e.target.value) } })}
            />
          </Field>
        </div>
        <Field label="Payout goal (credits)" hint="Workers can ask to sell once they reach this many credits.">
          <Input
            type="number"
            min={0}
            value={c.credits.payoutGoal}
            onChange={(e) => setC({ ...c, credits: { ...c.credits, payoutGoal: n(e.target.value) } })}
          />
        </Field>
        <Field label="Support phone" hint="The app's support button calls this number.">
          <Input type="tel" value={c.supportPhone} onChange={(e) => setC({ ...c, supportPhone: e.target.value.slice(0, 30) })} />
        </Field>
      </fieldset>
      <div className="sticky bottom-0 -mx-4 mt-2 flex gap-2 border-t border-line bg-surface px-4 py-3">
        <Button className="flex-1 rounded-xl" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" className="flex-1 rounded-xl" disabled={!changed}>
          Send for approval
        </Button>
      </div>
    </form>
  )
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-line px-3.5 py-2.5 text-sm font-medium">
      {label}
      <Switch checked={checked} onCheckedChange={onChange} />
    </label>
  )
}
