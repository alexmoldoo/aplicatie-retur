import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { findUserByEmail, verifyPassword } from '@/lib/db'
import { createSessionWithCookies } from '@/lib/auth'
import { logAudit } from '@/lib/audit'
import { getClientIp, makeRateLimiter, formatWaitTime } from '@/lib/security'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// Max 5 încercări login / 10 minute / IP — protecție contra brute-force
const checkLoginRateLimit = makeRateLimiter({ max: 5, windowMs: 10 * 60_000 })

export async function POST(request: NextRequest) {
  const ip = getClientIp(request)

  try {
    const rl = checkLoginRateLimit(ip)
    if (!rl.allowed) {
      await logAudit({ action: 'admin_login_fail', ip, details: { reason: 'rate_limited' } })
      return NextResponse.json(
        {
          success: false,
          message: `Prea multe încercări. Aștepți ${formatWaitTime(rl.retryAfter)}.`,
        },
        { status: 429, headers: { 'Retry-After': String(rl.retryAfter) } }
      )
    }

    const body = await request.json()
    const { email, password } = body

    // Validări
    if (!email || !password) {
      return NextResponse.json(
        { success: false, message: 'Email și parolă sunt obligatorii' },
        { status: 400 }
      )
    }

    // Găsește utilizatorul
    const user = await findUserByEmail(email)

    if (!user) {
      await logAudit({ action: 'admin_login_fail', ip, details: { email, reason: 'user_not_found' } })
      return NextResponse.json(
        { success: false, message: 'Email sau parolă incorectă' },
        { status: 401 }
      )
    }

    // Verifică parola
    if (!(await verifyPassword(password, user.passwordHash))) {
      await logAudit({ action: 'admin_login_fail', ip, details: { email, reason: 'wrong_password' } })
      return NextResponse.json(
        { success: false, message: 'Email sau parolă incorectă' },
        { status: 401 }
      )
    }

    // Creează sesiune folosind cookieStore direct
    const cookieStore = await cookies()
    createSessionWithCookies(user.id, user.email, cookieStore)

    await logAudit({ action: 'admin_login_success', ip, details: { email } })

    return NextResponse.json({
      success: true,
      message: 'Autentificare reușită',
      user: {
        id: user.id,
        nume: user.nume,
        prenume: user.prenume,
        email: user.email,
      },
    })
  } catch (error: any) {
    console.error('Error in login API:', error)
    return NextResponse.json(
      { success: false, message: 'Eroare la procesarea cererii', error: error?.message },
      { status: 500 }
    )
  }
}

