import { NextRequest, NextResponse } from 'next/server'
import { verifyPickscanKey } from '@/lib/pickscan'
import {
  RETURN_STATUS_LIST,
  RETURN_STATUS_LABEL,
  STATUS_RANK,
  TERMINAL_STATUSES,
  AUTO_STATUSES,
  RECEPTION_STATUSES,
} from '@/lib/return-status'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * GET /api/integrations/pickscan/statuses
 * Lista statusurilor + care pot fi puse de un operator la recepție.
 */
export async function GET(request: NextRequest) {
  const denied = verifyPickscanKey(request)
  if (denied) return denied

  const statuses = RETURN_STATUS_LIST.map(code => ({
    code,
    label: RETURN_STATUS_LABEL[code],
    rank: STATUS_RANK[code],
    terminal: TERMINAL_STATUSES.has(code),
    auto: AUTO_STATUSES.has(code),
    receptionSettable: RECEPTION_STATUSES.includes(code),
  }))

  return NextResponse.json({
    success: true,
    statuses,
    receptionSettable: [...RECEPTION_STATUSES],
  })
}
