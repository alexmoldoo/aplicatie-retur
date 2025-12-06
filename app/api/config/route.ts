import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getCurrentUserFromCookies } from '@/lib/auth'
import { getConfig, updateShopifyConfig, updateExcludedSKUs } from '@/lib/db'

export const dynamic = 'force-dynamic'

/**
 * GET - Obține configurația
 */
export async function GET() {
  try {
    const cookieStore = await cookies()
    const user = await getCurrentUserFromCookies(cookieStore)
    
    if (!user) {
      return NextResponse.json(
        { success: false, message: 'Neautorizat' },
        { status: 401 }
      )
    }

    const config = await getConfig()
    
    // Nu returnăm token-ul complet din motive de securitate
    return NextResponse.json({
      success: true,
      config: {
        shopify: {
          domain: config.shopify.domain,
          shopTitle: config.shopify.shopTitle,
          accessTokenConfigured: config.shopify.accessToken.length > 0,
        },
        excludedSKUs: config.excludedSKUs,
      },
    })
  } catch (error) {
    console.error('Error getting config:', error)
    return NextResponse.json(
      { success: false, message: 'Eroare la obținerea configurației' },
      { status: 500 }
    )
  }
}

/**
 * POST - Actualizează configurația Shopify
 */
export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const user = await getCurrentUserFromCookies(cookieStore)
    
    if (!user) {
      return NextResponse.json(
        { success: false, message: 'Neautorizat' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { shopify, excludedSKUs } = body

    // Obține configurația existentă pentru a păstra datele
    const currentConfig = await getConfig()

    if (shopify) {
      // Păstrează datele existente dacă nu sunt furnizate noi valori
      await updateShopifyConfig({
        domain: shopify.domain || currentConfig.shopify.domain || '',
        accessToken: shopify.accessToken || currentConfig.shopify.accessToken || '',
        shopTitle: shopify.shopTitle || currentConfig.shopify.shopTitle || '',
      })
    }

    if (excludedSKUs !== undefined) {
      await updateExcludedSKUs(excludedSKUs)
    }

    return NextResponse.json({
      success: true,
      message: 'Configurație actualizată cu succes',
    })
  } catch (error) {
    console.error('Error updating config:', error)
    return NextResponse.json(
      { success: false, message: 'Eroare la actualizarea configurației' },
      { status: 500 }
    )
  }
}

