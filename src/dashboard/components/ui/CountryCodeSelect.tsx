'use client'

import { ChevronDown } from 'lucide-react'

import { COUNTRIES, flag } from '../../lib/phone'
import { cn } from '../../lib/utils'

/**
 * Compact dialling-code picker: shows only the flag and code (🇮🇳 +91); the list opened from it shows
 * full country names. It is a native <select> underneath, so it stays keyboard and screen-reader friendly
 * and uses the phone's own picker on mobile.
 */
export function CountryCodeSelect({
  value,
  onChange,
  className,
  'aria-label': ariaLabel = 'Country code',
}: {
  value: string
  onChange: (iso: string) => void
  className?: string
  'aria-label'?: string
}) {
  const c = COUNTRIES.find((x) => x.iso === value) ?? COUNTRIES[0]
  return (
    <div
      className={cn(
        'relative flex h-9 w-[5.75rem] shrink-0 items-center gap-1.5 rounded-lg border border-line bg-surface pr-2 pl-2.5 text-sm focus-within:border-brand focus-within:ring-2 focus-within:ring-brand/15 hover:border-line-strong',
        className,
      )}
    >
      <span aria-hidden className="text-base leading-none">
        {flag(c.iso)}
      </span>
      <span aria-hidden className="flex-1 font-medium tabular-nums">
        {c.dial}
      </span>
      <ChevronDown aria-hidden className="size-3.5 text-ink-subtle" />
      <select
        aria-label={ariaLabel}
        value={c.iso}
        onChange={(e) => onChange(e.target.value)}
        className="absolute inset-0 cursor-pointer appearance-none opacity-0"
      >
        {COUNTRIES.map((x) => (
          <option key={x.iso} value={x.iso}>
            {flag(x.iso)} {x.name} {x.dial}
          </option>
        ))}
      </select>
    </div>
  )
}
