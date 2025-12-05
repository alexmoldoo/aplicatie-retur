/**
 * Validare strictă pentru numere de telefon românești
 */

/**
 * Validează dacă un număr de telefon este un număr românesc valid
 * Acceptă formate:
 * - +40712345678
 * - 0712345678
 * - 0040712345678
 * - 40712345678
 */
export function isValidRomanianPhone(phone: string): boolean {
  if (!phone || phone.trim().length === 0) {
    return false
  }

  // Elimină spații și caractere speciale pentru validare
  let cleaned = phone.replace(/[\s\-\(\)]/g, '')
  
  // Verifică formatele valide pentru numere românești
  // Format 1: +40712345678 (10 cifre după +40)
  if (cleaned.startsWith('+40')) {
    const digits = cleaned.substring(3)
    return /^\d{9}$/.test(digits) && digits.startsWith('7')
  }
  
  // Format 2: 0712345678 (10 cifre, începe cu 0)
  if (cleaned.startsWith('0') && cleaned.length === 10) {
    return /^0[7]\d{8}$/.test(cleaned)
  }
  
  // Format 3: 0040712345678 (12 cifre, începe cu 0040)
  if (cleaned.startsWith('0040') && cleaned.length === 12) {
    const digits = cleaned.substring(4)
    return /^7\d{8}$/.test(digits)
  }
  
  // Format 4: 40712345678 (11 cifre, începe cu 40)
  if (cleaned.startsWith('40') && cleaned.length === 11) {
    const digits = cleaned.substring(2)
    return /^7\d{8}$/.test(digits)
  }
  
  return false
}

/**
 * Normalizează numărul de telefon pentru afișare
 */
export function normalizePhoneForDisplay(phone: string): string {
  if (!phone) return ''
  
  let cleaned = phone.replace(/[\s\-\(\)]/g, '')
  
  // Dacă începe cu +40, păstrează formatul
  if (cleaned.startsWith('+40')) {
    const digits = cleaned.substring(3)
    if (digits.length === 9 && digits.startsWith('7')) {
      return `+40${digits.substring(0, 3)} ${digits.substring(3, 6)} ${digits.substring(6)}`
    }
  }
  
  // Dacă începe cu 0, formatează ca 07xx xxx xxx
  if (cleaned.startsWith('0') && cleaned.length === 10) {
    return `${cleaned.substring(0, 2)} ${cleaned.substring(2, 5)} ${cleaned.substring(5, 8)} ${cleaned.substring(8)}`
  }
  
  return phone
}

