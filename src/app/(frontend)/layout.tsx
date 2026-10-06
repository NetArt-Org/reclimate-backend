import React from 'react'

export const metadata = {
  title: 'Reclimate dMRV',
  description: "Measure, verify and track biochar production and carbon removal credits across Reclimate's networks.",
  robots: { index: false, follow: false },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
