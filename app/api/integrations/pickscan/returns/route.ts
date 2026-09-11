import { NextRequest, NextResponse } from 'next/server'
import { getReturns, getConfig } from '@/lib/db'
import { TERMINAL_STATUSES } from '@/lib/return-status'
import { verifyPickscanKey, toPickscanReturn } from '@/lib/pickscan'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * GET /api/integrations/pickscan/returns
 * Retururile DESCHISE (ne-terminale: nu FINALIZAT / ANULAT), cele mai noi primele.
 * Opțional `?limit=N`. Retururile rezolvate nu apar — PickScan n-are nevoie de ele.
 */
export async function GET(request: NextRequest) {
  const denied = verifyPickscanKey(request)
  if (denied) return denied

  const limitRaw = Number(request.nextUrl.searchParams.get('limit'))
  const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.floor(limitRaw) : null

  const [all, config] = await Promise.all([getReturns(), getConfig()])
  const shop = config.shopify.shopTitle || config.shopify.domain || ''

  let open = all
    .filter(r => !TERMINAL_STATUSES.has(r.status))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  if (limit) open = open.slice(0, limit)

  return NextResponse.json({
    success: true,
    count: open.length,
    returns: open.map(r => toPickscanReturn(r, shop)),
  })
}
