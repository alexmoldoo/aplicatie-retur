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
  line_items: Array<{
    id: string
    title: string
    quantity: number
    price: string
    variant_id: string
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
}

export interface SearchOrderResult {
  success: boolean
  order?: ShopifyOrder
  message?: string
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

    for (const pattern of searchPatterns) {
      const response = await fetch(
        `https://${shopifyDomain}/admin/api/2024-01/orders.json?name=${pattern}&status=any`,
        {
          headers: {
            'X-Shopify-Access-Token': accessToken,
            'Content-Type': 'application/json',
          },
        }
      )

      if (!response.ok) {
        continue // Încearcă următorul pattern
      }

      const data = await response.json()
      
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
          `https://${shopifyDomain}/admin/api/2024-01/customers.json?phone=${encodeURIComponent(phoneVariant)}&limit=250`,
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
          `https://${shopifyDomain}/admin/api/2024-01/orders.json?customer_id=${customer.id}&status=any&limit=250`,
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
            `https://${shopifyDomain}/admin/api/2024-01/orders.json?email=${encodeURIComponent(customer.email)}&status=any&limit=250`,
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
      `https://${shopifyDomain}/admin/api/2024-01/orders.json?email=${encodeURIComponent(cleanEmail)}&status=any&limit=250`,
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
  return {
    id: order.id,
    nume: order.billing_address.name || `${order.billing_address.first_name} ${order.billing_address.last_name}`,
    numarComanda: order.name,
    telefon: order.phone || '',
    email: order.email,
    paymentMethod: order.payment_gateway_names?.[0] || order.payment_method || order.gateway || '',
    wasPaidWithCard: wasPaidWithCard(order),
    products: [
      // Produse normale din line_items
      ...order.line_items.map(item => {
        // Calculează discount-ul pentru acest item
        const itemDiscount = item.discount_allocations?.reduce((sum, disc) => sum + parseFloat(disc.amount || '0'), 0) || 0
        const pretInitial = parseFloat(item.price) + itemDiscount // Prețul înainte de discount
        const pretDupaDiscount = parseFloat(item.price) // Prețul după discount (cel returnat de Shopify)
        
        return {
          id: item.id.toString(),
          nume: item.title,
          cantitate: item.quantity,
          pret: pretDupaDiscount, // Prețul după discount
          pretInitial: pretInitial, // Prețul inițial
          discount: itemDiscount, // Valoarea discount-ului
          variant_id: item.variant_id?.toString(),
          sku: item.sku || '',
          variant_title: item.variant_title || '',
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

