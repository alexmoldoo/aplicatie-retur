import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import crypto from 'crypto'
import { getCurrentUserFromCookies } from '@/lib/auth'
import {
  getReturns,
  getConfig,
  findReturnById,
  updateReturnIfStatus,
  updatePaymentsConfig,
  type Return,
} from '@/lib/db'
import { logAudit } from '@/lib/audit'
import { getClientIp } from '@/lib/security'
import { RETURN_STATUS } from '@/lib/return-status'
import {
  BT_MAX_ROWS,
  buildBtCsv,
  buildBtLine,
  btValueDate,
  checkPayable,
  cleanIban,
  validateSourceIban,
  withValueDate,
} from '@/lib/bt-payments'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const ALREADY_IN_FILE = 'A mai fost într-un fișier de plăți.'

/** Rambursările pe card nu trec prin fișierul de plăți. */
function isBankRefund(r: Return): boolean {
  return r.refundData?.metodaRambursare !== 'card'
}

/** LOT-AAAALLZZ-OOMMSS-XXXX, în fusul României; sufixul evită coliziunile în aceeași secundă. */
function newLotId(now: Date = new Date()): string {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Europe/Bucharest',
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
    }).formatToParts(now).map(x => [x.type, x.value])
  )
  const suffix = crypto.randomBytes(2).toString('hex').toUpperCase()
  return `LOT-${p.year}${p.month}${p.day}-${p.hour}${p.minute}${p.second}-${suffix}`
}

function lotOf(r: Return): string {
  return r.refundData?.plata?.lot || ''
}

/** Fișierul unui lot aflat încă în plată, cu data plății adusă la zi. */
function csvForLot(all: Return[], lot: string): string | null {
  const rows = all
    .filter(r => lot && r.status === RETURN_STATUS.IN_PLATA && lotOf(r) === lot && r.refundData?.plata?.linie)
    .sort((a, b) => (a.refundData!.plata!.nr || 0) - (b.refundData!.plata!.nr || 0))
  if (rows.length === 0) return null
  const today = btValueDate()
  return buildBtCsv(rows.map(r => withValueDate(r.refundData!.plata!.linie, today)))
}

async function requireAdmin() {
  const cookieStore = await cookies()
  return getCurrentUserFromCookies(cookieStore)
}

/**
 * GET /api/admin/payments
 *   → contul plătitor, retururile de plătit (PRIMIT, rambursare în cont),
 *     cele care trebuie plătite manual (cu motiv) și loturile aflate în plată.
 * GET /api/admin/payments?lot=LOT-…&download=1
 *   → fișierul CSV al unui lot aflat încă în plată.
 */
export async function GET(request: NextRequest) {
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ success: false, message: 'Neautorizat' }, { status: 401 })

  const all = await getReturns()
  const lotParam = request.nextUrl.searchParams.get('lot')

  if (lotParam && request.nextUrl.searchParams.get('download')) {
    const csv = csvForLot(all, lotParam)
    if (!csv) return NextResponse.json({ success: false, message: 'Lot inexistent sau deja închis.' }, { status: 404 })
    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="plati-retururi-${lotParam.replace(/[^A-Za-z0-9-]/g, '')}.csv"`,
      },
    })
  }

  const config = await getConfig()

  const eligible: Array<Record<string, unknown>> = []
  const manual: Array<Record<string, unknown>> = []
  let cardCount = 0
  for (const r of all) {
    if (r.status !== RETURN_STATUS.PRIMIT) continue
    if (!isBankRefund(r)) { cardCount++; continue }
    // Un retur care a mai fost într-un fișier nu reintră singur: se plătește manual,
    // ca să nu fie plătit de două ori.
    const check = r.refundData?.plata ? ({ ok: false, reason: ALREADY_IN_FILE } as const) : checkPayable(r)
    if (check.ok) {
      eligible.push({ ...check.candidate, createdAt: r.createdAt })
    } else {
      manual.push({
        idRetur: r.idRetur,
        numarComanda: r.numarComanda,
        numeClient: r.orderData?.nume || '',
        suma: r.totalRefund,
        reason: check.reason,
      })
    }
  }

  const lotsMap = new Map<string, Return[]>()
  for (const r of all) {
    if (r.status !== RETURN_STATUS.IN_PLATA) continue
    const key = lotOf(r)
    lotsMap.set(key, [...(lotsMap.get(key) || []), r])
  }
  const lots = Array.from(lotsMap.entries())
    .map(([lot, rs]) => ({
      lot,
      generatLa: rs[0].refundData?.plata?.generatLa || null,
      count: rs.length,
      total: Number(rs.reduce((s, r) => s + (r.refundData?.plata?.suma ?? r.totalRefund), 0).toFixed(2)),
      hasFile: !!lot,
      returns: rs
        .sort((a, b) => (a.refundData?.plata?.nr || 0) - (b.refundData?.plata?.nr || 0))
        .map(r => {
          // Numele și suma din rândul trimis la bancă, nu cele curente de pe retur.
          const fields = (r.refundData?.plata?.linie || '').split(',')
          return {
            idRetur: r.idRetur,
            numarComanda: r.numarComanda,
            numeTitular: fields.length === 11 ? fields[3] : r.refundData?.numeTitular || '',
            suma: r.refundData?.plata?.suma ?? r.totalRefund,
          }
        }),
    }))
    .sort((a, b) => String(b.generatLa || '').localeCompare(String(a.generatLa || '')))

  return NextResponse.json({
    success: true,
    sourceIban: config.plati.ibanSursa,
    eligible,
    manual,
    cardCount,
    lots,
  })
}

/**
 * POST /api/admin/payments
 *   { action: 'setSourceIban', iban }
 *   { action: 'generate', ids: string[] }   → fișier CSV + retururile trec în IN_PLATA
 *   { action: 'finalize', lot }             → lotul trece în FINALIZAT
 *   { action: 'cancel', lot }               → lotul revine în PRIMIT
 */
export async function POST(request: NextRequest) {
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ success: false, message: 'Neautorizat' }, { status: 401 })

  const ip = getClientIp(request)
  const body = await request.json().catch(() => ({}))
  const action = typeof body.action === 'string' ? body.action : ''

  if (action === 'setSourceIban') {
    const iban = cleanIban(typeof body.iban === 'string' ? body.iban : '')
    const check = validateSourceIban(iban)
    if (!check.valid) {
      return NextResponse.json({ success: false, message: check.error }, { status: 400 })
    }
    await updatePaymentsConfig({ ibanSursa: iban })
    return NextResponse.json({ success: true, sourceIban: iban })
  }

  if (action === 'generate') {
    const ids: string[] = Array.isArray(body.ids)
      ? Array.from(new Set(body.ids.filter((x: unknown): x is string => typeof x === 'string')))
      : []
    if (ids.length === 0) {
      return NextResponse.json({ success: false, message: 'Nu ai selectat niciun retur.' }, { status: 400 })
    }
    if (ids.length > BT_MAX_ROWS) {
      return NextResponse.json({ success: false, message: `Maxim ${BT_MAX_ROWS} plăți într-un fișier.` }, { status: 400 })
    }

    const config = await getConfig()
    const sourceIban = config.plati.ibanSursa
    if (!validateSourceIban(sourceIban).valid) {
      return NextResponse.json({ success: false, message: 'Completează întâi contul din care plătești.' }, { status: 400 })
    }

    const lot = newLotId()
    const generatLa = new Date().toISOString()
    const valueDate = btValueDate()

    const lines: string[] = []
    const included: string[] = []
    const skipped: Array<{ idRetur: string; reason: string }> = []
    let total = 0

    for (const id of ids) {
      // Citire proaspătă per retur: validăm pe datele de ACUM, nu pe o listă veche.
      const r = await findReturnById(id)
      if (!r) { skipped.push({ idRetur: id, reason: 'Retur inexistent.' }); continue }
      if (r.status !== RETURN_STATUS.PRIMIT) { skipped.push({ idRetur: id, reason: 'Nu mai este în statusul Primit.' }); continue }
      if (!isBankRefund(r)) { skipped.push({ idRetur: id, reason: 'Rambursare pe card.' }); continue }
      if (r.refundData?.plata) { skipped.push({ idRetur: id, reason: ALREADY_IN_FILE }); continue }
      const check = checkPayable(r)
      if (!check.ok) { skipped.push({ idRetur: id, reason: check.reason }); continue }

      const nr = lines.length + 1
      const linie = buildBtLine(nr, sourceIban, check.candidate, valueDate)
      // Compare-and-set: reușește doar dacă returul e ÎNCĂ „Primit" în baza de date.
      // Dacă o altă cerere l-a luat între timp, nu intră și în acest fișier.
      const claimed = await updateReturnIfStatus(id, RETURN_STATUS.PRIMIT, {
        status: RETURN_STATUS.IN_PLATA,
        refundData: { ...r.refundData, plata: { lot, nr, suma: check.candidate.suma, linie, generatLa } },
      })
      if (!claimed) { skipped.push({ idRetur: id, reason: 'Nu mai este în statusul Primit.' }); continue }

      lines.push(linie)
      included.push(id)
      total += check.candidate.suma
    }

    if (lines.length === 0) {
      return NextResponse.json(
        { success: false, message: 'Nicio plată nu a putut fi pusă în fișier.', skipped },
        { status: 409 }
      )
    }

    total = Number(total.toFixed(2))
    await logAudit({
      action: 'payment_batch_generated',
      ip,
      details: { lot, count: lines.length, total, returns: included, skipped, user: user.email },
    })

    return NextResponse.json({
      success: true,
      lot,
      filename: `plati-retururi-${lot}.csv`,
      csv: buildBtCsv(lines),
      count: lines.length,
      total,
      skipped,
    })
  }

  if (action === 'finalize' || action === 'cancel') {
    const lot = typeof body.lot === 'string' ? body.lot : ''
    const all = await getReturns()
    const inLot = all.filter(r => r.status === RETURN_STATUS.IN_PLATA && lotOf(r) === lot)
    if (inLot.length === 0) {
      return NextResponse.json({ success: false, message: 'Lotul nu mai are retururi în plată.' }, { status: 404 })
    }

    const done: string[] = []
    const failed: string[] = []
    for (const snapshot of inLot) {
      const r = await findReturnById(snapshot.idRetur)
      if (!r || r.status !== RETURN_STATUS.IN_PLATA || lotOf(r) !== lot) { failed.push(snapshot.idRetur); continue }

      let ok: boolean
      if (action === 'finalize') {
        const refundData = r.refundData?.plata
          ? { ...r.refundData, plata: { ...r.refundData.plata, platitLa: new Date().toISOString() } }
          : r.refundData
        ok = await updateReturnIfStatus(r.idRetur, RETURN_STATUS.IN_PLATA, { status: RETURN_STATUS.FINALIZAT, refundData })
      } else {
        const { plata: _removed, ...refundData } = r.refundData || {}
        ok = await updateReturnIfStatus(r.idRetur, RETURN_STATUS.IN_PLATA, { status: RETURN_STATUS.PRIMIT, refundData })
      }
      if (ok) done.push(r.idRetur)
      else failed.push(r.idRetur)
    }

    await logAudit({
      action: action === 'finalize' ? 'payment_batch_finalized' : 'payment_batch_cancelled',
      ip,
      details: { lot, returns: done, failed, user: user.email },
    })

    return NextResponse.json({
      success: failed.length === 0,
      count: done.length,
      failed,
      ...(failed.length > 0 ? { message: `Nu s-au putut actualiza: ${failed.join(', ')}` } : {}),
    })
  }

  return NextResponse.json({ success: false, message: 'Acțiune necunoscută.' }, { status: 400 })
}
