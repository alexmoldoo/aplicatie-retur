import { NextRequest, NextResponse } from 'next/server'
import { createReturn, OrderData, Product, RefundData, generateReturnId } from '@/lib/db'
import { generateQRCode } from '@/lib/qrcode-generator'
import { generateReturnPDF } from '@/lib/pdf-generator'
import fs from 'fs'
import path from 'path'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      orderData,
      products,
      refundData,
      signature,
    }: {
      orderData: OrderData
      products: Product[]
      refundData: RefundData
      signature: string
    } = body

    // Validare date
    if (!orderData || !products || !refundData || !signature) {
      return NextResponse.json(
        { success: false, message: 'Missing required data' },
        { status: 400 }
      )
    }

    // Calculare suma totală de returnat
    const totalRefund = products.reduce((sum, p) => {
      const cantitateReturnata = p.cantitateReturnata || (p.selected ? p.cantitate : 0)
      return sum + (p.pret * cantitateReturnata)
    }, 0)

    // Generează ID retur
    const idRetur = await generateReturnId()

    // Obține baseUrl pentru generarea link-ului QR code
    const origin = request.headers.get('origin') || request.headers.get('host')
    const protocol = request.headers.get('x-forwarded-proto') || 'http'
    const baseUrl = origin ? `${protocol}://${origin}` : process.env.NEXT_PUBLIC_BASE_URL || ''

    // Generează QR code cu link către pagina de detalii
    const qrCodeDataUrl = await generateQRCode(idRetur, baseUrl)

    // Pregătește orderData doar cu nume (fără email și telefon)
    const orderDataForReturn: OrderData = {
      nume: orderData.nume,
      numarComanda: orderData.numarComanda,
    }

    // Pregătește refundData doar cu IBAN și numeTitular (fără metodaRambursare)
    const refundDataForReturn: RefundData = {
      iban: refundData.iban,
      numeTitular: refundData.numeTitular,
    }

    // Creează returul temporar pentru generare PDF
    const tempReturn = {
      idRetur,
      numarComanda: orderData.numarComanda,
      orderData: orderDataForReturn,
      products,
      refundData: refundDataForReturn,
      signature,
      totalRefund,
      status: 'INITIAT' as const,
      createdAt: new Date().toISOString(),
      pdfPath: '',
      qrCodeData: qrCodeDataUrl,
    }

    // Generează PDF
    const pdfBuffer = await generateReturnPDF(tempReturn, qrCodeDataUrl)

    // Salvează PDF-ul
    const returnsDir = path.join(process.cwd(), 'data', 'retururi')
    if (!fs.existsSync(returnsDir)) {
      fs.mkdirSync(returnsDir, { recursive: true })
    }

    const pdfFileName = `${idRetur}.pdf`
    const pdfPath = path.join(returnsDir, pdfFileName)
    fs.writeFileSync(pdfPath, pdfBuffer)

    // Creează returul în baza de date
    const newReturn = await createReturn(
      orderData.numarComanda,
      orderDataForReturn,
      products,
      refundDataForReturn,
      signature,
      totalRefund,
      pdfPath,
      qrCodeDataUrl,
      idRetur
    )

    // Returnează răspuns cu datele necesare
    return NextResponse.json({
      success: true,
      returnId: newReturn.idRetur,
      pdfPath: `/api/returns/${newReturn.idRetur}/pdf`,
      returnData: {
        idRetur: newReturn.idRetur,
        numarComanda: newReturn.numarComanda,
        totalRefund: newReturn.totalRefund,
        createdAt: newReturn.createdAt,
      },
    })
  } catch (error) {
    console.error('Error creating return:', error)
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to create return',
      },
      { status: 500 }
    )
  }
}

