import React from 'react'

export const metadata = {
  description: 'Backend for Artisan Pro · Reclimate dMRV',
  title: 'Reclimate dMRV · Backend',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
