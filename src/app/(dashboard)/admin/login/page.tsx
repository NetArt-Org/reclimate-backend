import config from '@payload-config'
import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'

import { LoginForm } from '@/dashboard/components/shell/LoginForm'

export const metadata: Metadata = { title: 'Sign in' }

export default async function LoginPage() {
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: await headers() })
  if (user?.role === 'admin') redirect('/admin')
  return <LoginForm />
}
