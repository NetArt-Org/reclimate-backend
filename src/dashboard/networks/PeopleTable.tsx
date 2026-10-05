'use client'

import { ChevronRight, Search, UserPlus, Users, X } from 'lucide-react'
import { useState } from 'react'

import { Avatar, Badge, Button, EmptyState, Input, NativeSelect, Tooltip, type BadgeTone } from '../components/ui'
import { LATEST_APP_VERSION, ROLE_LABEL } from '../data/catalog'
import { useDashboard } from '../data/store'
import type { Role } from '../data/types'
import { cn, versionLess } from '../lib/utils'
import { UserSheet } from './UserSheet'

export const ROLE_TONE: Record<Role, BadgeTone> = { manager: 'danger', supervisor: 'warn', operator: 'info', farmer: 'success' }

/**
 * Searchable list of people — everyone (directory) or one network's team.
 * Click a row to open the person's profile.
 */
export function PeopleTable({ networkId, onAdd, compact = false }: { networkId?: string; onAdd: () => void; compact?: boolean }) {
  const { data, filters } = useDashboard()
  const [query, setQuery] = useState('')
  const [role, setRole] = useState<Role | ''>('')
  const [status, setStatus] = useState<'' | 'active' | 'inactive'>('')
  const [openId, setOpenId] = useState<string | null>(null)

  const q = query.trim().toLowerCase()
  const people = data.users
    .filter(
      (u) =>
        (networkId ? u.networkIds.includes(networkId) : !filters.orgId || u.orgId === filters.orgId) &&
        (!role || u.role === role) &&
        (!status || (status === 'active') === u.active) &&
        (!q || [u.name, u.phone, u.email ?? ''].some((v) => v.toLowerCase().includes(q))),
    )
    .sort((a, b) => Number(b.active) - Number(a.active) || a.name.localeCompare(b.name))
  const netName = (id: string) => data.networks.find((n) => n.id === id)?.name ?? ''
  const filtered = !!(q || role || status)

  return (
    <div className="flex flex-col">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-48 flex-1">
          <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-subtle" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by name, phone or email" className="pl-9" />
        </div>
        <NativeSelect value={role} onChange={(e) => setRole(e.target.value as Role | '')} className="w-40" aria-label="Role">
          <option value="">All roles</option>
          {(Object.keys(ROLE_LABEL) as Role[]).map((r) => (
            <option key={r} value={r}>
              {ROLE_LABEL[r]}
            </option>
          ))}
        </NativeSelect>
        <NativeSelect value={status} onChange={(e) => setStatus(e.target.value as '' | 'active' | 'inactive')} className="w-36" aria-label="Status">
          <option value="">Any status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </NativeSelect>
        {filtered && (
          <Button variant="ghost" size="sm" className="rounded-lg" onClick={() => {
              setQuery('')
              setRole('')
              setStatus('')
            }}>
            <X /> Clear
          </Button>
        )}
        <Button variant="primary" className="rounded-xl" onClick={onAdd}>
          <UserPlus /> Add person
        </Button>
      </div>

      <div className="mt-4 overflow-hidden rounded-xl border border-line">
        {/* header (wide screens) */}
        <div
          className={cn(
            'hidden items-center gap-4 border-b border-line bg-muted px-4 py-2.5 text-xs font-semibold text-ink-muted md:grid',
            compact ? 'grid-cols-[minmax(0,1.6fr)_120px_150px_90px_20px]' : 'grid-cols-[minmax(0,1.6fr)_120px_150px_minmax(0,1.2fr)_90px_20px]',
          )}
        >
          <span>Person</span>
          <span>Role</span>
          <span>Phone</span>
          {!compact && <span>Networks</span>}
          <span>App</span>
          <span />
        </div>
        {people.map((u) => {
          const outdated = u.device && versionLess(u.device.version, LATEST_APP_VERSION)
          return (
            <button
              key={u.id}
              type="button"
              onClick={() => setOpenId(u.id)}
              className={cn(
                'grid w-full cursor-pointer grid-cols-[minmax(0,1fr)_20px] items-center gap-4 border-b border-line px-4 py-3 text-left text-sm transition-colors last:border-0 hover:bg-muted/70',
                compact ? 'md:grid-cols-[minmax(0,1.6fr)_120px_150px_90px_20px]' : 'md:grid-cols-[minmax(0,1.6fr)_120px_150px_minmax(0,1.2fr)_90px_20px]',
                !u.active && 'opacity-60',
              )}
            >
              <span className="flex min-w-0 items-center gap-3">
                <span className="relative">
                  <Avatar name={u.name} src={u.photo} size={36} />
                  <span className={cn('absolute -right-0.5 -bottom-0.5 size-3 rounded-full ring-2 ring-surface', u.active ? 'bg-success' : 'bg-line-strong')} />
                </span>
                <span className="min-w-0">
                  <span className="block truncate font-semibold">{u.name}</span>
                  <span className="block truncate text-xs text-ink-muted">
                    {u.email ?? <span className="md:hidden">{ROLE_LABEL[u.role]} · {u.phone}</span>}
                    {!u.email && <span className="hidden md:inline">No email</span>}
                  </span>
                </span>
              </span>
              <span className="hidden md:block">
                <Badge tone={ROLE_TONE[u.role]}>{ROLE_LABEL[u.role]}</Badge>
              </span>
              <span className="hidden truncate text-ink-2 tabular-nums md:block">{u.phone}</span>
              {!compact && <span className="hidden truncate text-ink-2 md:block">{u.networkIds.map(netName).join(', ') || '—'}</span>}
              <span className="hidden md:block">
                {u.device ? (
                  <Tooltip content={outdated ? `Older than ${LATEST_APP_VERSION}` : 'Up to date'}>
                    <span className={cn('text-xs font-semibold tabular-nums', outdated ? 'text-warn' : 'text-ink-muted')}>v{u.device.version}</span>
                  </Tooltip>
                ) : (
                  <span className="text-xs text-ink-subtle">—</span>
                )}
              </span>
              <ChevronRight className="size-4 text-ink-subtle" />
            </button>
          )
        })}
        {people.length === 0 && <EmptyState icon={<Users />} title={filtered ? 'No one matches' : 'No people yet'} sub={filtered ? 'Change the search or filters.' : 'Add the first person.'} />}
      </div>
      <div className="mt-2 text-xs text-ink-subtle">
        {people.length} {people.length === 1 ? 'person' : 'people'}
      </div>

      <UserSheet userId={openId} onClose={() => setOpenId(null)} />
    </div>
  )
}
