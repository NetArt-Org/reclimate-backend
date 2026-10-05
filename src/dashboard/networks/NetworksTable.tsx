'use client'

import { ArrowDown, ArrowUp, BadgeCheck, ChevronRight, Hammer, Minimize2, Network as NetworkIcon, Search, Workflow } from 'lucide-react'
import { useState } from 'react'

import { Badge, Button, Card, EmptyState, Input, Segmented, Tooltip } from '../components/ui'
import { NETWORK_TYPE_LABEL } from '../data/catalog'
import { useDashboard } from '../data/store'
import type { Network, NetworkType } from '../data/types'
import { cn, num } from '../lib/utils'

type SortKey = 'name' | 'type' | 'org' | 'sites' | 'kilns' | 'people' | 'biochar' | 'status'

/** Every network as one full-width, sortable table. Click a row to open it. */
export function NetworksTable({
  networks,
  query,
  onQuery,
  type,
  onType,
  ceresOnly,
  onCeresOnly,
  onOpen,
  onCollapse,
}: {
  networks: Network[]
  query: string
  onQuery: (q: string) => void
  type: 'all' | NetworkType
  onType: (t: 'all' | NetworkType) => void
  ceresOnly: boolean
  onCeresOnly: (v: boolean) => void
  onOpen: (id: string) => void
  onCollapse: () => void
}) {
  const { data } = useDashboard()
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: 'name', dir: 1 })

  const rows = networks.map((n) => {
    const sites = data.sites.filter((s) => s.networkId === n.id)
    const siteIds = new Set(sites.map((s) => s.id))
    return {
      n,
      org: data.orgs.find((o) => o.id === n.orgId),
      sites: sites.length,
      kilns: data.kilns.filter((k) => k.active && siteIds.has(k.siteId)).length,
      people: data.users.filter((u) => u.networkIds.includes(n.id)).length,
      biochar: data.production.filter((p) => p.networkId === n.id).reduce((a, p) => a + p.biocharT, 0),
    }
  })
  const value = (r: (typeof rows)[number]): string | number =>
    ({ name: r.n.name, type: r.n.type, org: r.org?.code ?? '', sites: r.sites, kilns: r.kilns, people: r.people, biochar: r.biochar, status: Number(r.n.active) })[sort.key]
  rows.sort((a, b) => {
    const x = value(a)
    const y = value(b)
    return (typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y))) * sort.dir
  })

  const head = (key: SortKey, label: string, right = false) => (
    <button
      type="button"
      onClick={() => setSort((s) => ({ key, dir: s.key === key ? (s.dir === 1 ? -1 : 1) : key === 'name' || key === 'type' || key === 'org' ? 1 : -1 }))}
      className={cn('flex cursor-pointer items-center gap-1 hover:text-ink', right && 'justify-end', sort.key === key && 'text-ink')}
      aria-label={`Sort by ${label}`}
    >
      {label}
      {sort.key === key && (sort.dir === 1 ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />)}
    </button>
  )
  const cols = 'grid-cols-[minmax(0,2fr)_120px_minmax(0,1.3fr)_70px_70px_70px_100px_90px_20px]'

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-center gap-2 border-b border-line p-3">
        <div className="relative min-w-56 flex-1">
          <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-subtle" />
          <Input value={query} onChange={(e) => onQuery(e.target.value)} placeholder="Search networks" className="pl-9" aria-label="Search networks" />
        </div>
        <Segmented
          value={type}
          onChange={onType}
          options={[
            { value: 'all', label: 'All' },
            { value: 'artisan', label: 'Artisan Pro' },
            { value: 'csink', label: 'C-sink' },
          ]}
        />
        <Button className={cn('rounded-xl', ceresOnly && 'border-info bg-info-soft text-info')} onClick={() => onCeresOnly(!ceresOnly)} aria-pressed={ceresOnly}>
          <BadgeCheck /> CERES approved
        </Button>
        <Tooltip content="Back to list and details">
          <Button size="icon" className="rounded-xl" onClick={onCollapse} aria-label="Back to list and details">
            <Minimize2 />
          </Button>
        </Tooltip>
      </div>

      <div className="overflow-x-auto">
        <div className="min-w-[960px]">
          <div className={cn('grid items-center gap-4 border-b border-line bg-muted px-4 py-2.5 text-xs font-semibold text-ink-muted', cols)}>
            {head('name', 'Network')}
            {head('type', 'Type')}
            {head('org', 'Organisation')}
            {head('sites', 'Sites', true)}
            {head('kilns', 'Kilns', true)}
            {head('people', 'People', true)}
            {head('biochar', 'Biochar', true)}
            {head('status', 'Status')}
            <span />
          </div>
          {rows.map(({ n, org, sites, kilns, people, biochar }) => {
            const Icon = n.type === 'artisan' ? Hammer : Workflow
            return (
              <button
                key={n.id}
                type="button"
                onClick={() => onOpen(n.id)}
                className={cn('grid w-full cursor-pointer items-center gap-4 border-b border-line px-4 py-3 text-left text-sm transition-colors last:border-0 hover:bg-muted/70', cols)}
              >
                <span className="flex min-w-0 items-center gap-3">
                  <span className={cn('flex size-8 shrink-0 items-center justify-center rounded-lg', n.type === 'artisan' ? 'bg-clay-soft text-clay' : 'bg-info-soft text-csink')}>
                    <Icon className="size-4" />
                  </span>
                  <span className="min-w-0">
                    <span className="flex items-center gap-1.5">
                      <span className="truncate font-semibold">{n.name}</span>
                      {n.ceresApproved && <BadgeCheck className="size-3.5 shrink-0 fill-info text-white" aria-label="CERES approved" />}
                    </span>
                    <span className="block truncate text-xs text-ink-muted">{n.location}</span>
                  </span>
                </span>
                <span>
                  <Badge tone={n.type}>{n.type === 'artisan' ? 'Artisan' : 'C-sink'}</Badge>
                </span>
                <span className="truncate text-ink-2" title={org?.name}>
                  {org ? `${org.name} (${org.code})` : '—'}
                </span>
                <span className="text-right tabular-nums">{sites}</span>
                <span className="text-right tabular-nums">{n.type === 'artisan' ? kilns : '—'}</span>
                <span className="text-right tabular-nums">{people}</span>
                <span className="text-right tabular-nums">{num(biochar, 1)} t</span>
                <span>
                  <Badge tone={n.active ? 'success' : 'neutral'}>{n.active ? 'Active' : 'Inactive'}</Badge>
                </span>
                <ChevronRight className="size-4 text-ink-subtle" />
              </button>
            )
          })}
        </div>
      </div>
      {rows.length === 0 && <EmptyState icon={<NetworkIcon />} title="No networks match" sub="Change the search or filters." />}
      <div className="border-t border-line px-4 py-2.5 text-xs text-ink-subtle">
        {rows.length} {rows.length === 1 ? 'network' : 'networks'} · {NETWORK_TYPE_LABEL.artisan} and {NETWORK_TYPE_LABEL.csink}
      </div>
    </Card>
  )
}
