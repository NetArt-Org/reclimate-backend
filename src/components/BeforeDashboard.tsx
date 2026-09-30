import configPromise from '@payload-config'
import Link from 'next/link'
import { getPayload } from 'payload'
import React from 'react'

const card: React.CSSProperties = {
  border: '1px solid var(--theme-elevation-150)',
  borderRadius: 8,
  color: 'inherit',
  display: 'block',
  padding: '16px 18px',
  textDecoration: 'none',
}
const big: React.CSSProperties = { fontSize: 32, fontWeight: 700, lineHeight: 1.1 }
const grid: React.CSSProperties = {
  display: 'grid',
  gap: 12,
  gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
}

/** Plain-language start page for the admin panel: what needs attention, and where to click. */
export default async function BeforeDashboard() {
  const payload = await getPayload({ config: configPromise })
  const count = async (collection: 'batches' | 'sell-requests' | 'users', where: object) =>
    (await payload.count({ collection, where: where as never })).totalDocs

  const [waiting, inProgress, sellPending, workers] = await Promise.all([
    count('batches', { status: { equals: 'waiting' } }),
    count('batches', { status: { equals: 'progress' } }),
    count('sell-requests', { status: { equals: 'pending' } }),
    count('users', { role: { equals: 'worker' } }),
  ])

  const tiles = [
    {
      href: '/admin/collections/batches?where[status][equals]=waiting',
      label: 'Batches waiting for review',
      n: waiting,
      hint: 'Open one, check the photos, then approve or reject.',
    },
    {
      href: '/admin/collections/batches?where[status][equals]=progress',
      label: 'Batches in progress',
      n: inProgress,
      hint: 'Workers are still recording these.',
    },
    {
      href: '/admin/collections/sell-requests?where[status][equals]=pending',
      label: 'Sell requests to handle',
      n: sellPending,
      hint: 'Mark as Paid once the buyer has paid.',
    },
    {
      href: '/admin/collections/users?where[role][equals]=worker',
      label: 'Workers',
      n: workers,
      hint: 'Add people, change a PIN or move someone to another site.',
    },
  ]

  return (
    <div style={{ marginBottom: 32 }}>
      <h2 style={{ marginBottom: 4 }}>Artisan Pro · Reclimate dMRV</h2>
      <p style={{ marginBottom: 16, opacity: 0.75 }}>What needs your attention today.</p>
      <div style={grid}>
        {tiles.map((t) => (
          <Link href={t.href} key={t.label} style={card}>
            <div style={big}>{t.n}</div>
            <div style={{ fontWeight: 600, marginTop: 4 }}>{t.label}</div>
            <div style={{ fontSize: 13, marginTop: 4, opacity: 0.7 }}>{t.hint}</div>
          </Link>
        ))}
      </div>

      <h3 style={{ marginBottom: 8, marginTop: 28 }}>How do I…</h3>
      <ul style={{ lineHeight: 1.7, margin: 0, paddingLeft: 18 }}>
        <li>
          <strong>Add a worker or supervisor:</strong> People → Create New. Fill in the name, phone number, role and
          site. The <em>Username</em> is the phone number&apos;s digits only, and the <em>Password</em> is the 4-digit
          PIN they will type in the app.
        </li>
        <li>
          <strong>Reset a forgotten PIN:</strong> People → open the person → Change Password.
        </li>
        <li>
          <strong>Review a batch:</strong> Batches → open it → look through the Day tabs → set Status to Approved or
          Rejected → Save. Approving adds the credits to the worker automatically.
        </li>
        <li>
          <strong>Change the lists workers choose from</strong> (kilns, farmers, bags…): Site setup lists.
        </li>
        <li>
          <strong>Change the credit price or factor:</strong> Credit &amp; quality settings.
        </li>
      </ul>
    </div>
  )
}
