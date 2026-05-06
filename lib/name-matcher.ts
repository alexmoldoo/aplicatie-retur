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

  let normalized = name.toLowerCase().trim()

  // Elimină diacritice
  normalized = normalized
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')

  // Cratime, apostrofuri, virgule, puncte → spațiu
  // („Maria-Elena", „D'Angelo", „Lungu, Dana" → tokeni separați)
  normalized = normalized.replace(/[-_,.'`’]/g, ' ')

  // Elimină orice alt caracter non-literă (cifre, simboluri exotice)
  normalized = normalized.replace(/[^a-z\s]/g, ' ')

  // Spații multiple → unul singur
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
 * Verifică dacă numele introdus se potrivește cu numele din comandă.
 *
 * Matching ORDER-INDEPENDENT pe seturi de tokeni — în RO oamenii scriu
 * deopotrivă „Lungu Dana" (familie-prenume) și „Dana Lungu" (prenume-familie),
 * iar Shopify stochează `first_name + last_name`. Comparăm seturi, nu ordine.
 *
 * Reguli:
 * - tokeni de minim 2 caractere, normalizați (lowercase + fără diacritice)
 * - dacă unul e subset al celuilalt → match (ex: „Andrei" ⊆ „Moldovan Andrei",
 *   „Lungu Dana Andra" ⊇ „Lungu Dana")
 * - dacă au cel puțin 2 tokeni în comun → match (acoperă „Lungu Dana" vs
 *   „Dana Lungu Andra")
 * - dacă unul are un singur token (≥3 caractere) prezent în celălalt → match
 */
export function matchNames(introducedName: string, orderName: string): boolean {
  if (!introducedName || !orderName) {
    return false
  }

  const normalizedIntroduced = normalizeName(introducedName)
  const normalizedOrder = normalizeName(orderName)

  if (normalizedIntroduced === normalizedOrder) {
    return true
  }

  const introTokens = normalizedIntroduced.split(' ').filter(t => t.length >= 2)
  const orderTokens = normalizedOrder.split(' ').filter(t => t.length >= 2)

  if (introTokens.length === 0 || orderTokens.length === 0) {
    return false
  }

  const introSet = new Set(introTokens)
  const orderSet = new Set(orderTokens)

  // Subset în orice direcție
  const introSubsetOfOrder = introTokens.every(t => orderSet.has(t))
  const orderSubsetOfIntro = orderTokens.every(t => introSet.has(t))
  if (introSubsetOfOrder || orderSubsetOfIntro) {
    return true
  }

  // Calculează intersecția
  const commonTokens: string[] = []
  Array.from(introSet).forEach(t => {
    if (orderSet.has(t)) commonTokens.push(t)
  })

  // ≥2 tokeni în comun → match (acoperă „Dana Pop" vs „Pop Dana Andra")
  if (commonTokens.length >= 2) {
    return true
  }

  // 1 token comun, dar de cel puțin 4 caractere → match
  // (acoperă cazul „Lungu Adriana" introdus când comanda e a lui „Dana Lungu",
  // dar numai dacă tokenul comun e suficient de specific — un nume de familie
  // realist, nu doar particule scurte ca „de", „la", „al".)
  if (commonTokens.length === 1 && commonTokens[0].length >= 4) {
    return true
  }

  // Caz edge: un singur token introdus, ≥3 caractere, prezent în comandă
  // (ex: „Andrei" introdus, comanda e „Moldovan Andrei")
  if (introTokens.length === 1 && introTokens[0].length >= 3 && orderSet.has(introTokens[0])) {
    return true
  }
  if (orderTokens.length === 1 && orderTokens[0].length >= 3 && introSet.has(orderTokens[0])) {
    return true
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

