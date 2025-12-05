import { NextResponse } from 'next/server'
import { destroySession } from '@/lib/auth'

export async function POST() {
  try {
    await destroySession()
    
    return NextResponse.json({
      success: true,
      message: 'Deconectare reușită',
    })
  } catch (error) {
    console.error('Error in logout API:', error)
    return NextResponse.json(
      { success: false, message: 'Eroare la deconectare' },
      { status: 500 }
    )
  }
}

