/**
 * Coduri pentru retur gratuit.
 *
 * Format: 4 cifre + 1 literă (5 caractere total). Litera vine din alfabetul fără
 * caracterele ambigue I și O — 24 litere × 10^4 cifre = 240k combos. Suficient
 * pentru rate-limit + UNIQUE constraint, ușor de citit/dictat la telefon.
 *
 * Stocate uppercase. Validate case-insensitive.
 */

import crypto from 'crypto'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = (process.env.SUPABASE_URL || '').trim()
const supabaseServiceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim()
const supabase = supabaseUrl && supabaseServiceKey
  ? createClient(supabaseUrl, supabaseServiceKey)
  : null

function requireSupabase() {
  if (!supabase) {
    throw new Error('Supabase nu este configurat (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY).')
  }
  return supabase
}

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ' // fără I și O
// Acceptă format „4 cifre + 1 literă" (free shipping) sau „D + 4 cifre + 1 literă" (direct refund).
const CODE_REGEX = /^D?[0-9]{4}[A-HJ-NP-Z]$/

export type CodeKind = 'free_shipping' | 'direct_refund'

export interface ReturnCode {
  code: string
  kind: CodeKind
  note: string | null
  active: boolean
  createdAt: string
  createdBy: string | null
  createdByEmail?: string | null
  usedAt: string | null
  usedByReturnId: string | null
  sentAt: string | null
}

/** Derivă tipul codului din prefixul lui. */
export function kindFromCode(code: string): CodeKind {
  return code.startsWith('D') ? 'direct_refund' : 'free_shipping'
}

/**
 * Generează un cod random nou. Pentru `direct_refund` adăugăm prefix `D` ca să fie
 * vizual distinct (cod normal = 5 chars, decont direct = 6 chars cu D în față).
 * Nu garantează unicitate — caller trebuie să gestioneze conflictele pe INSERT.
 */
export function generateCode(kind: CodeKind = 'free_shipping'): string {
  const digits = String(crypto.randomInt(0, 10000)).padStart(4, '0')
  const letter = CODE_ALPHABET[crypto.randomInt(0, CODE_ALPHABET.length)]
  const body = `${digits}${letter}`
  return kind === 'direct_refund' ? `D${body}` : body
}

/**
 * Normalizează un cod introdus de user (trim + uppercase). Returnează `null`
 * dacă nu respectă formatul așteptat — caller-ul trebuie să refuze cu mesaj clar.
 */
export function normalizeCode(input: string | null | undefined): string | null {
  if (!input) return null
  const cleaned = input.trim().toUpperCase().replace(/[^0-9A-Z]/g, '')
  if (!CODE_REGEX.test(cleaned)) return null
  return cleaned
}

interface ValidationResult {
  valid: boolean
  reason?: 'not_found' | 'inactive' | 'used'
  kind?: CodeKind
  note?: string | null
}

/**
 * Verifică doar dacă codul există, e activ și nefolosit. NU îl rezervă.
 * Folosit ca preview înainte de submit-ul retururilor.
 */
export async function validateCodeForRedemption(code: string): Promise<ValidationResult> {
  const sb = requireSupabase()
  // Nu cerem `kind` ca să rămânem compatibili cu schema înainte de migrație
  // (kindFromCode derivă din prefixul codului).
  const { data, error } = await sb
    .from('return_codes')
    .select('code, note, active, used_at')
    .eq('code', code)
    .maybeSingle()

  if (error) {
    console.error('[return-codes] validate error:', error)
    return { valid: false, reason: 'not_found' }
  }
  if (!data) return { valid: false, reason: 'not_found' }
  if (!data.active) return { valid: false, reason: 'inactive' }
  if (data.used_at) return { valid: false, reason: 'used' }
  return { valid: true, kind: kindFromCode(data.code), note: data.note }
}

/**
 * Atomic redeem: marchează codul ca folosit DOAR dacă era încă disponibil.
 * Returnează `true` doar dacă rândul a fost actualizat (winner-ul race-ului).
 * Loserul/codul invalid primește `false` și trebuie tratat de caller cu 409.
 */
export async function redeemCode(code: string, returnId: string): Promise<boolean> {
  const sb = requireSupabase()
  const { data, error } = await sb
    .from('return_codes')
    .update({
      used_at: new Date().toISOString(),
      used_by_return_id: returnId,
    })
    .eq('code', code)
    .eq('active', true)
    .is('used_at', null)
    .select('code')
    .maybeSingle()

  if (error) {
    console.error('[return-codes] redeem error:', error)
    return false
  }
  return !!data
}

/**
 * Rollback pentru redeem — eliberează un cod dacă pasul ulterior (AWB, insert)
 * pică. Idempotent: dacă codul nu mai e folosit, nu schimbă nimic.
 */
export async function releaseCode(code: string): Promise<void> {
  const sb = requireSupabase()
  const { error } = await sb
    .from('return_codes')
    .update({ used_at: null, used_by_return_id: null })
    .eq('code', code)
  if (error) {
    console.error('[return-codes] release error:', error)
  }
}

export interface ListFilter {
  status?: 'all' | 'active' | 'used' | 'inactive' | 'sent' | 'not_sent'
  search?: string
  limit?: number
}

/**
 * Listă coduri pentru admin. Join cu users ca să afișăm cine l-a generat.
 */
export async function listCodes(filter: ListFilter = {}): Promise<ReturnCode[]> {
  const sb = requireSupabase()
  const status = filter.status || 'all'
  const limit = Math.min(Math.max(filter.limit ?? 200, 1), 1000)

  let query = sb
    .from('return_codes')
    .select('code, kind, note, active, created_at, created_by, used_at, used_by_return_id, sent_at, users:created_by(email)')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (status === 'active') {
    query = query.is('used_at', null).eq('active', true)
  } else if (status === 'used') {
    query = query.not('used_at', 'is', null)
  } else if (status === 'inactive') {
    query = query.eq('active', false).is('used_at', null)
  } else if (status === 'sent') {
    query = query.is('used_at', null).not('sent_at', 'is', null)
  } else if (status === 'not_sent') {
    query = query.is('used_at', null).is('sent_at', null).eq('active', true)
  }

  if (filter.search) {
    const s = filter.search.trim().toUpperCase()
    if (s) query = query.ilike('code', `%${s}%`)
  }

  const { data, error } = await query
  if (error || !data) return []
  return data.map(row => ({
    code: row.code,
    kind: ((row as any).kind as CodeKind) || kindFromCode(row.code),
    note: row.note,
    active: row.active,
    createdAt: row.created_at,
    createdBy: row.created_by,
    createdByEmail: (row as any).users?.email ?? null,
    usedAt: row.used_at,
    usedByReturnId: row.used_by_return_id,
    sentAt: (row as any).sent_at ?? null,
  }))
}

/**
 * Marchează un cod ca trimis (sent=true setează NOW()) sau resetează (sent=false setează NULL).
 * Doar pentru coduri nefolosite. Returnează codul actualizat sau null.
 */
export async function markCodeSent(code: string, sent: boolean): Promise<ReturnCode | null> {
  const sb = requireSupabase()
  const { data, error } = await sb
    .from('return_codes')
    .update({ sent_at: sent ? new Date().toISOString() : null })
    .eq('code', code)
    .is('used_at', null)
    .select('code, kind, note, active, created_at, created_by, used_at, used_by_return_id, sent_at')
    .maybeSingle()
  if (error || !data) return null
  return {
    code: data.code,
    kind: ((data as any).kind as CodeKind) || kindFromCode(data.code),
    note: data.note,
    active: data.active,
    createdAt: data.created_at,
    createdBy: data.created_by,
    usedAt: data.used_at,
    usedByReturnId: data.used_by_return_id,
    sentAt: (data as any).sent_at ?? null,
  }
}

/**
 * Inserează un cod nou de tipul cerut. Retry pe coliziune UNIQUE (rar la volume mici).
 * Întoarce codul efectiv inserat.
 */
export async function insertGeneratedCode(opts: {
  kind?: CodeKind
  note?: string | null
  createdBy: string | null
}): Promise<string> {
  const sb = requireSupabase()
  const kind: CodeKind = opts.kind === 'direct_refund' ? 'direct_refund' : 'free_shipping'
  const MAX_RETRIES = 5
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const code = generateCode(kind)
    const { error } = await sb.from('return_codes').insert({
      code,
      kind,
      note: opts.note?.trim() || null,
      created_by: opts.createdBy,
    })
    if (!error) return code
    // 23505 = unique_violation Postgres
    if ((error as any).code !== '23505') {
      throw new Error('Eroare la inserarea codului: ' + error.message)
    }
  }
  throw new Error('Nu am putut genera un cod unic după mai multe încercări.')
}

/**
 * Toggle active (doar pentru coduri nefolosite). Returnează codul actualizat
 * sau null dacă nu există / e deja folosit.
 */
export async function toggleCodeActive(code: string, active: boolean): Promise<ReturnCode | null> {
  const sb = requireSupabase()
  const { data, error } = await sb
    .from('return_codes')
    .update({ active })
    .eq('code', code)
    .is('used_at', null)
    .select('code, kind, note, active, created_at, created_by, used_at, used_by_return_id, sent_at')
    .maybeSingle()
  if (error || !data) return null
  return {
    code: data.code,
    kind: ((data as any).kind as CodeKind) || kindFromCode(data.code),
    note: data.note,
    active: data.active,
    createdAt: data.created_at,
    createdBy: data.created_by,
    usedAt: data.used_at,
    usedByReturnId: data.used_by_return_id,
    sentAt: (data as any).sent_at ?? null,
  }
}

/**
 * Șterge un cod nefolosit. Returnează `true` dacă a fost șters efectiv.
 */
export async function deleteCode(code: string): Promise<boolean> {
  const sb = requireSupabase()
  const { data, error } = await sb
    .from('return_codes')
    .delete()
    .eq('code', code)
    .is('used_at', null)
    .select('code')
    .maybeSingle()
  if (error) return false
  return !!data
}

/**
 * Citește codul folosit pe un anumit retur (pentru pagina detalii admin).
 */
export async function findCodeByReturnId(returnId: string): Promise<{ code: string; kind: CodeKind; note: string | null } | null> {
  const sb = requireSupabase()
  const { data, error } = await sb
    .from('return_codes')
    .select('code, kind, note')
    .eq('used_by_return_id', returnId)
    .maybeSingle()
  if (error || !data) return null
  return {
    code: data.code,
    kind: ((data as any).kind as CodeKind) || kindFromCode(data.code),
    note: data.note,
  }
}
