import { NextRequest, NextResponse } from 'next/server'
import { authenticate } from '@/lib/auth'

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

    // Autentifică utilizatorul
    const user = await authenticate(email, password)

    if (!user) {
      return NextResponse.json(
        { success: false, message: 'Email sau parolă incorectă' },
        { status: 401 }
      )
    }

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
  } catch (error) {
    console.error('Error in login API:', error)
    return NextResponse.json(
      { success: false, message: 'Eroare la procesarea cererii' },
      { status: 500 }
    )
  }
}

