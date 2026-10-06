'use client'

import { Plus, Save, UserPlus } from 'lucide-react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useState } from 'react'

import { PageHeader } from '../components/shell/PageHeader'
import { Button, Segmented, Spinner } from '../components/ui'
import type { Feedstock } from '../data/types'
import type { Template } from '../server/settings'
import { AdminAccessSection } from './AdminAccessSection'
import { CERTIFICATE_FORM_ID, CertificateSection } from './CertificateSection'
import { FeedstockSheet } from './FeedstockSheet'
import { FeedstocksSection } from './FeedstocksSection'
import { TemplateSheet } from './TemplateSheet'
import { TemplatesSection } from './TemplatesSection'
import type { TemplateKind } from './volume'

type Section = 'feedstocks' | 'templates' | 'access' | 'certificate'

const SECTIONS: { value: Section; label: string }[] = [
  { value: 'feedstocks', label: 'Feedstock management' },
  { value: 'templates', label: 'Templates' },
  { value: 'access', label: 'Admin access' },
  { value: 'certificate', label: 'Certificate' },
]

const DESCRIPTION: Record<Section, string> = {
  feedstocks: 'Feedstocks and the kiln and container templates the field app uses.',
  templates: 'Feedstocks and the kiln and container templates the field app uses.',
  access: 'Who can sign in to this admin.',
  certificate: 'Company details, logo and signatures for carbon-removal certificates.',
}

/** Settings: feedstocks, kiln / container templates, admin access and the certificate generator. */
export function SettingsPage({ templates }: { templates: Template[] }) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const requested = params.get('section')
  const section: Section = SECTIONS.find((s) => s.value === requested)?.value ?? 'feedstocks'

  const setSection = (s: Section) => {
    const next = new URLSearchParams(params.toString())
    next.set('section', s)
    router.replace(`${pathname}?${next.toString()}`, { scroll: false })
  }

  const [kind, setKind] = useState<TemplateKind>('kiln')

  // Feedstock editor: undefined = closed, null = new, otherwise the feedstock.
  const [feedstock, setFeedstock] = useState<Feedstock | null | undefined>(undefined)
  // Template editor: undefined = closed, null = new, otherwise the template.
  const [template, setTemplate] = useState<Template | null | undefined>(undefined)
  const [inviting, setInviting] = useState(false)
  const [savingCertificate, setSavingCertificate] = useState(false)

  const action =
    section === 'feedstocks' ? (
      <Button variant="primary" onClick={() => setFeedstock(null)}>
        <Plus /> Add feedstock
      </Button>
    ) : section === 'templates' ? (
      <Button variant="primary" onClick={() => setTemplate(null)}>
        <Plus /> {kind === 'kiln' ? 'Add kiln template' : 'Add container template'}
      </Button>
    ) : section === 'access' ? (
      <Button variant="primary" onClick={() => setInviting(true)}>
        <UserPlus /> Invite admin
      </Button>
    ) : (
      <Button variant="primary" type="submit" form={CERTIFICATE_FORM_ID} disabled={savingCertificate}>
        {savingCertificate ? <Spinner className="text-white" /> : <Save />} {savingCertificate ? 'Saving…' : 'Save'}
      </Button>
    )

  return (
    <>
      <PageHeader title="Settings" description={DESCRIPTION[section]} actions={action} />
      <div className="flex flex-col gap-3 px-3 pb-6 sm:gap-4 sm:px-4 md:px-6">
        <Segmented<Section>
          value={section}
          onChange={setSection}
          className="max-w-full self-start overflow-x-auto [&>button]:shrink-0 [&>button]:whitespace-nowrap"
          options={SECTIONS}
        />

        {section === 'feedstocks' ? (
          <FeedstocksSection onEdit={setFeedstock} />
        ) : section === 'templates' ? (
          <TemplatesSection kind={kind} onKind={setKind} templates={templates} onEdit={setTemplate} />
        ) : section === 'access' ? (
          <AdminAccessSection inviteOpen={inviting} onInviteOpenChange={setInviting} />
        ) : (
          <CertificateSection onSavingChange={setSavingCertificate} />
        )}
      </div>

      <FeedstockSheet feedstock={feedstock ?? null} open={feedstock !== undefined} onOpenChange={(o) => !o && setFeedstock(undefined)} />
      <TemplateSheet
        kind={template?.kind ?? kind}
        template={template ?? null}
        open={template !== undefined}
        onOpenChange={(o) => !o && setTemplate(undefined)}
      />
    </>
  )
}
