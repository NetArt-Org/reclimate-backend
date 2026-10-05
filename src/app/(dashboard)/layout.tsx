import type { Metadata } from 'next'
import { Plus_Jakarta_Sans } from 'next/font/google'
import React from 'react'

import './dashboard.css'

const jakarta = Plus_Jakarta_Sans({ variable: '--font-jakarta', subsets: ['latin'], weight: ['400', '500', '600', '700', '800'] })

export const metadata: Metadata = {
  title: { default: 'Reclimate Admin', template: '%s · Reclimate Admin' },
  description: 'Operations admin for Reclimate dMRV',
}

export default function DashboardRootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={jakarta.variable}>
      <body>{children}</body>
    </html>
  )
}
