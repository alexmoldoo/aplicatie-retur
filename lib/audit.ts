/**
 * Audit log pentru acțiuni sensibile.
 * Salvează în Supabase dacă e configurat, altfel în data/audit.json (max 5000 entries).
 */

import fs from 'fs'
import path from 'path'
import { createClient } from '@supabase/supabase-js'

export type AuditAction =
  | 'search_order_success'
  | 'search_order_fail'
  | 'search_order_rate_limited'
  | 'create_return_success'
  | 'create_return_fail'
  | 'create_return_invalid_token'
  | 'create_return_rate_limited'
  | 'create_return_origin_blocked'
  | 'create_return_awb_fail'
  | 'return_cancel_customer'
  | 'return_cancel_denied'
  | 'admin_login_success'
  | 'admin_login_fail'

export interface AuditEntry {
  timestamp: string
  action: AuditAction
  ip: string
  details?: Record<string, any>
}

const supabaseUrl = process.env.SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const supabase = supabaseUrl && supabaseServiceKey
  ? createClient(supabaseUrl, supabaseServiceKey)
  : null

const AUDIT_FILE = path.join(process.cwd(), 'data', 'audit.json')
const MAX_ENTRIES = 5000

export async function logAudit(entry: Omit<AuditEntry, 'timestamp'>): Promise<void> {
  const fullEntry: AuditEntry = {
    timestamp: new Date().toISOString(),
    ...entry,
  }

  // Log în consolă pentru debug
  console.log(`[AUDIT] ${fullEntry.action} from ${fullEntry.ip}`, fullEntry.details || '')

  if (supabase) {
    // Supabase: tabel audit_log (creat manual sau prin migrare)
    try {
      await supabase.from('audit_log').insert(fullEntry)
    } catch (err) {
      console.error('Failed to write audit to Supabase:', err)
    }
    return
  }

  // Fallback: fișier JSON local
  try {
    const dataDir = path.dirname(AUDIT_FILE)
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true })
    }

    let entries: AuditEntry[] = []
    if (fs.existsSync(AUDIT_FILE)) {
      try {
        const content = fs.readFileSync(AUDIT_FILE, 'utf8')
        entries = JSON.parse(content)
        if (!Array.isArray(entries)) entries = []
      } catch {
        entries = []
      }
    }

    entries.push(fullEntry)

    // Păstrează doar ultimele MAX_ENTRIES
    if (entries.length > MAX_ENTRIES) {
      entries = entries.slice(-MAX_ENTRIES)
    }

    fs.writeFileSync(AUDIT_FILE, JSON.stringify(entries, null, 2))
  } catch (err) {
    console.error('Failed to write audit log:', err)
  }
}

export async function getRecentAuditEntries(limit = 100): Promise<AuditEntry[]> {
  if (supabase) {
    try {
      const { data } = await supabase
        .from('audit_log')
        .select('*')
        .order('timestamp', { ascending: false })
        .limit(limit)
      return data || []
    } catch {
      return []
    }
  }

  if (!fs.existsSync(AUDIT_FILE)) return []
  try {
    const entries: AuditEntry[] = JSON.parse(fs.readFileSync(AUDIT_FILE, 'utf8'))
    return entries.slice(-limit).reverse()
  } catch {
    return []
  }
}
