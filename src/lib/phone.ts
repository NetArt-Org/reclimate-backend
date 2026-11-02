/**
 * Phone numbers are typed in many ways (+62 812…, 0812…, 812-…). Two numbers are the same person's when their
 * last 9 digits match; shorter numbers never match.
 */
export function phoneKey(phone?: string | null) {
  const digits = (phone ?? '').replace(/\D/g, '')
  return digits.length >= 8 ? digits.slice(-9) : ''
}

/** "Ramesh Kumar" → "R***** K****": enough for the person to recognise, not enough to learn someone's name. */
export const maskName = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .map((w) => w[0] + '*'.repeat(Math.min(Math.max(w.length - 1, 2), 6)))
    .join(' ')
