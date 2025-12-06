import { NextRequest, NextResponse } from 'next/server'
import { findReturnById } from '@/lib/db'
import fs from 'fs'

/**
 * GET - Descarcă PDF-ul unui retur
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
    
    // Verifică dacă PDF-ul există
    if (!returnData.pdfPath || !fs.existsSync(returnData.pdfPath)) {
      return NextResponse.json(
        { success: false, message: 'PDF not found' },
        { status: 404 }
      )
    }
    
    // Citește PDF-ul
    const pdfBuffer = fs.readFileSync(returnData.pdfPath)
    
    // Returnează PDF-ul
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


