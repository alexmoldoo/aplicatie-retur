import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { findReturnById, updateReturnStatus } from '@/lib/db'
import { getCurrentUserFromCookies } from '@/lib/auth'
import { logAudit } from '@/lib/audit'
import { getClientIp } from '@/lib/security'
import { getAWBStatus } from '@/lib/sameday'
import {
  sameDayStatusToInternal,
  STATUS_RANK,
  RETURN_STATUS_LABEL,
  TERMINAL_STATUSES,
} from '@/lib/return-status'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * GET /api/admin/returns/[id]/tracking
 *
 * Întoarce istoricul SameDay pentru un retur și — dacă tracking-ul indică un
 * status mai avansat decât cel intern și returul nu e blocat manual (PRIMIT) sau
 * terminal (FINALIZAT/ANULAT) — actualizează automat statusul.
 *
 * Răspuns: { success, awbNumber, expeditionStatus(Id), history[], appliedStatus? }
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ip = getClientIp(request)
  const cookieStore = await cookies()
  const user = await getCurrentUserFromCookies(cookieStore)
  if (!user) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  const ret = await findReturnById(id)
  if (!ret) {
    return NextResponse.json({ success: false, message: 'Returul nu a fost găsit.' }, { status: 404 })
  }
  if (!ret.awbNumber) {
    return NextResponse.json({
      success: true,
      awbNumber: null,
      expeditionStatusId: null,
      expeditionStatus: null,
      history: [],
      appliedStatus: null,
    })
  }

  const tracking = await getAWBStatus(ret.awbNumber)
  if (!tracking) {
    return NextResponse.json({
      success: true,
      awbNumber: ret.awbNumber,
      expeditionStatusId: null,
      expeditionStatus: null,
      history: [],
      appliedStatus: null,
    })
  }

  let appliedStatus: string | null = null

  // Auto-advance doar pe statusurile non-manuale și non-terminale.
  if (!TERMINAL_STATUSES.has(ret.status) && ret.status !== 'PRIMIT') {
    const mapped = sameDayStatusToInternal({
      expeditionStatusId: tracking.expeditionStatusId,
      expeditionStatus: tracking.expeditionStatus,
    })
    if (mapped && STATUS_RANK[mapped] > STATUS_RANK[ret.status]) {
      const updated = await updateReturnStatus(ret.idRetur, mapped)
      if (updated) {
        appliedStatus = mapped
        await logAudit({
          action: 'auto_status_change',
          ip,
          details: {
            idRetur: ret.idRetur,
            awbNumber: ret.awbNumber,
            from: ret.status,
            to: mapped,
            fromLabel: RETURN_STATUS_LABEL[ret.status],
            toLabel: RETURN_STATUS_LABEL[mapped],
            source: 'sameday',
            samedayStatus: tracking.expeditionStatus,
            samedayStatusId: tracking.expeditionStatusId,
            triggeredBy: user.email,
          },
        })
      }
    }
  }

  return NextResponse.json({
    success: true,
    awbNumber: tracking.awbNumber,
    expeditionStatusId: tracking.expeditionStatusId,
    expeditionStatus: tracking.expeditionStatus,
    history: tracking.history,
    appliedStatus,
  })
}
