import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { findReturnById, updateReturnStatus, updateReturn } from '@/lib/db'
import { getCurrentUserFromCookies } from '@/lib/auth'
import { logAudit } from '@/lib/audit'
import { getClientIp } from '@/lib/security'
import { isReturnStatus, RETURN_STATUS_LABEL, type ReturnStatus } from '@/lib/return-status'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * PATCH - Schimbare manuală a statusului unui retur (admin).
 * Loghează auditul cu (from, to, user). `motiv` e opțional (max 500).
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const ip = getClientIp(request)
  try {
    const cookieStore = await cookies()
    const user = await getCurrentUserFromCookies(cookieStore)

    if (!user) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json().catch(() => ({}))
    const status: unknown = body?.status
    const motivRaw: unknown = body?.motiv
    const motiv = typeof motivRaw === 'string' ? motivRaw.trim() : ''

    if (typeof status !== 'string' || !isReturnStatus(status)) {
      return NextResponse.json(
        { success: false, message: 'Status invalid.' },
        { status: 400 }
      )
    }

    if (motiv.length > 500) {
      return NextResponse.json(
        { success: false, message: 'Motivul este prea lung (maxim 500 caractere).' },
        { status: 400 }
      )
    }

    const existing = await findReturnById(params.id)
    if (!existing) {
      return NextResponse.json(
        { success: false, message: 'Retur inexistent.' },
        { status: 404 }
      )
    }

    const fromStatus = existing.status
    const toStatus = status as ReturnStatus

    if (toStatus === 'IN_PLATA') {
      return NextResponse.json(
        { success: false, message: 'Statusul „În plată" se setează din „Plăți retururi", la generarea fișierului.' },
        { status: 400 }
      )
    }

    // Un retur aflat într-un fișier de plăți poate doar să fie finalizat de aici.
    // Orice altă mutare l-ar putea readuce în lista de plată → plată dublă.
    if (fromStatus === 'IN_PLATA' && toStatus !== 'FINALIZAT') {
      return NextResponse.json(
        { success: false, message: 'Returul este într-un fișier de plăți. Anulează lotul din „Plăți retururi" ca să-i schimbi statusul.' },
        { status: 409 }
      )
    }

    if (fromStatus === toStatus) {
      return NextResponse.json(
        { success: false, message: 'Returul este deja în acest status.' },
        { status: 409 }
      )
    }

    // La FINALIZAT reținem și data: e momentul în care banii au plecat (pentru totaluri).
    const updated = toStatus === 'FINALIZAT'
      ? await updateReturn(params.id, {
          status: toStatus,
          refundData: {
            ...existing.refundData,
            finalizatLa: existing.refundData?.finalizatLa || new Date().toISOString(),
            ...(existing.refundData?.plata && !existing.refundData.plata.platitLa
              ? { plata: { ...existing.refundData.plata, platitLa: new Date().toISOString() } }
              : {}),
          },
        })
      : await updateReturnStatus(params.id, toStatus)
    if (!updated) {
      return NextResponse.json(
        { success: false, message: 'Eroare la actualizarea statusului.' },
        { status: 500 }
      )
    }

    await logAudit({
      action: 'admin_status_change',
      ip,
      details: {
        idRetur: params.id,
        from: fromStatus,
        to: toStatus,
        fromLabel: RETURN_STATUS_LABEL[fromStatus],
        toLabel: RETURN_STATUS_LABEL[toStatus],
        ...(motiv ? { motiv } : {}),
        userId: user.id,
        userEmail: user.email,
      },
    })

    return NextResponse.json({
      success: true,
      return: updated,
    })
  } catch (error) {
    console.error('Error updating return status:', error)
    return NextResponse.json(
      { success: false, message: 'Eroare la actualizarea statusului.' },
      { status: 500 }
    )
  }
}
