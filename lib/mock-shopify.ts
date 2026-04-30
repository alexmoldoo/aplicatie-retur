/**
 * Mock Shopify — comenzi fictive pentru test end-to-end fără Shopify real.
 *
 * Activare: setați `SHOPIFY_MOCK=true` în `.env.local`.
 * Comenzile sunt definite mai jos și acoperă toate căile aplicației:
 *  - Pas 2 (selecție din mai multe comenzi)
 *  - Pas 3 (produse cu și fără discount)
 *  - Pas 4 (refund pe card vs IBAN)
 *  - Pas 5 (toate cele 3 metode de trimitere)
 */

import type { ShopifyOrder } from './shopify'

export const isShopifyMock = process.env.SHOPIFY_MOCK === 'true'

/**
 * Două comenzi pentru același client (Ion Popescu / +40712345678 / ion.popescu@test.ro):
 *   - #TEST-001 — plătită RAMBURS (test path IBAN). 2 produse, unul cu discount.
 *   - #TEST-002 — plătită CARD (test path refund pe card). 1 produs cu discount.
 * Ambele comenzi sunt eligibile (data recentă, în termenul de 15 zile).
 */
function buildOrders(): ShopifyOrder[] {
  const now = new Date()
  // Două zile în urmă — sigur eligibilă (sub 15 zile, peste data limită aug 2025)
  const recent = new Date(now.getTime() - 2 * 24 * 3600 * 1000).toISOString()

  return [
    {
      id: 'mock-order-1',
      name: '#TEST-001',
      email: 'ion.popescu@test.ro',
      phone: '+40712345678',
      billing_address: {
        name: 'Ion Popescu',
        first_name: 'Ion',
        last_name: 'Popescu',
      },
      shipping_address: {
        name: 'Ion Popescu',
        first_name: 'Ion',
        last_name: 'Popescu',
        address1: 'Str. Mihai Eminescu 25',
        city: 'Cluj-Napoca',
        province: 'Cluj',
        province_code: 'CJ',
        zip: '400123',
        country: 'România',
        phone: '+40712345678',
      },
      line_items: [
        {
          id: 'mock-line-1-1',
          title: 'Tricou Premium Negru — Mărimea L',
          quantity: 2,
          price: '89.90', // pret listat ÎNAINTE de discount
          variant_id: 'mock-var-1-1',
          product_id: 'mock-prod-1-1',
          sku: 'TRC-PREM-NEG-L',
          variant_title: 'L / Negru',
          discount_allocations: [
            { amount: '20.00', discount_application_index: 0 }, // 10 RON discount per buc × 2 buc
          ],
        },
        {
          id: 'mock-line-1-2',
          title: 'Pantaloni Cargo — Mărimea 32',
          quantity: 1,
          price: '199.90',
          variant_id: 'mock-var-1-2',
          product_id: 'mock-prod-1-2',
          sku: 'PNT-CRG-32',
          variant_title: '32 / Verde',
          // fără discount
        },
      ],
      discount_codes: [{ code: 'SUMMER10', amount: '20.00', type: 'percentage' }],
      total_discounts: '20.00',
      subtotal_price: '359.70',
      shipping_lines: [],
      created_at: recent,
      total_price: '359.70',
      currency: 'RON',
      payment_gateway_names: ['Cash on Delivery (COD)'],
      payment_method: 'cash_on_delivery',
      gateway: 'manual',
      financial_status: 'paid',
      total_outstanding: '0.00',
    },
    {
      id: 'mock-order-2',
      name: '#TEST-002',
      email: 'ion.popescu@test.ro',
      phone: '+40712345678',
      billing_address: {
        name: 'Ion Popescu',
        first_name: 'Ion',
        last_name: 'Popescu',
      },
      shipping_address: {
        name: 'Ion Popescu',
        first_name: 'Ion',
        last_name: 'Popescu',
        address1: 'Str. Mihai Eminescu 25',
        city: 'Cluj-Napoca',
        province: 'Cluj',
        province_code: 'CJ',
        zip: '400123',
        country: 'România',
        phone: '+40712345678',
      },
      line_items: [
        {
          id: 'mock-line-2-1',
          title: 'Bocanci Iarnă Munte — Mărimea 43',
          quantity: 1,
          price: '399.00',
          variant_id: 'mock-var-2-1',
          product_id: 'mock-prod-2-1',
          sku: 'BCN-MNT-43',
          variant_title: '43 / Maro',
          discount_allocations: [
            { amount: '50.00', discount_application_index: 0 }, // 50 RON discount
          ],
        },
      ],
      discount_codes: [{ code: 'WINTER50', amount: '50.00', type: 'fixed_amount' }],
      total_discounts: '50.00',
      subtotal_price: '349.00',
      shipping_lines: [],
      created_at: recent,
      total_price: '349.00',
      currency: 'RON',
      payment_gateway_names: ['shopify_payments'],
      payment_method: 'shopify_payments',
      gateway: 'shopify_payments',
      financial_status: 'paid',
      total_outstanding: '0.00',
    },
  ]
}

const MOCK_ORDERS = buildOrders()

function normalize(s: string): string {
  return (s || '').toLowerCase().trim()
}
function normalizePhone(p: string): string {
  return (p || '').replace(/[\s\-+]/g, '')
}

export function findMockOrders(filter: {
  orderNumber?: string
  phone?: string
  email?: string
  fullName?: string
}): ShopifyOrder[] {
  const { orderNumber, phone, email, fullName } = filter

  if (orderNumber) {
    const q = normalize(orderNumber).replace(/^#/, '')
    const match = MOCK_ORDERS.filter(o => normalize(o.name).replace(/^#/, '') === q)
    if (match.length > 0) return match
  }

  if (phone) {
    const q = normalizePhone(phone)
    const match = MOCK_ORDERS.filter(o => {
      const op = normalizePhone(o.phone)
      return op === q || op.endsWith(q) || q.endsWith(op)
    })
    if (match.length > 0) return match
  }

  if (email) {
    const q = normalize(email)
    const match = MOCK_ORDERS.filter(o => normalize(o.email) === q)
    if (match.length > 0) return match
  }

  if (fullName) {
    const q = normalize(fullName)
    const match = MOCK_ORDERS.filter(o => {
      const on = normalize(o.billing_address.name)
      // matching permisiv pentru ușurința testării
      return on.includes(q) || q.includes(on)
    })
    if (match.length > 0) return match
  }

  return []
}
