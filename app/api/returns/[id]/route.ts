import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { findReturnById, deleteReturn } from '@/lib/db'
import { getCurrentUserFromCookies } from '@/lib/auth'
import { findCodeByReturnId } from '@/lib/return-codes'
import fs from 'fs'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * GET - Obține detalii despre un retur specific
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const cookieStore = await cookies()
    // Verificarea login-ului și cele două citiri pornesc împreună (un singur drum
    // la bază în loc de trei la rând). Datele nu pleacă decât dacă userul e logat.
    const [user, returnData, usedCode] = await Promise.all([
      getCurrentUserFromCookies(cookieStore),
      findReturnById(params.id),
      findCodeByReturnId(params.id),
    ])
    
    if (!user) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized' },
        { status: 401 }
      )
    }

    if (!returnData) {
      return NextResponse.json(
        { success: false, message: 'Return not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      return: { ...returnData, usedCode: usedCode || null },
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

    const existing = await findReturnById(params.id)
    if (!existing) {
      return NextResponse.json(
        { success: false, message: 'Return not found' },
        { status: 404 }
      )
    }

    // Un retur aflat într-un fișier de plăți nu se editează: IBAN-ul / suma din
    // fișierul trimis la bancă trebuie să rămână cele de pe retur.
    if (existing.status === 'IN_PLATA') {
      return NextResponse.json(
        { success: false, message: 'Returul este într-un fișier de plăți. Anulează lotul din „Plăți retururi" ca să-l poți modifica.' },
        { status: 409 }
      )
    }

    // Statusul NU se schimbă de aici (are ruta lui, cu reguli) — pagina de editare
    // trimite tot returul, posibil cu un status vechi. Iar `plata` și `factura`
    // sunt gestionate doar de server: le păstrăm pe cele din DB.
    void status
    let mergedRefundData = refundData
    if (refundData !== undefined && refundData !== null) {
      const { plata: _p, factura: _f, ...clientRefund } = refundData
      mergedRefundData = {
        ...clientRefund,
        ...(existing.refundData?.plata ? { plata: existing.refundData.plata } : {}),
        ...(existing.refundData?.factura ? { factura: existing.refundData.factura } : {}),
      }
    }

    const updatedReturn = await updateReturn(params.id, {
      orderData,
      products,
      refundData: mergedRefundData,
      totalRefund,
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

    const toDelete = await findReturnById(params.id)
    if (toDelete?.status === 'IN_PLATA') {
      return NextResponse.json(
        { success: false, message: 'Returul este într-un fișier de plăți. Anulează lotul din „Plăți retururi" înainte să-l ștergi.' },
        { status: 409 }
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

