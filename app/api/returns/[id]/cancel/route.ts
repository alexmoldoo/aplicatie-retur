import { NextRequest, NextResponse } from 'next/server'
import { findReturnById, updateReturnStatus } from '@/lib/db'
import { verifyCustomerToken } from '@/lib/customer-session'
import { logAudit } from '@/lib/audit'
import { getClientIp, makeRateLimiter, isAllowedOrigin, formatWaitTime } from '@/lib/security'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// Max 5 anulări / 10 minute / IP — protecție brute-force pe ID-uri de retur
const checkCancelRateLimit = makeRateLimiter({ max: 5, windowMs: 10 * 60_000 })

/**
 * Anulare retur de către client.
 * Auth: sessionToken emis la /api/search-order. Token-ul trebuie să corespundă
 * comenzii pe care e atașat returul. Permis doar dacă coletul nu a fost încă primit.
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params
  const ip = getClientIp(request)

  try {
    if (!isAllowedOrigin(request)) {
      await logAudit({ action: 'return_cancel_denied', ip, details: { idRetur: id, reason: 'origin_blocked' } })
      return NextResponse.json({ success: false, message: 'Acces refuzat.' }, { status: 403 })
    }

    const rl = checkCancelRateLimit(ip)
    if (!rl.allowed) {
      await logAudit({ action: 'return_cancel_denied', ip, details: { idRetur: id, reason: 'rate_limited' } })
      return NextResponse.json(
        {
          success: false,
          message: `Prea multe încercări de anulare. Aștepți ${formatWaitTime(rl.retryAfter)}.`,
        },
        { status: 429, headers: { 'Retry-After': String(rl.retryAfter) } }
      )
    }

    const body = await request.json().catch(() => ({}))
    const sessionToken: string | undefined = body?.sessionToken

    const session = verifyCustomerToken(sessionToken)
    if (!session) {
      return NextResponse.json(
        { success: false, message: 'Sesiune expirată. Reia căutarea comenzii și încearcă din nou.' },
        { status: 401 }
      )
    }

    const ret = await findReturnById(id)
    if (!ret) {
      return NextResponse.json(
        { success: false, message: 'Returul nu a fost găsit.' },
        { status: 404 }
      )
    }

    // Token-ul trebuie să fie pentru aceeași comandă
    if (ret.numarComanda !== session.numarComanda) {
      await logAudit({ action: 'return_cancel_denied', ip, details: { idRetur: id, reason: 'token_order_mismatch' } })
      return NextResponse.json(
        { success: false, message: 'Acest token nu corespunde acestui retur.' },
        { status: 403 }
      )
    }

    // Anulare permisă doar înainte ca pachetul să fi fost preluat de curier
    const statusCancellable = ret.status === 'INITIAT'
    if (!statusCancellable) {
      return NextResponse.json(
        {
          success: false,
          message:
            ret.status === 'ANULAT'
              ? 'Returul este deja anulat.'
              : 'Returul nu mai poate fi anulat — coletul a fost preluat sau procesat. Contactează-ne pe info@maxari.ro.',
        },
        { status: 409 }
      )
    }

    // Cu AWB deja emis (metoda „curier"), SameDay poate să fi facturat pickup-ul →
    // anularea trebuie aprobată manual de admin. Pentru self-cancel cerem absența AWB-ului.
    if (ret.awbNumber) {
      await logAudit({
        action: 'return_cancel_denied',
        ip,
        details: { idRetur: id, reason: 'awb_already_generated', awbNumber: ret.awbNumber },
      })
      return NextResponse.json(
        {
          success: false,
          message:
            'Pentru acest retur am generat deja AWB-ul de curier. Anularea trebuie aprobată manual — trimite-ne un email la info@maxari.ro cu numărul comenzii și motivul.',
          requiresAdminApproval: true,
        },
        { status: 409 }
      )
    }

    const updated = await updateReturnStatus(id, 'ANULAT')
    if (!updated) {
      return NextResponse.json(
        { success: false, message: 'Eroare la anularea returului.' },
        { status: 500 }
      )
    }

    await logAudit({
      action: 'return_cancel_customer',
      ip,
      details: { idRetur: id, numarComanda: ret.numarComanda, previousStatus: ret.status },
    })

    return NextResponse.json({
      success: true,
      message: 'Returul a fost anulat. Poți iniția unul nou când dorești.',
      idRetur: updated.idRetur,
      status: updated.status,
    })
  } catch (error) {
    console.error('Error cancelling return:', error)
    return NextResponse.json(
      { success: false, message: 'Eroare la anularea returului.' },
      { status: 500 }
    )
  }
}
