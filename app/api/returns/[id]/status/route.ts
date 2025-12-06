import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { updateReturnStatus } from '@/lib/db'
import { getCurrentUserFromCookies } from '@/lib/auth'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * PATCH - Actualizează statusul unui retur
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const cookieStore = await cookies()
    const user = await getCurrentUserFromCookies(cookieStore)
    
    if (!user) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { status } = body
    
    if (!status || !['INITIAT', 'IN_ASTEPTARE_COLET', 'COLET_PRIMIT', 'PROCESAT', 'FINALIZAT', 'ANULAT'].includes(status)) {
      return NextResponse.json(
        { success: false, message: 'Invalid status' },
        { status: 400 }
      )
    }

    const updatedReturn = await updateReturnStatus(params.id, status as any)
    
    if (!updatedReturn) {
      return NextResponse.json(
        { success: false, message: 'Return not found' },
        { status: 404 }
      )
    }
    
    return NextResponse.json({
      success: true,
      return: updatedReturn,
    })
  } catch (error) {
    console.error('Error updating return status:', error)
    return NextResponse.json(
      { success: false, message: 'Error updating return status' },
      { status: 500 }
    )
  }
}

