'use client'

import {
  Bell,
  Building2,
  Leaf,
  LogOut,
  Menu as MenuIcon,
  PanelLeftClose,
  PanelLeftOpen,
  ShieldAlert,
  X,
} from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState, type ReactNode } from 'react'
import { Toaster } from 'sonner'

import { outdatedUsers } from '../../data/selectors'
import { DashboardProvider, useDashboard } from '../../data/store'
import type { DashboardData } from '../../data/types'
import { cn } from '../../lib/utils'
import {
  Avatar,
  Button,
  Menu,
  MenuContent,
  MenuItem,
  MenuTrigger,
  Tooltip,
  TooltipProvider,
} from '../ui'
import { SECTIONS } from './nav'
import { SessionProvider, useSession, type SessionUser } from './session'

async function logout() {
  try {
    await fetch('/admin/session', { method: 'DELETE', credentials: 'include' })
  } finally {
    window.location.replace(new URL('/admin/login', window.location.origin).href)
  }
}

const COLLAPSE_KEY = 'reclimate-admin-sidebar'

/** Sidebar + page area for every admin page. */
export function DashboardShell({ user, data, children }: { user: SessionUser; data: DashboardData; children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const pathname = usePathname()

  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- restore a per-browser preference
      setCollapsed(localStorage.getItem(COLLAPSE_KEY) === 'collapsed')
    } catch {
      /* ignore */
    }
  }, [])
  // Close the phone menu after navigating.
  // eslint-disable-next-line react-hooks/set-state-in-effect -- reacting to navigation
  useEffect(() => setMobileOpen(false), [pathname])

  const toggle = () =>
    setCollapsed((c) => {
      try {
        localStorage.setItem(COLLAPSE_KEY, c ? 'open' : 'collapsed')
      } catch {
        /* ignore */
      }
      return !c
    })

  return (
    <SessionProvider user={user}>
      <TooltipProvider>
        <DashboardProvider initial={data}>
          <div className="flex min-h-screen">
            <aside
              className={cn(
                'sticky top-0 hidden h-screen shrink-0 border-r border-line bg-surface transition-[width] duration-200 lg:block',
                collapsed ? 'w-[64px]' : 'w-60',
              )}
            >
              <Sidebar collapsed={collapsed} onToggle={toggle} />
            </aside>

            {mobileOpen && (
              <div className="fixed inset-0 z-50 lg:hidden">
                <button
                  type="button"
                  aria-label="Close menu"
                  className="absolute inset-0 bg-ink/40"
                  onClick={() => setMobileOpen(false)}
                />
                <aside className="absolute inset-y-0 left-0 w-72 animate-in bg-surface shadow-2xl">
                  <Sidebar collapsed={false} onClose={() => setMobileOpen(false)} />
                </aside>
              </div>
            )}

            <div className="flex min-w-0 flex-1 flex-col overflow-x-clip">
              <TopBar onMenu={() => setMobileOpen(true)} />
              <main className="flex min-w-0 flex-1 flex-col">{children}</main>
            </div>
          </div>
          <Toaster position="bottom-right" richColors closeButton />
        </DashboardProvider>
      </TooltipProvider>
    </SessionProvider>
  )
}

function Sidebar({
  collapsed,
  onToggle,
  onClose,
}: {
  collapsed: boolean
  onToggle?: () => void
  onClose?: () => void
}) {
  const pathname = usePathname()
  const active = (href: string) =>
    href === '/admin' ? pathname === href : pathname.startsWith(href)

  return (
    <div className="flex h-full flex-col px-3 py-4">
      <div
        className={cn('flex h-10 items-center gap-2.5 px-2', collapsed && 'justify-center px-0')}
      >
        <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-brand text-lime">
          <Leaf className="size-[18px]" />
        </div>
        {!collapsed && (
          <div className="min-w-0 flex-1 leading-tight">
            <div className="text-sm font-bold">Reclimate</div>
            <div className="text-xs text-ink-muted">dMRV Admin</div>
          </div>
        )}
        {onClose && (
          <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label="Close menu">
            <X />
          </Button>
        )}
      </div>

      <nav className="mt-6 flex flex-1 flex-col gap-5 overflow-y-auto">
        {SECTIONS.map((group) => (
          <div key={group.label}>
            {!collapsed && (
              <div className="mb-1.5 px-3 text-[11px] font-semibold tracking-wider text-ink-subtle uppercase">
                {group.label}
              </div>
            )}
            <div className="flex flex-col gap-0.5">
              {group.items.map((s) => {
                const Icon = s.icon
                const on = active(s.href)
                const link = (
                  <Link
                    href={s.href}
                    aria-current={on ? 'page' : undefined}
                    className={cn(
                      'flex h-9 items-center gap-2.5 rounded-lg px-2.5 text-sm font-medium text-ink-2 transition-colors hover:bg-muted',
                      collapsed && 'justify-center px-0',
                      on && 'bg-brand-soft font-semibold text-brand hover:bg-brand-soft',
                    )}
                  >
                    <Icon className="size-[18px] shrink-0" />
                    {!collapsed && <span className="flex-1 truncate">{s.label}</span>}
                  </Link>
                )
                return collapsed ? (
                  <Tooltip
                    key={s.href}
                    side="right"
                    content={s.label}
                  >
                    {link}
                  </Tooltip>
                ) : (
                  <div key={s.href}>{link}</div>
                )
              })}
            </div>
          </div>
        ))}
      </nav>

      {onToggle && (
        <button
          type="button"
          onClick={onToggle}
          className={cn(
            'flex h-9 cursor-pointer items-center gap-2.5 rounded-lg px-2.5 text-sm font-medium text-ink-muted hover:bg-muted hover:text-ink',
            collapsed && 'justify-center px-0',
          )}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? (
            <PanelLeftOpen className="size-[18px]" />
          ) : (
            <PanelLeftClose className="size-[18px]" />
          )}
          {!collapsed && 'Collapse'}
        </button>
      )}
    </div>
  )
}

function TopBar({ onMenu }: { onMenu: () => void }) {
  const { user } = useSession()
  const { data } = useDashboard()
  const openAlerts =
    data.alerts.filter((a) => a.status === 'open').length + (outdatedUsers(data).length ? 1 : 0)

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-line bg-surface/85 px-3 backdrop-blur md:px-6">
      <Button
        variant="ghost"
        size="icon"
        className="lg:hidden"
        onClick={onMenu}
        aria-label="Open menu"
      >
        <MenuIcon />
      </Button>
      <OrgSwitcher />
      <div className="ml-auto flex items-center gap-1.5">
        <Tooltip content={openAlerts ? `${openAlerts} things need attention` : 'No alerts'}>
          <Link
            href="/admin#attention"
            className="relative flex size-9 items-center justify-center rounded-lg text-ink-2 hover:bg-muted"
            aria-label="Alerts"
          >
            <Bell className="size-[18px]" />
            {openAlerts > 0 && (
              <span className="absolute top-1.5 right-1.5 flex size-4 items-center justify-center rounded-full bg-danger text-[10px] font-bold text-white">
                {openAlerts}
              </span>
            )}
          </Link>
        </Tooltip>
        <Menu>
          <MenuTrigger asChild>
            <button
              type="button"
              className="flex cursor-pointer items-center gap-2.5 rounded-xl py-1 pr-2 pl-1 hover:bg-muted"
            >
              <Avatar name={user.name} size={32} />
              <span className="hidden text-left leading-tight sm:block">
                <span className="block text-sm font-semibold">{user.name}</span>
                <span className="block text-xs text-ink-muted">Administrator</span>
              </span>
            </button>
          </MenuTrigger>
          <MenuContent className="w-60">
            {user.email && (
              <div className="truncate px-3 pt-1.5 pb-2 text-xs text-ink-muted">{user.email}</div>
            )}
            <MenuItem asChild>
              <Link href="/admin/account">
                <Building2 /> Account &amp; company
              </Link>
            </MenuItem>
            <MenuItem onSelect={() => void logout()} className="text-danger [&_svg]:text-danger">
              <LogOut /> Log out
            </MenuItem>
          </MenuContent>
        </Menu>
      </div>
    </header>
  )
}

/** Partner organisation filter, shared by every page. */
function OrgSwitcher() {
  const { data, filters, setFilters } = useDashboard()
  return (
    <label className="relative flex h-9 min-w-0 items-center rounded-lg border border-line bg-surface pr-2 pl-3 text-sm hover:border-line-strong">
      <span className="mr-2 hidden text-ink-muted sm:inline">Organisation</span>
      <select
        value={filters.orgId ?? ''}
        onChange={(e) => setFilters({ orgId: e.target.value || null, networkIds: [], siteIds: [] })}
        className="max-w-48 cursor-pointer appearance-none bg-transparent pr-5 font-semibold outline-none sm:max-w-64"
        aria-label="Partner organisation"
      >
        <option value="">All organisations</option>
        {data.orgs.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name} ({o.code}){o.active ? '' : ' · inactive'}
          </option>
        ))}
      </select>
      <svg
        className="pointer-events-none absolute right-2.5 size-4 text-ink-subtle"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
      >
        <path d="m6 9 6 6 6-6" />
      </svg>
    </label>
  )
}

/** Signed in, but not an admin (e.g. a worker's session from the app). */
export function AccessDenied() {
  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="flex max-w-sm flex-col items-center gap-3 rounded-card border border-line bg-surface p-8 text-center">
        <div className="flex size-12 items-center justify-center rounded-full bg-danger-soft text-danger">
          <ShieldAlert className="size-6" />
        </div>
        <div className="text-lg font-bold">Admins only</div>
        <p className="text-sm text-ink-muted">
          This browser is signed in with an account that is not an admin — often a worker or
          supervisor signed in on the app. Log out, then sign in as an admin.
        </p>
        <Button variant="primary" onClick={logout}>
          <LogOut /> Log out
        </Button>
      </div>
    </div>
  )
}
