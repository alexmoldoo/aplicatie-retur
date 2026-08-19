import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { findReturnById, updateReturn, getConfig } from '@/lib/db'
import { getCurrentUserFromCookies } from '@/lib/auth'
import { logAudit } from '@/lib/audit'
import { getClientIp } from '@/lib/security'
import { isSmartbillConfigured, reverseInvoice } from '@/lib/smartbill'
import {
  searchOrderByOrderNumber,
  extractInvoiceFromOrder,
  getShopifyAccessToken,
} from '@/lib/shopify'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * POST /api/admin/returns/[id]/storno
 *
 * body: { action: 'preview' | 'execute', serie?: string, numar?: string }
 *
 * preview → găsește factura asociată comenzii returului (din Shopify
 *   note_attributes puse de xConnector) și spune dacă SmartBill e configurat.
 * execute → stornează factura ORIGINALĂ (serie+număr) în SmartBill și salvează
 *   rezultatul pe retur. Fără token SmartBill configurat rulează în mod DEMO:
 *   arată exact ce ar storna, dar nu apelează SmartBill și nu salvează nimic.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const ip = getClientIp(request)

  const cookieStore = await cookies()
  const user = await getCurrentUserFromCookies(cookieStore)
  if (!user) {
    return NextResponse.json({ success: false, message: 'Neautorizat' }, { status: 401 })
  }

  const body = await request.json().catch(() => ({}))
  const action = body.action === 'execute' ? 'execute' : 'preview'
  const manualSerie = typeof body.serie === 'string' ? body.serie.trim() : ''
  const manualNumar = typeof body.numar === 'string' ? body.numar.trim() : ''

  const returnData = await findReturnById(id)
  if (!returnData) {
    return NextResponse.json({ success: false, message: 'Returul nu a fost găsit.' }, { status: 404 })
  }

  // Deja stornat? Nu stornăm de două ori.
  const existing = returnData.refundData?.factura
  if (existing?.storno) {
    return NextResponse.json({
      success: true,
      alreadyStorno: true,
      factura: existing,
      message: `Factura ${existing.serie} ${existing.numar} este deja stornată (storno ${existing.storno.serie} ${existing.storno.numar} din ${existing.storno.data}).`,
    })
  }

  const config = await getConfig()
  const smartbillConfigured = isSmartbillConfigured(config.smartbill)

  // 1. Determină factura: manual > salvată pe retur > detectată din Shopify.
  let factura: { serie: string; numar: string } | null = null
  let detectError: string | null = null

  if (manualSerie && manualNumar) {
    factura = { serie: manualSerie, numar: manualNumar }
  } else if (existing?.serie && existing?.numar) {
    factura = { serie: existing.serie, numar: existing.numar }
  } else if (
    process.env.NODE_ENV !== 'production' &&
    /^#?TEST/i.test(returnData.numarComanda)
  ) {
    // Comandă de test locală → factură fictivă, ca demo-ul să meargă fără Shopify.
    factura = { serie: 'DEMO', numar: '4444' }
  } else {
    try {
      const shopifyDomain = config.shopify.domain || process.env.SHOPIFY_DOMAIN
      if (!shopifyDomain) throw new Error('Shopify neconfigurat (lipsește domeniul).')
      const token = await getShopifyAccessToken({
        domain: shopifyDomain,
        legacyToken: config.shopify.accessToken || process.env.SHOPIFY_ACCESS_TOKEN,
        clientId: config.shopify.clientId || process.env.SHOPIFY_CLIENT_ID,
        clientSecret: config.shopify.clientSecret || process.env.SHOPIFY_CLIENT_SECRET,
      })
      const result = await searchOrderByOrderNumber(returnData.numarComanda, shopifyDomain, token)
      if (result.success && result.order) {
        factura = extractInvoiceFromOrder(result.order)
        if (!factura) detectError = 'Comanda există în Shopify, dar nu are factură atașată (xconnector-invoice-url lipsă).'
      } else {
        detectError = 'Comanda nu a fost găsită în Shopify.'
      }
    } catch (e) {
      detectError = e instanceof Error ? e.message : 'Eroare la căutarea comenzii în Shopify.'
    }
  }

  if (action === 'preview') {
    return NextResponse.json({
      success: true,
      orderNumber: returnData.numarComanda,
      factura,
      detectError,
      smartbillConfigured,
    })
  }

  // action === 'execute'
  if (!factura) {
    return NextResponse.json(
      { success: false, message: detectError || 'Completează seria și numărul facturii.' },
      { status: 400 }
    )
  }

  if (!smartbillConfigured) {
    // Mod DEMO — nu apelăm SmartBill, nu salvăm nimic.
    await logAudit({
      action: 'storno_invoice_demo',
      ip,
      details: { returnId: returnData.idRetur, numarComanda: returnData.numarComanda, factura },
    })
    return NextResponse.json({
      success: true,
      demo: true,
      factura,
      message: `DEMO — nicio factură nu a fost stornată. S-ar storna factura ${factura.serie} ${factura.numar} pentru comanda ${returnData.numarComanda}. Configurează SmartBill (email + token + CIF) pentru stornare reală.`,
    })
  }

  try {
    const storno = await reverseInvoice(config.smartbill, factura.serie, factura.numar)

    // Persistă pe retur factura originală + documentul de storno.
    const newRefundData = {
      ...returnData.refundData,
      factura: { serie: factura.serie, numar: factura.numar, storno },
    }
    await updateReturn(returnData.idRetur, { refundData: newRefundData })

    await logAudit({
      action: 'storno_invoice',
      ip,
      details: {
        returnId: returnData.idRetur,
        numarComanda: returnData.numarComanda,
        factura,
        storno,
        user: user.email,
      },
    })

    return NextResponse.json({
      success: true,
      factura: { ...factura, storno },
      message: `Factura ${factura.serie} ${factura.numar} a fost stornată: storno ${storno.serie} ${storno.numar} din ${storno.data}.`,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Eroare la stornare.'
    await logAudit({
      action: 'storno_invoice_fail',
      ip,
      details: { returnId: returnData.idRetur, factura, error: msg },
    })
    return NextResponse.json({ success: false, message: msg }, { status: 502 })
  }
}
