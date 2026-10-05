import type { Metadata } from 'next'

import { AccountPage } from '@/dashboard/account/AccountPage'

export const metadata: Metadata = { title: 'Account & company' }

export default function Account() {
  return <AccountPage />
}
