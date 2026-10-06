import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs))

export const uid = (prefix = '') => prefix + Math.random().toString(36).slice(2, 9)

/** 1234.5 → "1,234.5"; never more than `digits` decimals. */
export const num = (n: number, digits = 2) =>
  n.toLocaleString('en-US', { maximumFractionDigits: digits, minimumFractionDigits: 0 })

/** "2026-10-05" → "5 Oct 2026". UTC, because records are stored as UTC wall-clock dates. */
export const day = (iso: string) =>
  new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })

/** "Pak Andi Saputra" → "AS" (honorifics skipped) */
export const initials = (name: string) => {
  const words = name.trim().split(/\s+/).filter((w) => !['pak', 'ibu', 'bu', 'bapak'].includes(w.toLowerCase()))
  return (words.slice(0, 2).map((w) => w[0]).join('') || '?').toUpperCase()
}

/** Compare app versions: "2.6.3" < "2.7.0" */
export const versionLess = (a: string, b: string) => {
  const pa = a.split('.').map(Number)
  const pb = b.split('.').map(Number)
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0)
    if (d) return d < 0
  }
  return false
}
