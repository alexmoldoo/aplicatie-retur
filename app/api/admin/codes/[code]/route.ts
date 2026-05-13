import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getCurrentUserFromCookies } from '@/lib/auth'
import { logAudit } from '@/lib/audit'
import { getClientIp } from '@/lib/security'
import { deleteCode, normalizeCode, toggleCodeActive } from '@/lib/return-codes'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * PATCH /api/admin/codes/[code] — toggle active.
 * Body: { active: boolean }
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const ip = getClientIp(request)
  const cookieStore = await cookies()
  const user = await getCurrentUserFromCookies(cookieStore)
  if (!user) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 })
  }

  const { code: rawCode } = await params
  const code = normalizeCode(rawCode)
  if (!code) {
    return NextResponse.json({ success: false, message: 'Cod invalid.' }, { status: 400 })
  }

  let body: { active?: unknown }
  try {
    body = await request.json()
  } catch {
    body = {}
  }
  if (typeof body.active !== 'boolean') {
    return NextResponse.json({ success: false, message: 'Lipsește câmpul active (boolean).' }, { status: 400 })
  }

  const updated = await toggleCodeActive(code, body.active)
  if (!updated) {
    return NextResponse.json(
      { success: false, message: 'Codul nu există sau este deja folosit.' },
      { status: 404 }
    )
  }

  await logAudit({
    action: 'admin_code_toggled',
    ip,
    details: { code, active: body.active, by: user.email },
  })
  return NextResponse.json({ success: true, code: updated })
}

/**
 * DELETE /api/admin/codes/[code] — șterge un cod nefolosit.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const ip = getClientIp(request)
  const cookieStore = await cookies()
  const user = await getCurrentUserFromCookies(cookieStore)
  if (!user) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 })
  }

  const { code: rawCode } = await params
  const code = normalizeCode(rawCode)
  if (!code) {
    return NextResponse.json({ success: false, message: 'Cod invalid.' }, { status: 400 })
  }

  const ok = await deleteCode(code)
  if (!ok) {
    return NextResponse.json(
      { success: false, message: 'Codul nu există sau este deja folosit (nu poate fi șters).' },
      { status: 400 }
    )
  }

  await logAudit({
    action: 'admin_code_deleted',
    ip,
    details: { code, by: user.email },
  })
  return NextResponse.json({ success: true })
}
