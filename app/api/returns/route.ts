import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getReturnsLight } from '@/lib/db'
import { getCurrentUserFromCookies } from '@/lib/auth'
import { isReturnStatus } from '@/lib/return-status'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * GET /api/returns — lista „ușoară" de retururi pentru admin (fără semnătură,
 * QR, poze, produse; acelea se încarcă doar pe pagina returului).
 *
 *   ?since=<ISO>   doar retururile modificate după acel moment (sincronizare
 *                  incrementală; dacă baza nu are încă `updated_at`, întoarce
 *                  lista întreagă și `supportsSince: false`)
 *   ?status=<COD>  filtrare după status (compatibilitate)
 *
 * Răspuns: { success, returns, serverTime, supportsSince, incremental }
 * `serverTime` e momentul de la care clientul cere data viitoare „ce e nou";
 * e luat cu 2 s înainte de interogare ca să nu se piardă o modificare făcută
 * exact în timpul ei (dublurile se îmbină după id).
 */
export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const { searchParams } = new URL(request.url)
    const sinceRaw = searchParams.get('since')
    const since = sinceRaw && !Number.isNaN(new Date(sinceRaw).getTime()) ? sinceRaw : undefined
    const status = searchParams.get('status')

    const serverTime = new Date(Date.now() - 2000).toISOString()
    // Login + listă în paralel; lista nu pleacă decât dacă userul e logat.
    const [user, light] = await Promise.all([
      getCurrentUserFromCookies(cookieStore),
      getReturnsLight(since),
    ])
    if (!user) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 })
    }
    const { returns: all, supportsSince } = light

    let returns = all
    if (status && isReturnStatus(status)) {
      returns = returns.filter(r => r.status === status)
    }
    returns = [...returns].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

    return NextResponse.json({
      success: true,
      returns,
      serverTime,
      supportsSince,
      incremental: !!since && supportsSince,
    })
  } catch (error) {
    console.error('Error getting returns:', error)
    return NextResponse.json({ success: false, message: 'Error getting returns' }, { status: 500 })
  }
}
