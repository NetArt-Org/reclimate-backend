'use client'

import { cva, type VariantProps } from 'class-variance-authority'
import { Check, Loader2, X } from 'lucide-react'
import {
  Checkbox as CheckboxPrimitive,
  Dialog as DialogPrimitive,
  DropdownMenu as MenuPrimitive,
  Popover as PopoverPrimitive,
  Switch as SwitchPrimitive,
  Tooltip as TooltipPrimitive,
} from 'radix-ui'
import * as React from 'react'

import { cn, initials } from '../../lib/utils'

/* ------------------------------------------------------------------ */
/* Button                                                              */
/* ------------------------------------------------------------------ */

const buttonVariants = cva(
  'inline-flex cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-lg font-semibold transition-colors outline-none focus-visible:ring-2 focus-visible:ring-brand/40 disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        primary: 'bg-brand text-white hover:bg-brand-dark',
        dark: 'bg-ink text-white hover:bg-ink-2',
        outline: 'border border-line bg-surface text-ink hover:bg-muted',
        ghost: 'text-ink-2 hover:bg-muted',
        soft: 'bg-brand-soft text-brand hover:bg-brand-soft/70',
        danger: 'bg-danger text-white hover:bg-danger/90',
        'danger-soft': 'bg-danger-soft text-danger hover:bg-danger-soft/70',
      },
      size: {
        sm: 'h-8 px-2.5 text-xs',
        md: 'h-9 px-3.5 text-sm',
        lg: 'h-10 px-5 text-sm',
        icon: 'size-9',
        'icon-sm': 'size-8',
      },
    },
    defaultVariants: { variant: 'outline', size: 'md' },
  },
)

export function Button({
  className,
  variant,
  size,
  ...props
}: React.ComponentProps<'button'> & VariantProps<typeof buttonVariants>) {
  return <button type="button" className={cn(buttonVariants({ variant, size }), className)} {...props} />
}

/* ------------------------------------------------------------------ */
/* Badge, Card, Spinner, Avatar, EmptyState                            */
/* ------------------------------------------------------------------ */

const badgeTones = {
  neutral: 'bg-muted text-ink-2',
  brand: 'bg-brand-soft text-brand',
  success: 'bg-success-soft text-success',
  warn: 'bg-warn-soft text-warn',
  danger: 'bg-danger-soft text-danger',
  info: 'bg-info-soft text-info',
  artisan: 'bg-clay-soft text-clay',
  csink: 'bg-info-soft text-csink',
} as const
export type BadgeTone = keyof typeof badgeTones

export function Badge({
  tone = 'neutral',
  className,
  ...props
}: React.ComponentProps<'span'> & { tone?: BadgeTone }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-bold tracking-wide uppercase [&_svg]:size-3',
        badgeTones[tone],
        className,
      )}
      {...props}
    />
  )
}

export function Card({ className, ...props }: React.ComponentProps<'div'>) {
  return <div className={cn('min-w-0 rounded-card border border-line bg-surface', className)} {...props} />
}

export const Spinner = ({ className }: { className?: string }) => (
  <Loader2 className={cn('size-4 animate-spin text-brand', className)} aria-label="Loading" />
)

const avatarTones = ['bg-brand-soft text-brand', 'bg-clay-soft text-clay', 'bg-info-soft text-info', 'bg-warn-soft text-warn']

export function Avatar({ name, src, size = 40, className }: { name: string; src?: string; size?: number; className?: string }) {
  const tone = avatarTones[name.length % avatarTones.length]
  return (
    <span
      className={cn('inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full font-bold', tone, className)}
      style={{ width: size, height: size, fontSize: Math.round(size / 2.8) }}
    >
      {src ? (
        // Object URLs / data URLs from uploads cannot go through next/image.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" className="size-full object-cover" />
      ) : (
        initials(name)
      )}
    </span>
  )
}

export function EmptyState({ icon, title, sub }: { icon: React.ReactNode; title: string; sub?: string }) {
  return (
    <div className="flex flex-col items-center gap-2 px-6 py-10 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-muted text-ink-muted [&_svg]:size-5">{icon}</div>
      <div className="font-bold">{title}</div>
      {sub && <div className="max-w-xs text-sm text-ink-muted">{sub}</div>}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Form controls                                                       */
/* ------------------------------------------------------------------ */

export const Input = ({ className, ...props }: React.ComponentProps<'input'>) => (
  <input
    className={cn(
      'h-9 w-full min-w-0 rounded-lg border border-line bg-surface px-3 text-sm outline-none placeholder:text-ink-subtle focus:border-brand focus:ring-2 focus:ring-brand/15',
      className,
    )}
    {...props}
  />
)

export const Textarea = ({ className, ...props }: React.ComponentProps<'textarea'>) => (
  <textarea
    className={cn(
      'min-h-24 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none placeholder:text-ink-subtle focus:border-brand focus:ring-2 focus:ring-brand/15',
      className,
    )}
    {...props}
  />
)

export const NativeSelect = ({ className, ...props }: React.ComponentProps<'select'>) => (
  <select
    className={cn(
      'h-9 w-full min-w-0 cursor-pointer rounded-lg border border-line bg-surface px-3 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/15',
      className,
    )}
    {...props}
  />
)

export function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-bold tracking-wide text-ink-muted uppercase">{label}</span>
      {children}
      {hint && <span className="text-xs text-ink-subtle">{hint}</span>}
    </label>
  )
}

export function Switch({ className, ...props }: React.ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      className={cn(
        'relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full bg-line-strong transition-colors data-[state=checked]:bg-brand',
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb className="block size-5 translate-x-0.5 rounded-full bg-white shadow transition-transform data-[state=checked]:translate-x-[22px]" />
    </SwitchPrimitive.Root>
  )
}

export function Checkbox({ className, ...props }: React.ComponentProps<typeof CheckboxPrimitive.Root>) {
  return (
    <CheckboxPrimitive.Root
      className={cn(
        'flex size-5 shrink-0 cursor-pointer items-center justify-center rounded-md border border-line-strong bg-surface data-[state=checked]:border-brand data-[state=checked]:bg-brand',
        className,
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator>
        <Check className="size-3.5 text-white" strokeWidth={3} />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  )
}

/** Pill tabs: All / Month / Year / Custom, Alerts / Logs… */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  className,
  size = 'md',
}: {
  value: T
  onChange: (v: T) => void
  options: { value: T; label: React.ReactNode }[]
  className?: string
  /** `lg`: page-level tabs — larger from tablet width up, compact on phones. */
  size?: 'md' | 'lg'
}) {
  return (
    <div
      role="tablist"
      className={cn('inline-flex max-w-full overflow-x-auto rounded-lg border border-line bg-muted p-0.5', size === 'lg' && 'md:rounded-xl md:p-1', className)}
    >
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="tab"
          aria-selected={o.value === value}
          onClick={() => onChange(o.value)}
          className={cn(
            'cursor-pointer whitespace-nowrap rounded-md px-2.5 py-1 text-[13px] font-semibold text-ink-muted transition-colors hover:text-ink',
            size === 'lg' && 'md:rounded-lg md:px-4 md:py-2 md:text-sm',
            o.value === value && 'bg-surface text-brand shadow-sm',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Overlays                                                            */
/* ------------------------------------------------------------------ */

export const TooltipProvider = TooltipPrimitive.Provider

export function Tooltip({ content, children, side = 'top' }: { content: React.ReactNode; children: React.ReactNode; side?: 'top' | 'right' | 'bottom' | 'left' }) {
  return (
    <TooltipPrimitive.Root delayDuration={200}>
      <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content
          side={side}
          sideOffset={6}
          className="z-50 max-w-xs animate-in rounded-lg bg-ink px-2.5 py-1.5 text-xs font-medium text-white shadow-lg"
        >
          {content}
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  )
}

export const Popover = PopoverPrimitive.Root
export const PopoverTrigger = PopoverPrimitive.Trigger
/** Positions a popover next to an element without making that element open it. */
export const PopoverAnchor = PopoverPrimitive.Anchor
export function PopoverContent({ className, align = 'start', ...props }: React.ComponentProps<typeof PopoverPrimitive.Content>) {
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Content
        align={align}
        sideOffset={6}
        className={cn('z-50 max-w-[calc(100vw-16px)] animate-in rounded-xl border border-line bg-surface p-1.5 shadow-xl outline-none', className)}
        {...props}
      />
    </PopoverPrimitive.Portal>
  )
}

export const Menu = MenuPrimitive.Root
export const MenuTrigger = MenuPrimitive.Trigger
export function MenuContent({ className, align = 'end', ...props }: React.ComponentProps<typeof MenuPrimitive.Content>) {
  return (
    <MenuPrimitive.Portal>
      <MenuPrimitive.Content
        align={align}
        sideOffset={6}
        className={cn('z-50 min-w-44 animate-in rounded-xl border border-line bg-surface p-1 shadow-xl', className)}
        {...props}
      />
    </MenuPrimitive.Portal>
  )
}
export function MenuItem({ className, ...props }: React.ComponentProps<typeof MenuPrimitive.Item>) {
  return (
    <MenuPrimitive.Item
      className={cn(
        'flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium outline-none data-[highlighted]:bg-muted [&_svg]:size-4 [&_svg]:text-ink-muted',
        className,
      )}
      {...props}
    />
  )
}

/** Centered dialog. */
export function Modal({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  className,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  title: string
  description?: string
  children: React.ReactNode
  footer?: React.ReactNode
  className?: string
}) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-40 bg-ink/40 backdrop-blur-[2px]" />
        <DialogPrimitive.Content
          className={cn(
            'fixed top-1/2 left-1/2 z-50 flex max-h-[90dvh] w-[calc(100vw-24px)] max-w-lg -translate-x-1/2 -translate-y-1/2 animate-in flex-col rounded-2xl bg-surface shadow-2xl outline-none',
            className,
          )}
        >
          <div className="flex items-start justify-between gap-4 border-b border-line px-4 py-3">
            <div>
              <DialogPrimitive.Title className="text-base font-bold">{title}</DialogPrimitive.Title>
              {description ? (
                <DialogPrimitive.Description className="mt-0.5 text-sm text-ink-muted">{description}</DialogPrimitive.Description>
              ) : (
                <DialogPrimitive.Description className="sr-only">{title}</DialogPrimitive.Description>
              )}
            </div>
            <DialogPrimitive.Close asChild>
              <Button variant="ghost" size="icon-sm" aria-label="Close">
                <X />
              </Button>
            </DialogPrimitive.Close>
          </div>
          <div className="scroll-thin flex-1 overflow-y-auto px-4 py-3">{children}</div>
          {footer && <div className="flex flex-wrap justify-end gap-2 border-t border-line px-4 py-3">{footer}</div>}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}

/** Right-hand side panel. */
export function Sheet({
  open,
  onOpenChange,
  title,
  onBack,
  children,
  footer,
  className,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  title: React.ReactNode
  /** Shows a back arrow (for drill-in panels). */
  onBack?: () => void
  children: React.ReactNode
  footer?: React.ReactNode
  className?: string
}) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-40 bg-ink/30" />
        <DialogPrimitive.Content
          className={cn(
            'fixed inset-y-0 right-0 z-50 flex w-full max-w-lg animate-slide-in flex-col bg-surface shadow-2xl outline-none sm:rounded-l-2xl',
            className,
          )}
        >
          <div className="flex items-center gap-3 border-b border-line px-4 py-3">
            {onBack && (
              <Button variant="ghost" size="icon-sm" onClick={onBack} aria-label="Back">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <path d="m12 19-7-7 7-7M19 12H5" />
                </svg>
              </Button>
            )}
            <DialogPrimitive.Title className="min-w-0 flex-1 truncate text-base font-bold">{title}</DialogPrimitive.Title>
            <DialogPrimitive.Description className="sr-only">Details</DialogPrimitive.Description>
            <DialogPrimitive.Close asChild>
              <Button variant="ghost" size="icon-sm" aria-label="Close">
                <X />
              </Button>
            </DialogPrimitive.Close>
          </div>
          <div className="scroll-thin flex-1 overflow-y-auto px-4 py-3">{children}</div>
          {footer && <div className="border-t border-line px-4 py-3">{footer}</div>}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}

/** "Are you sure?" before destructive actions. */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  message,
  confirmLabel = 'Delete',
  onConfirm,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  title: string
  message: string
  confirmLabel?: string
  onConfirm: () => void
}) {
  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      footer={
        <>
          <Button onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            variant="danger"
            onClick={() => {
              onConfirm()
              onOpenChange(false)
            }}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      <p className="text-sm text-ink-2">{message}</p>
    </Modal>
  )
}
