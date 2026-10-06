'use client'

import { BadgeCheck, FileText, Layers, Recycle, SquareCheckBig } from 'lucide-react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'

import { PageHeader } from '../components/shell/PageHeader'
import { Button, ConfirmDialog } from '../components/ui'
import { useDashboard } from '../data/store'
import { FilterBar, PeriodPicker } from '../home/FilterBar'
import { cn } from '../lib/utils'
import { unwrap } from '../lib/unwrap'
import { registerCredits, type PortfolioExtras } from '../server/portfolio'
import { tco2 } from './buckets'
import { DocumentsTab } from './DocumentsTab'
import { readiness, RegisterTab } from './RegisterTab'
import { SinksLedger, StocksLedger } from './Ledgers'
import { StatusOverview } from './StatusOverview'

const TABS = [
  { key: 'documents', label: 'Documents', icon: FileText },
  { key: 'register', label: 'Register credits', icon: SquareCheckBig },
  { key: 'stocks', label: 'Stocks ledger', icon: Layers },
  { key: 'sinks', label: 'Sinks ledger', icon: Recycle },
] as const
type Tab = (typeof TABS)[number]['key']

export function PortfolioPage({ extras }: { extras: PortfolioExtras }) {
  const { data, ready } = useDashboard()
  const router = useRouter()
  const params = useSearchParams()
  const tab: Tab = TABS.some((t) => t.key === params.get('tab')) ? (params.get('tab') as Tab) : 'documents'
  const setTab = (t: Tab) => router.replace(`/admin/portfolio?tab=${t}`, { scroll: false })

  const [confirm, setConfirm] = useState(false)
  const [pending, start] = useTransition()
  const checks = readiness(data)
  const blocked = checks.filter((c) => !c.ok)
  const canRegister = extras.registerableT > 0 && !blocked.length

  const register = () =>
    start(async () => {
      try {
        const r = unwrap(await registerCredits())
        toast.success(`${tco2(r.t)} t CO₂e registered`, { description: `${r.batches} batches moved to Registered.` })
        router.refresh()
      } catch (err) {
        toast.error('Could not register the credits', { description: err instanceof Error ? err.message : String(err) })
      }
    })

  return (
    <>
      <PageHeader
        title="Projects portfolio"
        description="Carbon credits from field record to registry, with the stock and sink ledgers."
        actions={ready && <PeriodPicker />}
      />
      <div className="flex flex-col gap-3 px-3 pb-6 sm:gap-4 sm:px-4 md:px-6">
        {ready ? <FilterBar /> : <div className="h-10" />}
        {ready ? <StatusOverview /> : <div className="h-[420px] animate-pulse rounded-card bg-surface" />}

        <div className="mt-2 flex flex-wrap items-center gap-3">
          <div role="tablist" aria-label="Portfolio records" className="flex flex-wrap gap-1 rounded-2xl border border-line bg-surface p-1">
            {TABS.map((t) => {
              const Icon = t.icon
              const on = t.key === tab
              return (
                <button
                  key={t.key}
                  type="button"
                  role="tab"
                  aria-selected={on}
                  onClick={() => setTab(t.key)}
                  className={cn(
                    'flex h-9 cursor-pointer items-center gap-2 rounded-xl px-3.5 text-sm font-semibold text-ink-muted transition-colors outline-none hover:text-ink focus-visible:ring-2 focus-visible:ring-brand/40',
                    on && 'bg-brand text-white hover:text-white',
                  )}
                >
                  <Icon className="size-4" />
                  {t.label}
                </button>
              )
            })}
          </div>
          <Button
            variant="primary"
            className="ml-auto rounded-xl"
            disabled={!canRegister || pending}
            onClick={() => setConfirm(true)}
            title={blocked.length ? `Fix first: ${blocked.map((b) => b.title).join(', ')}` : undefined}
          >
            <BadgeCheck />
            Register {tco2(extras.registerableT)} credits
          </Button>
        </div>

        {tab === 'documents' && <DocumentsTab documents={extras.documents} />}
        {tab === 'register' && <RegisterTab extras={extras} checks={checks} />}
        {tab === 'stocks' && <StocksLedger stocks={extras.stocks} />}
        {tab === 'sinks' && <SinksLedger sinks={extras.sinks} stocks={extras.stocks} />}
      </div>

      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title={`Register ${tco2(extras.registerableT)} credits?`}
        message="Every approved batch whose sink is approved is marked Registered. This is recorded in the activity log."
        confirmLabel="Register"
        onConfirm={register}
      />
    </>
  )
}
