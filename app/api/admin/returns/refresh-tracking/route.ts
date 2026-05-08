import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getReturns, updateReturnStatus } from '@/lib/db'
import { getCurrentUserFromCookies } from '@/lib/auth'
import { logAudit } from '@/lib/audit'
import { getClientIp } from '@/lib/security'
import { getAWBStatus } from '@/lib/sameday'
import {
  sameDayStatusToInternal,
  STATUS_RANK,
  RETURN_STATUS_LABEL,
  TERMINAL_STATUSES,
  type ReturnStatus,
} from '@/lib/return-status'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * /api/admin/returns/refresh-tracking
 *
 * Iterează retururile cu AWB SameDay activ și aliniază statusul intern cu
 * tracking-ul curierului pentru cele aflate încă în drum (PRELUAT_CURIER /
 * IN_TRANZIT / LIVRAT). Statusurile manuale (PRIMIT, FINALIZAT) și ANULAT nu
 * se ating — odată ce un operator a confirmat primirea, tracking-ul curierului
 * nu mai e sursa de adevăr. STATUS_RANK împiedică „downgrade" accidental.
 *
 * POST → folosit din admin UI (auth prin cookie).
 * GET  → folosit de cron (Vercel Cron) cu `Authorization: Bearer $CRON_SECRET`.
 */

interface RefreshResult {
  processed: number
  updated: number
  skipped: number
  errors: Array<{ idRetur: string; awbNumber: string; error: string }>
  changes: Array<{
    idRetur: string
    from: ReturnStatus
    to: ReturnStatus
    samedayStatus: string | null
    samedayStatusId: number | null
  }>
}

async function runRefresh(triggeredBy: string, ip: string): Promise<RefreshResult> {
  const startedAt = Date.now()
  const all = await getReturns()
  const candidates = all.filter(r => {
    if (!r.awbNumber) return false
    if (TERMINAL_STATUSES.has(r.status)) return false
    if (r.status === 'PRIMIT') return false
    return true
  })

  const result: RefreshResult = {
    processed: candidates.length,
    updated: 0,
    skipped: 0,
    errors: [],
    changes: [],
  }

  for (const ret of candidates) {
    try {
      const tracking = await getAWBStatus(ret.awbNumber!)
      if (!tracking) {
        result.skipped++
        continue
      }

      const mapped = sameDayStatusToInternal({
        expeditionStatusId: tracking.expeditionStatusId,
        expeditionStatus: tracking.expeditionStatus,
      })
      if (!mapped) {
        result.skipped++
        continue
      }

      // Anti-downgrade: aplicăm doar dacă noul status are rang mai mare decât cel curent.
      if (STATUS_RANK[mapped] <= STATUS_RANK[ret.status]) {
        result.skipped++
        continue
      }

      const updatedRet = await updateReturnStatus(ret.idRetur, mapped)
      if (!updatedRet) {
        result.errors.push({ idRetur: ret.idRetur, awbNumber: ret.awbNumber!, error: 'update failed' })
        continue
      }

      result.updated++
      result.changes.push({
        idRetur: ret.idRetur,
        from: ret.status,
        to: mapped,
        samedayStatus: tracking.expeditionStatus,
        samedayStatusId: tracking.expeditionStatusId,
      })

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
          triggeredBy,
        },
      })
    } catch (err: any) {
      result.errors.push({
        idRetur: ret.idRetur,
        awbNumber: ret.awbNumber!,
        error: err?.message || 'unknown',
      })
    }
  }

  await logAudit({
    action: 'auto_status_refresh_run',
    ip,
    details: {
      processed: result.processed,
      updated: result.updated,
      skipped: result.skipped,
      errorsCount: result.errors.length,
      durationMs: Date.now() - startedAt,
      triggeredBy,
    },
  })

  return result
}

export async function POST(request: NextRequest) {
  const ip = getClientIp(request)
  const cookieStore = await cookies()
  const user = await getCurrentUserFromCookies(cookieStore)
  if (!user) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 })
  }
  const result = await runRefresh(user.email, ip)
  return NextResponse.json({ success: true, ...result })
}

/**
 * Orele (Europe/Bucharest) la care cronul rulează efectiv. Restul invocărilor
 * sunt no-op. Cronul Vercel folosește UTC și nu cunoaște DST, așa că-l programăm
 * pe toate orele UTC candidate (vara și iarna) și filtrăm aici.
 */
const CRON_LOCAL_HOURS = [9, 12, 15] as const

function bucharestHour(date = new Date()): number {
  const formatted = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Bucharest',
    hour: 'numeric',
    hour12: false,
  }).format(date)
  return Number.parseInt(formatted, 10)
}

/**
 * Endpoint pentru Vercel Cron / orice scheduler extern.
 * Header obligatoriu: `Authorization: Bearer $CRON_SECRET`.
 * Vercel Cron îl trimite automat dacă e setat env-ul `CRON_SECRET`.
 */
export async function GET(request: NextRequest) {
  const ip = getClientIp(request)
  const secret = process.env.CRON_SECRET
  if (!secret) {
    return NextResponse.json({ success: false, message: 'CRON_SECRET nu e configurat.' }, { status: 503 })
  }
  const auth = request.headers.get('authorization') || ''
  const expected = `Bearer ${secret}`
  if (auth !== expected) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 })
  }

  const hour = bucharestHour()
  if (!CRON_LOCAL_HOURS.includes(hour as (typeof CRON_LOCAL_HOURS)[number])) {
    return NextResponse.json({
      success: true,
      skipped: 'outside_window',
      bucharestHour: hour,
      allowedHours: CRON_LOCAL_HOURS,
    })
  }

  const result = await runRefresh('cron', ip)
  return NextResponse.json({ success: true, bucharestHour: hour, ...result })
}
