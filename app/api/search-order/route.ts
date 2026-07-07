import { NextRequest, NextResponse } from 'next/server'
import {
  searchOrderByOrderNumber,
  searchOrdersByPhone,
  searchOrdersByEmail,
  convertShopifyOrdersToAppFormat,
  enrichOrdersWithProductImages,
  getShopifyAccessToken,
} from '@/lib/shopify'
import { calculateEligibility } from '@/lib/eligibility'
import { getConfig, findReturnByOrderNumber, normalizeOrderNumber } from '@/lib/db'
import { isDevTestOrderNumber, buildDevTestOrder } from '@/lib/dev-test-orders'
import { matchNames } from '@/lib/name-matcher'
import { createCustomerToken } from '@/lib/customer-session'
import { logAudit } from '@/lib/audit'
import { getClientIp, makeRateLimiter, formatWaitTime } from '@/lib/security'
import { isBlocked, recordFail } from '@/lib/ip-blocklist'

const HUMAN_MIN_FILL_TIME_MS = 1500 // sub atât → suspect bot

export const dynamic = 'force-dynamic'

// Rate limit: max 8 căutări / 5 minute / IP (oamenii fac mai multe încercări
// legitime: tastează greșit numărul, scriu numele în alt format etc.)
const checkRateLimit = makeRateLimiter({ max: 8, windowMs: 5 * 60_000 })

// Cache rezultate: 60 secunde / același input
const CACHE_TTL_MS = 60_000
const cacheMap = new Map<string, { data: any; expiresAt: number }>()

function makeCacheKey(p: { orderNumber?: string; phone?: string; fullName?: string; email?: string }): string {
  return JSON.stringify({
    o: (p.orderNumber || '').trim().toLowerCase(),
    p: (p.phone || '').replace(/\s+/g, '').toLowerCase(),
    n: (p.fullName || '').trim().toLowerCase(),
    e: (p.email || '').trim().toLowerCase(),
  })
}

function getCached(key: string): any | null {
  const entry = cacheMap.get(key)
  if (!entry) return null
  if (entry.expiresAt < Date.now()) {
    cacheMap.delete(key)
    return null
  }
  return entry.data
}

async function enrichWithExistingReturns<T extends { numarComanda: string }>(orders: T[]): Promise<(T & { existingReturn: any | null })[]> {
  return Promise.all(
    orders.map(async (order) => {
      try {
        const existing = await findReturnByOrderNumber(order.numarComanda)
        if (!existing) return { ...order, existingReturn: null }
        return {
          ...order,
          existingReturn: {
            idRetur: existing.idRetur,
            status: existing.status,
            awbNumber: existing.awbNumber || null,
            createdAt: existing.createdAt,
            totalRefund: existing.totalRefund,
            metodaTrimitere: (existing.refundData as any)?.metodaTrimitere || null,
          },
        }
      } catch (e) {
        console.warn('findReturnByOrderNumber failed for', order.numarComanda, e)
        return { ...order, existingReturn: null }
      }
    })
  )
}

function setCached(key: string, data: any): void {
  cacheMap.set(key, { data, expiresAt: Date.now() + CACHE_TTL_MS })
  // Curățare oportunistă: dacă map-ul crește prea mult, șterge intrările expirate
  if (cacheMap.size > 500) {
    const now = Date.now()
    Array.from(cacheMap.entries()).forEach(([k, v]) => {
      if (v.expiresAt < now) cacheMap.delete(k)
    })
  }
}

/**
 * API Route pentru căutarea comenzilor în Shopify
 * Validare strictă: nume+prenume obligatoriu, număr comandă SAU telefon SAU email obligatoriu
 */
export async function POST(request: NextRequest) {
  const ip = getClientIp(request)

  try {
    // 0. Verifică dacă IP-ul e blocat (după prea multe eșecuri în trecut)
    const block = isBlocked(ip)
    if (block.blocked) {
      await logAudit({ action: 'search_order_rate_limited', ip, details: { reason: 'ip_blocked', retryAfter: block.retryAfterSeconds } })
      return NextResponse.json(
        {
          success: false,
          message: 'Acces temporar blocat din cauza prea multor încercări eșuate. Te rugăm să contactezi suportul dacă ai nevoie de ajutor.',
        },
        { status: 429, headers: { 'Retry-After': String(block.retryAfterSeconds || 0) } }
      )
    }

    // Rate limit per IP
    const rl = checkRateLimit(ip)
    if (!rl.allowed) {
      await logAudit({ action: 'search_order_rate_limited', ip, details: { retryAfter: rl.retryAfter } })
      return NextResponse.json(
        {
          success: false,
          message: `Ai depășit numărul maxim de încercări. Te rugăm să aștepți ${formatWaitTime(rl.retryAfter)} înainte să încerci din nou.`,
        },
        {
          status: 429,
          headers: { 'Retry-After': String(rl.retryAfter) },
        }
      )
    }

    const body = await request.json()
    const { orderNumber, phone, fullName, email, _hp, _formStartedAt } = body

    // Honeypot — câmp ascuns care nu trebuie completat decât de boți
    if (_hp && String(_hp).trim().length > 0) {
      recordFail(ip)
      await logAudit({ action: 'search_order_fail', ip, details: { reason: 'honeypot_filled' } })
      // Răspuns generic ca să nu dezvăluim că am detectat botul
      return NextResponse.json({
        success: false,
        message: 'Comanda nu a fost găsită. Verifică datele introduse și încearcă din nou.',
      })
    }

    // Detectare timp completare formular — sub 1.5s e suspect bot
    if (typeof _formStartedAt === 'number' && _formStartedAt > 0) {
      const elapsed = Date.now() - _formStartedAt
      if (elapsed < HUMAN_MIN_FILL_TIME_MS && elapsed >= 0) {
        recordFail(ip)
        await logAudit({ action: 'search_order_fail', ip, details: { reason: 'too_fast', elapsedMs: elapsed } })
        return NextResponse.json({
          success: false,
          message: 'Comanda nu a fost găsită. Verifică datele introduse și încearcă din nou.',
        })
      }
    }

    // DEV ONLY — comandă de test pentru verificarea fluxului fără Shopify.
    // (TESTCARD / TESTIBAN / TESTEXPIRED — vezi lib/dev-test-orders.ts)
    if (isDevTestOrderNumber(orderNumber)) {
      const testCfg = await getConfig()
      const testOrder = buildDevTestOrder(orderNumber, testCfg.eligibilityOverrides)
      const kind = /expired/i.test(orderNumber) ? 'expirată' : /card/i.test(orderNumber) ? 'plată card' : 'ramburs'
      return NextResponse.json({
        success: true,
        orders: [testOrder],
        message: `Comandă de test (local) — ${kind}.`,
      })
    }

    console.log('Search order request:', {
      orderNumber: orderNumber || 'none',
      phone: phone || 'none',
      fullName: fullName || 'none',
      email: email || 'none'
    })

    // Helper: înregistrează eșec (pentru blocare după 19) și returnează mesaj generic
    const failNotFound = (extra?: Record<string, any>) => {
      const r = recordFail(ip)
      if (r.newlyBlocked) {
        logAudit({ action: 'search_order_rate_limited', ip, details: { reason: 'auto_blocked_after_fails', failCount: r.failCount } })
      }
      return NextResponse.json({
        success: false,
        message: 'Comanda nu a fost găsită. Verifică datele introduse și încearcă din nou.',
        ...(extra || {}),
      })
    }

    // Cache: dacă același input a fost căutat recent, returnează rezultatul cache
    const cacheKey = makeCacheKey({ orderNumber, phone, fullName, email })
    const cached = getCached(cacheKey)
    if (cached) {
      console.log('Cache hit for search-order:', cacheKey)
      return NextResponse.json(cached)
    }

    // Obține credențialele Shopify din configurație sau variabilele de mediu
    const config = await getConfig()

    const shopifyDomain = config.shopify.domain || process.env.SHOPIFY_DOMAIN
    const legacyToken = config.shopify.accessToken || process.env.SHOPIFY_ACCESS_TOKEN
    const clientId = config.shopify.clientId || process.env.SHOPIFY_CLIENT_ID
    const clientSecret = config.shopify.clientSecret || process.env.SHOPIFY_CLIENT_SECRET

    if (!shopifyDomain) {
      return NextResponse.json(
        { success: false, message: 'Configurația Shopify nu este completă (lipsește domeniul).' },
        { status: 500 }
      )
    }

    let shopifyAccessToken: string
    try {
      shopifyAccessToken = await getShopifyAccessToken({
        domain: shopifyDomain,
        legacyToken,
        clientId,
        clientSecret,
      })
    } catch (err: any) {
      console.error('[search-order] failed to obtain Shopify access token:', err?.message)
      return NextResponse.json(
        { success: false, message: 'Configurația Shopify nu este completă. Vă rugăm să contactați administratorul.' },
        { status: 500 }
      )
    }

    // Validare: Trebuie să existe fie număr comandă, fie telefon, fie email (cel puțin unul)
    if (!orderNumber && !phone && !email) {
      return NextResponse.json({
        success: false,
        message: 'Introduceți numărul de telefon sau numărul de comandă pentru a găsi comanda.',
      })
    }

    // Validare: Numele și prenumele sunt OBLIGATORII (doar dacă NU se caută doar cu email)
    // Când se caută doar cu email, numele nu este obligatoriu
    const isEmailOnlySearch = email && email.trim().length > 0 && !orderNumber && !phone
    if (!isEmailOnlySearch && (!fullName || fullName.trim().length === 0)) {
      return NextResponse.json({
        success: false,
        message: 'Numele și prenumele sunt obligatorii.',
      })
    }

    let orders: any[] = []

    // CAZUL 1: Căutare după email (dacă există email și NU există comandă sau telefon)
    // Email-ul poate funcționa independent, fără comandă sau telefon
    // Nu validăm numele când se caută doar cu email - afișăm toate comenzile din acel email
    if (isEmailOnlySearch) {
      console.log('Searching by email only:', email)
      const result = await searchOrdersByEmail(email.trim(), shopifyDomain, shopifyAccessToken)
      
      if (!result.success || !result.orders || result.orders.length === 0) {
        // Nu există comenzi cu acest email
        console.log(`No orders found for email: ${email}`)
        return failNotFound()
      }

      // Găsim toate comenzile asociate cu acel email
      // Când se caută doar cu email, nu validăm numele - afișăm toate comenzile din acel email
      console.log(`Found ${result.orders.length} orders for email: ${email}`)
      orders = result.orders
    }
    // CAZUL 2: Căutare după număr comandă
    else if (orderNumber && orderNumber.trim().length > 0) {
      const result = await searchOrderByOrderNumber(orderNumber, shopifyDomain, shopifyAccessToken)

      if (!result.success || !result.order) {
        // Comanda nu există
        return failNotFound({ needsEmail: !email })
      }

      const foundOrder = result.order
      
      // Extrage numele din comandă
      const orderName = foundOrder.billing_address?.name || 
                       `${foundOrder.billing_address?.first_name || ''} ${foundOrder.billing_address?.last_name || ''}`.trim()
      
      // Verificare STRICTĂ: numele SAU prenumele trebuie să se potrivească cu comanda găsită
      const nameMatches = matchNames(fullName, orderName)
      
      if (nameMatches) {
        // Numele se potrivește → valid, afișăm comanda
        orders = [foundOrder]
      } else {
        // Numele nu se potrivește → verificăm dacă a introdus și telefon
        if (phone) {
          // Verificăm dacă telefonul din comandă se potrivește cu telefonul introdus
          const orderPhone = foundOrder.phone || ''
          const normalizedOrderPhone = orderPhone.replace(/\s+/g, '').replace(/[-\+]/g, '')
          const normalizedInputPhone = phone.replace(/\s+/g, '').replace(/[-\+]/g, '')
          
          if (normalizedOrderPhone === normalizedInputPhone || 
              normalizedOrderPhone.endsWith(normalizedInputPhone) ||
              normalizedInputPhone.endsWith(normalizedOrderPhone)) {
            // Telefonul se potrivește → valid, afișăm comanda
            orders = [foundOrder]
          } else {
            // Nici numele, nici telefonul nu se potrivesc → invalid
            return failNotFound({ needsEmail: !email })
          }
        } else {
          // Numele nu se potrivește și nu a introdus telefon → invalid
          return failNotFound({ needsEmail: !email })
        }
      }
    }
    // CAZUL 3: Căutare după telefon (dacă nu s-a găsit după număr comandă)
    else if (phone && phone.trim().length > 0) {
      const result = await searchOrdersByPhone(phone, shopifyDomain, shopifyAccessToken)
      
      if (!result.success || !result.orders || result.orders.length === 0) {
        // Nu există comenzi cu acest telefon
        return failNotFound({ needsEmail: !email })
      }

      // Găsim toate comenzile cu acel telefon
      const foundOrders = result.orders
      
      // Data limită: august 2025 (1 august 2025)
      const cutoffDate = new Date('2025-08-01T00:00:00Z')
      
      // Verificare STRICTĂ: Filtrează doar comenzile unde numele se potrivește EXACT
      // Returnează STRICT doar comenzile asociate cu acest număr de telefon care se potrivesc cu numele
      const matchedOrders: any[] = []
      const ordersBeforeCutoff: any[] = []
      
      for (const order of foundOrders) {
        // Extrage numele din comandă
        const orderName = order.billing_address?.name || 
                         `${order.billing_address?.first_name || ''} ${order.billing_address?.last_name || ''}`.trim()
        
        // Verifică STRICT dacă numele se potrivește
        if (matchNames(fullName, orderName)) {
          // Verifică data comenzii
          const orderDate = new Date(order.created_at)
          
          if (orderDate >= cutoffDate) {
            // Comandă după august 2025 → adaugă la lista de afișat
            matchedOrders.push(order)
          } else {
            // Comandă înainte de august 2025 → păstrează pentru verificare
            ordersBeforeCutoff.push(order)
          }
        }
      }
      
      // Dacă nu are comenzi după august 2025, dar are comenzi înainte → eroare
      // (nu contorizăm ca fail — comanda există, dar nu e eligibilă online)
      if (matchedOrders.length === 0 && ordersBeforeCutoff.length > 0) {
        return NextResponse.json({
          success: false,
          message: 'Această comandă nu poate fi procesată online. Te rugăm să contactezi suportul.',
          needsEmail: !email,
        })
      }
      
      if (matchedOrders.length > 0) {
        // Returnează STRICT doar comenzile care se potrivesc cu numele și sunt după august 2025
        // Nu returnează toate comenzile cu telefonul, doar cele care trec validarea numelui și datei
        orders = matchedOrders
      } else {
        // Numele nu se potrivește cu nici o comandă → cerem email
        return failNotFound({ needsEmail: !email })
      }
    }

    // CAZUL 4: Căutare după email (dacă nu s-a găsit după număr comandă sau telefon, dar există email)
    // Când se caută după email ca fallback, nu validăm numele - afișăm toate comenzile din acel email
    if (orders.length === 0 && email && email.trim().length > 0) {
      console.log('Searching by email as fallback:', email)
      const result = await searchOrdersByEmail(email.trim(), shopifyDomain, shopifyAccessToken)
      
      if (!result.success || !result.orders || result.orders.length === 0) {
        // Nu există comenzi cu acest email
        console.log(`No orders found for email: ${email}`)
        return failNotFound()
      }

      // Găsim toate comenzile asociate cu acel email
      // Când se caută după email, nu validăm numele - afișăm toate comenzile din acel email
      console.log(`Found ${result.orders.length} orders for email: ${email}`)
      orders = result.orders
    }

    // Dacă am găsit comenzi, le procesăm
    if (orders.length > 0) {
      // Convertește comenzile în formatul aplicației
      const baseOrders = convertShopifyOrdersToAppFormat(orders)
      // Îmbogățește cu imagini din Shopify (un singur apel batched)
      try {
        await enrichOrdersWithProductImages(baseOrders, shopifyDomain, shopifyAccessToken)
      } catch (e) {
        // Nu blocăm fluxul dacă imaginile eșuează
        console.warn('Image enrichment failed:', e)
      }
      // Comenzi deblocate manual din admin — trec de termenul expirat.
      const overrides = new Set((config.eligibilityOverrides || []).map(normalizeOrderNumber))

      // Adaugă eligibilitatea și token de sesiune
      const convertedOrders = baseOrders.map(order => {
        const baseElig = calculateEligibility(order.dataComanda)
        const isUnblocked = overrides.has(normalizeOrderNumber(order.numarComanda))
        // Deblocat manual → forțăm „eligibil", păstrând un flag ca UI-ul să poată marca „deblocat".
        const eligibility = isUnblocked
          ? { ...baseElig, status: 'eligible' as const, overridden: true }
          : baseElig
        return {
          ...order,
          eligibility,
          sessionToken: createCustomerToken({
            orderId: String(order.id),
            numarComanda: order.numarComanda,
            nume: order.nume || '',
            wasPaidWithCard: order.wasPaidWithCard === true,
          }),
        }
      })

      // Sortează: comenzile eligibile primul, apoi celelalte
      convertedOrders.sort((a, b) => {
        if (a.eligibility.status === 'eligible' && b.eligibility.status !== 'eligible') return -1
        if (a.eligibility.status !== 'eligible' && b.eligibility.status === 'eligible') return 1
        return 0
      })

      const enrichedOrders = await enrichWithExistingReturns(convertedOrders)

      const successPayload = {
        success: true,
        orders: enrichedOrders,
        message: enrichedOrders.length === 1
          ? 'Comanda a fost găsită cu succes!'
          : `Am găsit ${enrichedOrders.length} comenzi!`,
      }
      setCached(cacheKey, successPayload)
      await logAudit({
        action: 'search_order_success',
        ip,
        details: { count: enrichedOrders.length, ordersFound: enrichedOrders.map(o => o.numarComanda) },
      })
      return NextResponse.json(successPayload)
    }

    // Nu s-a găsit nicio comandă
    await logAudit({
      action: 'search_order_fail',
      ip,
      details: { reason: 'no_match', hadOrder: !!orderNumber, hadPhone: !!phone, hadEmail: !!email },
    })
    return failNotFound({ needsEmail: !email && !orderNumber && !phone })
  } catch (error) {
    console.error('Error in search-order API:', error)
    await logAudit({ action: 'search_order_fail', ip, details: { reason: 'exception' } })
    return NextResponse.json(
      {
        success: false,
        message: 'A apărut o eroare la căutarea comenzii. Vă rugăm să încercați din nou.'
      },
      { status: 500 }
    )
  }
}
