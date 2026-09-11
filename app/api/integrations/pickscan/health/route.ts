import { NextRequest, NextResponse } from 'next/server'
import { verifyPickscanKey } from '@/lib/pickscan'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * GET /api/integrations/pickscan/health
 * Verifică că aplicația răspunde ȘI că cheia e corectă (cheie greșită → 401).
 */
export async function GET(request: NextRequest) {
  const denied = verifyPickscanKey(request)
  if (denied) return denied
  return NextResponse.json({
    success: true,
    ok: true,
    app: 'aplicatie-retur',
    time: new Date().toISOString(),
  })
}
