import { NextRequest, NextResponse } from 'next/server'
import { createUser } from '@/lib/db'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { nume, prenume, email, password, confirmPassword } = body

    // Validări
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

    if (password.length < 6) {
      return NextResponse.json(
        { success: false, message: 'Parola trebuie să aibă cel puțin 6 caractere' },
        { status: 400 }
      )
    }

    // Creează utilizatorul
    try {
      const user = createUser(nume, prenume, email, password)
      
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
  } catch (error) {
    console.error('Error in register API:', error)
    return NextResponse.json(
      { success: false, message: 'Eroare la procesarea cererii' },
      { status: 500 }
    )
  }
}

