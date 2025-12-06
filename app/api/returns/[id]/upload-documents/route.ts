import { NextRequest, NextResponse } from 'next/server'
import { updateReturnDocuments } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'

/**
 * POST - Actualizează documentele unui retur (AWB, poze)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentUser()
    
    if (!user) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { awbNumber, shippingReceiptPhoto, packageLabelPhoto } = body

    const updatedReturn = await updateReturnDocuments(
      params.id,
      awbNumber,
      shippingReceiptPhoto,
      packageLabelPhoto
    )
    
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
    console.error('Error updating return documents:', error)
    return NextResponse.json(
      { success: false, message: 'Error updating return documents' },
      { status: 500 }
    )
  }
}


