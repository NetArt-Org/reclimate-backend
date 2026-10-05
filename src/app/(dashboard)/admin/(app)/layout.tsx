import config from '@payload-config'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'
import React from 'react'

import { AccessDenied, DashboardShell } from '@/dashboard/components/shell/DashboardShell'

/** Every admin page: signed-in admins only. */
export default async function AdminAppLayout({ children }: { children: React.ReactNode }) {
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: await headers() })
  if (!user) redirect('/admin/login')
  if (user.role !== 'admin') return <AccessDenied />
  return (
    <DashboardShell
      user={{
        id: user.id,
        name: user.name || 'Admin',
        username: user.username ?? undefined,
        email: user.email ?? undefined,
        phone: user.phone ?? undefined,
      }}
    >
      {children}
    </DashboardShell>
  )
}
