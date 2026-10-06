/** Calendar helpers for the charts and filters. */

const pad = (n: number) => String(n).padStart(2, '0')

/** Every month from Jan 2024 to the current month, as YYYY-MM. */
export function monthRange(from = '2024-01', to?: string) {
  const now = new Date()
  const end = to ?? `${now.getFullYear()}-${pad(now.getMonth() + 1)}`
  const out: string[] = []
  let [y, m] = from.split('-').map(Number)
  for (;;) {
    const key = `${y}-${pad(m)}`
    out.push(key)
    if (key >= end) break
    m++
    if (m > 12) {
      m = 1
      y++
    }
  }
  return out
}

/** Monday (local) of the week containing `d`, as YYYY-MM-DD. */
export function weekStart(d: Date) {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7))
  return `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}`
}

/** Every week (its Monday) from the first week of 2024 to the current week. */
export function weekRange(from = '2024-01-01') {
  const out: string[] = []
  const end = weekStart(new Date())
  const d = new Date(`${from}T00:00:00`)
  for (let key = weekStart(d); key <= end; ) {
    out.push(key)
    d.setDate(d.getDate() + 7)
    key = weekStart(d)
  }
  return out
}
