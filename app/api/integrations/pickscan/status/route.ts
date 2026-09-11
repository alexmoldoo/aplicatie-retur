import { NextRequest, NextResponse } from 'next/server'
import { findReturnById, findReturnByAwb, updateReturnStatus, getConfig } from '@/lib/db'
import { logAudit, findAuditEntryByDetail } from '@/lib/audit'
import { getClientIp } from '@/lib/security'
import { verifyPickscanKey, toPickscanReturn } from '@/lib/pickscan'
import {
  isReturnStatus,
  RECEPTION_STATUSES,
  STATUS_RANK,
  RETURN_STATUS,
  RETURN_STATUS_LABEL,
  type ReturnStatus,
} from '@/lib/return-status'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * POST /api/integrations/pickscan/status
 *
 * body: {
 *   idRetur?: string,        // sau
 *   awb?: string,            // AWB-ul scanat
 *   status: string,          // trebuie să fie în RECEPTION_STATUSES (ex. PRIMIT)
 *   scanId: string,          // identificator unic al scanării (idempotență)
 *   scannedAt?: string,      // ISO 8601
 *   operatorEmail?: string,
 *   note?: string            // max 500
 * }
 *
 * Reguli: nu se merge înapoi în flux; ANULAT → 409; același status → changed:false;
 * același scanId → duplicate:true (nu se întâmplă nimic a doua oară).
 */
export async function POST(request: NextRequest) {
  const denied = verifyPickscanKey(request)
  if (denied) return denied

  const ip = getClientIp(request)
  const body = await request.json().catch(() => ({}))

  const idRetur = typeof body.idRetur === 'string' ? body.idRetur.trim() : ''
  const awb = typeof body.awb === 'string' ? body.awb.trim() : ''
  const statusRaw = typeof body.status === 'string' ? body.status.trim().toUpperCase() : ''
  const scanId = typeof body.scanId === 'string' ? body.scanId.trim() : ''
  const scannedAt = typeof body.scannedAt === 'string' ? body.scannedAt.trim() : ''
  const operatorEmail = typeof body.operatorEmail === 'string' ? body.operatorEmail.trim() : ''
  const note = typeof body.note === 'string' ? body.note.trim() : ''

  if (!idRetur && !awb) {
    return NextResponse.json(
      { success: false, code: 'missing_identifier', message: 'Trimite idRetur sau awb.' },
      { status: 400 }
    )
  }
  if (!scanId) {
    return NextResponse.json(
      { success: false, code: 'missing_scan_id', message: 'scanId este obligatoriu.' },
      { status: 400 }
    )
  }
  if (!isReturnStatus(statusRaw) || !RECEPTION_STATUSES.includes(statusRaw)) {
    return NextResponse.json(
      {
        success: false,
        code: 'status_not_allowed',
        message: `Statusul „${statusRaw || '(gol)'}" nu poate fi setat la recepție.`,
        allowed: [...RECEPTION_STATUSES],
      },
      { status: 400 }
    )
  }
  const toStatus = statusRaw as ReturnStatus
  if (note.length > 500) {
    return NextResponse.json(
      { success: false, code: 'note_too_long', message: 'Nota este prea lungă (max 500).' },
      { status: 400 }
    )
  }
  if (scannedAt && Number.isNaN(new Date(scannedAt).getTime())) {
    return NextResponse.json(
      { success: false, code: 'invalid_scanned_at', message: 'scannedAt trebuie să fie ISO 8601.' },
      { status: 400 }
    )
  }

  // Idempotență: același scanId procesat deja → răspuns identic, fără efecte.
  const dup = await findAuditEntryByDetail('pickscan_status_change', 'scanId', scanId)
  if (dup) {
    return NextResponse.json({
      success: true,
      duplicate: true,
      changed: false,
      idRetur: dup.details?.idRetur || null,
      status: dup.details?.to || null,
      message: 'Scanare deja procesată.',
    })
  }

  const ret = idRetur ? await findReturnById(idRetur) : await findReturnByAwb(awb)
  if (!ret) {
    return NextResponse.json(
      {
        success: false,
        code: 'not_found',
        message: idRetur ? 'Retur inexistent.' : 'AWB-ul nu aparține niciunei cereri de retur.',
      },
      { status: 404 }
    )
  }

  const config = await getConfig()
  const shop = config.shopify.shopTitle || config.shopify.domain || ''
  const fromStatus = ret.status

  if (fromStatus === RETURN_STATUS.ANULAT) {
    return NextResponse.json(
      {
        success: false,
        code: 'cancelled',
        message: `Returul ${ret.idRetur} este ANULAT — coletul nu era așteptat.`,
        return: toPickscanReturn(ret, shop),
      },
      { status: 409 }
    )
  }

  if (fromStatus === toStatus) {
    return NextResponse.json({
      success: true,
      changed: false,
      duplicate: false,
      message: `Returul este deja „${RETURN_STATUS_LABEL[toStatus]}".`,
      return: toPickscanReturn(ret, shop),
    })
  }

  if (STATUS_RANK[fromStatus] > STATUS_RANK[toStatus]) {
    return NextResponse.json(
      {
        success: false,
        code: 'backwards',
        message: `Returul este deja „${RETURN_STATUS_LABEL[fromStatus]}" — nu se poate întoarce la „${RETURN_STATUS_LABEL[toStatus]}".`,
        return: toPickscanReturn(ret, shop),
      },
      { status: 409 }
    )
  }

  const updated = await updateReturnStatus(ret.idRetur, toStatus)
  if (!updated) {
    return NextResponse.json(
      { success: false, code: 'update_failed', message: 'Eroare la actualizarea statusului.' },
      { status: 500 }
    )
  }

  await logAudit({
    action: 'pickscan_status_change',
    ip,
    details: {
      idRetur: ret.idRetur,
      awbNumber: ret.awbNumber || null,
      from: fromStatus,
      to: toStatus,
      fromLabel: RETURN_STATUS_LABEL[fromStatus],
      toLabel: RETURN_STATUS_LABEL[toStatus],
      scanId,
      ...(scannedAt ? { scannedAt } : {}),
      ...(operatorEmail ? { operatorEmail } : {}),
      ...(note ? { note } : {}),
      source: 'pickscan',
    },
  })

  return NextResponse.json({
    success: true,
    changed: true,
    duplicate: false,
    previousStatus: fromStatus,
    message: `Retur ${ret.idRetur}: „${RETURN_STATUS_LABEL[fromStatus]}" → „${RETURN_STATUS_LABEL[toStatus]}".`,
    return: toPickscanReturn(updated, shop),
  })
}
