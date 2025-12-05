/**
 * Baza de date simplă folosind JSON pentru stocare
 * În producție, ar trebui să folosești o bază de date reală (PostgreSQL, MySQL, etc.)
 */

import fs from 'fs'
import path from 'path'
import crypto from 'crypto'

const DB_DIR = path.join(process.cwd(), 'data')
const RETURNS_DIR = path.join(DB_DIR, 'retururi')
const USERS_FILE = path.join(DB_DIR, 'users.json')
const CONFIG_FILE = path.join(DB_DIR, 'config.json')
const RETURNS_FILE = path.join(DB_DIR, 'returns.json')

// Asigură-te că directorul data există
if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true })
}

// Asigură-te că directorul retururi există
if (!fs.existsSync(RETURNS_DIR)) {
  fs.mkdirSync(RETURNS_DIR, { recursive: true })
}

// Inițializează fișierele JSON dacă nu există
if (!fs.existsSync(USERS_FILE)) {
  fs.writeFileSync(USERS_FILE, JSON.stringify([], null, 2))
}

if (!fs.existsSync(CONFIG_FILE)) {
  fs.writeFileSync(CONFIG_FILE, JSON.stringify({
    shopify: {
      domain: '',
      accessToken: '',
      shopTitle: '',
    },
    excludedSKUs: [],
  }, null, 2))
}

if (!fs.existsSync(RETURNS_FILE)) {
  fs.writeFileSync(RETURNS_FILE, JSON.stringify([], null, 2))
}

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
  accessToken: string
  shopTitle: string
}

export interface AppConfig {
  shopify: ShopifyConfig
  excludedSKUs: string[]
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
  iban?: string // Doar IBAN și numeTitular (fără metodaRambursare)
  numeTitular?: string
}

export interface Return {
  idRetur: string // ID unic de retur (ex: RET-2025-000123)
  numarComanda: string // Număr comandă
  orderData: OrderData // Date client (doar nume)
  products: Product[] // Lista produselor returnate
  refundData: RefundData // Date rambursare (IBAN și nume titular)
  signature: string // Semnătura clientului (data URL)
  totalRefund: number // Suma totală de returnat
  status: 'INITIAT' | 'IN_ASTEPTARE_COLET' | 'COLET_PRIMIT' | 'PROCESAT' | 'FINALIZAT' | 'ANULAT' // Status retur
  createdAt: string // Data creării cererii
  pdfPath: string // Calea către PDF-ul generat
  qrCodeData: string // QR code cu link către pagina de detalii (data URL)
  awbNumber?: string // Număr AWB client (completat ulterior)
  shippingReceiptPhoto?: string // Poză chitanță expediere (path sau data URL)
  packageLabelPhoto?: string // Poză etichetă colet (path sau data URL)
}

/**
 * Hash-uiește o parolă
 */
export function hashPassword(password: string): string {
  return crypto.createHash('sha256').update(password).digest('hex')
}

/**
 * Verifică o parolă
 */
export function verifyPassword(password: string, hash: string): boolean {
  return hashPassword(password) === hash
}

/**
 * Citește utilizatorii din baza de date
 */
export function getUsers(): User[] {
  try {
    const data = fs.readFileSync(USERS_FILE, 'utf-8')
    return JSON.parse(data)
  } catch (error) {
    return []
  }
}

/**
 * Salvează utilizatorii în baza de date
 */
export function saveUsers(users: User[]): void {
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2))
}

/**
 * Găsește un utilizator după email
 */
export function findUserByEmail(email: string): User | null {
  const users = getUsers()
  return users.find(u => u.email.toLowerCase() === email.toLowerCase()) || null
}

/**
 * Găsește un utilizator după ID
 */
export function findUserById(id: string): User | null {
  const users = getUsers()
  return users.find(u => u.id === id) || null
}

/**
 * Creează un nou utilizator
 */
export function createUser(nume: string, prenume: string, email: string, password: string): User {
  const users = getUsers()
  
  // Verifică dacă utilizatorul există deja
  if (findUserByEmail(email)) {
    throw new Error('Utilizatorul cu acest email există deja')
  }
  
  const user: User = {
    id: crypto.randomUUID(),
    nume,
    prenume,
    email: email.toLowerCase(),
    passwordHash: hashPassword(password),
    createdAt: new Date().toISOString(),
  }
  
  users.push(user)
  saveUsers(users)
  
  return user
}

/**
 * Citește configurația aplicației
 */
export function getConfig(): AppConfig {
  try {
    const data = fs.readFileSync(CONFIG_FILE, 'utf-8')
    return JSON.parse(data)
  } catch (error) {
    return {
      shopify: {
        domain: '',
        accessToken: '',
        shopTitle: '',
      },
      excludedSKUs: [],
    }
  }
}

/**
 * Salvează configurația aplicației
 */
export function saveConfig(config: AppConfig): void {
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2))
}

/**
 * Actualizează configurația Shopify
 */
export function updateShopifyConfig(shopify: ShopifyConfig): void {
  const config = getConfig()
  config.shopify = shopify
  saveConfig(config)
}

/**
 * Actualizează SKU-urile excluse
 */
export function updateExcludedSKUs(skus: string[]): void {
  const config = getConfig()
  config.excludedSKUs = skus
  saveConfig(config)
}

/**
 * Citește toate retururile din baza de date
 */
export function getReturns(): Return[] {
  try {
    const data = fs.readFileSync(RETURNS_FILE, 'utf-8')
    return JSON.parse(data)
  } catch (error) {
    return []
  }
}

/**
 * Salvează retururile în baza de date
 */
export function saveReturns(returns: Return[]): void {
  fs.writeFileSync(RETURNS_FILE, JSON.stringify(returns, null, 2))
}

/**
 * Generează un ID de retur formatat: RET-YYYY-NNNNNN
 */
export function generateReturnId(): string {
  const returns = getReturns()
  const currentYear = new Date().getFullYear()
  
  // Găsește ultimul număr pentru anul curent
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
export function createReturn(
  numarComanda: string,
  orderData: OrderData,
  products: Product[],
  refundData: RefundData,
  signature: string,
  totalRefund: number,
  pdfPath: string,
  qrCodeData: string,
  idRetur?: string
): Return {
  const returns = getReturns()
  
  const newReturn: Return = {
    idRetur: idRetur || generateReturnId(),
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
export function findReturnById(idRetur: string): Return | null {
  const returns = getReturns()
  return returns.find(r => r.idRetur === idRetur) || null
}

/**
 * Actualizează statusul unui retur
 */
export function updateReturnStatus(idRetur: string, status: Return['status']): Return | null {
  const returns = getReturns()
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
export function archiveReturn(idRetur: string): Return | null {
  return updateReturnStatus(idRetur, 'ANULAT')
}

/**
 * Șterge un retur din baza de date
 */
export function deleteReturn(idRetur: string): boolean {
  const returns = getReturns()
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
export function updateReturnDocuments(
  idRetur: string,
  awbNumber?: string,
  shippingReceiptPhoto?: string,
  packageLabelPhoto?: string
): Return | null {
  const returns = getReturns()
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
export function updateReturn(
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
): Return | null {
  const returns = getReturns()
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

