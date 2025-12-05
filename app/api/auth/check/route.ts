import { NextResponse } from 'next/server'
import { isAuthenticated, getCurrentUser } from '@/lib/auth'

export async function GET() {
  try {
    const authenticated = await isAuthenticated()
    const user = authenticated ? await getCurrentUser() : null

    return NextResponse.json({
      authenticated,
      user: user ? {
        id: user.id,
        nume: user.nume,
        prenume: user.prenume,
        email: user.email,
      } : null,
    })
  } catch (error) {
    return NextResponse.json({
      authenticated: false,
      user: null,
    })
  }
}

