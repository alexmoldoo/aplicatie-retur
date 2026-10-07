import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import crypto from 'crypto'
import { getCurrentUserFromCookies } from '@/lib/auth'
import {
  getReturnsLight,
  getConfig,
  findReturnById,
  updateReturnIfStatus,
  updatePaymentsConfig,
  type Return,
  type ReturnLight,
} from '@/lib/db'
import { logAudit, getAuditEntriesByActions, type AuditEntry } from '@/lib/audit'
import { monthKeyRO, currentAndPreviousMonthRO } from '@/lib/dates'
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
function isBankRefund(r: Pick<Return, 'refundData'>): boolean {
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

function lotOf(r: Pick<Return, 'refundData'>): string {
  return r.refundData?.plata?.lot || ''
}

/**
 * Fișierul unui lot. Pentru un lot încă în plată data plății e adusă la zi
 * (poți să-l încarci la bancă și mâine). Pentru un lot închis fișierul rămâne
 * exact cel generat. Un lot anulat nu mai are rânduri pe retururi, dar le avem
 * în jurnal, ca istoricul să rămână descărcabil.
 */
function csvForLot(all: ReturnLight[], lot: string, generated?: AuditEntry): string | null {
  if (!lot) return null
  const rows = all
    .filter(r => lotOf(r) === lot && r.refundData?.plata?.linie)
    .sort((a, b) => (a.refundData!.plata!.nr || 0) - (b.refundData!.plata!.nr || 0))
  if (rows.length > 0) {
    const stillOpen = rows.some(r => r.status === RETURN_STATUS.IN_PLATA)
    const today = btValueDate()
    return buildBtCsv(rows.map(r => (stillOpen ? withValueDate(r.refundData!.plata!.linie, today) : r.refundData!.plata!.linie)))
  }
  const lines = generated?.details?.lines
  if (Array.isArray(lines) && lines.length > 0) return buildBtCsv(lines as string[])
  return null
}

/** Când a plecat banul pentru un retur finalizat (pentru totaluri pe lună). */
function paidAt(r: ReturnLight): string {
  return r.refundData?.finalizatLa || r.refundData?.plata?.platitLa || r.createdAt
}

/** Istoricul fișierelor, din jurnalul de audit: generat / descărcat / plătit / anulat. */
const HISTORY_ACTIONS = ['payment_batch_generated', 'payment_batch_finalized', 'payment_batch_cancelled', 'payment_batch_downloaded'] as const

function buildHistory(all: ReturnLight[], entries: AuditEntry[]) {
  const byLot = new Map<string, {
    lot: string
    generatLa: string
    count: number
    total: number
    user: string | null
    returns: string[]
    hasLines: boolean
    stare: 'in_plata' | 'platit' | 'anulat' | 'inchis'
    platitLa: string | null
    anulatLa: string | null
    descarcari: number
    ultimaDescarcare: string | null
  }>()
  // Jurnalul e nou → vechi; parcurgem invers ca „generat" să vină primul.
  for (const e of [...entries].reverse()) {
    const lot = typeof e.details?.lot === 'string' ? e.details.lot : ''
    if (!lot) continue
    if (e.action === 'payment_batch_generated') {
      byLot.set(lot, {
        lot,
        generatLa: e.timestamp,
        count: Number(e.details?.count) || (e.details?.returns?.length ?? 0),
        total: Number(e.details?.total) || 0,
        user: e.details?.user || null,
        returns: Array.isArray(e.details?.returns) ? e.details.returns : [],
        hasLines: Array.isArray(e.details?.lines) && e.details.lines.length > 0,
        stare: 'in_plata',
        platitLa: null,
        anulatLa: null,
        descarcari: 0,
        ultimaDescarcare: null,
      })
      continue
    }
    const h = byLot.get(lot)
    if (!h) continue
    if (e.action === 'payment_batch_finalized') { h.stare = 'platit'; h.platitLa = e.timestamp }
    if (e.action === 'payment_batch_cancelled') { h.stare = 'anulat'; h.anulatLa = e.timestamp }
    if (e.action === 'payment_batch_downloaded') { h.descarcari++; h.ultimaDescarcare = e.timestamp }
  }
  // Starea reală o dau retururile, nu jurnalul: un retur poate fi finalizat și de
  // mână, din pagina lui, fără un eveniment „lot plătit".
  for (const h of Array.from(byLot.values())) {
    const live = all.filter(r => lotOf(r) === h.lot)
    if (live.some(r => r.status === RETURN_STATUS.IN_PLATA)) {
      h.stare = 'in_plata'
    } else if (live.some(r => r.status === RETURN_STATUS.FINALIZAT)) {
      h.stare = 'platit'
      h.platitLa = h.platitLa || live.find(r => r.refundData?.plata?.platitLa)?.refundData?.plata?.platitLa
        || live.find(r => r.refundData?.finalizatLa)?.refundData?.finalizatLa || null
    } else if (h.stare !== 'anulat') {
      h.stare = 'inchis'
    }
  }
  return Array.from(byLot.values()).sort((a, b) => b.generatLa.localeCompare(a.generatLa))
}

/** Cât s-a dat înapoi: luna aceasta, luna trecută, total — separat bancă / card. */
function buildTotals(all: ReturnLight[]) {
  const { current, previous } = currentAndPreviousMonthRO()
  const empty = () => ({ total: 0, banca: 0, card: 0, count: 0 })
  const buckets = { lunaAceasta: empty(), lunaTrecuta: empty(), total: empty() }
  for (const r of all) {
    if (r.status !== RETURN_STATUS.FINALIZAT) continue
    const suma = Number((r.refundData?.plata?.suma ?? r.totalRefund) || 0)
    if (!(suma > 0)) continue
    const key = monthKeyRO(paidAt(r))
    const add = (b: ReturnType<typeof empty>) => {
      b.total += suma
      b.count++
      if (isBankRefund(r)) b.banca += suma
      else b.card += suma
    }
    add(buckets.total)
    if (key === current) add(buckets.lunaAceasta)
    else if (key === previous) add(buckets.lunaTrecuta)
  }
  const round = (b: ReturnType<typeof empty>) => ({
    total: Number(b.total.toFixed(2)), banca: Number(b.banca.toFixed(2)), card: Number(b.card.toFixed(2)), count: b.count,
  })
  return {
    lunaAceasta: { ...round(buckets.lunaAceasta), luna: current },
    lunaTrecuta: { ...round(buckets.lunaTrecuta), luna: previous },
    total: round(buckets.total),
  }
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
  const lotParam = request.nextUrl.searchParams.get('lot')

  if (lotParam && request.nextUrl.searchParams.get('download')) {
    const [user, { returns: all }, generatedEntries] = await Promise.all([
      requireAdmin(),
      getReturnsLight(),
      getAuditEntriesByActions(['payment_batch_generated'], 1000),
    ])
    if (!user) return NextResponse.json({ success: false, message: 'Neautorizat' }, { status: 401 })
    const generated = generatedEntries.find(e => e.details?.lot === lotParam)
    const csv = csvForLot(all, lotParam, generated)
    if (!csv) return NextResponse.json({ success: false, message: 'Lot inexistent.' }, { status: 404 })
    await logAudit({
      action: 'payment_batch_downloaded',
      ip: getClientIp(request),
      details: { lot: lotParam, user: user.email },
    })
    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="plati-retururi-${lotParam.replace(/[^A-Za-z0-9-]/g, '')}.csv"`,
      },
    })
  }

  // Login + cele trei citiri, toate în paralel; nimic nu pleacă fără login.
  const [user, { returns: all }, config, historyEntries] = await Promise.all([
    requireAdmin(),
    getReturnsLight(),
    getConfig(),
    getAuditEntriesByActions([...HISTORY_ACTIONS], 1000),
  ])
  if (!user) return NextResponse.json({ success: false, message: 'Neautorizat' }, { status: 401 })

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

  const lotsMap = new Map<string, ReturnLight[]>()
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
    history: buildHistory(all, historyEntries),
    totals: buildTotals(all),
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
      details: { lot, count: lines.length, total, returns: included, skipped, user: user.email, valueDate, lines },
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
    const { returns: all } = await getReturnsLight()
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
        const now = new Date().toISOString()
        const refundData = {
          ...r.refundData,
          finalizatLa: now,
          ...(r.refundData?.plata ? { plata: { ...r.refundData.plata, platitLa: now } } : {}),
        }
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
