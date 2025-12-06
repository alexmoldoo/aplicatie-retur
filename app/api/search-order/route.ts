import { NextRequest, NextResponse } from 'next/server'
import { 
  searchOrderByOrderNumber, 
  searchOrdersByPhone, 
  searchOrdersByEmail,
  convertShopifyOrdersToAppFormat 
} from '@/lib/shopify'
import { calculateEligibility } from '@/lib/eligibility'
import { getConfig } from '@/lib/db'
import { matchNames } from '@/lib/name-matcher'

export const dynamic = 'force-dynamic'

/**
 * API Route pentru căutarea comenzilor în Shopify
 * Validare strictă: nume+prenume obligatoriu, număr comandă SAU telefon SAU email obligatoriu
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { orderNumber, phone, fullName, email } = body
    
    console.log('Search order request:', { 
      orderNumber: orderNumber || 'none', 
      phone: phone || 'none', 
      fullName: fullName || 'none', 
      email: email || 'none' 
    })

    // Obține credențialele Shopify din configurație sau variabilele de mediu
    const config = await getConfig()
    
    const shopifyDomain = config.shopify.domain || process.env.SHOPIFY_DOMAIN
    const shopifyAccessToken = config.shopify.accessToken || process.env.SHOPIFY_ACCESS_TOKEN

    if (!shopifyDomain || !shopifyAccessToken) {
      return NextResponse.json(
        { 
          success: false, 
          message: 'Configurația Shopify nu este completă. Vă rugăm să contactați administratorul.' 
        },
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
        return NextResponse.json({
          success: false,
          message: 'Nu am găsit comenzi cu acest email. Verificați dacă email-ul este corect sau dacă ați făcut comenzi pe acest magazin.',
        })
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
        return NextResponse.json({
          success: false,
          message: 'Nu am găsit comanda cu numărul introdus.',
          needsEmail: !email,
        })
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
            return NextResponse.json({
              success: false,
              message: 'Comanda nu este asociată cu acest nume.',
              needsEmail: !email,
            })
          }
        } else {
          // Numele nu se potrivește și nu a introdus telefon → invalid
          return NextResponse.json({
            success: false,
            message: 'Comanda nu este asociată cu acest nume.',
            needsEmail: !email,
          })
        }
      }
    }
    // CAZUL 3: Căutare după telefon (dacă nu s-a găsit după număr comandă)
    else if (phone && phone.trim().length > 0) {
      const result = await searchOrdersByPhone(phone, shopifyDomain, shopifyAccessToken)
      
      if (!result.success || !result.orders || result.orders.length === 0) {
        // Nu există comenzi cu acest telefon
        return NextResponse.json({
          success: false,
          message: 'Nu am găsit comenzi cu acest număr de telefon.',
          needsEmail: !email,
        })
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
      if (matchedOrders.length === 0 && ordersBeforeCutoff.length > 0) {
        return NextResponse.json({
          success: false,
          message: 'Nu aveți comenzi eligibile după august 2025. Vă rugăm să contactați suportul pentru comenzile mai vechi.',
          needsEmail: !email,
        })
      }
      
      if (matchedOrders.length > 0) {
        // Returnează STRICT doar comenzile care se potrivesc cu numele și sunt după august 2025
        // Nu returnează toate comenzile cu telefonul, doar cele care trec validarea numelui și datei
        orders = matchedOrders
      } else {
        // Numele nu se potrivește cu nici o comandă → cerem email
        return NextResponse.json({
          success: false,
          message: 'Pe acest număr de telefon nu este asociat acest nume.',
          needsEmail: !email,
        })
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
        return NextResponse.json({
          success: false,
          message: 'Nu am găsit comenzi cu acest email. Verificați dacă email-ul este corect sau dacă ați făcut comenzi pe acest magazin.',
        })
      }

      // Găsim toate comenzile asociate cu acel email
      // Când se caută după email, nu validăm numele - afișăm toate comenzile din acel email
      console.log(`Found ${result.orders.length} orders for email: ${email}`)
      orders = result.orders
    }

    // Dacă am găsit comenzi, le procesăm
    if (orders.length > 0) {
      // Convertește comenzile în formatul aplicației și adaugă eligibilitatea
      const convertedOrders = convertShopifyOrdersToAppFormat(orders).map(order => ({
        ...order,
        eligibility: calculateEligibility(order.dataComanda),
      }))

      // Sortează: comenzile eligibile primul, apoi celelalte
      convertedOrders.sort((a, b) => {
        if (a.eligibility.status === 'eligible' && b.eligibility.status !== 'eligible') return -1
        if (a.eligibility.status !== 'eligible' && b.eligibility.status === 'eligible') return 1
        return 0
      })
      
      return NextResponse.json({
        success: true,
        orders: convertedOrders,
        message: convertedOrders.length === 1 
          ? 'Comanda a fost găsită cu succes!' 
          : `Am găsit ${convertedOrders.length} comenzi!`,
      })
    }

    // Nu s-a găsit nicio comandă
    return NextResponse.json({
      success: false,
      message: 'Comanda nu a fost găsită. Vă rugăm să verificați datele introduse.',
      needsEmail: !email && !orderNumber && !phone,
    })
  } catch (error) {
    console.error('Error in search-order API:', error)
    return NextResponse.json(
      { 
        success: false, 
        message: 'A apărut o eroare la căutarea comenzii. Vă rugăm să încercați din nou.' 
      },
      { status: 500 }
    )
  }
}
