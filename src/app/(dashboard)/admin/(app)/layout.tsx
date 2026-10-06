import { redirect } from 'next/navigation'
import React from 'react'

import { AccessDenied, DashboardShell } from '@/dashboard/components/shell/DashboardShell'
import { loadDashboardData } from '@/dashboard/server/load'
import { sessionUser } from '@/dashboard/server/payload'

/** Every admin page: signed-in admins only. The shared data is read from Neon here. */
export default async function AdminAppLayout({ children }: { children: React.ReactNode }) {
  const user = await sessionUser()
  if (!user) redirect('/admin/login')
  if (user.role !== 'admin') return <AccessDenied />
  const data = await loadDashboardData()
  return (
    <DashboardShell
      user={{
        id: user.id,
        name: user.name || 'Admin',
        email: user.email ?? undefined,
        phone: user.phone ?? undefined,
        googleSignIn: !!user.googleSignIn,
      }}
      data={data}
    >
      {children}
    </DashboardShell>
  )
}
