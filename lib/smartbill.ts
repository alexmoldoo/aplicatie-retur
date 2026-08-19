/**
 * Client minimal pentru SmartBill Cloud API.
 *
 * Folosit DOAR pentru stornarea facturii asociate unei comenzi returnate:
 * `POST /invoice/reverse` emite documentul de STORNO pentru factura originală
 * (serie + număr) — nu creează o factură nouă „în minus" pe client.
 *
 * Auth: Basic base64(email:token). Token-ul se generează din contul SmartBill
 * (Contul meu → Integrări → API) și se configurează în /admin/shopify.
 * Limită API SmartBill: 3 apeluri/secundă — aici facem un singur apel per storno.
 */

import type { SmartbillConfig } from './db'

const SMARTBILL_BASE = 'https://ws.smartbill.ro/SBORO/api'

export function isSmartbillConfigured(cfg: SmartbillConfig | undefined | null): boolean {
  return !!(cfg && cfg.email && cfg.token && cfg.cif)
}

/** Data de azi în fusul României, format YYYY-MM-DD (cerut de SmartBill la issueDate). */
export function todayRO(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Bucharest' }).format(new Date())
}

export interface StornoResult {
  serie: string
  numar: string
  data: string
}

/**
 * Stornează factura originală (seriesName + number) în SmartBill.
 * Returnează seria + numărul documentului de storno emis.
 * Aruncă Error cu mesajul SmartBill dacă apelul eșuează.
 */
export async function reverseInvoice(
  cfg: SmartbillConfig,
  seriesName: string,
  number: string
): Promise<StornoResult> {
  if (!isSmartbillConfigured(cfg)) {
    throw new Error('SmartBill nu este configurat (email + token + CIF).')
  }

  const issueDate = todayRO()
  const auth = Buffer.from(`${cfg.email}:${cfg.token}`).toString('base64')

  const response = await fetch(`${SMARTBILL_BASE}/invoice/reverse`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: `Basic ${auth}`,
    },
    body: JSON.stringify({
      companyVatCode: cfg.cif,
      seriesName,
      number,
      issueDate,
    }),
  })

  let body: any = null
  try {
    body = await response.json()
  } catch {
    /* răspuns non-JSON — tratat mai jos */
  }

  if (!response.ok) {
    const msg = body?.errorText || body?.message || `HTTP ${response.status}`
    throw new Error(`SmartBill: ${msg}`)
  }
  // SmartBill poate răspunde 200 cu errorText completat
  if (body?.errorText) {
    throw new Error(`SmartBill: ${body.errorText}`)
  }
  if (!body?.series || !body?.number) {
    throw new Error('SmartBill: răspuns neașteptat (lipsesc seria/numărul documentului de storno).')
  }

  return { serie: String(body.series), numar: String(body.number), data: issueDate }
}
