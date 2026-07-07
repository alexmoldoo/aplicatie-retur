import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getCurrentUserFromCookies } from '@/lib/auth'
import { getConfig, normalizeOrderNumber } from '@/lib/db'
import { calculateEligibility } from '@/lib/eligibility'
import { isDevTestOrderNumber, buildDevTestOrder } from '@/lib/dev-test-orders'
import {
  searchOrderByOrderNumber,
  searchOrdersByPhone,
  searchOrdersByEmail,
  convertShopifyOrdersToAppFormat,
  getShopifyAccessToken,
  type ShopifyOrder,
} from '@/lib/shopify'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * Căutare de comenzi pentru admin (centrul de deblocare retur).
 * Un singur câmp: se auto-detectează dacă e email / telefon / nume / nr. comandă.
 * Spre deosebire de fluxul public, NU cere nume + identificator (adminul e de
 * încredere) și nu are rate-limit / honeypot.
 */
export async function POST(request: NextRequest) {
  const cookieStore = await cookies()
  const user = await getCurrentUserFromCookies(cookieStore)
  if (!user) {
    return NextResponse.json({ success: false, message: 'Neautorizat' }, { status: 401 })
  }

  const body = await request.json()
  const query = typeof body.query === 'string' ? body.query.trim() : ''
  if (!query) {
    return NextResponse.json(
      { success: false, message: 'Introdu un număr de comandă, nume sau telefon.' },
      { status: 400 }
    )
  }

  const config = await getConfig()
  const overrides = new Set((config.eligibilityOverrides || []).map(normalizeOrderNumber))

  // Atașează eligibilitatea + flag „deblocat" pe fiecare comandă.
  const withEligibility = (order: any) => {
    const base = calculateEligibility(order.dataComanda)
    const isUnblocked = overrides.has(normalizeOrderNumber(order.numarComanda))
    return {
      ...order,
      eligibility: isUnblocked ? { ...base, status: 'eligible' as const, overridden: true } : base,
      isUnblocked,
    }
  }

  // Comenzi de test locale (fără Shopify).
  if (isDevTestOrderNumber(query)) {
    const testOrder = buildDevTestOrder(query, config.eligibilityOverrides)
    return NextResponse.json({
      success: true,
      orders: [{ ...testOrder, isUnblocked: overrides.has(normalizeOrderNumber(testOrder.numarComanda)) }],
    })
  }

  // Auto-detectare tip input: email → telefon → nr. comandă.
  // Căutarea doar după nume nu e suportată (prea mulți omonimi) — trimitem un mesaj clar.
  const isEmail = query.includes('@')
  const isPhone = /^\+?[\d\s().-]{6,}$/.test(query)
  const looksLikeName = !isEmail && !isPhone && /\s/.test(query)
  if (looksLikeName) {
    return NextResponse.json({
      success: true,
      orders: [],
      message: 'Căutarea după nume nu e disponibilă. Folosește numărul comenzii sau telefonul.',
    })
  }

  const shopifyDomain = config.shopify.domain || process.env.SHOPIFY_DOMAIN
  if (!shopifyDomain) {
    return NextResponse.json(
      { success: false, message: 'Shopify nu este configurat (lipsește domeniul).' },
      { status: 500 }
    )
  }

  let token: string
  try {
    token = await getShopifyAccessToken({
      domain: shopifyDomain,
      legacyToken: config.shopify.accessToken || process.env.SHOPIFY_ACCESS_TOKEN,
      clientId: config.shopify.clientId || process.env.SHOPIFY_CLIENT_ID,
      clientSecret: config.shopify.clientSecret || process.env.SHOPIFY_CLIENT_SECRET,
    })
  } catch {
    return NextResponse.json(
      { success: false, message: 'Shopify indisponibil (token invalid?). Reconectează Shopify în Setări.' },
      { status: 502 }
    )
  }

  try {
    let found: ShopifyOrder[] = []
    if (isEmail) {
      const r = await searchOrdersByEmail(query, shopifyDomain, token)
      found = r.orders || []
    } else if (isPhone) {
      const r = await searchOrdersByPhone(query, shopifyDomain, token)
      found = r.orders || []
    } else {
      const r = await searchOrderByOrderNumber(query, shopifyDomain, token)
      found = r.order ? [r.order] : []
    }

    if (found.length === 0) {
      return NextResponse.json({ success: true, orders: [], message: 'Nicio comandă găsită.' })
    }
    const orders = convertShopifyOrdersToAppFormat(found).map(withEligibility)
    return NextResponse.json({ success: true, orders })
  } catch (e) {
    console.error('[admin/orders/search] error:', e)
    return NextResponse.json(
      { success: false, message: 'Eroare la căutarea comenzii.' },
      { status: 500 }
    )
  }
}
