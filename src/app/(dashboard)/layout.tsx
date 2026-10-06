import type { Metadata, Viewport } from 'next'
import { Plus_Jakarta_Sans } from 'next/font/google'
import React from 'react'

import './dashboard.css'

const jakarta = Plus_Jakarta_Sans({ variable: '--font-jakarta', subsets: ['latin'], weight: ['400', '500', '600', '700', '800'] })

export const metadata: Metadata = {
  title: { default: 'Reclimate dMRV', template: '%s · Reclimate dMRV' },
  description: "Measure, verify and track biochar production and carbon removal credits across Reclimate's networks.",
  applicationName: 'Reclimate dMRV',
  // A private admin: keep it out of search engines.
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
}

export const viewport: Viewport = { themeColor: '#1f5a3d' }

export default function DashboardRootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={jakarta.variable}>
      <body>{children}</body>
    </html>
  )
}
