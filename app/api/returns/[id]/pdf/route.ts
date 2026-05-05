import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { findReturnById } from '@/lib/db'
import { getSessionFromCookies } from '@/lib/auth'
import { verifyCustomerToken } from '@/lib/customer-session'
import fs from 'fs'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * GET - Descarcă PDF-ul unui retur.
 * Acces: admin (cookie session) SAU client cu sessionToken (din ?token= sau header)
 *        emis pentru aceeași comandă pe care e returul.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const returnData = await findReturnById(params.id)

    if (!returnData) {
      return NextResponse.json(
        { success: false, message: 'Return not found' },
        { status: 404 }
      )
    }

    // Autorizație: admin via cookie SAU customer token pentru aceeași comandă
    const cookieStore = await cookies()
    const adminSession = await getSessionFromCookies(cookieStore)

    let authorized = !!adminSession
    if (!authorized) {
      const url = new URL(request.url)
      const token =
        url.searchParams.get('token') ||
        request.headers.get('x-customer-session') ||
        undefined
      const customer = verifyCustomerToken(token)
      authorized = !!customer && customer.numarComanda === returnData.numarComanda
    }

    if (!authorized) {
      return NextResponse.json(
        { success: false, message: 'Acces refuzat. Reia căutarea comenzii.' },
        { status: 401 }
      )
    }

    if (!returnData.pdfPath || !fs.existsSync(returnData.pdfPath)) {
      return NextResponse.json(
        { success: false, message: 'PDF not found' },
        { status: 404 }
      )
    }

    const pdfBuffer = fs.readFileSync(returnData.pdfPath)

    return new NextResponse(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${returnData.idRetur}.pdf"`,
      },
    })
  } catch (error) {
    console.error('Error getting PDF:', error)
    return NextResponse.json(
      { success: false, message: 'Error getting PDF' },
      { status: 500 }
    )
  }
}


