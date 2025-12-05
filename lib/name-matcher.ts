/**
 * Utilitare pentru potrivirea numelor
 */

/**
 * Normalizează un nume pentru comparare
 * - lowercase
 * - elimină diacritice
 * - elimină spații duble
 */
export function normalizeName(name: string): string {
  if (!name) return ''
  
  // Convert la lowercase
  let normalized = name.toLowerCase().trim()
  
  // Elimină diacritice
  normalized = normalized
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
  
  // Elimină spații duble și normalizează spațiile
  normalized = normalized.replace(/\s+/g, ' ').trim()
  
  return normalized
}

/**
 * Extrage numele de familie și prenumele dintr-un nume complet
 */
export function extractNameParts(fullName: string): {
  numeFamilie: string
  prenume: string
  parts: string[]
} {
  const normalized = normalizeName(fullName)
  const parts = normalized.split(' ').filter(p => p.length > 0)
  
  if (parts.length === 0) {
    return { numeFamilie: '', prenume: '', parts: [] }
  }
  
  if (parts.length === 1) {
    return { numeFamilie: parts[0], prenume: '', parts }
  }
  
  // Numele de familie este primul cuvânt, prenumele este restul
  const numeFamilie = parts[0]
  const prenume = parts.slice(1).join(' ')
  
  return { numeFamilie, prenume, parts }
}

/**
 * Verifică dacă numele introdus se potrivește cu numele din comandă
 * Validare STRICTĂ:
 * - Numele de familie introdus trebuie să se regăsească EXACT în numele din comandă SAU
 * - Prenumele introdus trebuie să se regăsească EXACT în numele din comandă
 * - Nu acceptă potriviri parțiale sau fuzzy
 */
export function matchNames(introducedName: string, orderName: string): boolean {
  if (!introducedName || !orderName) {
    return false
  }
  
  const normalizedIntroduced = normalizeName(introducedName)
  const normalizedOrder = normalizeName(orderName)
  
  // Dacă numele sunt identice după normalizare
  if (normalizedIntroduced === normalizedOrder) {
    return true
  }
  
  // Extrage părțile din ambele nume
  const introducedParts = extractNameParts(introducedName)
  const orderParts = extractNameParts(orderName)
  
  // Dacă nu are părți, nu se potrivește
  if (introducedParts.parts.length === 0 || orderParts.parts.length === 0) {
    return false
  }
  
  // Verificare STRICTĂ: Numele de familie trebuie să se potrivească
  // Numele de familie este primul cuvânt în ambele cazuri
  const introducedNumeFamilie = introducedParts.parts[0]
  const orderNumeFamilie = orderParts.parts[0]
  
  if (introducedNumeFamilie === orderNumeFamilie) {
    // Numele de familie se potrivește - verifică dacă există și prenumele
    // Dacă numele introdus are doar nume de familie, acceptă
    if (introducedParts.parts.length === 1) {
      return true
    }
    
    // Dacă ambele au prenume, verifică dacă cel puțin un prenume se potrivește
    if (introducedParts.parts.length > 1 && orderParts.parts.length > 1) {
      const introducedPrenume = introducedParts.parts.slice(1)
      const orderPrenume = orderParts.parts.slice(1)
      
      // Verifică dacă cel puțin un prenume din introdus se regăsește în comenză
      for (const prenumeIntrodus of introducedPrenume) {
        if (prenumeIntrodus.length >= 3) { // Minim 3 caractere pentru prenume
          for (const prenumeComanda of orderPrenume) {
            if (prenumeIntrodus === prenumeComanda) {
              return true
            }
          }
        }
      }
    }
    
    // Dacă numele de familie se potrivește dar nu s-a verificat prenumele, acceptă
    return true
  }
  
  // Verificare alternativă: poate prenumele introdus este numele de familie din comandă
  // (caz: "Andrei" introdus, dar în comandă este "Moldovan Andrei")
  if (introducedParts.parts.length === 1 && introducedParts.parts[0].length >= 3) {
    // Verifică dacă numele introdus se regăsește ca prenume în comandă
    const introducedSingle = introducedParts.parts[0]
    for (let i = 1; i < orderParts.parts.length; i++) {
      if (introducedSingle === orderParts.parts[i]) {
        return true
      }
    }
  }
  
  return false
}

/**
 * Verifică dacă cel puțin o comandă se potrivește cu numele introdus
 */
export function matchOrdersWithName(orders: any[], introducedName: string): any[] {
  if (!introducedName || !orders || orders.length === 0) {
    return []
  }
  
  return orders.filter(order => {
    const orderName = order.billing_address?.name || 
                     `${order.billing_address?.first_name || ''} ${order.billing_address?.last_name || ''}`.trim()
    
    return matchNames(introducedName, orderName)
  })
}

