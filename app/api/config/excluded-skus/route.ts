import { NextResponse } from 'next/server'
import { getConfig } from '@/lib/db'

// Fără asta Next o „îngheață" la build: SKU-urile salvate în admin nu ajungeau
// la clienți până la următorul deploy. Acum se reîmprospătează la cel mult 60 s.
export const revalidate = 60

/**
 * GET - Obține SKU-urile excluse (public endpoint pentru aplicația de retur)
 */
export async function GET() {
  try {
    const config = await getConfig()
    
    return NextResponse.json({
      success: true,
      excludedSKUs: config.excludedSKUs || [],
    })
  } catch (error) {
    console.error('Error getting excluded SKUs:', error)
    return NextResponse.json(
      { success: false, excludedSKUs: [] },
      { status: 500 }
    )
  }
}

