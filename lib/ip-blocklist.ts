/**
 * Blocklist persistent pentru IP-uri abuzive.
 * După FAIL_THRESHOLD eșecuri într-o fereastră de FAIL_WINDOW_MS,
 * IP-ul este blocat pentru BLOCK_DURATION_MS.
 *
 * Salvează în data/blocklist.json (sau Supabase dacă e configurat).
 */

import fs from 'fs'
import path from 'path'
import { createClient } from '@supabase/supabase-js'

const FAIL_THRESHOLD = 19 // încercări eșuate înainte de blocare
const FAIL_WINDOW_MS = 24 * 60 * 60_000 // numără eșecurile din ultimele 24h
const BLOCK_DURATION_MS = 50 * 60 * 60_000 // blocaj 50h

const BLOCKLIST_FILE = path.join(process.cwd(), 'data', 'blocklist.json')

interface IpRecord {
  fails: number[] // timestamps eșecuri recente
  blockedUntil: number | null
}

interface BlocklistData {
  [ip: string]: IpRecord
}

const supabaseUrl = process.env.SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const supabase = supabaseUrl && supabaseServiceKey
  ? createClient(supabaseUrl, supabaseServiceKey)
  : null

// In-memory cache ca să nu citească fișierul la fiecare cerere
let cache: BlocklistData | null = null
let cacheLoadedAt = 0
const CACHE_TTL_MS = 5_000

function loadBlocklist(): BlocklistData {
  if (cache && Date.now() - cacheLoadedAt < CACHE_TTL_MS) {
    return cache
  }
  if (!fs.existsSync(BLOCKLIST_FILE)) {
    cache = {}
    cacheLoadedAt = Date.now()
    return cache
  }
  try {
    cache = JSON.parse(fs.readFileSync(BLOCKLIST_FILE, 'utf8'))
    cacheLoadedAt = Date.now()
    return cache!
  } catch {
    cache = {}
    cacheLoadedAt = Date.now()
    return cache
  }
}

function saveBlocklist(data: BlocklistData): void {
  cache = data
  cacheLoadedAt = Date.now()
  try {
    const dir = path.dirname(BLOCKLIST_FILE)
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(BLOCKLIST_FILE, JSON.stringify(data, null, 2))
  } catch (err) {
    console.error('Failed to save blocklist:', err)
  }
}

export interface BlockStatus {
  blocked: boolean
  until?: number
  retryAfterSeconds?: number
}

export function isBlocked(ip: string): BlockStatus {
  if (!ip || ip === 'unknown') return { blocked: false }
  const data = loadBlocklist()
  const rec = data[ip]
  if (!rec || !rec.blockedUntil) return { blocked: false }
  const now = Date.now()
  if (rec.blockedUntil < now) {
    // Block expirat — curăță înregistrarea
    delete data[ip]
    saveBlocklist(data)
    return { blocked: false }
  }
  return {
    blocked: true,
    until: rec.blockedUntil,
    retryAfterSeconds: Math.ceil((rec.blockedUntil - now) / 1000),
  }
}

export function recordFail(ip: string): { newlyBlocked: boolean; until?: number; failCount: number } {
  if (!ip || ip === 'unknown') return { newlyBlocked: false, failCount: 0 }
  const data = loadBlocklist()
  const now = Date.now()
  const rec: IpRecord = data[ip] || { fails: [], blockedUntil: null }

  // Dacă e deja blocat, nu mai procesăm
  if (rec.blockedUntil && rec.blockedUntil > now) {
    return { newlyBlocked: false, until: rec.blockedUntil, failCount: rec.fails.length }
  }

  // Filtrează eșecurile vechi
  rec.fails = rec.fails.filter(t => now - t < FAIL_WINDOW_MS)
  rec.fails.push(now)

  let newlyBlocked = false
  if (rec.fails.length >= FAIL_THRESHOLD) {
    rec.blockedUntil = now + BLOCK_DURATION_MS
    newlyBlocked = true
  }

  data[ip] = rec
  saveBlocklist(data)
  return {
    newlyBlocked,
    until: rec.blockedUntil || undefined,
    failCount: rec.fails.length,
  }
}

export function getBlocklistStats(): {
  totalTracked: number
  totalBlocked: number
  entries: Array<{ ip: string; fails: number; blockedUntil: number | null }>
} {
  const data = loadBlocklist()
  const entries = Object.entries(data).map(([ip, rec]) => ({
    ip,
    fails: rec.fails.length,
    blockedUntil: rec.blockedUntil,
  }))
  return {
    totalTracked: entries.length,
    totalBlocked: entries.filter(e => e.blockedUntil && e.blockedUntil > Date.now()).length,
    entries,
  }
}
