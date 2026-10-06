import type { Metadata } from 'next'

import { unwrap } from '@/dashboard/lib/unwrap'
import { listTemplates } from '@/dashboard/server/settings'
import { SettingsPage } from '@/dashboard/settings/SettingsPage'

export const metadata: Metadata = { title: 'Settings' }

export default async function Settings() {
  return <SettingsPage templates={unwrap(await listTemplates())} />
}
