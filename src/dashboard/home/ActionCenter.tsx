'use client'

import { Bell, CircleCheck, FlaskConical, Info, Smartphone, TriangleAlert } from 'lucide-react'
import Link from 'next/link'
import { useState } from 'react'
import { toast } from 'sonner'

import { Avatar, Badge, Button, Card, EmptyState, Modal, Segmented } from '../components/ui'
import { LATEST_APP_VERSION, ROLE_LABEL } from '../data/catalog'
import { outdatedUsers, scopedNetworks } from '../data/selectors'
import { useDashboard } from '../data/store'
import type { Alert } from '../data/types'
import { cn, day } from '../lib/utils'

const ICON: Record<Alert['kind'], typeof Info> = { 'bulk-density': Info, certificate: TriangleAlert, kiln: TriangleAlert, sampling: FlaskConical }

/** Things that need someone's attention, and a log of what happened. */
export function ActionCenter() {
  const { data, filters, resolveAlert } = useDashboard()
  const [tab, setTab] = useState<'alerts' | 'logs'>('alerts')
  const [showOutdated, setShowOutdated] = useState(false)

  const inScope = new Set(scopedNetworks(data, filters).map((n) => n.id))
  const visible = (networkId?: string) => !networkId || inScope.has(networkId)
  const alerts = data.alerts.filter((a) => a.status === 'open' && visible(a.networkId))
  const logs = data.logs.filter((l) => visible(l.networkId))
  const outdated = outdatedUsers(data).filter((u) => u.networkIds.some((id) => inScope.has(id)))
  const alertCount = alerts.length + (outdated.length ? 1 : 0)

  return (
    <Card id="attention" className="flex max-h-[430px] scroll-mt-24 flex-col p-3 sm:p-4">
      <div className="flex items-center gap-2.5">
        <Bell className="size-4 text-ink-muted" />
        <h2 className="text-base font-semibold">Needs attention</h2>
        <Segmented
          className="ml-auto"
          value={tab}
          onChange={setTab}
          options={[
            { value: 'alerts', label: `To do${alertCount ? ` · ${alertCount}` : ''}` },
            { value: 'logs', label: 'Activity' },
          ]}
        />
      </div>

      <div className="scroll-thin -mx-2 mt-4 flex-1 overflow-y-auto px-2">
        {tab === 'alerts' ? (
          <div className="flex flex-col gap-3">
            {outdated.length > 0 && (
              <button
                type="button"
                onClick={() => setShowOutdated(true)}
                className="flex cursor-pointer gap-3 rounded-xl border border-line p-3.5 text-left transition-colors hover:bg-muted"
              >
                <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg bg-info-soft text-info">
                  <Smartphone className="size-4" />
                </span>
                <div>
                  <div className="text-sm font-semibold">
                    {outdated.length} {outdated.length === 1 ? 'person is' : 'people are'} on an older app version than {LATEST_APP_VERSION}.
                  </div>
                  <div className="mt-1 text-xs font-semibold text-info">See who →</div>
                </div>
              </button>
            )}
            {alerts.map((a) => {
              const Icon = ICON[a.kind]
              const warn = a.kind !== 'bulk-density'
              return (
                <div key={a.id} className="rounded-xl border border-line p-3.5">
                  <div className="flex gap-3">
                    <span className={cn('mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg', warn ? 'bg-warn-soft text-warn' : 'bg-info-soft text-info')}>
                      <Icon className="size-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-semibold">{a.message}</div>
                      {a.request && (
                        <div className="mt-1 text-xs text-ink-2">
                          {a.request.by} asks to set {a.request.feedstock} to <b>{a.request.bulkDensity} kg/m³</b>
                        </div>
                      )}
                      <div className="mt-1 text-xs text-ink-muted">{day(a.date)}</div>
                      <div className="mt-3 flex gap-2">
                        {a.request ? (
                          <>
                            <Button
                              size="sm"
                              variant="primary"
                              onClick={() => {
                                resolveAlert(a.id, 'approved')
                                toast.success('Approved — reference value updated')
                              }}
                            >
                              Approve
                            </Button>
                            <Button size="sm" onClick={() => resolveAlert(a.id, 'rejected')}>
                              Reject
                            </Button>
                          </>
                        ) : a.kind === 'sampling' ? (
                          // Computed from the container itself: it clears once the sample is sent and the container is updated.
                          <Link
                            href="/admin/networks"
                            className="inline-flex h-8 items-center rounded-full border border-line px-3 text-xs font-semibold hover:bg-muted"
                          >
                            View containers
                          </Link>
                        ) : (
                          <Button size="sm" onClick={() => resolveAlert(a.id, 'dismissed')}>
                            Dismiss
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
            {alertCount === 0 && <EmptyState icon={<CircleCheck />} title="Nothing needs attention" sub="New requests and warnings show up here." />}
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {logs.map((l) => (
              <div key={l.id} className="flex gap-3 border-b border-line pb-3 last:border-0">
                <span className="mt-1.5 size-2 shrink-0 rounded-full bg-success" />
                <div>
                  <div className="text-sm font-medium">{l.message}</div>
                  <div className="mt-1 text-xs text-ink-muted">{day(l.date)}</div>
                </div>
              </div>
            ))}
            {logs.length === 0 && <EmptyState icon={<CircleCheck />} title="No activity yet" />}
          </div>
        )}
      </div>

      <Modal open={showOutdated} onOpenChange={setShowOutdated} title="Older app versions" description={`Latest version is ${LATEST_APP_VERSION}. Ask these people to update the app.`}>
        <div className="flex flex-col divide-y divide-line">
          {outdated.map((u) => (
            <div key={u.id} className="flex items-center gap-3 py-3">
              <Avatar name={u.name} size={36} />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-bold">{u.name}</div>
                <div className="text-xs text-ink-muted">
                  {ROLE_LABEL[u.role]} · {u.phone} · {u.device?.model}
                </div>
              </div>
              <Badge tone="warn">{u.device?.version}</Badge>
            </div>
          ))}
        </div>
      </Modal>
    </Card>
  )
}
