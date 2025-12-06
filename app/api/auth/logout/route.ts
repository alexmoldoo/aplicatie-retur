import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { destroySessionFromCookies } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function POST() {
  try {
    const cookieStore = await cookies()
    destroySessionFromCookies(cookieStore)
    
    return NextResponse.json({
      success: true,
      message: 'Deconectare reușită',
    })
  } catch (error: any) {
    console.error('Error in logout API:', error)
    return NextResponse.json(
      { success: false, message: 'Eroare la deconectare', error: error?.message },
      { status: 500 }
    )
  }
}

