/**
 * Serviciu pentru interacțiunea cu Shopify API
 */

export interface ShopifyOrder {
  id: string
  name: string // Număr comandă (ex: #1001)
  email: string
  phone: string
  billing_address: {
    name: string
    first_name: string
    last_name: string
  }
  shipping_address?: {
    name?: string
    first_name?: string
    last_name?: string
    address1?: string
    address2?: string
    city?: string
    province?: string
    province_code?: string
    zip?: string
    country?: string
    phone?: string
  }
  line_items: Array<{
    id: string
    title: string
    quantity: number
    price: string
    variant_id: string
    product_id?: string | number
    sku?: string
    variant_title?: string
    discount_allocations?: Array<{
      amount: string
      discount_application_index: number
    }>
  }>
  discount_codes?: Array<{
    code: string
    amount: string
    type: string
  }>
  total_discounts?: string
  subtotal_price?: string
  shipping_lines?: Array<{
    id: string
    title: string
    price: string
  }>
  created_at: string
  total_price: string
  currency: string
  payment_gateway_names?: string[] // Gateway-uri de plată folosite
  payment_method?: string // Metoda de plată
  gateway?: string // Gateway de plată
  financial_status?: string // Statusul financiar al comenzii ('paid', 'pending', 'refunded', etc.)
  total_outstanding?: string // Suma neachitată (ar trebui să fie '0.00' pentru comenzi plătite)
  note_attributes?: Array<{ name: string; value: string }> // Atribute custom (ex. xConnector pune factura aici)
}

/**
 * Extrage seria + numărul facturii SmartBill dintr-o comandă Shopify.
 * xConnector pune pe `note_attributes` cheia `xconnector-invoice-url`, un URL cu
 * query string `...&s={serie}&n={numar}&...`. Storno-urile NU apar în Shopify.
 */
export function extractInvoiceFromOrder(
  order: Pick<ShopifyOrder, 'note_attributes'>
): { serie: string; numar: string } | null {
  const attr = (order.note_attributes || []).find(a => a.name === 'xconnector-invoice-url')
  if (!attr || !attr.value) return null
  const serie = attr.value.match(/[?&]s=([^&]+)/)?.[1]
  const numar = attr.value.match(/[?&]n=([^&]+)/)?.[1]
  if (!serie || !numar) return null
  return { serie: decodeURIComponent(serie), numar: decodeURIComponent(numar) }
}

export interface SearchOrderResult {
  success: boolean
  order?: ShopifyOrder
  message?: string
}

/**
 * Cache pentru access token-ul obținut prin client_credentials_grant.
 * Token-ul Shopify e valid 24h; refresh la jumătate ca să avem siguranță.
 */
let tokenCache: { token: string; expiresAt: number; domain: string } | null = null

/**
 * Obține un Admin API access token pentru Shopify.
 *
 * Suportă 2 moduri (în ordine de prioritate):
 *   1. LEGACY: dacă există un token care începe cu `shpat_`, îl folosește direct
 *      (custom apps clasice, deprecat din 2026-01-01 dar tokenele existente merg).
 *   2. NOU: dacă are `clientId` + `clientSecret`, face client_credentials_grant
 *      la `/admin/oauth/access_token` și cachează rezultatul (~24h).
 */
export async function getShopifyAccessToken(opts: {
  domain: string
  legacyToken?: string | null
  clientId?: string | null
  clientSecret?: string | null
}): Promise<string> {
  const { domain, legacyToken, clientId, clientSecret } = opts

  if (legacyToken && legacyToken.startsWith('shpat_')) {
    return legacyToken
  }

  if (!clientId || !clientSecret) {
    throw new Error('Shopify nu e configurat: lipsesc CLIENT_ID/CLIENT_SECRET (sau un token shpat_ legacy).')
  }

  if (tokenCache && tokenCache.domain === domain && tokenCache.expiresAt > Date.now() + 60_000) {
    return tokenCache.token
  }

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: 'client_credentials',
  })

  const res = await fetch(`https://${domain}/admin/oauth/access_token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  })

  if (!res.ok) {
    const errText = await res.text().catch(() => '')
    console.error(`[shopify] client_credentials_grant failed status=${res.status} body=${errText.slice(0, 300)}`)
    throw new Error(`Shopify OAuth failed: ${res.status}`)
  }

  const data = await res.json() as { access_token: string; expires_in: number; scope: string }
  tokenCache = {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in * 1000),
    domain,
  }
  console.log(`[shopify] obtained new access token via client_credentials_grant scope=${data.scope} expiresIn=${data.expires_in}s`)
  return data.access_token
}

/**
 * Caută o comandă în Shopify după număr comandă
 * Acceptă formate: #12345, MX12345, 12345, #MX12345
 */
export async function searchOrderByOrderNumber(
  orderNumber: string,
  shopifyDomain: string,
  accessToken: string
): Promise<SearchOrderResult> {
  try {
    // Normalizează numărul de comandă (elimină # și MX)
    let cleanOrderNumber = orderNumber.trim().toUpperCase()
    cleanOrderNumber = cleanOrderNumber.replace(/^#+/, '') // Elimină #
    cleanOrderNumber = cleanOrderNumber.replace(/^MX/, '') // Elimină MX
    cleanOrderNumber = cleanOrderNumber.trim()
    
    if (!cleanOrderNumber || !/^\d+$/.test(cleanOrderNumber)) {
      return {
        success: false,
        message: 'Format număr comandă invalid',
      }
    }
    
    // Încearcă mai multe formate de căutare
    const searchPatterns = [
      cleanOrderNumber, // 12345
      `#${cleanOrderNumber}`, // #12345
      `MX${cleanOrderNumber}`, // MX12345
      `#MX${cleanOrderNumber}`, // #MX12345
    ]

    console.log(`[shopify] searchOrderByOrderNumber domain=${shopifyDomain} tokenPrefix=${accessToken.slice(0, 8)}... patterns=${searchPatterns.join(',')}`)

    for (const pattern of searchPatterns) {
      const response = await fetch(
        `https://${shopifyDomain}/admin/api/2026-04/orders.json?name=${pattern}&status=any`,
        {
          headers: {
            'X-Shopify-Access-Token': accessToken,
            'Content-Type': 'application/json',
          },
        }
      )

      if (!response.ok) {
        const errBody = await response.text().catch(() => '')
        console.warn(`[shopify] orders.json pattern=${pattern} status=${response.status} body=${errBody.slice(0, 200)}`)
        continue
      }

      const data = await response.json()
      console.log(`[shopify] orders.json pattern=${pattern} status=200 found=${data.orders?.length || 0}`)

      if (data.orders && data.orders.length > 0) {
        return {
          success: true,
          order: data.orders[0],
        }
      }
    }

    return {
      success: false,
      message: 'Comanda nu a fost găsită',
    }
  } catch (error) {
    console.error('Error searching order by number:', error)
    return {
      success: false,
      message: 'Eroare la căutarea comenzii',
    }
  }
}

/**
 * Normalizează numărul de telefon pentru căutare în Shopify
 * Gestionă multiple formate: +40, 0040, 0, etc.
 */
function normalizePhoneForSearch(phone: string): string[] {
  if (!phone) return []
  
  // Elimină toate caracterele non-digit și non-plus
  let cleaned = phone.replace(/[^\d+]/g, '')
  
  const variants: string[] = []
  
  // Variantă 1: Exact cum este introdus (după curățare)
  variants.push(cleaned)
  
  // Pentru numere românești
  if (cleaned.startsWith('+40')) {
    // +40764898819
    const withoutPlus = cleaned.substring(1) // 40764898819
    variants.push(withoutPlus)
    
    // 0040764898819
    variants.push('00' + withoutPlus.substring(2))
    
    // 0764898819 (fără prefix țară)
    if (withoutPlus.length >= 10) {
      variants.push(withoutPlus.substring(2))
    }
  } else if (cleaned.startsWith('0040')) {
    // 0040764898819
    variants.push(cleaned)
    
    // +40764898819
    variants.push('+40' + cleaned.substring(4))
    
    // 40764898819
    variants.push(cleaned.substring(2))
    
    // 0764898819
    if (cleaned.length >= 12) {
      variants.push(cleaned.substring(4))
    }
  } else if (cleaned.startsWith('40') && cleaned.length >= 10) {
    // 40764898819
    variants.push(cleaned)
    variants.push('+' + cleaned)
    variants.push('00' + cleaned)
    
    // 0764898819
    variants.push(cleaned.substring(2))
  } else if (cleaned.startsWith('0') && cleaned.length === 10) {
    // 0764898819
    variants.push(cleaned)
    variants.push('+40' + cleaned.substring(1))
    variants.push('0040' + cleaned.substring(1))
    variants.push('40' + cleaned.substring(1))
  }
  
  // Elimină duplicatele
  return Array.from(new Set(variants))
}

/**
 * Caută clientul în Shopify după număr de telefon
 */
async function searchCustomerByPhone(
  phone: string,
  shopifyDomain: string,
  accessToken: string
): Promise<{ success: boolean; customers?: any[]; message?: string }> {
  try {
    // Generează toate variantele posibile ale numărului
    const phoneVariants = normalizePhoneForSearch(phone)
    
    if (phoneVariants.length === 0) {
      return {
        success: false,
        message: 'Format număr de telefon invalid',
      }
    }
    
    const allCustomers: any[] = []
    const foundCustomerIds = new Set<string>()
    
    // Încearcă fiecare variantă pentru a găsi clientul
    for (const phoneVariant of phoneVariants) {
      try {
        const response = await fetch(
          `https://${shopifyDomain}/admin/api/2026-04/customers.json?phone=${encodeURIComponent(phoneVariant)}&limit=250`,
          {
            headers: {
              'X-Shopify-Access-Token': accessToken,
              'Content-Type': 'application/json',
            },
          }
        )

        if (response.ok) {
          const data = await response.json()
          
          if (data.customers && data.customers.length > 0) {
            // Adaugă clienții găsiți (evită duplicatele)
            for (const customer of data.customers) {
              if (!foundCustomerIds.has(customer.id.toString())) {
                allCustomers.push(customer)
                foundCustomerIds.add(customer.id.toString())
              }
            }
          }
        }
      } catch (error) {
        // Continuă cu următoarea variantă dacă aceasta eșuează
        console.warn(`Failed to search customer with phone variant ${phoneVariant}:`, error)
      }
    }
    
    if (allCustomers.length > 0) {
      return {
        success: true,
        customers: allCustomers,
      }
    }

    return {
      success: false,
      message: 'Nu s-au găsit clienți pentru acest număr de telefon',
    }
  } catch (error) {
    console.error('Error searching customer by phone:', error)
    return {
      success: false,
      message: 'Eroare la căutarea clientului',
    }
  }
}

/**
 * Caută comenzi în Shopify după număr de telefon (returnează toate comenzile)
 * Metodă corectă: Mai întâi găsește clientul după telefon, apoi comenzile clientului
 */
export async function searchOrdersByPhone(
  phone: string,
  shopifyDomain: string,
  accessToken: string
): Promise<{ success: boolean; orders?: ShopifyOrder[]; message?: string }> {
  try {
    // Pasul 1: Găsește clientul după număr de telefon
    const customerResult = await searchCustomerByPhone(phone, shopifyDomain, accessToken)
    
    if (!customerResult.success || !customerResult.customers || customerResult.customers.length === 0) {
      return {
        success: false,
        message: 'Nu s-au găsit clienți pentru acest număr de telefon',
      }
    }

    // Pasul 2: Găsește toate comenzile pentru clienții găsiți
    const allOrders: ShopifyOrder[] = []
    const foundOrderIds = new Set<string>()
    
    for (const customer of customerResult.customers) {
      // Caută comenzile după customer_id
      try {
        const response = await fetch(
          `https://${shopifyDomain}/admin/api/2026-04/orders.json?customer_id=${customer.id}&status=any&limit=250`,
          {
            headers: {
              'X-Shopify-Access-Token': accessToken,
              'Content-Type': 'application/json',
            },
          }
        )

        if (response.ok) {
          const data = await response.json()
          
          if (data.orders && data.orders.length > 0) {
            // Adaugă comenzile găsite (evită duplicatele)
            for (const order of data.orders) {
              if (!foundOrderIds.has(order.id.toString())) {
                allOrders.push(order)
                foundOrderIds.add(order.id.toString())
              }
            }
          }
        }
      } catch (error) {
        console.warn(`Failed to get orders for customer ${customer.id}:`, error)
      }
      
      // De asemenea, caută comenzile după email (dacă clientul are email)
      if (customer.email) {
        try {
          const response = await fetch(
            `https://${shopifyDomain}/admin/api/2026-04/orders.json?email=${encodeURIComponent(customer.email)}&status=any&limit=250`,
            {
              headers: {
                'X-Shopify-Access-Token': accessToken,
                'Content-Type': 'application/json',
              },
            }
          )

          if (response.ok) {
            const data = await response.json()
            
            if (data.orders && data.orders.length > 0) {
              // Adaugă comenzile găsite (evită duplicatele)
              for (const order of data.orders) {
                if (!foundOrderIds.has(order.id.toString())) {
                  allOrders.push(order)
                  foundOrderIds.add(order.id.toString())
                }
              }
            }
          }
        } catch (error) {
          console.warn(`Failed to get orders for email ${customer.email}:`, error)
        }
      }
    }
    
    if (allOrders.length > 0) {
      // Sortează comenzile după data (cea mai recentă primul)
      const sortedOrders = allOrders.sort((a: ShopifyOrder, b: ShopifyOrder) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )
      return {
        success: true,
        orders: sortedOrders,
      }
    }

    return {
      success: false,
      message: 'Nu s-au găsit comenzi pentru acest număr de telefon',
    }
  } catch (error) {
    console.error('Error searching orders by phone:', error)
    return {
      success: false,
      message: 'Eroare la căutarea comenzilor',
    }
  }
}

/**
 * Caută o comandă în Shopify după număr de telefon (pentru compatibilitate)
 */
export async function searchOrderByPhone(
  phone: string,
  shopifyDomain: string,
  accessToken: string
): Promise<SearchOrderResult> {
  const result = await searchOrdersByPhone(phone, shopifyDomain, accessToken)
  if (result.success && result.orders && result.orders.length > 0) {
    return {
      success: true,
      order: result.orders[0],
    }
  }
  return {
    success: false,
    message: result.message || 'Nu s-au găsit comenzi pentru acest număr de telefon',
  }
}

/**
 * Caută comenzi în Shopify după nume complet
 * NOTĂ: Nu se validează doar după nume pentru că sunt multe persoane cu același nume
 */
export async function searchOrdersByName(
  fullName: string,
  shopifyDomain: string,
  accessToken: string
): Promise<SearchOrderResult> {
  try {
    // Nu căutăm doar după nume pentru că sunt multe persoane cu același nume
    // Returnăm false pentru a trece la următorul pas (email)
    return {
      success: false,
      message: 'Căutarea doar după nume nu este disponibilă. Vă rugăm să introduceți email-ul.',
    }
  } catch (error) {
    console.error('Error searching order by name:', error)
    return {
      success: false,
      message: 'Eroare la căutarea comenzii',
    }
  }
}

/**
 * Caută comenzi în Shopify după email (returnează toate comenzile)
 */
export async function searchOrdersByEmail(
  email: string,
  shopifyDomain: string,
  accessToken: string
): Promise<{ success: boolean; orders?: ShopifyOrder[]; message?: string }> {
  try {
    const cleanEmail = email.trim().toLowerCase()
    console.log(`Searching orders for email: ${cleanEmail} on domain: ${shopifyDomain}`)
    
    const response = await fetch(
      `https://${shopifyDomain}/admin/api/2026-04/orders.json?email=${encodeURIComponent(cleanEmail)}&status=any&limit=250`,
      {
        headers: {
          'X-Shopify-Access-Token': accessToken,
          'Content-Type': 'application/json',
        },
      }
    )

    console.log(`Shopify API response status: ${response.status}`)

    if (!response.ok) {
      const errorText = await response.text()
      console.error(`Shopify API error ${response.status}:`, errorText)
      throw new Error(`Shopify API error: ${response.status} - ${errorText}`)
    }

    const data = await response.json()
    console.log(`Shopify API returned ${data.orders?.length || 0} orders`)
    
    if (data.orders && data.orders.length > 0) {
      // Sortează comenzile după data (cea mai recentă primul)
      const sortedOrders = data.orders.sort((a: ShopifyOrder, b: ShopifyOrder) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )
      console.log(`Returning ${sortedOrders.length} sorted orders`)
      return {
        success: true,
        orders: sortedOrders,
      }
    }

    console.log(`No orders found for email: ${cleanEmail}`)
    return {
      success: false,
      message: 'Nu s-au găsit comenzi pentru acest email. Verificați dacă ați făcut o comandă.',
    }
  } catch (error) {
    console.error('Error searching orders by email:', error)
    return {
      success: false,
      message: `Eroare la căutarea comenzilor: ${error instanceof Error ? error.message : 'Eroare necunoscută'}`,
    }
  }
}

/**
 * Caută o comandă în Shopify după email (pentru compatibilitate)
 */
export async function searchOrderByEmail(
  email: string,
  shopifyDomain: string,
  accessToken: string
): Promise<SearchOrderResult> {
  const result = await searchOrdersByEmail(email, shopifyDomain, accessToken)
  if (result.success && result.orders && result.orders.length > 0) {
    return {
      success: true,
      order: result.orders[0],
    }
  }
  return {
    success: false,
    message: result.message || 'Nu s-au găsit comenzi pentru acest email.',
  }
}

/**
 * Caută o comandă folosind strategia progresivă:
 * 1. Număr comandă
 * 2. Telefon
 * 3. Nume (nu se validează doar după nume)
 * 4. Email
 */
export async function searchOrderProgressive(
  orderNumber: string | null,
  phone: string | null,
  fullName: string | null,
  email: string | null,
  shopifyDomain: string,
  accessToken: string
): Promise<SearchOrderResult> {
  // Pasul 1: Căutare după număr comandă
  if (orderNumber) {
    const result = await searchOrderByOrderNumber(orderNumber, shopifyDomain, accessToken)
    if (result.success) {
      return result
    }
  }

  // Pasul 2: Căutare după telefon
  if (phone) {
    const result = await searchOrderByPhone(phone, shopifyDomain, accessToken)
    if (result.success) {
      return result
    }
  }

  // Pasul 3: Căutare după nume (nu se validează doar după nume)
  if (fullName) {
    const result = await searchOrdersByName(fullName, shopifyDomain, accessToken)
    // Dacă nu găsim după nume, continuăm la email
    if (!result.success && !email) {
      return {
        success: false,
        message: 'Vă rugăm să introduceți email-ul pentru a continua căutarea.',
      }
    }
  }

  // Pasul 4: Căutare după email
  if (email) {
    const result = await searchOrderByEmail(email, shopifyDomain, accessToken)
    return result
  }

  return {
    success: false,
    message: 'Nu s-au putut găsi comenzi. Vă rugăm să verificați datele introduse.',
  }
}

/**
 * Verifică dacă comanda a fost plătită cu cardul
 * Folosește verificări multiple pentru siguranță:
 * 1. Gateway-ul indică plată cu cardul (inclusiv shopify_payments)
 * 2. Statusul financiar este 'paid' (comanda este efectiv plătită)
 * 3. Nu mai există sume neachitate (total_outstanding === '0.00')
 */
function wasPaidWithCard(order: ShopifyOrder): boolean {
  // 1. Verifică gateway-urile de plată
  const paymentGateway = order.payment_gateway_names?.[0]?.toLowerCase() || 
                         order.payment_method?.toLowerCase() || 
                         order.gateway?.toLowerCase() || ''
  
  // Gateway-uri care indică plată cu cardul
  const cardGateways = ['shopify_payments', 'card', 'credit', 'debit', 'visa', 'mastercard', 'amex', 'stripe', 'paypal']
  const isCardGateway = cardGateways.some(gateway => paymentGateway.includes(gateway))
  
  // 2. Verifică statusul financiar (OBLIGATORIU)
  const isPaid = order.financial_status === 'paid'
  
  // 3. Verifică că nu mai există sume neachitate
  const totalOutstanding = parseFloat(order.total_outstanding || '0')
  const isFullyPaid = totalOutstanding === 0
  
  // Returnează true DOAR dacă toate condițiile sunt îndeplinite simultan
  return isCardGateway && isPaid && isFullyPaid
}

/**
 * Convertește o comandă Shopify în formatul aplicației
 */
export function convertShopifyOrderToAppFormat(order: ShopifyOrder) {
  const ship = order.shipping_address
  const shipName = ship?.name || [ship?.first_name, ship?.last_name].filter(Boolean).join(' ').trim()
  const shippingAddress = ship ? {
    nume: shipName || (order.billing_address.name || `${order.billing_address.first_name} ${order.billing_address.last_name}`),
    telefon: ship.phone || order.phone || '',
    strada: [ship.address1, ship.address2].filter(Boolean).join(', '),
    oras: ship.city || '',
    judet: ship.province || ship.province_code || '',
    codPostal: ship.zip || '',
    tara: ship.country || '',
  } : undefined

  return {
    id: order.id,
    nume: order.billing_address.name || `${order.billing_address.first_name} ${order.billing_address.last_name}`,
    numarComanda: order.name,
    telefon: order.phone || ship?.phone || '',
    email: order.email,
    shippingAddress,
    paymentMethod: order.payment_gateway_names?.[0] || order.payment_method || order.gateway || '',
    wasPaidWithCard: wasPaidWithCard(order),
    products: [
      // Produse normale din line_items
      ...order.line_items.map(item => {
        // Shopify returnează `item.price` ca preț unitar ÎNAINTE de discount-uri.
        // discount_allocations conține discount-ul total alocat pe linie (toate unitățile).
        // Pentru refund corect trebuie să folosim prețul efectiv plătit per unitate.
        const itemDiscountTotal = item.discount_allocations?.reduce((sum, disc) => sum + parseFloat(disc.amount || '0'), 0) || 0
        const qty = item.quantity || 1
        const pretListatPerUnit = parseFloat(item.price)
        const discountPerUnit = itemDiscountTotal / qty
        const pretPlatitPerUnit = Math.max(0, pretListatPerUnit - discountPerUnit)

        return {
          id: item.id.toString(),
          nume: item.title,
          cantitate: item.quantity,
          pret: pretPlatitPerUnit, // Prețul efectiv plătit per unitate (DUPĂ discount)
          pretInitial: pretListatPerUnit, // Prețul listat per unitate (ÎNAINTE de discount)
          discount: discountPerUnit, // Discount per unitate
          variant_id: item.variant_id?.toString(),
          product_id: item.product_id ? String(item.product_id) : undefined,
          sku: item.sku || '',
          variant_title: item.variant_title || '',
          imagine: '' as string, // populat ulterior prin enrichOrdersWithProductImages
        }
      }),
      // Taxe de transport din shipping_lines
      ...(order.shipping_lines || []).map((shipping, index) => ({
        id: `shipping-${shipping.id || index}`,
        nume: shipping.title || 'Transport',
        cantitate: 1,
        pret: parseFloat(shipping.price || '0'),
        variant_id: undefined,
        sku: '',
        variant_title: '',
      })),
    ],
    total: parseFloat(order.total_price),
    currency: order.currency,
    dataComanda: order.created_at,
  }
}

/**
 * Convertește multiple comenzi Shopify în formatul aplicației
 */
export function convertShopifyOrdersToAppFormat(orders: ShopifyOrder[]) {
  return orders.map(order => convertShopifyOrderToAppFormat(order))
}

// Cache simplu pentru imagini (evită re-fetch în 5 minute)
const imageCache = new Map<string, { url: string; expiresAt: number }>()
const IMAGE_CACHE_TTL_MS = 5 * 60_000

/**
 * Aduce într-un singur apel imaginile pentru o listă de product_id-uri.
 * Returnează Map<product_id, image_url>.
 */
export async function fetchProductImages(
  productIds: string[],
  shopifyDomain: string,
  accessToken: string
): Promise<Map<string, string>> {
  const result = new Map<string, string>()
  const now = Date.now()
  const toFetch: string[] = []

  for (const id of productIds) {
    if (!id) continue
    const cached = imageCache.get(id)
    if (cached && cached.expiresAt > now) {
      result.set(id, cached.url)
    } else {
      toFetch.push(id)
    }
  }

  if (toFetch.length === 0) return result

  try {
    const idsParam = toFetch.join(',')
    const url = `https://${shopifyDomain}/admin/api/2026-04/products.json?ids=${idsParam}&fields=id,image,images&limit=250`
    const response = await fetch(url, {
      headers: {
        'X-Shopify-Access-Token': accessToken,
        'Content-Type': 'application/json',
      },
    })
    if (!response.ok) {
      console.warn('fetchProductImages failed:', response.status)
      return result
    }
    const data = await response.json()
    const products: Array<{ id: number | string; image?: { src?: string }; images?: Array<{ src?: string }> }> = data.products || []
    for (const p of products) {
      const src = p.image?.src || p.images?.[0]?.src || ''
      const idStr = String(p.id)
      if (src) {
        result.set(idStr, src)
        imageCache.set(idStr, { url: src, expiresAt: now + IMAGE_CACHE_TTL_MS })
      }
    }
  } catch (err) {
    console.warn('fetchProductImages exception:', err)
  }

  return result
}

/**
 * Îmbogățește lista de comenzi convertite cu imaginile produselor.
 * Mutează în loc — pentru simplitate.
 */
export async function enrichOrdersWithProductImages(
  orders: ReturnType<typeof convertShopifyOrdersToAppFormat>,
  shopifyDomain: string,
  accessToken: string
): Promise<void> {
  const productIds = new Set<string>()
  for (const order of orders) {
    for (const p of order.products) {
      const pid = (p as any).product_id
      if (pid) productIds.add(String(pid))
    }
  }
  if (productIds.size === 0) return

  const images = await fetchProductImages(Array.from(productIds), shopifyDomain, accessToken)
  for (const order of orders) {
    for (const p of order.products) {
      const pid = (p as any).product_id
      if (pid && images.has(String(pid))) {
        ;(p as any).imagine = images.get(String(pid))
      }
    }
  }
}

