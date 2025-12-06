import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { findReturnById, deleteReturn } from '@/lib/db'
import { getCurrentUserFromCookies } from '@/lib/auth'
import fs from 'fs'

/**
 * GET - Obține detalii despre un retur specific
 */
export async function GET(
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

    const returnData = await findReturnById(params.id)
    
    if (!returnData) {
      return NextResponse.json(
        { success: false, message: 'Return not found' },
        { status: 404 }
      )
    }
    
    return NextResponse.json({
      success: true,
      return: returnData,
    })
  } catch (error) {
    console.error('Error getting return:', error)
    return NextResponse.json(
      { success: false, message: 'Error getting return' },
      { status: 500 }
    )
  }
}

/**
 * PUT - Actualizează complet un retur
 */
export async function PUT(
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
    const {
      orderData,
      products,
      refundData,
      totalRefund,
      status,
      awbNumber,
      shippingReceiptPhoto,
      packageLabelPhoto,
    } = body

    const { updateReturn } = await import('@/lib/db')
    const updatedReturn = await updateReturn(params.id, {
      orderData,
      products,
      refundData,
      totalRefund,
      status,
      awbNumber,
      shippingReceiptPhoto,
      packageLabelPhoto,
    })
    
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
    console.error('Error updating return:', error)
    return NextResponse.json(
      { success: false, message: 'Error updating return' },
      { status: 500 }
    )
  }
}

/**
 * DELETE - Șterge un retur
 */
export async function DELETE(
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

    const success = await deleteReturn(params.id)
    
    if (!success) {
      return NextResponse.json(
        { success: false, message: 'Return not found' },
        { status: 404 }
      )
    }
    
    return NextResponse.json({
      success: true,
      message: 'Return deleted successfully',
    })
  } catch (error) {
    console.error('Error deleting return:', error)
    return NextResponse.json(
      { success: false, message: 'Error deleting return' },
      { status: 500 }
    )
  }
}

