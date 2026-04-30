/**
 * Helpere de securitate partajate între API routes:
 * - rate limiting in-memory per IP
 * - extragere IP client
 * - verificare origin (CSRF light)
 */

import { NextRequest } from 'next/server'

export function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0].trim()
  return request.headers.get('x-real-ip') || 'unknown'
}

interface RateLimitEntry {
  count: number
  resetAt: number
}

export function makeRateLimiter(opts: { max: number; windowMs: number }) {
  const map = new Map<string, RateLimitEntry>()

  return function check(key: string): { allowed: boolean; retryAfter: number } {
    const now = Date.now()
    const entry = map.get(key)
    if (!entry || entry.resetAt < now) {
      map.set(key, { count: 1, resetAt: now + opts.windowMs })
      return { allowed: true, retryAfter: 0 }
    }
    if (entry.count >= opts.max) {
      return { allowed: false, retryAfter: Math.ceil((entry.resetAt - now) / 1000) }
    }
    entry.count++
    return { allowed: true, retryAfter: 0 }
  }
}

/**
 * Verifică dacă cererea vine de la un browser pe domeniul propriu.
 * Acceptă cereri server-to-server doar dacă au header-ul x-internal-call (nu folosit acum).
 *
 * Returnează `true` dacă origin-ul este OK sau dacă suntem în development cu host local.
 */
export function isAllowedOrigin(request: NextRequest): boolean {
  const origin = request.headers.get('origin')
  const referer = request.headers.get('referer')
  const host = request.headers.get('host')

  // În development, permite localhost/127.0.0.1 fără verificare strictă
  if (process.env.NODE_ENV !== 'production') {
    if (!origin && !referer) return true // dev tools, curl local — acceptă
  }

  // Dacă nu există nici origin, nici referer, e suspect (curl direct)
  if (!origin && !referer) return false

  const allowed: string[] = []
  if (host) {
    allowed.push(`https://${host}`, `http://${host}`)
  }
  // Domenii suplimentare permise (de configurat în env dacă e cazul)
  const extra = process.env.ALLOWED_ORIGINS
  if (extra) {
    extra.split(',').map(s => s.trim()).filter(Boolean).forEach(o => allowed.push(o))
  }

  const checkAgainst = origin || (referer ? new URL(referer).origin : '')
  if (!checkAgainst) return false

  return allowed.some(a => checkAgainst === a || checkAgainst.startsWith(a))
}

export function formatWaitTime(seconds: number): string {
  const minutes = Math.floor(seconds / 60)
  const sec = seconds % 60
  if (minutes > 0) {
    return `${minutes} ${minutes === 1 ? 'minut' : 'minute'}${sec > 0 ? ` și ${sec} secunde` : ''}`
  }
  return `${sec} secunde`
}
