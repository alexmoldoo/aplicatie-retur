/**
 * Token de sesiune pentru clientul care caută o comandă pentru retur.
 * Token-ul este emis după Pas 1 reușit și verificat la endpoint-urile sensibile
 * (ex: /api/returns/create) ca să nu poată fi apelate direct.
 *
 * Format: base64url(payload).base64url(hmac)
 */

import crypto from 'crypto'

const TOKEN_TTL_MS = 30 * 60 * 1000 // 30 minute

const DEV_FALLBACK_SECRET = 'dev-only-customer-session-secret-change-in-production-please'

// În producție obligă setarea CUSTOMER_SESSION_SECRET — fallback-ul dev compromite token-urile
function getSecret(): string {
  const secret = process.env.CUSTOMER_SESSION_SECRET
  if (process.env.NODE_ENV === 'production') {
    if (!secret || secret === DEV_FALLBACK_SECRET || secret.length < 32) {
      throw new Error(
        'CUSTOMER_SESSION_SECRET trebuie setat (>= 32 caractere) în producție.'
      )
    }
    return secret
  }
  return secret || DEV_FALLBACK_SECRET
}

export interface CustomerSessionPayload {
  orderId: string
  numarComanda: string
  nume: string
  // Sursă de adevăr server-side pentru metoda de rambursare: dacă a fost plată
  // cu card, refund-ul merge pe card și NU cerem IBAN la creare. Semnat HMAC,
  // deci clientul nu poate falsifica (vezi /api/returns/create).
  wasPaidWithCard: boolean
  expiresAt: number
}

function b64urlEncode(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function b64urlDecode(str: string): Buffer {
  const padded = str.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((str.length + 3) % 4)
  return Buffer.from(padded, 'base64')
}

export function createCustomerToken(
  payload: Omit<CustomerSessionPayload, 'expiresAt'>
): string {
  const fullPayload: CustomerSessionPayload = {
    ...payload,
    expiresAt: Date.now() + TOKEN_TTL_MS,
  }
  const data = b64urlEncode(Buffer.from(JSON.stringify(fullPayload), 'utf8'))
  const sig = b64urlEncode(
    crypto.createHmac('sha256', getSecret()).update(data).digest()
  )
  return `${data}.${sig}`
}

export function verifyCustomerToken(token: string | null | undefined): CustomerSessionPayload | null {
  if (!token || typeof token !== 'string') return null
  try {
    const parts = token.split('.')
    if (parts.length !== 2) return null
    const [data, sig] = parts
    const expectedSig = b64urlEncode(
      crypto.createHmac('sha256', getSecret()).update(data).digest()
    )
    // Comparare în timp constant
    const sigBuf = Buffer.from(sig)
    const expectedBuf = Buffer.from(expectedSig)
    if (sigBuf.length !== expectedBuf.length) return null
    if (!crypto.timingSafeEqual(sigBuf, expectedBuf)) return null

    const payload: CustomerSessionPayload = JSON.parse(b64urlDecode(data).toString('utf8'))
    if (typeof payload.expiresAt !== 'number' || payload.expiresAt < Date.now()) return null
    return payload
  } catch {
    return null
  }
}
