/**
 * Integrare PickScan (aplicația de depozit, server-to-server).
 *
 * Autentificare: o cheie secretă partajată, `PICKSCAN_API_KEY` (env, Vercel).
 * PickScan o trimite pe fiecare apel ca `Authorization: Bearer <cheie>` sau
 * `X-API-Key: <cheie>`. Fără cheie configurată, endpoint-urile răspund 503.
 */

import crypto from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import type { Return } from './db'
import { RETURN_STATUS_LABEL } from './return-status'

/** Extrage cheia din header (Bearer sau X-API-Key). */
function extractKey(request: NextRequest): string | null {
  const auth = request.headers.get('authorization') || ''
  const m = auth.match(/^Bearer\s+(.+)$/i)
  if (m) return m[1].trim()
  const x = request.headers.get('x-api-key')
  return x ? x.trim() : null
}

/**
 * Verifică cheia PickScan. Întoarce `null` dacă e OK, altfel răspunsul de eroare
 * de trimis direct (401 cheie greșită/lipsă, 503 integrare neconfigurată).
 */
export function verifyPickscanKey(request: NextRequest): NextResponse | null {
  const expected = (process.env.PICKSCAN_API_KEY || '').trim()
  if (!expected) {
    return NextResponse.json(
      { success: false, code: 'not_configured', message: 'Integrarea PickScan nu este configurată (PICKSCAN_API_KEY lipsă).' },
      { status: 503 }
    )
  }
  const provided = extractKey(request)
  if (!provided) {
    return NextResponse.json(
      { success: false, code: 'unauthorized', message: 'Lipsește cheia API.' },
      { status: 401 }
    )
  }
  const a = Buffer.from(provided)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return NextResponse.json(
      { success: false, code: 'unauthorized', message: 'Cheie API invalidă.' },
      { status: 401 }
    )
  }
  return null
}

/** Forma unui retur așa cum o vede PickScan — doar ce-i trebuie la recepție. */
export function toPickscanReturn(ret: Return, shop: string) {
  return {
    idRetur: ret.idRetur,
    awbNumber: ret.awbNumber || null,
    numarComanda: ret.numarComanda,
    shop,
    status: ret.status,
    statusLabel: RETURN_STATUS_LABEL[ret.status],
    metodaTrimitere: ret.refundData?.metodaTrimitere || null,
    createdAt: ret.createdAt,
  }
}
