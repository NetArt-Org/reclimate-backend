'use client'

import { Check } from 'lucide-react'
import type { ReactNode } from 'react'

import { cn } from '../../lib/utils'
import { Tooltip } from '../ui'

/** Page title row: title, one-line description and page actions. */
export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end gap-x-4 gap-y-2 px-4 pt-4 pb-3 md:px-6 md:pt-5">
      <div className="min-w-0">
        <h1 className="text-xl font-bold tracking-tight">{title}</h1>
        {description && <p className="mt-0.5 text-[13px] text-ink-muted">{description}</p>}
      </div>
      {actions && <div className="ml-auto flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}

/** One row of a dropdown list, with an optional active/inactive dot. */
export function OptionRow({
  selected,
  status,
  onClick,
  children,
}: {
  selected: boolean
  status?: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm hover:bg-muted',
        selected && 'font-semibold text-brand',
      )}
    >
      <span className={cn('flex size-4 shrink-0 items-center justify-center rounded border', selected ? 'border-brand bg-brand text-white' : 'border-line-strong')}>
        {selected && <Check className="size-3" strokeWidth={3} />}
      </span>
      <span className="flex-1 truncate">{children}</span>
      {status !== undefined && (
        <Tooltip content={status ? 'Active' : 'Inactive'}>
          <span className={cn('size-2 shrink-0 rounded-full', status ? 'bg-success' : 'bg-line-strong')} />
        </Tooltip>
      )}
    </button>
  )
}
