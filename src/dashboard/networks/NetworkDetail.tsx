'use client'

import { BadgeCheck, Factory, FileText, Flame, Globe, Hammer, MapPin, MoreHorizontal, Pencil, Workflow } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { toast } from 'sonner'

import { Badge, Button, Card, Menu, MenuContent, MenuItem, MenuTrigger, Tooltip } from '../components/ui'
import { NETWORK_TYPE_LABEL } from '../data/catalog'
import { useDashboard } from '../data/store'
import type { Network } from '../data/types'
import { cn, day, num } from '../lib/utils'
import { KmlPanel } from './Dialogs'
import { EditConfigSheet } from './EditConfigSheet'
import { PeopleTable } from './PeopleTable'
import { SiteAssets, useNetworkExtras } from './SiteAssets'

type Tab = 'people' | 'config' | 'sites' | 'boundaries'

/** Everything about one network: team, configuration, sites & kilns, boundaries. */
export function NetworkDetail({ network: n, onAddUser, leading }: { network: Network; onAddUser: () => void; leading?: ReactNode }) {
  const { data, updateNetwork } = useDashboard()
  const [tab, setTab] = useState<Tab>('people')
  const [editing, setEditing] = useState(false)
  const extras = useNetworkExtras(n.id)
  const info = extras.data?.network
  const samplingDue = extras.data?.sampling.filter((c) => c.due).length ?? 0

  const org = data.orgs.find((o) => o.id === n.orgId)
  const sites = data.sites.filter((s) => s.networkId === n.id)
  const kilns = data.kilns.filter((k) => sites.some((s) => s.id === k.siteId))
  const people = data.users.filter((u) => u.networkIds.includes(n.id))
  const biochar = data.production.filter((p) => p.networkId === n.id).reduce((a, p) => a + p.biocharT, 0)
  const TypeIcon = n.type === 'artisan' ? Hammer : Workflow

  const tabs: { key: Tab; label: string; count?: number }[] = [
    { key: 'people', label: 'People', count: people.length },
    { key: 'config', label: 'Configuration' },
    { key: 'sites', label: n.type === 'artisan' ? 'Sites & kilns' : 'Sites', count: sites.length },
    { key: 'boundaries', label: 'Boundaries' },
  ]

  return (
    <Card className="flex min-w-0 flex-col">
      {/* ---- header ---- */}
      <div className="flex flex-wrap items-start gap-3 border-b border-line p-3 sm:gap-4 sm:p-4">
        {leading}
        <div className={cn('flex size-10 shrink-0 items-center justify-center rounded-lg sm:size-12 sm:rounded-xl', n.type === 'artisan' ? 'bg-clay-soft text-clay' : 'bg-info-soft text-csink')}>
          <TypeIcon className="size-5" />
        </div>
        <div className="min-w-[min(100%,14rem)] flex-1">
          <div className="flex flex-wrap items-center gap-x-2">
            <h2 className="text-lg font-bold tracking-tight sm:text-xl">{n.name}</h2>
            {n.code && <span className="text-sm font-medium text-ink-muted tabular-nums">{n.code}</span>}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink-muted">
            <span className="flex min-w-0 items-center gap-1.5">
              <MapPin className="size-3.5 shrink-0" /> {info?.address || n.location || 'No address'}
            </span>
            {extras.loading && !info ? (
              <span className="h-4 w-20 animate-pulse rounded bg-muted" aria-hidden />
            ) : (
              info?.country && (
                <span className="flex items-center gap-1.5">
                  <Globe className="size-3.5" /> {info.country}
                </span>
              )
            )}
            {org && <span>{org.name} ({org.code})</span>}
          </div>
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            <Badge tone={n.type}>{NETWORK_TYPE_LABEL[n.type]}</Badge>
            <Badge tone={n.active ? 'success' : 'neutral'}>{n.active ? 'Active' : 'Inactive'}</Badge>
            {n.ceresApproved ? (
              <Tooltip content={`CERES approved${n.certifiedAt ? ` since ${day(n.certifiedAt)}` : ''}`}>
                <span tabIndex={0} className="rounded-md outline-none focus-visible:ring-2 focus-visible:ring-brand/40">
                  <Badge tone="info">
                    <BadgeCheck /> CERES approved
                  </Badge>
                </span>
              </Tooltip>
            ) : (
              <Badge tone="warn">Not CERES approved</Badge>
            )}
            {info?.methaneStrategy && (
              <Tooltip content="Methane compensation strategy">
                <span tabIndex={0} className="rounded-md outline-none focus-visible:ring-2 focus-visible:ring-brand/40">
                  <Badge tone="neutral" className="normal-case">
                    <Flame /> <span className="sr-only">Methane compensation strategy: </span>
                    {info.methaneStrategy}
                  </Badge>
                </span>
              </Tooltip>
            )}
          </div>
        </div>
        {/* Actions drop to their own row on phones so the name keeps the full width. */}
        <div className="flex w-full items-center gap-2 sm:w-auto">
          <Button variant="primary" className="max-sm:flex-1" onClick={() => setEditing(true)}>
            <Pencil /> Edit configuration
          </Button>
          <Menu>
            <MenuTrigger asChild>
              <Button size="icon" className="rounded-xl" aria-label="More actions">
                <MoreHorizontal />
              </Button>
            </MenuTrigger>
            <MenuContent>
              <MenuItem
                onSelect={() => {
                  updateNetwork(n.id, { ceresApproved: !n.ceresApproved, certifiedAt: n.ceresApproved ? undefined : new Date().toISOString().slice(0, 10) })
                  toast.success(n.ceresApproved ? 'CERES approval removed' : 'Marked as CERES approved from today')
                }}
              >
                <BadgeCheck /> {n.ceresApproved ? 'Remove CERES approval' : 'Mark CERES approved'}
              </MenuItem>
              <MenuItem
                onSelect={() => {
                  updateNetwork(n.id, { active: !n.active })
                  toast.success(n.active ? 'Network deactivated' : 'Network activated')
                }}
              >
                <Factory /> {n.active ? 'Deactivate network' : 'Activate network'}
              </MenuItem>
            </MenuContent>
          </Menu>
        </div>
      </div>

      {/* ---- key numbers ---- */}
      <div className="grid grid-cols-2 border-b border-line sm:grid-cols-4 sm:divide-x sm:divide-line">
        <Figure label="Sites" value={String(sites.length)} />
        <Figure label={n.type === 'artisan' ? 'Active kilns' : 'Farmers'} value={String(n.type === 'artisan' ? kilns.filter((k) => k.active).length : people.filter((u) => u.role === 'farmer').length)} />
        <Figure label="People" value={String(people.length)} />
        <Figure label="Biochar, all time" value={`${num(biochar, 1)} t`} />
      </div>

      {/* ---- tabs ---- */}
      <div role="tablist" className="scroll-thin flex gap-1 overflow-x-auto border-b border-line px-3">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              'relative flex h-12 shrink-0 cursor-pointer items-center gap-2 px-3 text-sm font-medium text-ink-muted transition-colors hover:text-ink',
              tab === t.key && 'font-semibold text-ink after:absolute after:inset-x-3 after:bottom-0 after:h-0.5 after:rounded-full after:bg-brand',
            )}
          >
            {t.label}
            {t.count !== undefined && <span className="rounded-md bg-muted px-1.5 text-xs text-ink-muted tabular-nums">{t.count}</span>}
            {t.key === 'sites' && samplingDue > 0 && (
              <span className="rounded-md bg-warn-soft px-1.5 text-xs font-semibold text-warn tabular-nums" title="Sampling containers past 6 months">
                {samplingDue} due
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="p-3 sm:p-4">
        {tab === 'people' && <PeopleTable networkId={n.id} onAdd={onAddUser} compact />}
        {tab === 'config' && <ConfigSummary network={n} onEdit={() => setEditing(true)} />}
        {tab === 'sites' && <SiteAssets network={n} extras={extras} />}
        {tab === 'boundaries' && <KmlPanel network={n} />}
      </div>

      <EditConfigSheet network={n} open={editing} onOpenChange={setEditing} />
    </Card>
  )
}

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-5 py-3.5">
      <div className="text-xs text-ink-muted">{label}</div>
      <div className="mt-0.5 text-lg font-bold tabular-nums">{value}</div>
    </div>
  )
}

function ConfigSummary({ network: n, onEdit }: { network: Network; onEdit: () => void }) {
  const c = n.config
  const steps = [
    c.drying && { name: 'Drying', method: c.drying.method, text: c.drying.description, docs: c.drying.documents.length },
    c.shredding && { name: 'Shredding', method: c.shredding.method, text: c.shredding.description, docs: c.shredding.documents.length },
  ].filter(Boolean) as { name: string; method: string; text: string; docs: number }[]

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <Group title="Feedstocks" items={c.feedstocks} />
        <Group title="Mixing types" items={c.mixingTypes} />
        <Group title="Application" items={c.applicationTypes} />
      </div>

      <div>
        <h3 className="mb-2 text-sm font-semibold">Pre-processing</h3>
        {steps.length ? (
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
            {steps.map((s) => (
              <div key={s.name} className="rounded-xl border border-line p-3.5">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  {s.name} <Badge tone="neutral">{s.method}</Badge>
                  {s.docs > 0 && (
                    <span className="ml-auto flex items-center gap-1 text-xs font-medium text-ink-muted">
                      <FileText className="size-3.5" /> {s.docs}
                    </span>
                  )}
                </div>
                {s.text && <p className="mt-1.5 text-sm text-ink-muted">{s.text}</p>}
              </div>
            ))}
          </div>
        ) : (
          <EmptyLine onEdit={onEdit}>No drying or shredding steps recorded.</EmptyLine>
        )}
      </div>

      <div>
        <h3 className="mb-2 text-sm font-semibold">Biomass reference values</h3>
        {c.references.filter((r) => c.feedstocks.includes(r.feedstock)).length ? (
          <div className="overflow-hidden rounded-xl border border-line">
            <div className="grid grid-cols-4 gap-3 bg-muted px-4 py-2 text-xs font-semibold text-ink-muted">
              <span>Feedstock</span>
              <span className="text-right">Bulk density</span>
              <span className="text-right">Moisture</span>
              <span className="text-right">Carbon</span>
            </div>
            {c.references
              .filter((r) => c.feedstocks.includes(r.feedstock))
              .map((r) => (
                <div key={r.feedstock} className="grid grid-cols-4 gap-3 border-t border-line px-4 py-2.5 text-sm tabular-nums">
                  <span className="font-medium">{r.feedstock}</span>
                  <span className="text-right">{r.bulkDensity} kg/m³</span>
                  <span className="text-right">{r.moisture != null ? `${r.moisture}%` : '—'}</span>
                  <span className="text-right">{r.carbonContent}%</span>
                </div>
              ))}
          </div>
        ) : (
          <EmptyLine onEdit={onEdit}>No reference values yet.</EmptyLine>
        )}
      </div>
    </div>
  )
}

function Group({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <h3 className="mb-2 text-sm font-semibold">{title}</h3>
      {items.length ? (
        <ul className="flex flex-col gap-1.5">
          {items.map((i) => (
            <li key={i} className="flex items-center gap-2 text-sm text-ink-2">
              <span className="size-1.5 rounded-full bg-brand" />
              {i}
            </li>
          ))}
        </ul>
      ) : (
        <span className="text-sm text-ink-subtle">Not set</span>
      )}
    </div>
  )
}

function EmptyLine({ children, onEdit }: { children: ReactNode; onEdit: () => void }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-dashed border-line-strong px-4 py-3 text-sm text-ink-muted">
      {children}
      <button type="button" onClick={onEdit} className="ml-auto cursor-pointer font-semibold text-brand hover:underline">
        Add
      </button>
    </div>
  )
}
