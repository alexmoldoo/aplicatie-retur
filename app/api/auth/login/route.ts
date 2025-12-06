import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { findUserByEmail, verifyPassword } from '@/lib/db'
import { createSessionWithCookies } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, password } = body

    // Validări
    if (!email || !password) {
      return NextResponse.json(
        { success: false, message: 'Email și parolă sunt obligatorii' },
        { status: 400 }
      )
    }

    // Găsește utilizatorul
    const user = await findUserByEmail(email)
    
    if (!user) {
      return NextResponse.json(
        { success: false, message: 'Email sau parolă incorectă' },
        { status: 401 }
      )
    }

    // Verifică parola
    if (!verifyPassword(password, user.passwordHash)) {
      return NextResponse.json(
        { success: false, message: 'Email sau parolă incorectă' },
        { status: 401 }
      )
    }

    // Creează sesiune folosind cookieStore direct
    const cookieStore = await cookies()
    createSessionWithCookies(user.id, user.email, cookieStore)

    return NextResponse.json({
      success: true,
      message: 'Autentificare reușită',
      user: {
        id: user.id,
        nume: user.nume,
        prenume: user.prenume,
        email: user.email,
      },
    })
  } catch (error: any) {
    console.error('Error in login API:', error)
    return NextResponse.json(
      { success: false, message: 'Eroare la procesarea cererii', error: error?.message },
      { status: 500 }
    )
  }
}

