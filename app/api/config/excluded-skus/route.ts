import { NextResponse } from 'next/server'
import { getConfig } from '@/lib/db'

/**
 * GET - Obține SKU-urile excluse (public endpoint pentru aplicația de retur)
 */
export async function GET() {
  try {
    const config = getConfig()
    
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

