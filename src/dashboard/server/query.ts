/** Input clean-up shared by the Production query actions (plain module, not 'use server'). */

/** Whole number within [min, max]; `fallback` when missing or not a number. */
export const clampInt = (v: unknown, fallback: number, min: number, max: number) => {
  const x = typeof v === 'number' && Number.isFinite(v) ? Math.trunc(v) : fallback
  return Math.min(Math.max(x, min), max)
}

/** Search box text, trimmed and at most 100 characters. */
export const searchText = (v: unknown) => (typeof v === 'string' ? v.trim().slice(0, 100) : '')

/** An id or YYYY-MM-DD filter value, or undefined when missing / not a short string. */
export const filterValue = (v: unknown, max = 64) => (typeof v === 'string' && v && v.length <= max ? v : undefined)
export const dateValue = (v: unknown) => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : undefined)
