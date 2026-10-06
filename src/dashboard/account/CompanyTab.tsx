'use client'

import {
  BadgeCheck,
  Building2,
  ChevronDown,
  FolderKanban,
  Leaf,
  Mail,
  MapPin,
  Pencil,
  Phone,
  Plus,
  Shield,
  Trash2,
  Wind,
} from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

import { useSession } from '../components/shell/session'
import { OptionRow } from '../components/shell/PageHeader'
import {
  Badge,
  Button,
  Field,
  Input,
  Menu,
  MenuContent,
  MenuItem,
  MenuTrigger,
  Modal,
  NativeSelect,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Switch,
  Tooltip,
} from '../components/ui'
import {
  APPLICATION_TYPES,
  MIXING_TYPES,
  referenceDefaults,
  REGISTRIES,
} from '../data/catalog'
import { useDashboard } from '../data/store'
import type { Company, FeedstockReference, FeedstockStrategy, Project } from '../data/types'
import { cn, day, uid } from '../lib/utils'
import { AppConfigCard } from './AppConfigCard'
import { ChipPicker, ContactList, DocList, Section } from './parts'

const STRATEGY: Record<
  'avoidance' | 'compensation',
  { label: string; tone: string; icon: typeof Shield }
> = {
  avoidance: { label: 'Avoidance strategy', tone: 'text-danger', icon: Shield },
  compensation: { label: 'Compensation strategy', tone: 'text-info', icon: Wind },
}

/** The C-sink manager company: contacts and documents on the left, how the programme runs on the right. */
export function CompanyTab() {
  const { data, updateCompany } = useDashboard()
  const { user } = useSession()
  const c = data.company
  const [editing, setEditing] = useState(false)
  const set = (recipe: (c: Company) => void, change?: string) =>
    updateCompany(recipe, change ? { by: user.name, change } : undefined)

  return (
    <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[360px_minmax(0,1fr)]">
      {/* ================= left: company, people, documents ================= */}
      <div className="flex flex-col gap-5">
        <Section
          title={c.name}
          description={c.kind}
          action={
            <Tooltip content="Edit company details">
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => setEditing(true)}
                aria-label="Edit company details"
              >
                <Pencil />
              </Button>
            </Tooltip>
          }
        >
          <div className="flex flex-col gap-3 text-sm">
            <Info icon={<MapPin />} label="Headquarters">
              {c.address}
            </Info>
            <Info icon={<Mail />} label="Email">
              {c.email}
            </Info>
            <Info icon={<Phone />} label="Phone">
              {c.phone || '—'}
            </Info>
          </div>
        </Section>

        <Section title="Company admins" description="Can sign in to this admin panel.">
          <ContactList
            contacts={c.admins}
            onChange={(admins) => set((x) => void (x.admins = admins), 'Company admins updated')}
            role="Company admin"
            empty="No admins yet."
          />
        </Section>

        <Section title="Billing" description="Who receives invoices, and billing documents.">
          <div className="text-xs font-semibold tracking-wide text-ink-muted uppercase">
            Managers
          </div>
          <div className="mt-2">
            <ContactList
              contacts={c.billingManagers}
              onChange={(v) => set((x) => void (x.billingManagers = v))}
              role="Billing manager"
              empty="No billing managers."
            />
          </div>
          <div className="mt-5 text-xs font-semibold tracking-wide text-ink-muted uppercase">
            Documents
          </div>
          <div className="mt-2">
            <DocList
              docs={c.billingDocs}
              onChange={(v) => set((x) => void (x.billingDocs = v))}
              empty="No billing documents."
            />
          </div>
        </Section>

        <Section
          title="ICS managers"
          description="Internal control system — checks field records before audit."
        >
          <ContactList
            contacts={c.icsManagers}
            onChange={(v) => set((x) => void (x.icsManagers = v), 'ICS managers updated')}
            role="ICS manager"
            empty="No ICS managers assigned."
          />
        </Section>

        <Section title="Documents">
          <DocList docs={c.documents} onChange={(v) => set((x) => void (x.documents = v))} />
        </Section>

        <Section title="Additional services">
          <div className="flex flex-col gap-4">
            <ServiceToggle
              label="Afforestation"
              code="AF"
              sub="Track tree planting alongside biochar."
              checked={c.services.afforestation}
              onChange={(on) =>
                set(
                  (x) => void (x.services.afforestation = on),
                  `Afforestation service ${on ? 'enabled' : 'disabled'}`,
                )
              }
            />
            <ServiceToggle
              label="Internet of Things"
              code="IoT"
              sub="Kiln temperature sensors feed readings automatically."
              checked={c.services.iot}
              onChange={(on) =>
                set((x) => void (x.services.iot = on), `IoT service ${on ? 'enabled' : 'disabled'}`)
              }
            />
          </div>
        </Section>
      </div>

      {/* ================= right: programme setup ================= */}
      <div className="flex min-w-0 flex-col gap-5">
        <FeedstockPortfolio />
        <Standards />
        <AppConfigCard />
        <ProjectRegistry />
      </div>

      <CompanyDialog open={editing} onOpenChange={setEditing} />
    </div>
  )
}

function Info({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="flex gap-3 [&>svg]:mt-0.5 [&>svg]:size-4 [&>svg]:shrink-0 [&>svg]:text-ink-subtle">
      {icon}
      <div>
        <div className="text-xs text-ink-muted">{label}</div>
        <div className="text-ink-2">{children}</div>
      </div>
    </div>
  )
}

function ServiceToggle({
  label,
  code,
  sub,
  checked,
  onChange,
}: {
  label: string
  code: string
  sub: string
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-xs font-bold text-ink-2">
        {code}
      </span>
      <span className="flex-1">
        <span className="block text-sm font-semibold">{label}</span>
        <span className="block text-xs text-ink-muted">{sub}</span>
      </span>
      <Switch checked={checked} onCheckedChange={onChange} aria-label={label} />
    </label>
  )
}

function CompanyDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
}) {
  const { data, updateCompany } = useDashboard()
  const { user } = useSession()
  return (
    <Modal open={open} onOpenChange={onOpenChange} title="Company details">
      {open && (
        <CompanyForm
          initial={{
            name: data.company.name,
            address: data.company.address,
            email: data.company.email,
            phone: data.company.phone,
          }}
          onCancel={() => onOpenChange(false)}
          onSave={(v) => {
            updateCompany((c) => Object.assign(c, v), {
              by: user.name,
              change: 'Company details updated',
            })
            toast.success('Company details saved')
            onOpenChange(false)
          }}
        />
      )}
    </Modal>
  )
}

function CompanyForm({
  initial,
  onCancel,
  onSave,
}: {
  initial: { name: string; address: string; email: string; phone: string }
  onCancel: () => void
  onSave: (v: { name: string; address: string; email: string; phone: string }) => void
}) {
  const [v, setV] = useState(initial)
  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault()
        onSave({
          name: v.name.trim(),
          address: v.address.trim(),
          email: v.email.trim(),
          phone: v.phone.trim(),
        })
      }}
    >
      <Field label="Company name">
        <Input required value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} />
      </Field>
      <Field label="Headquarters address">
        <Input
          required
          value={v.address}
          onChange={(e) => setV({ ...v, address: e.target.value })}
        />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Email">
          <Input
            required
            type="email"
            value={v.email}
            onChange={(e) => setV({ ...v, email: e.target.value })}
          />
        </Field>
        <Field label="Phone">
          <Input
            type="tel"
            value={v.phone}
            onChange={(e) => setV({ ...v, phone: e.target.value })}
          />
        </Field>
      </div>
      <div className="flex justify-end gap-2 pt-1">
        <Button onClick={onCancel}>Cancel</Button>
        <Button type="submit" variant="primary">
          Save
        </Button>
      </div>
    </form>
  )
}

/* ------------------------------------------------------------------ */
/* Feedstock portfolio                                                  */
/* ------------------------------------------------------------------ */

function FeedstockPortfolio() {
  const { data, updateCompany } = useDashboard()
  const { user } = useSession()
  const list = data.company.feedstocks
  const set = (recipe: (c: Company) => void, change: string) =>
    updateCompany(recipe, { by: user.name, change })
  const missing = data.feedstocks.map((f) => f.name).filter((f) => !list.some((x) => x.name === f))

  return (
    <Section
      title="Feedstock portfolio"
      description="Biomass types the programme accepts, and the methane strategy for each."
      action={
        <Popover>
          <PopoverTrigger asChild>
            <Button size="sm" className="rounded-lg" disabled={!missing.length}>
              <Plus /> Add feedstock
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-64 p-1.5">
            {missing.map((f) => (
              <OptionRow
                key={f}
                selected={false}
                onClick={() =>
                  set(
                    (c) => void c.feedstocks.push({ name: f, strategy: null, spc: false }),
                    `Feedstock added: ${f}`,
                  )
                }
              >
                {f}
              </OptionRow>
            ))}
          </PopoverContent>
        </Popover>
      }
    >
      <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2">
        {list.map((f) => {
          const s = f.strategy ? STRATEGY[f.strategy] : null
          const update = (patch: Partial<typeof f>, change: string) =>
            set((c) => {
              const x = c.feedstocks.find((y) => y.name === f.name)
              if (x) Object.assign(x, patch)
            }, change)
          return (
            <div
              key={f.name}
              className="group flex items-center gap-3 rounded-xl border border-line px-3.5 py-3"
            >
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand">
                <Leaf className="size-4" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm font-semibold">{f.name}</span>
                  {f.spc && (
                    <Tooltip content="Has a site-specific carbon value">
                      <span className="rounded bg-warn-soft px-1.5 py-0.5 text-[10px] font-bold text-warn">
                        SPC
                      </span>
                    </Tooltip>
                  )}
                </div>
                <Menu>
                  <MenuTrigger asChild>
                    <button
                      type="button"
                      className={cn(
                        'mt-0.5 flex cursor-pointer items-center gap-1 text-xs font-semibold',
                        s ? s.tone : 'text-ink-subtle',
                      )}
                    >
                      {s ? <s.icon className="size-3" /> : null}
                      {s ? s.label : 'Set methane strategy'}
                      <ChevronDown className="size-3" />
                    </button>
                  </MenuTrigger>
                  <MenuContent align="start">
                    {(['avoidance', 'compensation', null] as FeedstockStrategy[]).map((k) => (
                      <MenuItem
                        key={String(k)}
                        onSelect={() =>
                          update(
                            { strategy: k },
                            `${f.name}: ${k ? STRATEGY[k].label.toLowerCase() : 'no strategy'}`,
                          )
                        }
                      >
                        {k ? STRATEGY[k].label : 'No strategy'}
                      </MenuItem>
                    ))}
                    <MenuItem
                      onSelect={() =>
                        update({ spc: !f.spc }, `${f.name}: SPC ${f.spc ? 'removed' : 'added'}`)
                      }
                    >
                      {f.spc ? 'Remove SPC' : 'Mark as SPC'}
                    </MenuItem>
                  </MenuContent>
                </Menu>
              </div>
              <Button
                variant="ghost"
                size="icon-sm"
                className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
                aria-label={`Remove ${f.name}`}
                onClick={() =>
                  set(
                    (c) => void (c.feedstocks = c.feedstocks.filter((x) => x.name !== f.name)),
                    `Feedstock removed: ${f.name}`,
                  )
                }
              >
                <Trash2 />
              </Button>
            </div>
          )
        })}
      </div>
    </Section>
  )
}

/* ------------------------------------------------------------------ */
/* Mixing / application / approved networks / references                */
/* ------------------------------------------------------------------ */

function Standards() {
  const { data, updateCompany } = useDashboard()
  const { user } = useSession()
  const c = data.company
  const set = (recipe: (c: Company) => void, change: string) =>
    updateCompany(recipe, { by: user.name, change })
  const netName = new Map(data.networks.map((n) => [n.id, n.name]))

  return (
    <Section
      title="Standards"
      description="Mixing, application and biomass reference values applied across the programme."
    >
      <div className="flex flex-col gap-6">
        <Row label="Mixing types">
          <ChipPicker
            items={c.mixingTypes}
            options={MIXING_TYPES}
            onChange={(v) => set((x) => void (x.mixingTypes = v), 'Mixing types updated')}
          />
        </Row>
        <Row label="Application types">
          <ChipPicker
            items={c.applicationTypes}
            options={APPLICATION_TYPES}
            onChange={(v) => set((x) => void (x.applicationTypes = v), 'Application types updated')}
          />
        </Row>
        <Row label="CSI approved networks">
          <ChipPicker
            items={c.approvedNetworkIds.map((id) => netName.get(id) ?? id)}
            options={data.networks.map((n) => n.name)}
            onChange={(names) =>
              set(
                (x) =>
                  void (x.approvedNetworkIds = names.map(
                    (nm) => data.networks.find((n) => n.name === nm)?.id ?? nm,
                  )),
                'CSI approved networks updated',
              )
            }
            empty="No networks yet"
          />
        </Row>
        <Row label="Biomass reference">
          <References
            rows={c.references}
            onChange={(references) =>
              set((x) => void (x.references = references), 'Biomass reference values updated')
            }
            feedstocks={c.feedstocks.map((f) => f.name)}
          />
        </Row>
      </div>
    </Section>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-2 text-xs font-semibold tracking-wide text-ink-muted uppercase">
        {label}
      </div>
      {children}
    </div>
  )
}

export function References({
  rows,
  onChange,
  feedstocks,
}: {
  rows: FeedstockReference[]
  onChange: (r: FeedstockReference[]) => void
  feedstocks: string[]
}) {
  const { data } = useDashboard()
  const missing = feedstocks.filter((f) => !rows.some((r) => r.feedstock === f))
  const edit = (i: number, k: 'bulkDensity' | 'moisture' | 'carbonContent', v: string) =>
    onChange(rows.map((r, j) => (j === i ? { ...r, [k]: Number(v) } : r)))
  return (
    <div>
      {rows.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-line">
          <div className="grid grid-cols-[minmax(0,1.4fr)_1fr_1fr_1fr_32px] gap-3 bg-muted px-3 py-2 text-xs font-semibold text-ink-muted">
            <span>Feedstock</span>
            <span>Bulk density (kg/m³)</span>
            <span>Moisture (%)</span>
            <span>Carbon (%)</span>
            <span />
          </div>
          {rows.map((r, i) => (
            <div
              key={r.feedstock}
              className="grid grid-cols-[minmax(0,1.4fr)_1fr_1fr_1fr_32px] items-center gap-3 border-t border-line px-3 py-2"
            >
              <span className="truncate text-sm font-medium">{r.feedstock}</span>
              {(['bulkDensity', 'moisture', 'carbonContent'] as const).map((k) => (
                <Input
                  key={k}
                  type="number"
                  min={0}
                  className="h-8"
                  value={r[k]}
                  onChange={(e) => edit(i, k, e.target.value)}
                  aria-label={`${r.feedstock} ${k}`}
                />
              ))}
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`Remove ${r.feedstock}`}
                onClick={() => onChange(rows.filter((_, j) => j !== i))}
              >
                <Trash2 />
              </Button>
            </div>
          ))}
        </div>
      )}
      <Popover>
        <PopoverTrigger asChild>
          <Button
            size="sm"
            variant="ghost"
            className={cn('rounded-lg', rows.length && 'mt-2')}
            disabled={!missing.length}
          >
            <Plus /> {rows.length ? 'Add feedstock values' : 'Add reference values'}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-64 p-1.5">
          {missing.map((f) => (
            <OptionRow
              key={f}
              selected={false}
              onClick={() =>
                onChange([
                  ...rows,
                  {
                    feedstock: f,
                    ...referenceDefaults(data.feedstocks, f),
                  },
                ])
              }
            >
              {f}
            </OptionRow>
          ))}
        </PopoverContent>
      </Popover>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Projects                                                             */
/* ------------------------------------------------------------------ */

const STATUS: Record<
  Project['status'],
  { label: string; tone: 'neutral' | 'warn' | 'info' | 'success' }
> = {
  draft: { label: 'Draft', tone: 'neutral' },
  validation: { label: 'In validation', tone: 'warn' },
  validated: { label: 'Validated', tone: 'info' },
  registered: { label: 'Registered', tone: 'success' },
}

function ProjectRegistry() {
  const { data, updateCompany } = useDashboard()
  const { user } = useSession()
  const [adding, setAdding] = useState(false)
  const projects = data.company.projects
  const netName = new Map(data.networks.map((n) => [n.id, n.name]))

  return (
    <Section
      title="Project registry"
      description="Carbon projects, the registry they are with, and their validation status."
      action={
        <Button size="sm" className="rounded-lg" onClick={() => setAdding(true)}>
          <Plus /> Add project
        </Button>
      }
    >
      {projects.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-6 text-center text-sm text-ink-muted">
          <FolderKanban className="size-6" /> No projects yet.
        </div>
      ) : (
        <div className="flex flex-col divide-y divide-line">
          {projects.map((p) => (
            <div key={p.id} className="flex flex-wrap items-center gap-3 py-3 first:pt-0 last:pb-0">
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold">{p.name}</div>
                <div className="text-xs text-ink-muted">
                  {p.registry} ·{' '}
                  {p.networkIds
                    .map((id) => netName.get(id))
                    .filter(Boolean)
                    .join(', ') || 'No networks'}{' '}
                  · since {day(p.createdAt)}
                </div>
              </div>
              <Menu>
                <MenuTrigger asChild>
                  <button type="button" className="cursor-pointer" aria-label="Change status">
                    <Badge tone={STATUS[p.status].tone}>
                      {STATUS[p.status].label} <ChevronDown />
                    </Badge>
                  </button>
                </MenuTrigger>
                <MenuContent>
                  {(Object.keys(STATUS) as Project['status'][]).map((s) => (
                    <MenuItem
                      key={s}
                      onSelect={() =>
                        updateCompany(
                          (c) => {
                            const x = c.projects.find((y) => y.id === p.id)
                            if (x) x.status = s
                          },
                          { by: user.name, change: `${p.name}: ${STATUS[s].label.toLowerCase()}` },
                        )
                      }
                    >
                      {s === 'registered' && <BadgeCheck />} {STATUS[s].label}
                    </MenuItem>
                  ))}
                </MenuContent>
              </Menu>
            </div>
          ))}
        </div>
      )}
      <ProjectDialog open={adding} onOpenChange={setAdding} />
    </Section>
  )
}

function ProjectDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
}) {
  const { data, updateCompany } = useDashboard()
  const { user } = useSession()
  const [form, setForm] = useState({ name: '', registry: REGISTRIES[0], networkId: '' })
  return (
    <Modal open={open} onOpenChange={onOpenChange} title="New project">
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault()
          updateCompany(
            (c) =>
              void c.projects.unshift({
                id: uid('pr-'),
                name: form.name.trim(),
                registry: form.registry,
                status: 'draft',
                networkIds: form.networkId ? [form.networkId] : [],
                createdAt: new Date().toISOString(),
              }),
            { by: user.name, change: `Project added: ${form.name.trim()}` },
          )
          toast.success('Project added')
          setForm({ name: '', registry: REGISTRIES[0], networkId: '' })
          onOpenChange(false)
        }}
      >
        <Field label="Project name">
          <Input
            required
            autoFocus
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
        </Field>
        <Field label="Registry">
          <NativeSelect
            value={form.registry}
            onChange={(e) => setForm({ ...form, registry: e.target.value })}
          >
            {REGISTRIES.map((r) => (
              <option key={r}>{r}</option>
            ))}
          </NativeSelect>
        </Field>
        <Field label="Network (optional)">
          <NativeSelect
            value={form.networkId}
            onChange={(e) => setForm({ ...form, networkId: e.target.value })}
          >
            <option value="">— None yet —</option>
            {data.networks.map((n) => (
              <option key={n.id} value={n.id}>
                {n.name}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <div className="flex justify-end gap-2 pt-1">
          <Button onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button type="submit" variant="primary">
            <Building2 /> Add project
          </Button>
        </div>
      </form>
    </Modal>
  )
}
