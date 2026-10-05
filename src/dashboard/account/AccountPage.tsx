'use client'

import { KeyRound, Mail, Pencil, Phone } from 'lucide-react'
import { useState } from 'react'

import { useSession } from '../components/shell/session'
import { Avatar, Badge, Button, Card } from '../components/ui'
import { useDashboard } from '../data/store'
import { cn } from '../lib/utils'
import { CertificatesTab } from './CertificatesTab'
import { CompanyTab } from './CompanyTab'
import { PartnersTab } from './PartnersTab'
import { ChangePasswordSheet, EditProfileSheet } from './ProfileSheets'

type Tab = 'company' | 'partners' | 'certificates'

export function AccountPage() {
  const { user } = useSession()
  const { data, ready } = useDashboard()
  const [tab, setTab] = useState<Tab>('company')
  const [editing, setEditing] = useState(false)
  const [password, setPassword] = useState(false)

  const tabs: { key: Tab; label: string; count?: number }[] = [
    { key: 'company', label: 'Company' },
    { key: 'partners', label: 'Partner organisations', count: data.orgs.length },
    { key: 'certificates', label: 'Certificates', count: data.company.certificates.length },
  ]

  return (
    <div className="flex flex-col gap-5 px-4 pt-6 pb-10 md:px-6">
      {/* ---- who is signed in ---- */}
      <Card className="flex flex-wrap items-center gap-5 p-5">
        <Avatar name={user.name} size={64} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <h1 className="text-2xl font-bold tracking-tight">{user.name}</h1>
            <span className="text-sm text-ink-muted">{data.company.name}</span>
            <Badge tone="brand">Company admin</Badge>
          </div>
          <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm text-ink-muted">
            {user.email && (
              <span className="flex items-center gap-1.5">
                <Mail className="size-4" /> {user.email}
              </span>
            )}
            {user.phone && (
              <span className="flex items-center gap-1.5">
                <Phone className="size-4" /> {user.phone}
              </span>
            )}
            {user.username && <span>Username: {user.username}</span>}
          </div>
        </div>
        <div className="flex gap-2">
          <Button className="rounded-xl" onClick={() => setEditing(true)}>
            <Pencil /> Edit profile
          </Button>
          <Button className="rounded-xl" onClick={() => setPassword(true)}>
            <KeyRound /> Change password
          </Button>
        </div>
      </Card>

      {/* ---- tabs ---- */}
      <div role="tablist" className="scroll-thin flex gap-1 overflow-x-auto border-b border-line">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              'relative flex h-11 shrink-0 cursor-pointer items-center gap-2 px-3 text-sm font-medium text-ink-muted transition-colors hover:text-ink',
              tab === t.key &&
                'font-semibold text-ink after:absolute after:inset-x-3 after:bottom-0 after:h-0.5 after:rounded-full after:bg-brand',
            )}
          >
            {t.label}
            {t.count !== undefined && (
              <span className="rounded-md bg-muted px-1.5 text-xs text-ink-muted">{t.count}</span>
            )}
          </button>
        ))}
      </div>

      {ready && tab === 'company' && <CompanyTab />}
      {ready && tab === 'partners' && <PartnersTab />}
      {ready && tab === 'certificates' && <CertificatesTab />}

      <EditProfileSheet open={editing} onOpenChange={setEditing} />
      <ChangePasswordSheet open={password} onOpenChange={setPassword} />
    </div>
  )
}
