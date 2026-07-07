/**
 * Baza de date Supabase (PostgreSQL)
 * Fallback la JSON pentru development local dacă Supabase nu este configurat
 */

import { createClient } from '@supabase/supabase-js'
import bcrypt from 'bcryptjs'
import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import type { ReturnStatus } from './return-status'
import { normalizeStatus } from './return-status'

const supabaseUrl = (process.env.SUPABASE_URL || '').trim()
const supabaseServiceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim()

// Client Supabase pentru server-side
const supabase = supabaseUrl && supabaseServiceKey
  ? createClient(supabaseUrl, supabaseServiceKey)
  : null

// Fallback pentru development local (JSON files)
const DB_DIR = path.join(process.cwd(), 'data')
const RETURNS_DIR = path.join(DB_DIR, 'retururi')
const USERS_FILE = path.join(DB_DIR, 'users.json')
const CONFIG_FILE = path.join(DB_DIR, 'config.json')
const RETURNS_FILE = path.join(DB_DIR, 'returns.json')

// Detectăm Vercel: filesystem read-only acolo, fallback JSON nu e posibil.
// Pe Vercel sărim peste inițializarea fișierelor și forțăm folosirea Supabase.
const IS_VERCEL = !!process.env.VERCEL

// Inițializează fișierele JSON pentru fallback (DOAR în dev local fără Supabase
// și NU pe Vercel — acolo filesystem-ul e read-only).
if (!supabase && !IS_VERCEL) {
  try {
    if (!fs.existsSync(DB_DIR)) {
      fs.mkdirSync(DB_DIR, { recursive: true })
    }
    if (!fs.existsSync(RETURNS_DIR)) {
      fs.mkdirSync(RETURNS_DIR, { recursive: true })
    }
    if (!fs.existsSync(USERS_FILE)) {
      fs.writeFileSync(USERS_FILE, JSON.stringify([], null, 2))
    }
    if (!fs.existsSync(CONFIG_FILE)) {
      fs.writeFileSync(CONFIG_FILE, JSON.stringify({
        shopify: { domain: '', accessToken: '', clientId: '', clientSecret: '', shopTitle: '' },
        excludedSKUs: [],
      }, null, 2))
    }
    if (!fs.existsSync(RETURNS_FILE)) {
      fs.writeFileSync(RETURNS_FILE, JSON.stringify([], null, 2))
    }
  } catch (err) {
    console.warn('[db] Nu s-au putut inițializa fișierele JSON locale:', err)
  }
}

function requireSupabase(): NonNullable<typeof supabase> {
  if (!supabase) {
    throw new Error(
      'Supabase nu este configurat: setează SUPABASE_URL și SUPABASE_SERVICE_ROLE_KEY (Production scope) în Vercel.'
    )
  }
  return supabase
}

// Pe Vercel orice scriere/citire trebuie să meargă la Supabase. Dacă lipsește,
// la primul apel real al unei funcții DB se va arunca eroarea de mai sus.
void requireSupabase

export interface User {
  id: string
  nume: string
  prenume: string
  email: string
  passwordHash: string
  createdAt: string
}

export interface ShopifyConfig {
  domain: string
  accessToken: string // legacy shpat_ token (custom apps clasice, deprecate 2026-01-01)
  clientId: string // Dev Dashboard client_id (folosit pentru client_credentials_grant)
  clientSecret: string // Dev Dashboard client_secret
  shopTitle: string
}

export interface AppConfig {
  shopify: ShopifyConfig
  excludedSKUs: string[]
  // Numere de comandă deblocate manual din admin — trec de termenul de retur expirat.
  // Stocate normalizat (fără „#", uppercase). Vezi normalizeOrderNumber().
  eligibilityOverrides: string[]
}

/**
 * Normalizează un număr de comandă pentru comparație tolerantă:
 * scoate spațiile și „#", uppercase. „#MX22222" și „mx22222" → „MX22222".
 */
export function normalizeOrderNumber(s: string): string {
  return (s || '').replace(/\s/g, '').replace(/^#/, '').toUpperCase()
}

// Interfețe pentru retururi
export interface OrderData {
  nume: string // Doar nume (fără email și telefon)
  numarComanda: string
}

export interface Product {
  id: string
  nume: string
  cantitate: number // Cantitatea totală din comandă
  cantitateReturnata: number // Cantitatea selectată pentru retur
  pret: number // Prețul unitar (după discount dacă există)
  pretInitial?: number // Prețul inițial înainte de discount
  discount?: number // Valoarea discount-ului aplicat
  motivRetur: string
  selected?: boolean
  variant_id?: string
  sku?: string
  alteMotive?: string // Pentru câmpul "Alte motive"
  imagine?: string
}

export interface RefundData {
  // 'card' = refund pe cardul original (fără IBAN); 'cont' = transfer bancar (cu IBAN).
  // Determinat server-side din tokenul de sesiune, nu din client.
  metodaRambursare?: 'card' | 'cont'
  iban?: string // Completat doar când metodaRambursare === 'cont'
  numeTitular?: string
  // Metoda de expediere a coletului către magazin (din Pas 5)
  metodaTrimitere?: 'curier' | 'manual'
  costTransport?: number   // 0 manual, 15.99 curier
  subtotalProduse?: number // Suma fără cost transport
}

export interface Return {
  idRetur: string // ID unic de retur (ex: RET-2025-000123)
  numarComanda: string // Număr comandă
  orderData: OrderData // Date client (doar nume)
  products: Product[] // Lista produselor returnate
  refundData: RefundData // Date rambursare (IBAN și nume titular)
  signature: string // Semnătura clientului (data URL)
  totalRefund: number // Suma totală de returnat
  status: ReturnStatus // Status retur (vezi lib/return-status.ts)
  createdAt: string // Data creării cererii
  pdfPath: string // Calea către PDF-ul generat
  qrCodeData: string // QR code cu link către pagina de detalii (data URL)
  awbNumber?: string // Număr AWB client (completat ulterior)
  shippingReceiptPhoto?: string // Poză chitanță expediere (path sau data URL)
  packageLabelPhoto?: string // Poză etichetă colet (path sau data URL)
}

const BCRYPT_ROUNDS = 12
const LEGACY_SHA256_RE = /^[a-f0-9]{64}$/i

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS)
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  if (!hash) return false
  if (LEGACY_SHA256_RE.test(hash)) {
    // Legacy SHA-256 hash — accept dacă se potrivește, dar caller ar trebui să facă rehash.
    const legacy = crypto.createHash('sha256').update(password).digest('hex')
    return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(legacy, 'hex'))
  }
  try {
    return await bcrypt.compare(password, hash)
  } catch {
    return false
  }
}

export function isLegacyPasswordHash(hash: string): boolean {
  return LEGACY_SHA256_RE.test(hash)
}

/**
 * Citește utilizatorii din baza de date (compatibilitate - nu folosit)
 */
export function getUsers(): User[] {
  if (!supabase) {
    if (IS_VERCEL) {
      throw new Error(
        'Supabase nu este configurat în Vercel. Setează SUPABASE_URL și SUPABASE_SERVICE_ROLE_KEY (Production scope) și redeploy.'
      )
    }
    try {
      const data = fs.readFileSync(USERS_FILE, 'utf-8')
      return JSON.parse(data)
    } catch (error) {
      return []
    }
  }
  return []
}

/**
 * Salvează utilizatorii în baza de date (compatibilitate - nu folosit)
 */
export function saveUsers(users: User[]): void {
  if (!supabase) {
    if (IS_VERCEL) {
      throw new Error(
        'Supabase nu este configurat în Vercel. Setează SUPABASE_URL și SUPABASE_SERVICE_ROLE_KEY (Production scope) și redeploy.'
      )
    }
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2))
  }
}

/**
 * Numără utilizatorii existenți. Folosit pentru bootstrap: înregistrarea
 * publică e permisă doar când DB-ul e gol (primul admin).
 */
export async function countUsers(): Promise<number> {
  if (supabase) {
    const { count, error } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true })
    if (error) throw new Error('Eroare la numărarea utilizatorilor: ' + error.message)
    return count ?? 0
  }
  return getUsers().length
}

/**
 * Găsește un utilizator după email
 */
export async function findUserByEmail(email: string): Promise<User | null> {
  if (supabase) {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', email.toLowerCase())
      .single()
    
    if (error || !data) return null
    
    return {
      id: data.id,
      nume: data.nume,
      prenume: data.prenume,
      email: data.email,
      passwordHash: data.password_hash,
      createdAt: data.created_at,
    }
  }
  
  // Fallback la JSON
  const users = getUsers()
  return users.find(u => u.email.toLowerCase() === email.toLowerCase()) || null
}

/**
 * Găsește un utilizator după ID
 */
export async function findUserById(id: string): Promise<User | null> {
  if (supabase) {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', id)
      .single()
    
    if (error || !data) return null
    
    return {
      id: data.id,
      nume: data.nume,
      prenume: data.prenume,
      email: data.email,
      passwordHash: data.password_hash,
      createdAt: data.created_at,
    }
  }
  
  // Fallback la JSON
  const users = getUsers()
  return users.find(u => u.id === id) || null
}

/**
 * Creează un nou utilizator
 */
export async function createUser(nume: string, prenume: string, email: string, password: string): Promise<User> {
  if (supabase) {
    // Verifică dacă există deja
    const existing = await findUserByEmail(email)
    if (existing) {
      throw new Error('Utilizatorul cu acest email există deja')
    }
    
    const passwordHashValue = await hashPassword(password)
    const { data, error } = await supabase
      .from('users')
      .insert({
        nume,
        prenume,
        email: email.toLowerCase(),
        password_hash: passwordHashValue,
      })
      .select()
      .single()
    
    if (error) {
      throw new Error('Eroare la crearea utilizatorului: ' + error.message)
    }
    
    return {
      id: data.id,
      nume: data.nume,
      prenume: data.prenume,
      email: data.email,
      passwordHash: data.password_hash,
      createdAt: data.created_at,
    }
  }
  
  // Fallback la JSON
  const users = getUsers()
  
  // Verifică dacă utilizatorul există deja
  const existing = users.find(u => u.email.toLowerCase() === email.toLowerCase())
  if (existing) {
    throw new Error('Utilizatorul cu acest email există deja')
  }
  
  const user: User = {
    id: crypto.randomUUID(),
    nume,
    prenume,
    email: email.toLowerCase(),
    passwordHash: await hashPassword(password),
    createdAt: new Date().toISOString(),
  }
  
  users.push(user)
  saveUsers(users)
  
  return user
}

/**
 * Citește configurația aplicației
 */
export async function getConfig(): Promise<AppConfig> {
  if (supabase) {
    const { data, error } = await supabase
      .from('app_config')
      .select('*')
      .order('updated_at', { ascending: false })
      .limit(1)
      .single()
    
    if (error || !data) {
      return {
        shopify: {
          domain: '',
          accessToken: '',
          clientId: '',
          clientSecret: '',
          shopTitle: '',
        },
        excludedSKUs: [],
        eligibilityOverrides: [],
      }
    }

    return {
      shopify: {
        domain: data.shopify_domain || '',
        accessToken: data.shopify_access_token || '',
        clientId: data.shopify_client_id || '',
        clientSecret: data.shopify_client_secret || '',
        shopTitle: data.shop_title || '',
      },
      excludedSKUs: (data.excluded_skus as string[]) || [],
      eligibilityOverrides: (data.eligibility_overrides as string[]) || [],
    }
  }
  
  // Fallback la JSON
  try {
    const data = fs.readFileSync(CONFIG_FILE, 'utf-8')
    const parsed = JSON.parse(data) as Partial<AppConfig>
    return {
      shopify: {
        domain: parsed.shopify?.domain || '',
        accessToken: parsed.shopify?.accessToken || '',
        clientId: parsed.shopify?.clientId || '',
        clientSecret: parsed.shopify?.clientSecret || '',
        shopTitle: parsed.shopify?.shopTitle || '',
      },
      excludedSKUs: parsed.excludedSKUs || [],
      eligibilityOverrides: parsed.eligibilityOverrides || [],
    }
  } catch (error) {
    return {
      shopify: {
        domain: '',
        accessToken: '',
        clientId: '',
        clientSecret: '',
        shopTitle: '',
      },
      excludedSKUs: [],
      eligibilityOverrides: [],
    }
  }
}

/**
 * Salvează configurația aplicației (compatibilitate - nu folosit direct)
 */
export function saveConfig(config: AppConfig): void {
  if (!supabase) {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2))
  }
}

/**
 * Actualizează configurația Shopify
 */
export async function updateShopifyConfig(shopify: ShopifyConfig): Promise<void> {
  if (supabase) {
    // Obține configurația existentă
    const { data: existing } = await supabase
      .from('app_config')
      .select('id')
      .order('updated_at', { ascending: false })
      .limit(1)
      .single()

    if (existing) {
      const { error } = await supabase
        .from('app_config')
        .update({
          shopify_domain: shopify.domain,
          shopify_access_token: shopify.accessToken,
          shopify_client_id: shopify.clientId,
          shopify_client_secret: shopify.clientSecret,
          shop_title: shopify.shopTitle,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id)

      if (error) {
        throw new Error('Eroare la actualizarea configurației: ' + error.message)
      }
    } else {
      const { error } = await supabase
        .from('app_config')
        .insert({
          shopify_domain: shopify.domain,
          shopify_access_token: shopify.accessToken,
          shopify_client_id: shopify.clientId,
          shopify_client_secret: shopify.clientSecret,
          shop_title: shopify.shopTitle,
        })

      if (error) {
        throw new Error('Eroare la crearea configurației: ' + error.message)
      }
    }
    return
  }
  
  // Fallback la JSON
  const config = await getConfig()
  config.shopify = shopify
  saveConfig(config)
}

/**
 * Actualizează SKU-urile excluse
 */
export async function updateExcludedSKUs(skus: string[]): Promise<void> {
  if (supabase) {
    const { data: existing } = await supabase
      .from('app_config')
      .select('id')
      .order('updated_at', { ascending: false })
      .limit(1)
      .single()

    if (existing) {
      const { error } = await supabase
        .from('app_config')
        .update({
          excluded_skus: skus,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id)
      
      if (error) {
        throw new Error('Eroare la actualizarea SKU-urilor: ' + error.message)
      }
    } else {
      const { error } = await supabase
        .from('app_config')
        .insert({
          excluded_skus: skus,
        })
      
      if (error) {
        throw new Error('Eroare la crearea configurației: ' + error.message)
      }
    }
    return
  }
  
  // Fallback la JSON
  const config = await getConfig()
  config.excludedSKUs = skus
  saveConfig(config)
}

/**
 * Actualizează lista comenzilor deblocate manual (override termen retur expirat).
 * Valorile se stochează normalizat (vezi normalizeOrderNumber).
 */
export async function updateEligibilityOverrides(orders: string[]): Promise<void> {
  const normalized = Array.from(new Set(orders.map(normalizeOrderNumber).filter(Boolean)))
  if (supabase) {
    const { data: existing } = await supabase
      .from('app_config')
      .select('id')
      .order('updated_at', { ascending: false })
      .limit(1)
      .single()

    if (existing) {
      const { error } = await supabase
        .from('app_config')
        .update({
          eligibility_overrides: normalized,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id)

      if (error) {
        throw new Error('Eroare la actualizarea deblocărilor: ' + error.message)
      }
    } else {
      const { error } = await supabase
        .from('app_config')
        .insert({
          eligibility_overrides: normalized,
        })

      if (error) {
        throw new Error('Eroare la crearea configurației: ' + error.message)
      }
    }
    return
  }

  // Fallback la JSON
  const config = await getConfig()
  config.eligibilityOverrides = normalized
  saveConfig(config)
}

/**
 * Citește toate retururile din baza de date
 */
export async function getReturns(): Promise<Return[]> {
  if (supabase) {
    const { data, error } = await supabase
      .from('returns')
      .select('*')
      .order('created_at', { ascending: false })
    
    if (error || !data) return []
    
    return data.map(row => ({
      idRetur: row.id_retur,
      numarComanda: row.numar_comanda,
      orderData: row.order_data,
      products: row.products,
      refundData: row.refund_data,
      signature: row.signature,
      totalRefund: parseFloat(row.total_refund),
      status: normalizeStatus(row.status),
      createdAt: row.created_at,
      pdfPath: row.pdf_path || '',
      qrCodeData: row.qr_code_data || '',
      awbNumber: row.awb_number,
      shippingReceiptPhoto: row.shipping_receipt_photo,
      packageLabelPhoto: row.package_label_photo,
    }))
  }
  
  // Fallback la JSON
  try {
    const data = fs.readFileSync(RETURNS_FILE, 'utf-8')
    const parsed: Return[] = JSON.parse(data)
    return parsed.map(r => ({ ...r, status: normalizeStatus(r.status) }))
  } catch (error) {
    return []
  }
}

/**
 * Salvează retururile în baza de date (compatibilitate - nu folosit direct)
 */
export function saveReturns(returns: Return[]): void {
  if (!supabase) {
    fs.writeFileSync(RETURNS_FILE, JSON.stringify(returns, null, 2))
  }
}

/**
 * Generează un ID de retur formatat: RET-YYYY-NNNNNN
 */
export async function generateReturnId(): Promise<string> {
  const currentYear = new Date().getFullYear()
  
  if (supabase) {
    // Găsește ultimul număr pentru anul curent
    const { data } = await supabase
      .from('returns')
      .select('id_retur')
      .like('id_retur', `RET-${currentYear}-%`)
      .order('created_at', { ascending: false })
    
    let nextNumber = 1
    if (data && data.length > 0) {
      const lastReturn = data[0]
      const match = lastReturn.id_retur.match(/RET-\d{4}-(\d+)/)
      if (match) {
        nextNumber = parseInt(match[1], 10) + 1
      }
    }
    
    return `RET-${currentYear}-${nextNumber.toString().padStart(6, '0')}`
  }
  
  // Fallback la JSON
  const returns = await getReturns()
  const currentYearReturns = returns.filter(r => r.idRetur.startsWith(`RET-${currentYear}-`))
  
  let nextNumber = 1
  if (currentYearReturns.length > 0) {
    const lastReturn = currentYearReturns[currentYearReturns.length - 1]
    const match = lastReturn.idRetur.match(/RET-\d{4}-(\d+)/)
    if (match) {
      nextNumber = parseInt(match[1], 10) + 1
    }
  }
  
  return `RET-${currentYear}-${nextNumber.toString().padStart(6, '0')}`
}

/**
 * Creează un retur nou
 */
export async function createReturn(
  numarComanda: string,
  orderData: OrderData,
  products: Product[],
  refundData: RefundData,
  signature: string,
  totalRefund: number,
  pdfPath: string,
  qrCodeData: string,
  idRetur?: string
): Promise<Return> {
  const returnId = idRetur || await generateReturnId()
  
  if (supabase) {
    const { data, error } = await supabase
      .from('returns')
      .insert({
        id_retur: returnId,
        numar_comanda: numarComanda,
        order_data: orderData,
        products: products,
        refund_data: refundData,
        signature: signature,
        total_refund: totalRefund,
        status: 'INITIAT',
        pdf_path: pdfPath,
        qr_code_data: qrCodeData,
      })
      .select()
      .single()
    
    if (error) {
      throw new Error('Eroare la crearea returului: ' + error.message)
    }
    
    return {
      idRetur: data.id_retur,
      numarComanda: data.numar_comanda,
      orderData: data.order_data,
      products: data.products,
      refundData: data.refund_data,
      signature: data.signature,
      totalRefund: parseFloat(data.total_refund),
      status: normalizeStatus(data.status),
      createdAt: data.created_at,
      pdfPath: data.pdf_path || '',
      qrCodeData: data.qr_code_data || '',
      awbNumber: data.awb_number,
      shippingReceiptPhoto: data.shipping_receipt_photo,
      packageLabelPhoto: data.package_label_photo,
    }
  }
  
  // Fallback la JSON
  const returns = await getReturns()
  
  const newReturn: Return = {
    idRetur: returnId,
    numarComanda,
    orderData,
    products,
    refundData,
    signature,
    totalRefund,
    status: 'INITIAT',
    createdAt: new Date().toISOString(),
    pdfPath,
    qrCodeData,
  }
  
  returns.push(newReturn)
  saveReturns(returns)
  
  return newReturn
}

/**
 * Găsește un retur după ID
 */
export async function findReturnById(idRetur: string): Promise<Return | null> {
  if (supabase) {
    const { data, error } = await supabase
      .from('returns')
      .select('*')
      .eq('id_retur', idRetur)
      .single()
    
    if (error || !data) return null
    
    return {
      idRetur: data.id_retur,
      numarComanda: data.numar_comanda,
      orderData: data.order_data,
      products: data.products,
      refundData: data.refund_data,
      signature: data.signature,
      totalRefund: parseFloat(data.total_refund),
      status: normalizeStatus(data.status),
      createdAt: data.created_at,
      pdfPath: data.pdf_path || '',
      qrCodeData: data.qr_code_data || '',
      awbNumber: data.awb_number,
      shippingReceiptPhoto: data.shipping_receipt_photo,
      packageLabelPhoto: data.package_label_photo,
    }
  }
  
  // Fallback la JSON
  const returns = await getReturns()
  return returns.find(r => r.idRetur === idRetur) || null
}

/**
 * Găsește cel mai recent retur asociat unui număr de comandă (sau null).
 * Filtrează implicit returnurile anulate ca să nu blocheze un nou retur valid.
 */
export async function findReturnByOrderNumber(
  numarComanda: string,
  opts?: { includeCancelled?: boolean }
): Promise<Return | null> {
  const includeCancelled = !!opts?.includeCancelled
  if (supabase) {
    let query = supabase
      .from('returns')
      .select('*')
      .eq('numar_comanda', numarComanda)
      .order('created_at', { ascending: false })
      .limit(1)
    if (!includeCancelled) {
      query = query.neq('status', 'ANULAT')
    }
    const { data, error } = await query
    if (error || !data || data.length === 0) return null
    const row = data[0]
    return {
      idRetur: row.id_retur,
      numarComanda: row.numar_comanda,
      orderData: row.order_data,
      products: row.products,
      refundData: row.refund_data,
      signature: row.signature,
      totalRefund: parseFloat(row.total_refund),
      status: normalizeStatus(row.status),
      createdAt: row.created_at,
      pdfPath: row.pdf_path || '',
      qrCodeData: row.qr_code_data || '',
      awbNumber: row.awb_number,
      shippingReceiptPhoto: row.shipping_receipt_photo,
      packageLabelPhoto: row.package_label_photo,
    }
  }

  const returns = await getReturns()
  const filtered = returns
    .filter(r => r.numarComanda === numarComanda)
    .filter(r => includeCancelled || r.status !== 'ANULAT')
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  return filtered[0] || null
}

/**
 * Actualizează statusul unui retur
 */
export async function updateReturnStatus(idRetur: string, status: Return['status']): Promise<Return | null> {
  if (supabase) {
    const { data, error } = await supabase
      .from('returns')
      .update({ status })
      .eq('id_retur', idRetur)
      .select()
      .single()
    
    if (error || !data) return null
    
    return {
      idRetur: data.id_retur,
      numarComanda: data.numar_comanda,
      orderData: data.order_data,
      products: data.products,
      refundData: data.refund_data,
      signature: data.signature,
      totalRefund: parseFloat(data.total_refund),
      status: normalizeStatus(data.status),
      createdAt: data.created_at,
      pdfPath: data.pdf_path || '',
      qrCodeData: data.qr_code_data || '',
      awbNumber: data.awb_number,
      shippingReceiptPhoto: data.shipping_receipt_photo,
      packageLabelPhoto: data.package_label_photo,
    }
  }
  
  // Fallback la JSON
  const returns = await getReturns()
  const returnIndex = returns.findIndex(r => r.idRetur === idRetur)
  
  if (returnIndex === -1) {
    return null
  }
  
  returns[returnIndex].status = status
  saveReturns(returns)
  
  return returns[returnIndex]
}

/**
 * Anulează un retur
 */
export async function archiveReturn(idRetur: string): Promise<Return | null> {
  return updateReturnStatus(idRetur, 'ANULAT')
}

/**
 * Șterge un retur din baza de date
 */
export async function deleteReturn(idRetur: string): Promise<boolean> {
  if (supabase) {
    const { error } = await supabase
      .from('returns')
      .delete()
      .eq('id_retur', idRetur)
    
    return !error
  }
  
  // Fallback la JSON
  const returns = await getReturns()
  const returnIndex = returns.findIndex(r => r.idRetur === idRetur)
  
  if (returnIndex === -1) {
    return false
  }
  
  const returnToDelete = returns[returnIndex]
  
  // Șterge PDF-ul asociat dacă există
  if (returnToDelete.pdfPath && fs.existsSync(returnToDelete.pdfPath)) {
    try {
      fs.unlinkSync(returnToDelete.pdfPath)
    } catch (error) {
      console.error('Error deleting PDF file:', error)
    }
  }
  
  returns.splice(returnIndex, 1)
  saveReturns(returns)
  
  return true
}

/**
 * Actualizează documentele unui retur (AWB, poze)
 */
export async function updateReturnDocuments(
  idRetur: string,
  awbNumber?: string,
  shippingReceiptPhoto?: string,
  packageLabelPhoto?: string
): Promise<Return | null> {
  if (supabase) {
    const updates: any = {}
    if (awbNumber !== undefined) updates.awb_number = awbNumber
    if (shippingReceiptPhoto !== undefined) updates.shipping_receipt_photo = shippingReceiptPhoto
    if (packageLabelPhoto !== undefined) updates.package_label_photo = packageLabelPhoto
    
    const { data, error } = await supabase
      .from('returns')
      .update(updates)
      .eq('id_retur', idRetur)
      .select()
      .single()
    
    if (error || !data) return null
    
    return {
      idRetur: data.id_retur,
      numarComanda: data.numar_comanda,
      orderData: data.order_data,
      products: data.products,
      refundData: data.refund_data,
      signature: data.signature,
      totalRefund: parseFloat(data.total_refund),
      status: normalizeStatus(data.status),
      createdAt: data.created_at,
      pdfPath: data.pdf_path || '',
      qrCodeData: data.qr_code_data || '',
      awbNumber: data.awb_number,
      shippingReceiptPhoto: data.shipping_receipt_photo,
      packageLabelPhoto: data.package_label_photo,
    }
  }
  
  // Fallback la JSON
  const returns = await getReturns()
  const returnIndex = returns.findIndex(r => r.idRetur === idRetur)
  
  if (returnIndex === -1) {
    return null
  }
  
  if (awbNumber !== undefined) {
    returns[returnIndex].awbNumber = awbNumber
  }
  if (shippingReceiptPhoto !== undefined) {
    returns[returnIndex].shippingReceiptPhoto = shippingReceiptPhoto
  }
  if (packageLabelPhoto !== undefined) {
    returns[returnIndex].packageLabelPhoto = packageLabelPhoto
  }
  
  saveReturns(returns)
  
  return returns[returnIndex]
}

/**
 * Actualizează complet un retur (toate câmpurile)
 */
export async function updateReturn(
  idRetur: string,
  updates: Partial<{
    orderData: OrderData
    products: Product[]
    refundData: RefundData
    totalRefund: number
    status: Return['status']
    awbNumber: string
    shippingReceiptPhoto: string
    packageLabelPhoto: string
  }>
): Promise<Return | null> {
  if (supabase) {
    const dbUpdates: any = {}
    
    if (updates.orderData !== undefined) dbUpdates.order_data = updates.orderData
    if (updates.products !== undefined) dbUpdates.products = updates.products
    if (updates.refundData !== undefined) dbUpdates.refund_data = updates.refundData
    if (updates.totalRefund !== undefined) dbUpdates.total_refund = updates.totalRefund
    if (updates.status !== undefined) dbUpdates.status = updates.status
    if (updates.awbNumber !== undefined) dbUpdates.awb_number = updates.awbNumber
    if (updates.shippingReceiptPhoto !== undefined) dbUpdates.shipping_receipt_photo = updates.shippingReceiptPhoto
    if (updates.packageLabelPhoto !== undefined) dbUpdates.package_label_photo = updates.packageLabelPhoto
    
    const { data, error } = await supabase
      .from('returns')
      .update(dbUpdates)
      .eq('id_retur', idRetur)
      .select()
      .single()
    
    if (error || !data) return null
    
    return {
      idRetur: data.id_retur,
      numarComanda: data.numar_comanda,
      orderData: data.order_data,
      products: data.products,
      refundData: data.refund_data,
      signature: data.signature,
      totalRefund: parseFloat(data.total_refund),
      status: normalizeStatus(data.status),
      createdAt: data.created_at,
      pdfPath: data.pdf_path || '',
      qrCodeData: data.qr_code_data || '',
      awbNumber: data.awb_number,
      shippingReceiptPhoto: data.shipping_receipt_photo,
      packageLabelPhoto: data.package_label_photo,
    }
  }
  
  // Fallback la JSON
  const returns = await getReturns()
  const returnIndex = returns.findIndex(r => r.idRetur === idRetur)
  
  if (returnIndex === -1) {
    return null
  }
  
  // Actualizează doar câmpurile furnizate
  if (updates.orderData !== undefined) {
    returns[returnIndex].orderData = updates.orderData
  }
  if (updates.products !== undefined) {
    returns[returnIndex].products = updates.products
  }
  if (updates.refundData !== undefined) {
    returns[returnIndex].refundData = updates.refundData
  }
  if (updates.totalRefund !== undefined) {
    returns[returnIndex].totalRefund = updates.totalRefund
  }
  if (updates.status !== undefined) {
    returns[returnIndex].status = updates.status
  }
  if (updates.awbNumber !== undefined) {
    returns[returnIndex].awbNumber = updates.awbNumber
  }
  if (updates.shippingReceiptPhoto !== undefined) {
    returns[returnIndex].shippingReceiptPhoto = updates.shippingReceiptPhoto
  }
  if (updates.packageLabelPhoto !== undefined) {
    returns[returnIndex].packageLabelPhoto = updates.packageLabelPhoto
  }
  
  saveReturns(returns)
  
  return returns[returnIndex]
}

