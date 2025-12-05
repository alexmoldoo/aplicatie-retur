/**
 * Utilitare pentru validarea numerelor de comandă Shopify
 */

/**
 * Normalizează numărul de comandă pentru căutare
 * Acceptă: #12345, MX12345, 12345, #MX12345, etc.
 */
export function normalizeOrderNumber(orderNumber: string): string {
  // Elimină spații și convertește la uppercase
  let normalized = orderNumber.trim().toUpperCase()
  
  // Elimină # dacă există
  normalized = normalized.replace(/^#+/, '')
  
  // Elimină MX dacă există la început
  normalized = normalized.replace(/^MX/, '')
  
  return normalized.trim()
}

/**
 * Validează dacă un număr de comandă are format valid
 * Format valid: numere, opțional cu # sau MX la început
 */
export function isValidOrderNumberFormat(orderNumber: string): boolean {
  if (!orderNumber || orderNumber.trim().length === 0) {
    return false
  }
  
  // Elimină # și MX pentru validare
  const cleaned = normalizeOrderNumber(orderNumber)
  
  // Trebuie să conțină doar cifre după normalizare
  return /^\d+$/.test(cleaned) && cleaned.length > 0
}

/**
 * Validează numele (trebuie să existe nume SAU prenume SAU ambele)
 */
export function validateName(nume: string): { valid: boolean; error?: string } {
  if (!nume || nume.trim().length === 0) {
    return {
      valid: false,
      error: 'Numele este obligatoriu',
    }
  }
  
  const trimmed = nume.trim()
  
  // Verifică dacă are cel puțin un cuvânt (nume sau prenume)
  const words = trimmed.split(/\s+/).filter(w => w.length > 0)
  
  if (words.length === 0) {
    return {
      valid: false,
      error: 'Introduceți cel puțin numele sau prenumele',
    }
  }
  
  return { valid: true }
}

