import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getCurrentUserFromCookies } from '@/lib/auth'
import { logAudit } from '@/lib/audit'
import { getClientIp } from '@/lib/security'
import { insertGeneratedCode, listCodes, type CodeKind } from '@/lib/return-codes'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const MAX_PER_BATCH = 50

/**
 * GET /api/admin/codes — listă coduri pentru pagina admin.
 * Query: ?status=all|active|used|inactive, ?search=
 */
export async function GET(request: NextRequest) {
  const cookieStore = await cookies()
  const user = await getCurrentUserFromCookies(cookieStore)
  if (!user) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const status = (searchParams.get('status') || 'all') as 'all' | 'active' | 'used' | 'inactive' | 'sent' | 'not_sent'
  const search = searchParams.get('search') || undefined

  try {
    const codes = await listCodes({ status, search })
    return NextResponse.json({ success: true, codes })
  } catch (e) {
    console.error('GET /api/admin/codes error:', e)
    return NextResponse.json(
      { success: false, message: e instanceof Error ? e.message : 'Eroare la listare.' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/admin/codes — generează 1..MAX_PER_BATCH coduri noi.
 * Body: { count?: number, note?: string }
 */
export async function POST(request: NextRequest) {
  const ip = getClientIp(request)
  const cookieStore = await cookies()
  const user = await getCurrentUserFromCookies(cookieStore)
  if (!user) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 })
  }

  let body: { count?: number; note?: string; kind?: string }
  try {
    body = await request.json()
  } catch {
    body = {}
  }

  const count = Math.min(Math.max(Number.isFinite(body.count) ? Number(body.count) : 1, 1), MAX_PER_BATCH)
  const note = typeof body.note === 'string' ? body.note.slice(0, 500) : null
  const kind: CodeKind = body.kind === 'direct_refund' ? 'direct_refund' : 'free_shipping'

  try {
    const created: string[] = []
    for (let i = 0; i < count; i++) {
      const code = await insertGeneratedCode({ kind, note, createdBy: user.id })
      created.push(code)
    }
    await logAudit({
      action: 'admin_code_generated',
      ip,
      details: { count: created.length, kind, note: note || null, by: user.email, codes: created },
    })
    return NextResponse.json({ success: true, codes: created, kind })
  } catch (e) {
    console.error('POST /api/admin/codes error:', e)
    return NextResponse.json(
      { success: false, message: e instanceof Error ? e.message : 'Eroare la generare.' },
      { status: 500 }
    )
  }
}
