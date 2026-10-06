/** Country dialling codes for phone fields (profile, certificate settings). */
export const COUNTRIES: { iso: string; name: string; dial: string }[] = [
  { iso: 'SG', name: 'Singapore', dial: '+65' },
  { iso: 'IN', name: 'India', dial: '+91' },
  { iso: 'ID', name: 'Indonesia', dial: '+62' },
  { iso: 'MY', name: 'Malaysia', dial: '+60' },
  { iso: 'PH', name: 'Philippines', dial: '+63' },
  { iso: 'TH', name: 'Thailand', dial: '+66' },
  { iso: 'VN', name: 'Vietnam', dial: '+84' },
  { iso: 'BD', name: 'Bangladesh', dial: '+880' },
  { iso: 'LK', name: 'Sri Lanka', dial: '+94' },
  { iso: 'NP', name: 'Nepal', dial: '+977' },
  { iso: 'PK', name: 'Pakistan', dial: '+92' },
  { iso: 'CN', name: 'China', dial: '+86' },
  { iso: 'HK', name: 'Hong Kong', dial: '+852' },
  { iso: 'JP', name: 'Japan', dial: '+81' },
  { iso: 'KR', name: 'South Korea', dial: '+82' },
  { iso: 'AU', name: 'Australia', dial: '+61' },
  { iso: 'NZ', name: 'New Zealand', dial: '+64' },
  { iso: 'AE', name: 'United Arab Emirates', dial: '+971' },
  { iso: 'KE', name: 'Kenya', dial: '+254' },
  { iso: 'TZ', name: 'Tanzania', dial: '+255' },
  { iso: 'UG', name: 'Uganda', dial: '+256' },
  { iso: 'GH', name: 'Ghana', dial: '+233' },
  { iso: 'NG', name: 'Nigeria', dial: '+234' },
  { iso: 'ZA', name: 'South Africa', dial: '+27' },
  { iso: 'GB', name: 'United Kingdom', dial: '+44' },
  { iso: 'DE', name: 'Germany', dial: '+49' },
  { iso: 'FR', name: 'France', dial: '+33' },
  { iso: 'NL', name: 'Netherlands', dial: '+31' },
  { iso: 'CH', name: 'Switzerland', dial: '+41' },
  { iso: 'SE', name: 'Sweden', dial: '+46' },
  { iso: 'DK', name: 'Denmark', dial: '+45' },
  { iso: 'NO', name: 'Norway', dial: '+47' },
  { iso: 'FI', name: 'Finland', dial: '+358' },
  { iso: 'ES', name: 'Spain', dial: '+34' },
  { iso: 'IT', name: 'Italy', dial: '+39' },
  { iso: 'US', name: 'United States', dial: '+1' },
  { iso: 'CA', name: 'Canada', dial: '+1' },
  { iso: 'MX', name: 'Mexico', dial: '+52' },
  { iso: 'BR', name: 'Brazil', dial: '+55' },
]

const byDialLength = [...COUNTRIES].sort((a, b) => b.dial.length - a.dial.length)

/** Flag emoji for an ISO country code ("IN" → 🇮🇳). Systems without flag emoji show the two letters instead. */
export const flag = (iso: string) =>
  String.fromCodePoint(...[...iso.toUpperCase()].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65))

/** "+65 6123 4567" → { iso: 'SG', number: '6123 4567' }. Unknown or missing codes use `fallback`. */
export function splitPhone(phone: string | undefined | null, fallback = 'SG'): { iso: string; number: string } {
  const p = (phone ?? '').trim()
  if (p.startsWith('+')) {
    const c = byDialLength.find((c) => p.startsWith(c.dial))
    if (c) return { iso: c.iso, number: p.slice(c.dial.length).trim() }
  }
  return { iso: fallback, number: p }
}

export function joinPhone(iso: string, number: string): string {
  const n = number.trim()
  if (!n) return ''
  const dial = COUNTRIES.find((c) => c.iso === iso)?.dial ?? '+65'
  return `${dial} ${n}`
}
