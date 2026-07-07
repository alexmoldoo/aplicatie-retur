/**
 * Comenzi de test DOAR pentru local (NODE_ENV !== 'production'), ca fluxul de
 * retur să poată fi verificat fără o conexiune Shopify vie.
 *
 *   TESTCARD    → plată cu card (refund pe card, fără IBAN)
 *   TESTIBAN    → ramburs/transfer (cere IBAN)
 *   TESTEXPIRED → comandă veche de 60 zile (pentru testarea deblocării din admin)
 *
 * Gate strict pe non-producție în `isDevTestOrderNumber`. Pe Vercel (producție)
 * NODE_ENV='production', deci sunt automat dezactivate.
 */
import { calculateEligibility } from './eligibility'
import { createCustomerToken } from './customer-session'
import { normalizeOrderNumber } from './db'

const TEST_RE = /^TEST(CARD|IBAN|EXPIRED)$/i

export function isDevTestOrderNumber(orderNumber: string | null | undefined): boolean {
  return (
    process.env.NODE_ENV !== 'production' &&
    typeof orderNumber === 'string' &&
    TEST_RE.test(orderNumber.trim())
  )
}

/**
 * Construiește comanda de test în formatul aplicației, aplicând deblocarea manuală
 * dacă numărul e în lista de overrides (la fel ca fluxul real).
 */
export function buildDevTestOrder(orderNumber: string, eligibilityOverrides: string[] = []) {
  const isCard = /card/i.test(orderNumber)
  const isExpired = /expired/i.test(orderNumber)
  const numar = isExpired ? '#TESTEXPIRED' : isCard ? '#TESTCARD' : '#TESTIBAN'
  // Expirat = comandă veche de 60 de zile; altfel azi.
  const dataComanda = isExpired
    ? new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString()
    : new Date().toISOString()

  const baseElig = calculateEligibility(dataComanda)
  const isUnblocked = new Set((eligibilityOverrides || []).map(normalizeOrderNumber)).has(
    normalizeOrderNumber(numar)
  )
  const eligibility = isUnblocked
    ? { ...baseElig, status: 'eligible' as const, overridden: true }
    : baseElig

  return {
    id: 999000001,
    nume: 'Client Test',
    numarComanda: numar,
    telefon: '0712345678',
    email: 'test@local.dev',
    shippingAddress: {
      nume: 'Client Test',
      telefon: '0712345678',
      strada: 'Str. Test 1',
      oras: 'Bucuresti',
      judet: 'Bucuresti',
      codPostal: '010101',
      tara: 'Romania',
    },
    paymentMethod: isCard ? 'shopify_payments' : 'Cash on Delivery (COD)',
    wasPaidWithCard: isCard,
    products: [
      {
        id: 'test-line-1',
        nume: 'Produs Test A',
        cantitate: 1,
        pret: 99.99,
        pretInitial: 99.99,
        discount: 0,
        variant_id: 'v1',
        product_id: 'p1',
        sku: 'TEST-A',
        variant_title: '',
        imagine: '',
      },
    ],
    total: 99.99,
    currency: 'RON',
    dataComanda,
    eligibility,
    sessionToken: createCustomerToken({
      orderId: '999000001',
      numarComanda: numar,
      nume: 'Client Test',
      wasPaidWithCard: isCard,
    }),
    existingReturn: null,
  }
}
