import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getReturns } from '@/lib/db'
import { getCurrentUserFromCookies } from '@/lib/auth'

/**
 * GET - Obține lista tuturor retururilor
 */
export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const user = await getCurrentUserFromCookies(cookieStore)
    
    if (!user) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    
    let returns = await getReturns()
    
    // Filtrare după status dacă este specificat
    if (status) {
      returns = returns.filter(r => r.status === status)
    }
    
    // Sortare după data creării (cel mai recent primul)
    returns.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    
    return NextResponse.json({
      success: true,
      returns,
    })
  } catch (error) {
    console.error('Error getting returns:', error)
    return NextResponse.json(
      { success: false, message: 'Error getting returns' },
      { status: 500 }
    )
  }
}


