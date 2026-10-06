'use client'

import {
  BadgeCheck,
  Building2,
  ChevronRight,
  Hammer,
  Maximize2,
  Network as NetworkIcon,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Search,
  UserPlus,
  Workflow,
} from 'lucide-react'
import { useRef, useState } from 'react'

import { PageHeader } from '../components/shell/PageHeader'
import {
  Button,
  Card,
  EmptyState,
  Input,
  Menu,
  MenuContent,
  MenuItem,
  MenuTrigger,
  Segmented,
  Tooltip,
} from '../components/ui'
import { useDashboard } from '../data/store'
import type { Network, NetworkType } from '../data/types'
import { cn } from '../lib/utils'
import { NetworkDialog, OrgDialog, UserDialog } from './Dialogs'
import { NetworkDetail } from './NetworkDetail'
import { NetworksTable } from './NetworksTable'
import { PeopleTable } from './PeopleTable'

type View = 'networks' | 'people'
/** split = list + detail · table = all networks full width · focus = one network full width */
type Layout = 'split' | 'table' | 'focus'

export function NetworksPage() {
  const { data, filters, ready } = useDashboard()
  const [view, setView] = useState<View>('networks')
  const [layout, setLayout] = useState<Layout>('split')
  const [query, setQuery] = useState('')
  const [type, setType] = useState<'all' | NetworkType>('all')
  const [ceresOnly, setCeresOnly] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const detailRef = useRef<HTMLDivElement>(null)
  /** Pick a network; on stacked (phone/tablet) layouts, bring its detail into view. */
  const pick = (id: string) => {
    setSelectedId(id)
    if (window.matchMedia('(max-width: 1023px)').matches) {
      requestAnimationFrame(() =>
        detailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
      )
    }
  }
  const [adding, setAdding] = useState<null | 'org' | NetworkType | 'user'>(null)

  const q = query.trim().toLowerCase()
  const inOrg = data.networks.filter((n) => !filters.orgId || n.orgId === filters.orgId)
  const list = inOrg.filter(
    (n) =>
      (type === 'all' || n.type === type) &&
      (!ceresOnly || n.ceresApproved) &&
      (!q || `${n.name} ${n.location}`.toLowerCase().includes(q)),
  )
  // Always show a network on the right: the picked one, else the first in the list.
  const selected = list.find((n) => n.id === selectedId) ?? list[0] ?? null

  return (
    <>
      <PageHeader
        title="Networks & people"
        description="Artisan Pro and C-sink networks, their configuration, and who can access them."
        actions={
          <>
            <Segmented
              value={view}
              onChange={setView}
              options={[
                { value: 'networks', label: 'Networks' },
                { value: 'people', label: 'People directory' },
              ]}
            />
            <Menu>
              <MenuTrigger asChild>
                <Button variant="primary" className="rounded-xl">
                  <Plus /> Add
                </Button>
              </MenuTrigger>
              <MenuContent>
                <MenuItem onSelect={() => setAdding('artisan')}>
                  <Hammer /> Artisan Pro network
                </MenuItem>
                <MenuItem onSelect={() => setAdding('csink')}>
                  <Workflow /> C-sink network
                </MenuItem>
                <MenuItem onSelect={() => setAdding('user')}>
                  <UserPlus /> Person
                </MenuItem>
                <MenuItem onSelect={() => setAdding('org')}>
                  <Building2 /> Partner organisation
                </MenuItem>
              </MenuContent>
            </Menu>
          </>
        }
      />

      {ready && view === 'people' && (
        <div className="px-3 pb-6 sm:px-4 md:px-6">
          <Card className="p-3 sm:p-4">
            <PeopleTable onAdd={() => setAdding('user')} />
          </Card>
        </div>
      )}

      {ready && view === 'networks' && layout === 'table' && (
        <div className="px-3 pb-6 sm:px-4 md:px-6">
          <NetworksTable
            networks={list}
            query={query}
            onQuery={setQuery}
            type={type}
            onType={setType}
            ceresOnly={ceresOnly}
            onCeresOnly={setCeresOnly}
            onOpen={(id) => {
              setSelectedId(id)
              setLayout('split')
            }}
            onCollapse={() => setLayout('split')}
          />
        </div>
      )}

      {ready && view === 'networks' && layout === 'focus' && selected && (
        <div className="px-3 pb-6 sm:px-4 md:px-6">
          <NetworkDetail
            key={selected.id}
            network={selected}
            onAddUser={() => setAdding('user')}
            leading={
              <Tooltip content="Show network list">
                <Button
                  size="icon"
                  className="rounded-xl"
                  onClick={() => setLayout('split')}
                  aria-label="Show network list"
                >
                  <PanelLeftOpen />
                </Button>
              </Tooltip>
            }
          />
        </div>
      )}

      {ready &&
        view === 'networks' &&
        (layout === 'split' || (layout === 'focus' && !selected)) && (
          <div className="grid grid-cols-1 items-start gap-3 sm:gap-4 px-3 pb-6 sm:px-4 md:px-6 lg:grid-cols-[340px_minmax(0,1fr)]">
            {/* ---- list ---- */}
            <Card className="flex flex-col overflow-hidden lg:sticky lg:top-20 lg:max-h-[calc(100vh-6rem)]">
              <div className="flex flex-col gap-2.5 border-b border-line p-3">
                <div className="relative">
                  <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-subtle" />
                  <Input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search networks"
                    className="pr-11 pl-9"
                    aria-label="Search networks"
                  />
                  <Tooltip content="Open all networks as a full-width table">
                    <button
                      type="button"
                      onClick={() => setLayout('table')}
                      aria-label="Open all networks as a table"
                      className="absolute top-1/2 right-1.5 flex size-8 -translate-y-1/2 cursor-pointer items-center justify-center rounded-lg text-ink-muted hover:bg-muted hover:text-ink"
                    >
                      <Maximize2 className="size-4" />
                    </button>
                  </Tooltip>
                </div>
                <div className="flex items-center gap-2">
                  <Segmented
                    className="flex-1 [&>button]:flex-1"
                    value={type}
                    onChange={setType}
                    options={[
                      { value: 'all', label: `All ${inOrg.length}` },
                      { value: 'artisan', label: 'Artisan' },
                      { value: 'csink', label: 'C-sink' },
                    ]}
                  />
                  <Tooltip content="Only CERES-approved networks">
                    <button
                      type="button"
                      aria-pressed={ceresOnly}
                      aria-label="Only CERES-approved networks"
                      onClick={() => setCeresOnly((v) => !v)}
                      className={cn(
                        'flex size-10 shrink-0 cursor-pointer items-center justify-center rounded-xl border transition-colors',
                        ceresOnly
                          ? 'border-info bg-info-soft text-info'
                          : 'border-line text-ink-muted hover:bg-muted',
                      )}
                    >
                      <BadgeCheck className="size-4" />
                    </button>
                  </Tooltip>
                </div>
              </div>
              <div className="scroll-thin flex-1 overflow-y-auto p-1.5">
                {list.map((n) => (
                  <NetworkRow
                    key={n.id}
                    network={n}
                    selected={n.id === selected?.id}
                    onClick={() => pick(n.id)}
                  />
                ))}
                {list.length === 0 && (
                  <EmptyState
                    icon={<NetworkIcon />}
                    title="No networks match"
                    sub="Change the search or filters."
                  />
                )}
              </div>
            </Card>

            {/* ---- detail ---- */}
            <div ref={detailRef} className="min-w-0 scroll-mt-16">
              {selected ? (
                <NetworkDetail
                  key={selected.id}
                  network={selected}
                  onAddUser={() => setAdding('user')}
                  leading={
                    <Tooltip content="Hide the list — use the full width">
                      <Button
                        size="icon"
                        className="hidden rounded-xl lg:inline-flex"
                        onClick={() => setLayout('focus')}
                        aria-label="Hide network list"
                      >
                        <PanelLeftClose />
                      </Button>
                    </Tooltip>
                  }
                />
              ) : (
                <Card>
                  <EmptyState
                    icon={<NetworkIcon />}
                    title="No network selected"
                    sub="Add a network to get started."
                  />
                </Card>
              )}
            </div>
          </div>
        )}

      <OrgDialog open={adding === 'org'} onOpenChange={(o) => !o && setAdding(null)} />
      <NetworkDialog
        type={adding === 'artisan' || adding === 'csink' ? adding : 'artisan'}
        open={adding === 'artisan' || adding === 'csink'}
        onOpenChange={(o) => !o && setAdding(null)}
        onCreated={(id) => {
          setView('networks')
          setLayout('split')
          setType('all')
          setQuery('')
          setSelectedId(id)
        }}
      />
      <UserDialog
        open={adding === 'user'}
        onOpenChange={(o) => !o && setAdding(null)}
        defaultNetworkId={view === 'networks' ? selected?.id : undefined}
      />
    </>
  )
}

function NetworkRow({
  network: n,
  selected,
  onClick,
}: {
  network: Network
  selected: boolean
  onClick: () => void
}) {
  const { data } = useDashboard()
  const people = data.users.filter((u) => u.networkIds.includes(n.id)).length
  const Icon = n.type === 'artisan' ? Hammer : Workflow
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={selected ? 'true' : undefined}
      className={cn(
        'flex w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-muted',
        selected && 'bg-brand-soft hover:bg-brand-soft',
      )}
    >
      <span
        className={cn(
          'flex size-9 shrink-0 items-center justify-center rounded-lg',
          n.type === 'artisan' ? 'bg-clay-soft text-clay' : 'bg-info-soft text-csink',
        )}
      >
        <Icon className="size-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span className={cn('truncate text-sm font-semibold', !n.active && 'text-ink-muted')}>
            {n.name}
          </span>
          {n.ceresApproved && (
            <BadgeCheck
              className="size-3.5 shrink-0 fill-info text-white"
              aria-label="CERES approved"
            />
          )}
        </span>
        <span className="block truncate text-xs text-ink-muted">
          {n.location} · {people} {people === 1 ? 'person' : 'people'}
        </span>
      </span>
      {!n.active && (
        <span className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-ink-muted">
          Inactive
        </span>
      )}
      <ChevronRight className={cn('size-4 shrink-0 text-ink-subtle', selected && 'text-brand')} />
    </button>
  )
}
