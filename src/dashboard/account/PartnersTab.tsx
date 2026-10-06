'use client'

import { MapPin, Plus } from 'lucide-react'
import { useState } from 'react'

import { Avatar, Badge, Button, Card, Switch } from '../components/ui'
import { APPLICATION_TYPES, MIXING_TYPES } from '../data/catalog'
import { useDashboard } from '../data/store'
import type { PartnerOrg } from '../data/types'
import { cn } from '../lib/utils'
import { OrgDialog } from '../networks/Dialogs'
import { References } from './CompanyTab'
import { ChipPicker, ContactList, Section } from './parts'

const EMPTY_STANDARDS: NonNullable<PartnerOrg['standards']> = {
  mixingTypes: [],
  applicationTypes: [],
  references: [],
}

/** Partner organisations that run networks under this company. */
export function PartnersTab() {
  const { data, updateOrg } = useDashboard()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const org = data.orgs.find((o) => o.id === selectedId) ?? data.orgs[0]

  return (
    <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[320px_minmax(0,1fr)]">
      <Card className="p-1.5">
        {data.orgs.map((o) => (
          <button
            key={o.id}
            type="button"
            onClick={() => setSelectedId(o.id)}
            aria-current={o.id === org?.id ? 'true' : undefined}
            className={cn(
              'flex w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-left hover:bg-muted',
              o.id === org?.id && 'bg-brand-soft hover:bg-brand-soft',
            )}
          >
            <Avatar name={o.name} size={38} />
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-1.5">
                <span className="truncate text-sm font-semibold">{o.name}</span>
                <span
                  className={cn(
                    'size-1.5 shrink-0 rounded-full',
                    o.active ? 'bg-success' : 'bg-line-strong',
                  )}
                />
              </span>
              <span className="block truncate text-xs text-ink-muted">{o.address ?? o.code}</span>
            </span>
          </button>
        ))}
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="mt-1 flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-line-strong py-2.5 text-sm font-medium text-ink-muted hover:border-brand hover:text-brand"
        >
          <Plus className="size-4" /> Add partner organisation
        </button>
      </Card>

      {org && (
        <div className="flex min-w-0 flex-col gap-5">
          <Card className="flex flex-wrap items-center gap-4 p-3 sm:p-4">
            <Avatar name={org.name} size={56} />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-xl font-bold tracking-tight">{org.name}</h2>
                <Badge tone="neutral">{org.code}</Badge>
              </div>
              {org.address && (
                <div className="mt-1 flex items-center gap-1.5 text-sm text-ink-muted">
                  <MapPin className="size-3.5" /> {org.address}
                </div>
              )}
              <div className="mt-1 text-sm text-ink-muted">
                {data.networks.filter((n) => n.orgId === org.id).length} networks
              </div>
            </div>
            <label className="flex cursor-pointer items-center gap-2 text-sm font-medium">
              {org.active ? 'Active' : 'Inactive'}
              <Switch
                checked={org.active}
                onCheckedChange={(active) => updateOrg(org.id, (o) => void (o.active = active))}
                aria-label="Organisation active"
              />
            </label>
          </Card>

          <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-2">
            <Section title="Admins" description="Manage this organisation's networks and people.">
              <ContactList
                contacts={org.admins ?? []}
                onChange={(admins) => updateOrg(org.id, (o) => void (o.admins = admins))}
                role="Organisation admin"
                empty="No admins yet."
              />
            </Section>

            <Section
              title="Standards"
              description="Mixing, application and reference values for this organisation."
            >
              <StandardsFor org={org} />
            </Section>
          </div>
        </div>
      )}

      <OrgDialog open={adding} onOpenChange={setAdding} />
    </div>
  )
}

function StandardsFor({ org }: { org: PartnerOrg }) {
  const { data, updateOrg } = useDashboard()
  const s = org.standards ?? EMPTY_STANDARDS
  const set = (patch: Partial<typeof s>) =>
    updateOrg(org.id, (o) => void (o.standards = { ...(o.standards ?? EMPTY_STANDARDS), ...patch }))
  return (
    <div className="flex flex-col gap-5">
      <div>
        <div className="mb-2 text-xs font-semibold tracking-wide text-ink-muted uppercase">
          Mixing types
        </div>
        <ChipPicker
          items={s.mixingTypes}
          options={MIXING_TYPES}
          onChange={(mixingTypes) => set({ mixingTypes })}
        />
      </div>
      <div>
        <div className="mb-2 text-xs font-semibold tracking-wide text-ink-muted uppercase">
          Application types
        </div>
        <ChipPicker
          items={s.applicationTypes}
          options={APPLICATION_TYPES}
          onChange={(applicationTypes) => set({ applicationTypes })}
        />
      </div>
      <div>
        <div className="mb-2 text-xs font-semibold tracking-wide text-ink-muted uppercase">
          Biomass reference
        </div>
        <References
          rows={s.references}
          onChange={(references) => set({ references })}
          feedstocks={data.company.feedstocks.map((f) => f.name)}
        />
      </div>
      <Button
        size="sm"
        variant="ghost"
        className="w-fit rounded-lg"
        onClick={() =>
          set({
            mixingTypes: [...data.company.mixingTypes],
            applicationTypes: [...data.company.applicationTypes],
          })
        }
      >
        Copy from company standards
      </Button>
    </div>
  )
}
