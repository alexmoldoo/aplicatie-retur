/**
 * Date în fusul României — folosite și pe server, și în client (funcții pure).
 */

const RO_TZ = 'Europe/Bucharest'

/** Cheia lunii calendaristice („2026-10") pentru o dată, în fusul României. */
export function monthKeyRO(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  if (isNaN(d.getTime())) return ''
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', { timeZone: RO_TZ, year: 'numeric', month: '2-digit' })
      .formatToParts(d)
      .map(x => [x.type, x.value])
  )
  return `${p.year}-${p.month}`
}

/** Cheia lunii curente și a lunii trecute, în fusul României. */
export function currentAndPreviousMonthRO(now: Date = new Date()): { current: string; previous: string } {
  const current = monthKeyRO(now)
  const [y, m] = current.split('-').map(Number)
  const prevDate = new Date(Date.UTC(y, m - 2, 15)) // mijlocul lunii precedente, fără surprize de fus
  return { current, previous: monthKeyRO(prevDate) }
}

/** „octombrie 2026" pentru o cheie de lună. */
export function monthLabelRO(monthKey: string): string {
  const [y, m] = monthKey.split('-').map(Number)
  if (!y || !m) return monthKey
  return new Intl.DateTimeFormat('ro-RO', { month: 'long', year: 'numeric', timeZone: RO_TZ })
    .format(new Date(Date.UTC(y, m - 1, 15)))
}
