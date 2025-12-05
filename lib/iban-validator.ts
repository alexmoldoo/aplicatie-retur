/**
 * Validator pentru IBAN România
 * Format: RO + 2 cifre verificare + 4 litere + 16 cifre = 24 caractere total
 */

export function validateRomanianIBAN(iban: string): { valid: boolean; error?: string } {
  // Elimină spațiile și convertește la uppercase
  const cleanIban = iban.replace(/\s/g, '').toUpperCase()

  // Verifică lungimea (IBAN românesc are exact 24 caractere)
  if (cleanIban.length !== 24) {
    return {
      valid: false,
      error: 'IBAN-ul trebuie să aibă exact 24 de caractere (fără spații)',
    }
  }

  // Verifică că începe cu RO
  if (!cleanIban.startsWith('RO')) {
    return {
      valid: false,
      error: 'IBAN-ul trebuie să înceapă cu RO',
    }
  }

  // Verifică că după RO sunt doar cifre și litere (nu caractere speciale)
  const afterRO = cleanIban.substring(2)
  if (!/^[A-Z0-9]+$/.test(afterRO)) {
    return {
      valid: false,
      error: 'IBAN-ul conține caractere invalide. Doar litere și cifre sunt permise.',
    }
  }

  // Validare algoritm MOD-97-10 pentru IBAN (aceasta este validarea reală)
  const rearranged = cleanIban.slice(4) + cleanIban.slice(0, 4)
  const numericString = rearranged
    .split('')
    .map(char => {
      const code = char.charCodeAt(0)
      if (code >= 65 && code <= 90) { // A-Z
        return (code - 55).toString()
      }
      return char
    })
    .join('')

  // Calcul MOD-97-10
  let remainder = BigInt(0)
  for (let i = 0; i < numericString.length; i++) {
    remainder = (remainder * BigInt(10) + BigInt(numericString[i])) % BigInt(97)
  }

  if (remainder !== BigInt(1)) {
    return {
      valid: false,
      error: 'IBAN-ul nu este valid. Verificați cifrele de control.',
    }
  }

  return { valid: true }
}

/**
 * Formatează IBAN-ul pentru afișare (adaugă spații)
 */
export function formatIBAN(iban: string): string {
  const cleanIban = iban.replace(/\s/g, '').toUpperCase()
  if (cleanIban.length !== 24) return iban

  return `${cleanIban.slice(0, 4)} ${cleanIban.slice(4, 8)} ${cleanIban.slice(8, 12)} ${cleanIban.slice(12, 16)} ${cleanIban.slice(16, 20)} ${cleanIban.slice(20, 24)}`
}

