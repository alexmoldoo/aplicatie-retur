/**
 * Utilitare pentru calcularea eligibilității returului
 */

export type EligibilityStatus = 'eligible' | 'warning' | 'expired'

export interface EligibilityInfo {
  status: EligibilityStatus
  daysRemaining: number
  daysSinceOrder: number
  message?: string
}

/**
 * Calculează eligibilitatea returului
 * Regulă: 15 zile de la plasarea comenzii + 1 zi buffer = 16 zile total
 * - < 16 zile: eligibil (verde)
 * - 16-18 zile inclusiv: warning (galben) - mai ai X zile
 * - >= 19 zile: expirat (roșu) - ziua 18 inclusiv este eligibilă, ziua 19 nu mai este
 */
export function calculateEligibility(orderDate: string): EligibilityInfo {
  const orderDateTime = new Date(orderDate)
  const now = new Date()
  
  // Calculează zilele de la plasarea comenzii
  const daysSinceOrder = Math.floor((now.getTime() - orderDateTime.getTime()) / (1000 * 60 * 60 * 24))
  
  // 15 zile + 1 zi buffer = 16 zile total pentru eligibilitate
  const eligibilityDays = 16
  const lastEligibleDay = 18 // Ziua 18 inclusiv este eligibilă
  const expiredDay = 19 // Ziua 19 nu mai este eligibilă
  
  if (daysSinceOrder < eligibilityDays) {
    // Eligibil - led verde (< 16 zile)
    return {
      status: 'eligible',
      daysRemaining: eligibilityDays - daysSinceOrder,
      daysSinceOrder,
    }
  } else if (daysSinceOrder >= eligibilityDays && daysSinceOrder <= lastEligibleDay) {
    // Warning - led galben - mai ai X zile (16-18 zile inclusiv)
    const daysLeft = lastEligibleDay - daysSinceOrder + 1 // +1 pentru că ziua 18 este inclusiv
    return {
      status: 'warning',
      daysRemaining: daysLeft,
      daysSinceOrder,
      message: `Mai ai doar ${daysLeft} zile pentru retur`,
    }
  } else {
    // Expirat - led roșu (>= 19 zile)
    return {
      status: 'expired',
      daysRemaining: 0,
      daysSinceOrder,
      message: 'Nu mai sunteți eligibil pentru retur',
    }
  }
}

/**
 * Returnează culoarea led-ului în funcție de status
 */
export function getLedColor(status: EligibilityStatus): string {
  switch (status) {
    case 'eligible':
      return '#4CAF50' // Verde
    case 'warning':
      return '#FFC107' // Galben
    case 'expired':
      return '#F44336' // Roșu
    default:
      return '#9E9E9E' // Gri
  }
}

