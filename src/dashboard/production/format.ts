import type { BadgeTone } from '../components/ui'

/** Field records are stored as UTC wall-clock time, so always render in UTC. */
export const utcDate = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleDateString('en-GB', { timeZone: 'UTC', day: 'numeric', month: 'short', year: 'numeric' }) : '—'

export const utcTime = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleTimeString('en-GB', { timeZone: 'UTC', hour: '2-digit', minute: '2-digit' }) : ''

export const utcDateTime = (iso: string | null | undefined) => (iso ? `${utcDate(iso)}, ${utcTime(iso)} UTC` : '—')

export const STATUS: Record<string, { label: string; tone: BadgeTone }> = {
  not_assessed: { label: 'Awaiting assessment', tone: 'warn' },
  started: { label: 'Started', tone: 'neutral' },
  approved: { label: 'Approved by network', tone: 'info' },
  admin_approved: { label: 'Approved', tone: 'success' },
  rejected: { label: 'Rejected by network', tone: 'danger' },
  admin_rejected: { label: 'Rejected', tone: 'danger' },
}

export const statusOf = (s: string) => STATUS[s] ?? { label: s || 'Unknown', tone: 'neutral' as BadgeTone }

export const KILN_TYPE = { kontiki: 'Kon-Tiki', pit: 'Pit' } as const

/** Download rows as a CSV file (client side). */
export function downloadCsv(filename: string, header: string[], rows: (string | number)[][]) {
  const cell = (v: string | number) => {
    const s = String(v ?? '')
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const csv = [header, ...rows].map((r) => r.map(cell).join(',')).join('\r\n')
  const url = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
