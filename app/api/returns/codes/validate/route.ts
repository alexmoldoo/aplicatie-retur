import { NextRequest, NextResponse } from 'next/server'
import { logAudit } from '@/lib/audit'
import { getClientIp, isAllowedOrigin, makeRateLimiter } from '@/lib/security'
import { isBlocked, recordFail } from '@/lib/ip-blocklist'
import { normalizeCode, validateCodeForRedemption } from '@/lib/return-codes'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// 10 încercări / 15 min / IP — suficient pentru typo + previzualizare,
// previne brute force pe spațiul de 240k combos.
const checkRateLimit = makeRateLimiter({ max: 10, windowMs: 15 * 60_000 })

/**
 * POST /api/returns/codes/validate — preview public, NU redeem-uiește.
 * Body: { code: string }
 * Returnează: { valid: true } sau { valid: false, message }
 */
export async function POST(request: NextRequest) {
  const ip = getClientIp(request)

  const block = isBlocked(ip)
  if (block.blocked) {
    return NextResponse.json(
      { success: false, valid: false, message: 'Acces temporar blocat.' },
      { status: 429, headers: { 'Retry-After': String(block.retryAfterSeconds || 0) } }
    )
  }

  if (!isAllowedOrigin(request)) {
    recordFail(ip)
    return NextResponse.json({ success: false, valid: false, message: 'Acces refuzat.' }, { status: 403 })
  }

  const rl = checkRateLimit(ip)
  if (!rl.allowed) {
    await logAudit({ action: 'code_check_rate_limited', ip, details: { retryAfter: rl.retryAfter } })
    return NextResponse.json(
      { success: false, valid: false, message: 'Prea multe verificări de cod. Reîncearcă mai târziu.' },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfter) } }
    )
  }

  let body: { code?: unknown }
  try {
    body = await request.json()
  } catch {
    body = {}
  }

  const raw = typeof body.code === 'string' ? body.code : ''
  const code = normalizeCode(raw)
  if (!code) {
    await logAudit({ action: 'code_check', ip, details: { result: 'format_invalid' } })
    return NextResponse.json({
      success: true,
      valid: false,
      message: 'Format cod invalid. Așteptat: 4 cifre + 1 literă (ex: 7392K) sau D + 4 cifre + 1 literă (ex: D7392K).',
    })
  }

  try {
    const result = await validateCodeForRedemption(code)
    if (!result.valid) {
      recordFail(ip)
      await logAudit({ action: 'code_check', ip, details: { code, result: result.reason } })
      const messageByReason: Record<string, string> = {
        not_found: 'Cod inexistent.',
        inactive: 'Acest cod a fost dezactivat.',
        used: 'Acest cod a fost deja folosit.',
      }
      return NextResponse.json({
        success: true,
        valid: false,
        message: messageByReason[result.reason || 'not_found'] || 'Cod invalid.',
      })
    }
    await logAudit({ action: 'code_check', ip, details: { code, kind: result.kind, result: 'valid' } })
    return NextResponse.json({ success: true, valid: true, kind: result.kind })
  } catch (e) {
    console.error('POST /api/returns/codes/validate error:', e)
    return NextResponse.json(
      { success: false, valid: false, message: 'Eroare la verificarea codului. Reîncearcă.' },
      { status: 500 }
    )
  }
}
