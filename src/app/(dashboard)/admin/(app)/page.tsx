import type { Metadata } from 'next'

import { HomePage } from '@/dashboard/home/HomePage'

export const metadata: Metadata = { title: 'Overview' }

export default function AdminHome() {
  return <HomePage />
}
