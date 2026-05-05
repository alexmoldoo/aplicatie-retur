import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { countUsers, createUser } from '@/lib/db'
import { createSessionWithCookies } from '@/lib/auth'
import { logAudit } from '@/lib/audit'
import { getClientIp } from '@/lib/security'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * Înregistrare cont admin.
 *
 * Bootstrap-only: permis DOAR când în DB nu există niciun user (primul cont).
 * După primul admin, endpoint-ul răspunde 403 — adminii noi se adaugă manual
 * (din baza de date) sau printr-un viitor invite-flow autentificat.
 */
export async function POST(request: NextRequest) {
  const ip = getClientIp(request)
  try {
    const existingUsers = await countUsers()
    if (existingUsers > 0) {
      await logAudit({
        action: 'register_denied',
        ip,
        details: { reason: 'registration_locked', existingUsers },
      })
      return NextResponse.json(
        {
          success: false,
          message:
            'Înregistrarea publică este dezactivată. Contul de admin există deja — folosește pagina de login.',
        },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { nume, prenume, email, password, confirmPassword } = body

    if (!nume || !prenume || !email || !password || !confirmPassword) {
      return NextResponse.json(
        { success: false, message: 'Toate câmpurile sunt obligatorii' },
        { status: 400 }
      )
    }

    if (password !== confirmPassword) {
      return NextResponse.json(
        { success: false, message: 'Parolele nu se potrivesc' },
        { status: 400 }
      )
    }

    if (password.length < 12) {
      return NextResponse.json(
        { success: false, message: 'Parola trebuie să aibă cel puțin 12 caractere' },
        { status: 400 }
      )
    }

    try {
      const user = await createUser(nume, prenume, email, password)

      const cookieStore = await cookies()
      createSessionWithCookies(user.id, user.email, cookieStore)

      await logAudit({
        action: 'register_bootstrap',
        ip,
        details: { userId: user.id, email: user.email },
      })

      return NextResponse.json({
        success: true,
        message: 'Cont creat cu succes',
        user: {
          id: user.id,
          nume: user.nume,
          prenume: user.prenume,
          email: user.email,
        },
      })
    } catch (error: any) {
      return NextResponse.json(
        { success: false, message: error.message || 'Eroare la crearea contului' },
        { status: 400 }
      )
    }
  } catch (error: any) {
    console.error('Error in register API:', error)
    return NextResponse.json(
      { success: false, message: 'Eroare la procesarea cererii', error: error?.message },
      { status: 500 }
    )
  }
}
