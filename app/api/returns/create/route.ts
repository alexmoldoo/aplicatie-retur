import { NextRequest, NextResponse } from 'next/server'
import { createReturn, updateReturnDocuments, OrderData, Product, RefundData, generateReturnId } from '@/lib/db'
import { generateQRCode } from '@/lib/qrcode-generator'
import { generateReturnPDF } from '@/lib/pdf-generator'
import { verifyCustomerToken } from '@/lib/customer-session'
import { logAudit } from '@/lib/audit'
import { getClientIp, makeRateLimiter, isAllowedOrigin, formatWaitTime } from '@/lib/security'
import { isBlocked, recordFail } from '@/lib/ip-blocklist'
import { createReturnAWB } from '@/lib/sameday'
import { validateRomanianIBAN } from '@/lib/iban-validator'
import { normalizeCode, validateCodeForRedemption, redeemCode, releaseCode, type CodeKind } from '@/lib/return-codes'
import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'

const MAX_PRODUCTS = 50
const MAX_QTY_PER_PRODUCT = 50
const MAX_PRICE_PER_PRODUCT = 50000
const MAX_SIGNATURE_BYTES = 250_000 // ~180KB PNG base64 reasonable
const DEFAULT_CURIER_COST = 19.99

const _sbUrl = (process.env.SUPABASE_URL || '').trim()
const _sbKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim()
const _supabase = _sbUrl && _sbKey ? createClient(_sbUrl, _sbKey) : null

/**
 * Citește costul curier configurat de admin în /admin/Setări (stocat în
 * app_config.return_info.transportCosts.curier). Folosit ca singura sursă
 * de adevăr server-side pentru validarea costului trimis de client.
 */
async function getCurierCost(): Promise<number> {
  if (!_supabase) return DEFAULT_CURIER_COST
  try {
    const { data } = await _supabase
      .from('app_config')
      .select('return_info')
      .order('updated_at', { ascending: false })
      .limit(1)
      .single()
    const c = Number((data?.return_info as any)?.transportCosts?.curier)
    return Number.isFinite(c) && c >= 0 ? c : DEFAULT_CURIER_COST
  } catch {
    return DEFAULT_CURIER_COST
  }
}

export const dynamic = 'force-dynamic'

// Max 3 retururi / oră / IP — prevenția spam
const checkRateLimit = makeRateLimiter({ max: 3, windowMs: 60 * 60_000 })

export async function POST(request: NextRequest) {
  const ip = getClientIp(request)

  try {
    // 0. Verifică dacă IP-ul e blocat (după prea multe eșecuri în trecut)
    const block = isBlocked(ip)
    if (block.blocked) {
      await logAudit({ action: 'create_return_rate_limited', ip, details: { reason: 'ip_blocked', retryAfter: block.retryAfterSeconds } })
      return NextResponse.json(
        {
          success: false,
          message: 'Acces temporar blocat din cauza prea multor încercări eșuate. Te rugăm să contactezi suportul dacă ai nevoie de ajutor.',
        },
        { status: 429, headers: { 'Retry-After': String(block.retryAfterSeconds || 0) } }
      )
    }

    // 1. Verificare origin (CSRF light) — refuză apeluri din afara domeniului
    if (!isAllowedOrigin(request)) {
      recordFail(ip)
      await logAudit({ action: 'create_return_origin_blocked', ip })
      return NextResponse.json(
        { success: false, message: 'Acces refuzat.' },
        { status: 403 }
      )
    }

    // 2. Rate limit per IP
    const rl = checkRateLimit(ip)
    if (!rl.allowed) {
      await logAudit({ action: 'create_return_rate_limited', ip, details: { retryAfter: rl.retryAfter } })
      return NextResponse.json(
        {
          success: false,
          message: `Prea multe retururi în scurt timp. Te rugăm să aștepți ${formatWaitTime(rl.retryAfter)} înainte să încerci din nou.`,
        },
        { status: 429, headers: { 'Retry-After': String(rl.retryAfter) } }
      )
    }

    const body = await request.json()
    const {
      orderData,
      products,
      refundData,
      signature,
      sessionToken,
    }: {
      orderData: OrderData
      products: Product[]
      refundData: RefundData
      signature: string
      sessionToken?: string
    } = body

    // Cod de retur gratuit (opțional, propagat din Pas 5). Forțează curier + cost 0.
    const codeRedemptionRaw = typeof body.codeRedemption === 'string' ? body.codeRedemption : null
    const codeRedemption = codeRedemptionRaw ? normalizeCode(codeRedemptionRaw) : null
    if (codeRedemptionRaw && !codeRedemption) {
      await logAudit({ action: 'create_return_invalid_code', ip, details: { reason: 'invalid_format' } })
      return NextResponse.json(
        { success: false, message: 'Codul de retur are un format invalid.' },
        { status: 400 }
      )
    }
    let codeWaiver = false
    let codeKind: CodeKind | null = null
    if (codeRedemption) {
      const check = await validateCodeForRedemption(codeRedemption)
      if (!check.valid) {
        await logAudit({ action: 'create_return_invalid_code', ip, details: { code: codeRedemption, reason: check.reason } })
        return NextResponse.json(
          { success: false, message: 'Codul de retur este invalid sau a fost deja folosit.' },
          { status: 400 }
        )
      }
      codeWaiver = true
      codeKind = check.kind || 'free_shipping'
    }
    // Pentru decont direct (cod cu prefix D): magazinul plătește direct, clientul
    // NU mai trimite produsul. Sărim AWB, ignorăm metodaTrimitere, totalRefund = subtotal.
    const isDirectRefund = codeKind === 'direct_refund'

    // 3. Verificare token de sesiune (emis în Pas 1)
    const session = verifyCustomerToken(sessionToken)
    if (!session) {
      recordFail(ip)
      await logAudit({
        action: 'create_return_invalid_token',
        ip,
        details: { hadToken: !!sessionToken, claimedOrder: orderData?.numarComanda },
      })
      return NextResponse.json(
        {
          success: false,
          message: 'Sesiune invalidă sau expirată. Te rugăm să reiei procesul de la pasul 1.',
        },
        { status: 401 }
      )
    }

    // 4. Verificare că tokenul corespunde comenzii din payload
    if (orderData?.numarComanda !== session.numarComanda) {
      recordFail(ip)
      await logAudit({
        action: 'create_return_invalid_token',
        ip,
        details: { reason: 'order_mismatch', tokenOrder: session.numarComanda, payloadOrder: orderData?.numarComanda },
      })
      return NextResponse.json(
        { success: false, message: 'Datele comenzii nu corespund cu sesiunea. Te rugăm să reiei procesul.' },
        { status: 401 }
      )
    }

    // 5. Validare date
    if (!orderData || !products || !refundData || !signature) {
      await logAudit({ action: 'create_return_fail', ip, details: { reason: 'missing_data' } })
      return NextResponse.json(
        { success: false, message: 'Date incomplete.' },
        { status: 400 }
      )
    }

    // Validare produse: array, dimensiune, cantități + prețuri pozitive
    if (!Array.isArray(products) || products.length === 0 || products.length > MAX_PRODUCTS) {
      await logAudit({ action: 'create_return_fail', ip, details: { reason: 'invalid_products_array', count: products?.length } })
      return NextResponse.json(
        { success: false, message: 'Lista de produse este invalidă.' },
        { status: 400 }
      )
    }
    for (const p of products) {
      const qty = p.cantitateReturnata || (p.selected ? p.cantitate : 0)
      const price = Number(p.pret)
      if (!Number.isFinite(qty) || qty < 0 || qty > MAX_QTY_PER_PRODUCT) {
        await logAudit({ action: 'create_return_fail', ip, details: { reason: 'invalid_quantity', qty } })
        return NextResponse.json({ success: false, message: 'Cantitate invalidă.' }, { status: 400 })
      }
      if (!Number.isFinite(price) || price < 0 || price > MAX_PRICE_PER_PRODUCT) {
        await logAudit({ action: 'create_return_fail', ip, details: { reason: 'invalid_price', price } })
        return NextResponse.json({ success: false, message: 'Preț invalid.' }, { status: 400 })
      }
    }

    // Validare semnătură (data URL PNG, sub limită)
    if (
      typeof signature !== 'string' ||
      !signature.startsWith('data:image/png;base64,') ||
      signature.length > MAX_SIGNATURE_BYTES
    ) {
      await logAudit({ action: 'create_return_fail', ip, details: { reason: 'invalid_signature' } })
      return NextResponse.json(
        { success: false, message: 'Semnătura este invalidă.' },
        { status: 400 }
      )
    }

    // Validare IBAN (același validator ca în UI)
    const ibanCheck = validateRomanianIBAN(refundData.iban || '')
    if (!ibanCheck.valid) {
      await logAudit({ action: 'create_return_fail', ip, details: { reason: 'invalid_iban' } })
      return NextResponse.json(
        { success: false, message: ibanCheck.error || 'IBAN invalid.' },
        { status: 400 }
      )
    }
    if (!refundData.numeTitular || refundData.numeTitular.trim().length < 2) {
      await logAudit({ action: 'create_return_fail', ip, details: { reason: 'missing_holder' } })
      return NextResponse.json(
        { success: false, message: 'Numele titularului este obligatoriu.' },
        { status: 400 }
      )
    }

    // Calculare subtotal produse (fără cost transport)
    const subtotalProduse = products.reduce((sum, p) => {
      const cantitateReturnata = p.cantitateReturnata || (p.selected ? p.cantitate : 0)
      return sum + (p.pret * cantitateReturnata)
    }, 0)

    // Validare metoda de trimitere + cost transport (whitelist server-side)
    // Pentru decont direct sărim toată secțiunea: clientul nu mai trimite coletul.
    let metodaTrimitere: 'curier' | 'manual'
    let costTransport = 0
    if (isDirectRefund) {
      // Forțăm „curier" pe DB pentru consistență (oricum nu generăm AWB).
      // Cost 0 — magazinul plătește subtotalul complet, fără deducere de transport.
      metodaTrimitere = 'curier'
      costTransport = 0
    } else {
      const metodaTrimitereRaw = refundData.metodaTrimitere
      const costTransportRaw = typeof refundData.costTransport === 'number' ? refundData.costTransport : 0

      if (!metodaTrimitereRaw || (metodaTrimitereRaw !== 'curier' && metodaTrimitereRaw !== 'manual')) {
        await logAudit({ action: 'create_return_fail', ip, details: { reason: 'missing_shipping_method' } })
        return NextResponse.json(
          { success: false, message: 'Metoda de trimitere lipsește.' },
          { status: 400 }
        )
      }
      metodaTrimitere = metodaTrimitereRaw

      // Cod „curier gratuit" forțează curier — refuzăm dacă clientul a trimis „manual".
      if (codeWaiver && metodaTrimitere !== 'curier') {
        await logAudit({
          action: 'create_return_fail',
          ip,
          details: { reason: 'code_requires_curier', method: metodaTrimitere },
        })
        return NextResponse.json(
          { success: false, message: 'Codul de retur forțează metoda „Curier la adresă".' },
          { status: 400 }
        )
      }

      // Forțează costul corect server-side: îl citim din configul admin.
      const configuredCurierCost = await getCurierCost()
      costTransport = codeWaiver
        ? 0
        : (metodaTrimitere === 'curier' ? configuredCurierCost : 0)
      if (Math.abs(costTransportRaw - costTransport) > 0.01) {
        await logAudit({
          action: 'create_return_fail',
          ip,
          details: { reason: 'cost_transport_mismatch', sent: costTransportRaw, expected: costTransport },
        })
        return NextResponse.json(
          { success: false, message: 'Cost transport invalid.' },
          { status: 400 }
        )
      }
    }

    // Total final după deducerea costului de transport
    const totalRefund = Math.max(0, subtotalProduse - costTransport)

    // Generează ID retur
    const idRetur = await generateReturnId()

    // Redeem atomic codul ÎNAINTE de AWB. Dacă pierde race-ul → 409.
    // Dacă pașii ulteriori (AWB / DB insert) pică, eliberăm codul ca să poată fi
    // refolosit (vezi `releaseCode` în blocurile catch de mai jos).
    if (codeWaiver && codeRedemption) {
      const ok = await redeemCode(codeRedemption, idRetur)
      if (!ok) {
        await logAudit({
          action: 'create_return_code_race',
          ip,
          details: { code: codeRedemption, returnId: idRetur },
        })
        return NextResponse.json(
          {
            success: false,
            message: 'Codul tocmai a fost folosit de altcineva. Te rugăm să reîmprospătezi pagina.',
          },
          { status: 409 }
        )
      }
    }

    // Obține baseUrl pentru generarea link-ului QR code
    const origin = request.headers.get('origin') || request.headers.get('host')
    const protocol = request.headers.get('x-forwarded-proto') || 'http'
    const baseUrl = origin ? `${protocol}://${origin}` : process.env.NEXT_PUBLIC_BASE_URL || ''

    // Generează QR code cu link către pagina de detalii
    const qrCodeDataUrl = await generateQRCode(idRetur, baseUrl)

    // Pregătește orderData doar cu nume (fără email și telefon)
    const orderDataForReturn: OrderData = {
      nume: orderData.nume,
      numarComanda: orderData.numarComanda,
    }

    // Pregătește refundData doar cu IBAN și numeTitular (fără metodaRambursare)
    // + datele de expediere alese în Pas 5
    const refundDataForReturn: RefundData = {
      iban: refundData.iban,
      numeTitular: refundData.numeTitular,
      metodaTrimitere,
      costTransport,
      subtotalProduse,
    }

    // Generează AWB SameDay (doar pentru curier la adresă, NU pentru decont direct)
    // Folosim adresa de livrare din comanda Shopify (orderContact) ca adresă de pickup.
    // Dacă lipsește vreun câmp esențial sau API-ul SameDay eșuează, întoarcem 502
    // ca să vadă clientul și să poată reîncerca / contacta suportul (în loc să generăm
    // un retur fără AWB, care ar fi invizibil pentru ei).
    let awbNumber: string | undefined
    let awbPdfUrl: string | null = null
    if (metodaTrimitere === 'curier' && !isDirectRefund) {
      const pickupContact = (body as {
        orderContact?: {
          nume?: string
          telefon?: string
          oras?: string
          judet?: string
          strada?: string
          codPostal?: string
          email?: string
        }
      }).orderContact || {}

      const missing: string[] = []
      if (!pickupContact.telefon) missing.push('telefon')
      if (!pickupContact.strada) missing.push('stradă')
      if (!pickupContact.oras) missing.push('oraș')
      if (!pickupContact.judet) missing.push('județ')
      if (missing.length > 0) {
        if (codeWaiver && codeRedemption) await releaseCode(codeRedemption)
        await logAudit({
          action: 'create_return_awb_fail',
          ip,
          details: { returnId: idRetur, reason: 'missing_pickup_address', missing },
        })
        return NextResponse.json(
          {
            success: false,
            message: `Nu putem genera AWB-ul SameDay — lipsesc datele de adresă din comandă: ${missing.join(', ')}. Te rugăm să alegi „trimit eu cu un curier ales" sau să contactezi suportul.`,
            missingFields: missing,
          },
          { status: 400 }
        )
      }

      try {
        const awbResult = await createReturnAWB({
          pickupAddress: {
            name: pickupContact.nume || orderData.nume,
            phone: pickupContact.telefon || '',
            city: pickupContact.oras || '',
            county: pickupContact.judet || '',
            street: pickupContact.strada || '',
            postalCode: pickupContact.codPostal,
            email: pickupContact.email,
          },
          packageInfo: { weight: 1, observation: `Retur ${idRetur}` },
          reference: idRetur,
        })
        awbNumber = awbResult.awbNumber
        awbPdfUrl = awbResult.awbPdfUrl
      } catch (e) {
        const errMsg = e instanceof Error ? e.message : 'unknown'
        console.error('SameDay AWB generation failed:', errMsg)
        if (codeWaiver && codeRedemption) await releaseCode(codeRedemption)
        await logAudit({
          action: 'create_return_awb_fail',
          ip,
          details: { returnId: idRetur, error: errMsg },
        })
        // Detaliile tehnice (cu stack/credentials/config) rămân în loguri.
        // Către client expunem doar dacă e un mesaj de la API SameDay (HTTP 4xx/5xx).
        const isApiError = /^SameDay /.test(errMsg) && !/lipsesc din env/.test(errMsg)
        return NextResponse.json(
          {
            success: false,
            message: isApiError
              ? `SameDay a refuzat AWB-ul: ${errMsg.replace(/^SameDay [^:]+:\s*/, '')}`
              : 'Curierul SameDay nu este disponibil momentan. Te rugăm să alegi „trimit eu cu un curier ales" sau să contactezi suportul.',
          },
          { status: 502 }
        )
      }
    }

    // Creează returul temporar pentru generare PDF
    const tempReturn = {
      idRetur,
      numarComanda: orderData.numarComanda,
      orderData: orderDataForReturn,
      products,
      refundData: refundDataForReturn,
      signature,
      totalRefund,
      status: 'INITIAT' as const,
      createdAt: new Date().toISOString(),
      pdfPath: '',
      qrCodeData: qrCodeDataUrl,
      awbNumber,
    }

    // Generează PDF (în memorie). Validăm că funcționează — dacă pică, oprim
    // tot fluxul ca să nu salvăm un retur fără PDF descărcabil.
    try {
      await generateReturnPDF(tempReturn, qrCodeDataUrl)
    } catch (err) {
      console.error('PDF generation failed:', err)
      if (codeWaiver && codeRedemption) await releaseCode(codeRedemption)
      return NextResponse.json(
        { success: false, message: 'Eroare la generarea PDF-ului. Încearcă din nou.' },
        { status: 500 }
      )
    }

    // Pe Vercel filesystem-ul e read-only — sărim peste scrierea pe disc.
    // PDF-ul e regenerat on-demand la GET /api/returns/[id]/pdf din datele din DB.
    const IS_VERCEL = !!process.env.VERCEL
    let pdfPath = ''
    if (!IS_VERCEL) {
      try {
        const returnsDir = path.join(process.cwd(), 'data', 'retururi')
        if (!fs.existsSync(returnsDir)) {
          fs.mkdirSync(returnsDir, { recursive: true })
        }
        const pdfFileName = `${idRetur}.pdf`
        pdfPath = path.join(returnsDir, pdfFileName)
        const buf = await generateReturnPDF(tempReturn, qrCodeDataUrl)
        fs.writeFileSync(pdfPath, buf)
      } catch (err) {
        console.warn('Local PDF cache write skipped:', err)
        pdfPath = ''
      }
    }

    // Creează returul în baza de date
    let newReturn
    try {
      newReturn = await createReturn(
        orderData.numarComanda,
        orderDataForReturn,
        products,
        refundDataForReturn,
        signature,
        totalRefund,
        pdfPath,
        qrCodeDataUrl,
        idRetur
      )
    } catch (err) {
      if (codeWaiver && codeRedemption) await releaseCode(codeRedemption)
      throw err
    }

    // Salvează AWB-ul (dacă a fost generat) pe rândul de retur
    if (awbNumber) {
      try {
        await updateReturnDocuments(newReturn.idRetur, awbNumber)
        newReturn.awbNumber = awbNumber
      } catch (e) {
        console.error('Failed to persist AWB number:', e)
      }
    }

    await logAudit({
      action: 'create_return_success',
      ip,
      details: {
        returnId: newReturn.idRetur,
        numarComanda: newReturn.numarComanda,
        totalRefund: newReturn.totalRefund,
        metodaTrimitere,
        awbNumber: awbNumber || null,
        codeRedemption: codeRedemption || null,
        codeKind: codeKind || null,
      },
    })

    // Returnează răspuns cu datele necesare
    return NextResponse.json({
      success: true,
      returnId: newReturn.idRetur,
      pdfPath: `/api/returns/${newReturn.idRetur}/pdf`,
      awbNumber: awbNumber || null,
      awbPdfUrl,
      returnData: {
        idRetur: newReturn.idRetur,
        numarComanda: newReturn.numarComanda,
        totalRefund: newReturn.totalRefund,
        createdAt: newReturn.createdAt,
      },
    })
  } catch (error) {
    console.error('Error creating return:', error)
    await logAudit({
      action: 'create_return_fail',
      ip,
      details: { reason: 'exception', error: error instanceof Error ? error.message : 'unknown' },
    })
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to create return',
      },
      { status: 500 }
    )
  }
}

