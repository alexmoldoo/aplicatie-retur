import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getSessionFromCookies } from '@/lib/auth'
import { findUserById } from '@/lib/db'

export async function GET() {
  try {
    const cookieStore = await cookies()
    const session = await getSessionFromCookies(cookieStore)
    const authenticated = session !== null
    
    let user = null
    if (authenticated && session) {
      user = await findUserById(session.userId)
    }

    return NextResponse.json({
      authenticated,
      user: user ? {
        id: user.id,
        nume: user.nume,
        prenume: user.prenume,
        email: user.email,
      } : null,
    })
  } catch (error: any) {
    console.error('Error in /api/auth/check:', error)
    return NextResponse.json({
      authenticated: false,
      user: null,
    }, { status: 500 })
  }
}

