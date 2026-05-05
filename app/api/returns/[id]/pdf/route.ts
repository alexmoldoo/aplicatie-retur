import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { findReturnById } from '@/lib/db'
import { getSessionFromCookies } from '@/lib/auth'
import { verifyCustomerToken } from '@/lib/customer-session'
import { generateReturnPDF } from '@/lib/pdf-generator'
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

    // Pe Vercel filesystem-ul e read-only, deci nu putem citi PDF de pe disc.
    // Soluție universală: regenerăm PDF-ul on-demand din datele din DB.
    // (Avantaj bonus: PDF-ul reflectă întotdeauna ultimele date — ex. AWB
    // adăugat post-creare.)
    let pdfBuffer: Buffer

    if (returnData.pdfPath && fs.existsSync(returnData.pdfPath)) {
      pdfBuffer = fs.readFileSync(returnData.pdfPath)
    } else {
      try {
        pdfBuffer = await generateReturnPDF(returnData, returnData.qrCodeData || '')
      } catch (err) {
        console.error('Failed to regenerate PDF on-demand:', err)
        return NextResponse.json(
          { success: false, message: 'Eroare la generarea PDF-ului' },
          { status: 500 }
        )
      }
    }

    return new NextResponse(pdfBuffer as any, {
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


