'use client'

import { CalendarRange, ChevronDown, MapPin, Network, Search, SlidersHorizontal, X } from 'lucide-react'
import { useMemo, useState, type ReactNode } from 'react'

import { OptionRow } from '../components/shell/PageHeader'
import { Button, Input, Popover, PopoverContent, PopoverTrigger, Segmented, Switch } from '../components/ui'
import { scopedNetworks, vintageYears } from '../data/selectors'
import { useDashboard } from '../data/store'
import type { NetworkType, PeriodKind } from '../data/types'
import { cn } from '../lib/utils'

/** Network type, networks, sites and credit rules — what the Overview is filtered by. */
export function FilterBar() {
  const { data, filters, setFilters } = useDashboard()
  const networks = scopedNetworks(data, filters)
  const siteSource = data.sites.filter((s) => (filters.networkIds.length ? filters.networkIds : networks.map((n) => n.id)).includes(s.networkId))
  const years = vintageYears(data)
  const creditRules = (filters.cutoff ? 1 : 0) + (filters.vintages.length ? 1 : 0)
  const filtered = filters.networkType || filters.networkIds.length || filters.siteIds.length || creditRules

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Segmented<'all' | NetworkType>
        value={filters.networkType ?? 'all'}
        onChange={(t) => setFilters({ networkType: t === 'all' ? null : t, networkIds: [], siteIds: [] })}
        options={[
          { value: 'all', label: 'All networks' },
          { value: 'artisan', label: 'Artisan Pro' },
          { value: 'csink', label: 'C-sink' },
        ]}
      />
      <MultiSelect
        icon={<Network className="size-4" />}
        placeholder="Any network"
        noun="networks"
        options={networks.map((n) => ({ value: n.id, label: n.name, active: n.active }))}
        value={filters.networkIds}
        onChange={(networkIds) => setFilters({ networkIds, siteIds: [] })}
      />
      <MultiSelect
        icon={<MapPin className="size-4" />}
        placeholder="Any site"
        noun="sites"
        options={siteSource.map((s) => ({ value: s.id, label: s.name, active: s.active }))}
        value={filters.siteIds}
        onChange={(siteIds) => setFilters({ siteIds })}
      />

      <Popover>
        <PopoverTrigger asChild>
          <Button className={cn('max-sm:h-8 max-sm:px-2.5 max-sm:text-xs', creditRules && 'border-brand text-brand')}>
            <SlidersHorizontal />
            Credit rules{creditRules ? ` · ${creditRules}` : ''}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80 max-w-[calc(100vw-24px)] p-4">
          <label className="flex cursor-pointer items-start gap-3">
            <div className="flex-1">
              <div className="text-sm font-semibold">Apply CERES cut-off date</div>
              <p className="mt-0.5 text-xs text-ink-muted">Only count credits produced after each network&apos;s CERES certificate date.</p>
            </div>
            <Switch checked={filters.cutoff} onCheckedChange={(cutoff) => setFilters({ cutoff })} />
          </label>
          <div className="my-4 h-px bg-line" />
          <div className="text-sm font-semibold">Vintage</div>
          <p className="mt-0.5 mb-2.5 text-xs text-ink-muted">Production years to count credits from. None selected = all years.</p>
          <div className="flex flex-wrap gap-1.5">
            {years.map((y) => {
              const on = filters.vintages.includes(y)
              return (
                <button
                  key={y}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setFilters((f) => ({ vintages: on ? f.vintages.filter((v) => v !== y) : [...f.vintages, y].sort() }))}
                  className={cn('h-8 cursor-pointer rounded-lg border px-3 text-sm font-semibold', on ? 'border-brand bg-brand-soft text-brand' : 'border-line hover:bg-muted')}
                >
                  {y}
                </button>
              )
            })}
          </div>
        </PopoverContent>
      </Popover>

      {filtered ? (
        <Button
          variant="ghost"
          size="sm"
          className="rounded-lg"
          onClick={() => setFilters({ networkType: null, networkIds: [], siteIds: [], cutoff: false, vintages: [] })}
        >
          <X /> Reset filters
        </Button>
      ) : null}
    </div>
  )
}

export function PeriodPicker() {
  const { filters, setFilters } = useDashboard()
  const [customOpen, setCustomOpen] = useState(false)
  const p = filters.period
  return (
    <Popover open={customOpen} onOpenChange={setCustomOpen}>
      <PopoverTrigger asChild>
        <div>
          <Segmented<PeriodKind>
            value={p.kind}
            onChange={(kind) => (kind === 'custom' ? setCustomOpen(true) : setFilters({ period: { kind } }))}
            options={[
              { value: 'all', label: 'All time' },
              { value: 'month', label: 'This month' },
              { value: 'year', label: 'This year' },
              {
                value: 'custom',
                label:
                  p.kind === 'custom' && (p.from || p.to) ? (
                    <span className="inline-flex items-center gap-1.5">
                      <CalendarRange className="size-3.5" />
                      {p.from ?? '…'} – {p.to ?? '…'}
                    </span>
                  ) : (
                    'Custom'
                  ),
              },
            ]}
          />
        </div>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 p-4">
        <CustomRange
          initial={p}
          onApply={(from, to) => {
            setFilters({ period: { kind: 'custom', from, to } })
            setCustomOpen(false)
          }}
        />
      </PopoverContent>
    </Popover>
  )
}

function CustomRange({ initial, onApply }: { initial: { from?: string; to?: string }; onApply: (from?: string, to?: string) => void }) {
  const [from, setFrom] = useState(initial.from ?? '')
  const [to, setTo] = useState(initial.to ?? '')
  return (
    <div className="flex flex-col gap-3">
      <div className="text-sm font-semibold">Custom period</div>
      <label className="flex flex-col gap-1 text-xs font-medium text-ink-muted">
        From
        <Input type="month" value={from} onChange={(e) => setFrom(e.target.value)} />
      </label>
      <label className="flex flex-col gap-1 text-xs font-medium text-ink-muted">
        To
        <Input type="month" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} />
      </label>
      <Button variant="primary" className="rounded-xl" onClick={() => onApply(from || undefined, to || undefined)} disabled={!from && !to}>
        Apply
      </Button>
    </div>
  )
}

/** Dropdown with search and checkboxes, showing "3 networks" once several are picked. */
export function MultiSelect({
  icon,
  placeholder,
  noun,
  options,
  value,
  onChange,
}: {
  icon: ReactNode
  placeholder: string
  noun: string
  options: { value: string; label: string; active?: boolean }[]
  value: string[]
  onChange: (v: string[]) => void
}) {
  const [query, setQuery] = useState('')
  const shown = useMemo(() => options.filter((o) => o.label.toLowerCase().includes(query.trim().toLowerCase())), [options, query])
  const label = value.length === 0 ? placeholder : value.length === 1 ? (options.find((o) => o.value === value[0])?.label ?? placeholder) : `${value.length} ${noun}`

  return (
    <Popover onOpenChange={(o) => !o && setQuery('')}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            'flex h-9 w-[calc(50%-4px)] min-w-0 cursor-pointer items-center gap-2 rounded-lg border border-line bg-surface px-2.5 text-sm font-medium hover:border-line-strong sm:w-48',
            value.length > 0 && 'border-brand text-brand',
          )}
        >
          <span className="text-ink-muted">{icon}</span>
          <span className={cn('flex-1 truncate text-left', !value.length && 'text-ink-muted')}>{label}</span>
          {value.length ? (
            <X
              className="size-4 text-ink-subtle hover:text-ink"
              onClick={(e) => {
                e.stopPropagation()
                onChange([])
              }}
            />
          ) : (
            <ChevronDown className="size-4 text-ink-subtle" />
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-1.5">
        {options.length > 6 && (
          <div className="relative mb-1">
            <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-subtle" />
            <Input autoFocus placeholder={`Search ${noun}`} value={query} onChange={(e) => setQuery(e.target.value)} className="h-9 pl-9" />
          </div>
        )}
        <div className="scroll-thin max-h-72 overflow-y-auto">
          {shown.length === 0 && <div className="px-3 py-4 text-center text-sm text-ink-muted">No {noun} found</div>}
          {shown.map((o) => (
            <OptionRow
              key={o.value}
              status={o.active}
              selected={value.includes(o.value)}
              onClick={() => onChange(value.includes(o.value) ? value.filter((v) => v !== o.value) : [...value, o.value])}
            >
              {o.label}
            </OptionRow>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  )
}
