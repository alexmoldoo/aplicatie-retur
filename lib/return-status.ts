/**
 * Statusurile retururilor — sursă unică pentru tot codebase-ul.
 *
 * Flux principal:
 *   INITIAT → PRELUAT_CURIER → IN_TRANZIT → LIVRAT → PRIMIT → FINALIZAT
 *   (oricând) → ANULAT
 *
 * Statusurile automate (din tracking SameDay): PRELUAT_CURIER, IN_TRANZIT, LIVRAT.
 * Statusurile manuale (confirmate de operator/owner): PRIMIT, FINALIZAT, ANULAT.
 */

export const RETURN_STATUS = {
  INITIAT: 'INITIAT',
  PRELUAT_CURIER: 'PRELUAT_CURIER',
  IN_TRANZIT: 'IN_TRANZIT',
  LIVRAT: 'LIVRAT',
  PRIMIT: 'PRIMIT',
  FINALIZAT: 'FINALIZAT',
  ANULAT: 'ANULAT',
} as const

export type ReturnStatus = typeof RETURN_STATUS[keyof typeof RETURN_STATUS]

export const RETURN_STATUS_LIST: ReturnStatus[] = [
  RETURN_STATUS.INITIAT,
  RETURN_STATUS.PRELUAT_CURIER,
  RETURN_STATUS.IN_TRANZIT,
  RETURN_STATUS.LIVRAT,
  RETURN_STATUS.PRIMIT,
  RETURN_STATUS.FINALIZAT,
  RETURN_STATUS.ANULAT,
]

export const RETURN_STATUS_LABEL: Record<ReturnStatus, string> = {
  INITIAT: 'Inițiat',
  PRELUAT_CURIER: 'Preluat de curier',
  IN_TRANZIT: 'În tranzit',
  LIVRAT: 'Livrat',
  PRIMIT: 'Primit',
  FINALIZAT: 'Finalizat',
  ANULAT: 'Anulat',
}

/** Culoare folosită pentru badge-ul de status în UI admin. */
export const RETURN_STATUS_COLOR: Record<ReturnStatus, 'gray' | 'blue' | 'amber' | 'teal' | 'green' | 'red'> = {
  INITIAT: 'gray',
  PRELUAT_CURIER: 'blue',
  IN_TRANZIT: 'amber',
  LIVRAT: 'teal',
  PRIMIT: 'teal',
  FINALIZAT: 'green',
  ANULAT: 'red',
}

/**
 * Mapare valori vechi din DB → noile statusuri.
 * Tot ce există în Supabase din versiuni anterioare se citește ca status nou
 * fără migrație de date.
 */
const LEGACY_MAP: Record<string, ReturnStatus> = {
  IN_ASTEPTARE_COLET: RETURN_STATUS.INITIAT,
  COLET_PRIMIT: RETURN_STATUS.LIVRAT,
  PROCESAT: RETURN_STATUS.PRIMIT,
}

/** Întoarce un status canonic, traducând valorile legacy dacă e cazul. */
export function normalizeStatus(s: string | null | undefined): ReturnStatus {
  if (!s) return RETURN_STATUS.INITIAT
  if (s in RETURN_STATUS) return s as ReturnStatus
  if (s in LEGACY_MAP) return LEGACY_MAP[s]
  return RETURN_STATUS.INITIAT
}

/** True dacă valoarea e un status canonic (nu legacy, nu necunoscut). */
export function isReturnStatus(s: string): s is ReturnStatus {
  return s in RETURN_STATUS
}

/**
 * Statusuri automate — setate de sistem din tracking SameDay.
 * Owner-ul poate suprascrie manual oricum (cu motiv), dar UI-ul trebuie să arate
 * că valoarea curentă vine din curier, nu de la o persoană.
 */
export const AUTO_STATUSES: ReadonlySet<ReturnStatus> = new Set([
  RETURN_STATUS.PRELUAT_CURIER,
  RETURN_STATUS.IN_TRANZIT,
  RETURN_STATUS.LIVRAT,
])

/** Statusuri terminale — un retur ajuns aici nu mai trece automat mai departe. */
export const TERMINAL_STATUSES: ReadonlySet<ReturnStatus> = new Set([
  RETURN_STATUS.FINALIZAT,
  RETURN_STATUS.ANULAT,
])

/**
 * Rang ordinal pentru fluxul principal — folosit ca să nu „dăm înapoi" un retur
 * când tracking-ul curierului raportează un status anterior celui pe care l-a
 * setat deja un operator (ex: status manual PRIMIT, tracking spune încă LIVRAT).
 * ANULAT nu e ordonat — orice status poate trece la ANULAT manual.
 */
export const STATUS_RANK: Record<ReturnStatus, number> = {
  INITIAT: 0,
  PRELUAT_CURIER: 1,
  IN_TRANZIT: 2,
  LIVRAT: 3,
  PRIMIT: 4,
  FINALIZAT: 5,
  ANULAT: -1,
}

/**
 * Maparea răspunsului de tracking SameDay → status intern.
 *
 * SameDay folosește atât un ID numeric (`expeditionStatusId`) cât și un text
 * (`expeditionStatus`). Schema lor exactă variază pe documentație; folosim ID-ul
 * cu praguri conservatoare și un fallback pe cuvinte cheie din text.
 *
 * Returnează `null` dacă nu putem face o mapare sigură — atunci păstrăm
 * statusul curent în loc să-l setăm greșit.
 */
export function sameDayStatusToInternal(input: {
  expeditionStatusId: number | null
  expeditionStatus: string | null
}): ReturnStatus | null {
  // SameDay: ID-urile NU sunt ordinale (1=AWB Emis, 4=Ridicat, 23=Alocat
  // pentru ridicare, 26=Depozitare etc). Praguri pe ID dau false positive.
  // Folosim text-first cu regex bilingv (RO/EN) și ID exact ca fallback.
  const text = (input.expeditionStatus || '').toLowerCase().trim()
  if (text) {
    if (/livrat|delivered/.test(text)) return RETURN_STATUS.LIVRAT
    if (/depozit|tranzit|transit|sortar|sortation|delivery|drum|out\s+for/.test(text)) return RETURN_STATUS.IN_TRANZIT
    if (/preluat|pickup|picked|ridicat|alocat/.test(text)) return RETURN_STATUS.PRELUAT_CURIER
    if (/awb.*emis|issued/.test(text)) return null
  }

  // Fallback pe ID-uri cunoscute (din observații live SameDay).
  if (typeof input.expeditionStatusId === 'number') {
    const id = input.expeditionStatusId
    if (id === 1) return null               // AWB Emis
    if (id === 4 || id === 23) return RETURN_STATUS.PRELUAT_CURIER  // Ridicat / Alocat ridicare
    if (id === 26) return RETURN_STATUS.IN_TRANZIT  // Depozitare
  }

  return null
}
