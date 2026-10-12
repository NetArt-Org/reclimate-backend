import type { ReactNode } from 'react'

/** Shared look of the public pages (privacy policy, terms, account deletion): plain, readable, mobile-first. */
export function LegalPage({ title, updated, children }: { title: string; updated: string; children: ReactNode }) {
  return (
    <main
      style={{
        maxWidth: 760,
        margin: '0 auto',
        padding: '32px 20px 64px',
        fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
        lineHeight: 1.6,
        color: '#1e2320',
        fontSize: 16,
      }}
    >
      <div style={{ fontWeight: 800, color: '#1f5a3d', fontSize: 15, letterSpacing: 0.3 }}>Artisan Pro · Reclimate dMRV</div>
      <h1 style={{ fontSize: 30, lineHeight: 1.2, margin: '8px 0 4px' }}>{title}</h1>
      <p style={{ color: '#5b625d', marginTop: 0 }}>Last updated: {updated}</p>
      {children}
    </main>
  )
}

export const H = ({ children }: { children: ReactNode }) => <h2 style={{ fontSize: 20, marginTop: 28, marginBottom: 6 }}>{children}</h2>
