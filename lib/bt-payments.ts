/**
 * Fișier de plăți în lot pentru Banca Transilvania (BT Go → Pachet de plăți).
 *
 * Format luat din modelul oficial BT (Model-fisier.xlsx) și din instrucțiunile
 * BT Go: 11 coloane, separate prin virgulă, fără ghilimele; sume cu „.";
 * dată zz/ll/aaaa; detalii fără diacritice și fără caractere speciale, max 105.
 * Parserul BT nu suportă „," sau „;" în interiorul unui câmp, deci textele se
 * reduc la litere, cifre și spații.
 *
 * Funcțiile de aici sunt pure (fără DB) ca să poată fi testate izolat.
 */

import type { Return } from './db'
import { validateRomanianIBAN } from './iban-validator'

export const BT_CSV_HEADER =
  'OrderNumber,SourceAccountNumber,TargetAccountNumber,BeneficiaryName,BeneficiaryBankBIC,BeneficiaryFiscalCode,Amount,PaymentRef1,PaymentRef2,ValueDate,Urgent'

/** Maxim de tranzacții acceptat de BT într-un fișier. */
export const BT_MAX_ROWS = 2000

/** Sub acest prag plata e „normală" (Urgent = F); rambursările sunt mereu sub el. */
export const BT_URGENT_THRESHOLD = 50000

const PAYMENT_REF_MAX = 105
const BENEFICIARY_NAME_MAX = 70

/**
 * Coduri BIC din lista oficială BT (Cod-SWIFT.pdf, „NUME BANCA / COD BANCA").
 * Primele 4 litere ale BIC-ului sunt codul băncii din IBAN (pozițiile 5–8).
 */
const BT_BIC_LIST = [
  'MINDROBUXXX', 'WBANRO22XXX', 'BFERROBUXXX', 'RNCBROBUXXX', 'BRDEROBUXXX',
  'BRMAROBUXXX', 'BTRLRO22XXX', 'BCRLROBUXXX', 'BLOMROBUXXX', 'CECEROBUXXX',
  'CITIROBUXXX', 'FNNBROBUXXX', 'CRCOROBUXXX', 'FTSBROBUXXX', 'UGBIROBUXXX',
  'INGBROBUXXX', 'BRELROBUXXX', 'EGNAROBXXXX', 'CARPRO22XXX', 'PIRBROBUXXX',
  'PORLROBUXXX', 'MIROROBUXXX', 'RZBLROBUXXX', 'RZBRROBUXXX', 'ROINROBUXXX',
  'TREZROBUXXX', 'BACXROBUXXX', 'TBIBROBUXXX', 'REVOROBBXXX', 'TRPCROB2XXX',
  'VPAYROB2XXX', 'SSRRROBUXXX', 'BKCHROBUXXX', 'BPKOROBUXXX',
] as const

const BIC_BY_BANK_CODE: Record<string, string> = Object.fromEntries(
  BT_BIC_LIST.map(bic => [bic.slice(0, 4), bic])
)

/** Bănci către care BT acceptă DOAR plăți ≥ 50.000 RON — rambursările nu pot merge prin fișier. */
const HIGH_VALUE_ONLY = new Set(['BKCH', 'BPKO'])

/** Trezoreria cere cod fiscal al beneficiarului — nu e cazul rambursărilor către clienți. */
const TREASURY = 'TREZ'

export function cleanIban(iban: string | undefined | null): string {
  return (iban || '').replace(/\s/g, '').toUpperCase()
}

export function bicForIban(iban: string): string | null {
  return BIC_BY_BANK_CODE[cleanIban(iban).slice(4, 8)] || null
}

/** Litere latine care nu se descompun prin NFD — le transliterăm explicit. */
const TRANSLIT: Record<string, string> = {
  'ß': 'ss', 'Đ': 'D', 'đ': 'd', 'Ð': 'D', 'ð': 'd', 'Ł': 'L', 'ł': 'l',
  'Ø': 'O', 'ø': 'o', 'Æ': 'AE', 'æ': 'ae', 'Œ': 'OE', 'œ': 'oe',
  'ı': 'i', 'Þ': 'Th', 'þ': 'th',
}

function transliterate(input: string): string {
  return input.replace(/[ßĐđÐðŁłØøÆæŒœıÞþ]/g, ch => TRANSLIT[ch] || ch)
}

/**
 * True dacă textul conține litere care nu pot fi scrise cu A–Z (ex. chirilice):
 * în loc să le ștergem în tăcere și să trimitem un nume ciuntit, returul merge
 * pe lista „de plătit manual".
 */
export function hasUnsupportedLetters(input: string | undefined | null): boolean {
  const base = transliterate(input || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    // punctuație tipografică inofensivă (ghilimele, apostrof, liniuțe, spațiu nedespărțitor)
    .replace(/[\u00A0\u2018\u2019\u201C\u201D\u201E\u2013\u2014\u2026\u00B7]/g, ' ')
  return /[^\x00-\x7F]/.test(base)
}

/** Litere fără diacritice, cifre și spații; restul devine spațiu. */
export function sanitizeBtText(input: string | undefined | null, maxLen: number): string {
  return transliterate(input || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLen)
    .trim()
}

/** Aceeași rotunjire ca în admin și în PDF (`toFixed(2)`), ca suma plătită să fie cea afișată. */
export function formatBtAmount(amount: number): string {
  return amount.toFixed(2)
}

/** Înlocuiește data plății (coloana 10) dintr-un rând deja generat. */
export function withValueDate(line: string, valueDate: string): string {
  const fields = line.split(',')
  if (fields.length !== 11) return line
  fields[9] = valueDate
  return fields.join(',')
}

/** Data în fusul României, zz/ll/aaaa. */
export function btValueDate(d: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Bucharest',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(d)
}

/** Validează contul plătitor: IBAN românesc valid, deschis la BT. */
export function validateSourceIban(iban: string): { valid: boolean; error?: string } {
  const clean = cleanIban(iban)
  const check = validateRomanianIBAN(clean)
  if (!check.valid) return { valid: false, error: check.error || 'IBAN invalid.' }
  if (!/^RO\d{2}[A-Z]{4}[A-Z0-9]{16}$/.test(clean)) return { valid: false, error: 'IBAN invalid.' }
  if (clean.slice(4, 8) !== 'BTRL') {
    return { valid: false, error: 'Contul plătitor trebuie să fie un cont Banca Transilvania.' }
  }
  return { valid: true }
}

export interface PaymentCandidate {
  idRetur: string
  numarComanda: string
  numeTitular: string
  iban: string
  bic: string
  suma: number
}

export type Eligibility =
  | { ok: true; candidate: PaymentCandidate }
  | { ok: false; reason: string }

/**
 * Poate intra returul în fișierul de plăți? Regulile țin doar de datele de plată;
 * filtrarea pe status (PRIMIT) și pe metoda de rambursare se face în apelant.
 */
export function checkPayable(ret: Pick<Return, 'idRetur' | 'numarComanda' | 'refundData' | 'totalRefund'>): Eligibility {
  const iban = cleanIban(ret.refundData?.iban)
  if (!iban) return { ok: false, reason: 'Lipsește IBAN-ul.' }

  const ibanCheck = validateRomanianIBAN(iban)
  if (!ibanCheck.valid) return { ok: false, reason: ibanCheck.error || 'IBAN invalid.' }
  if (!/^RO\d{2}[A-Z]{4}[A-Z0-9]{16}$/.test(iban)) return { ok: false, reason: 'IBAN invalid.' }

  const bankCode = iban.slice(4, 8)
  const bic = BIC_BY_BANK_CODE[bankCode]
  if (!bic) return { ok: false, reason: `Banca „${bankCode}" nu e în lista BT.` }
  if (bankCode === TREASURY) return { ok: false, reason: 'Cont de Trezorerie — necesită cod fiscal.' }
  if (HIGH_VALUE_ONLY.has(bankCode)) {
    return { ok: false, reason: 'Banca acceptă doar plăți de peste 50.000 RON.' }
  }

  if (hasUnsupportedLetters(ret.refundData?.numeTitular)) {
    return { ok: false, reason: 'Numele titularului conține caractere nesuportate.' }
  }
  const numeTitular = sanitizeBtText(ret.refundData?.numeTitular, BENEFICIARY_NAME_MAX)
  if (numeTitular.length < 3 || !/[A-Za-z]{2}/.test(numeTitular)) {
    return { ok: false, reason: 'Lipsește titularul contului.' }
  }

  const total = Number(ret.totalRefund)
  if (!Number.isFinite(total)) return { ok: false, reason: 'Sumă invalidă.' }
  const suma = Number(total.toFixed(2))
  if (!(suma > 0)) return { ok: false, reason: 'Suma de rambursat este 0.' }
  if (suma >= BT_URGENT_THRESHOLD) return { ok: false, reason: 'Sumă de peste 50.000 RON.' }

  return {
    ok: true,
    candidate: { idRetur: ret.idRetur, numarComanda: ret.numarComanda, numeTitular, iban, bic, suma },
  }
}

/** Un rând CSV pentru BT. `orderNumber` e numărul ordinului de plată în fișier (1, 2, 3…). */
export function buildBtLine(
  orderNumber: number,
  sourceIban: string,
  c: PaymentCandidate,
  valueDate: string
): string {
  const ref1 = sanitizeBtText(`Plata retur nr comanda ${c.numarComanda}`, PAYMENT_REF_MAX)
  const ref2 = sanitizeBtText(c.idRetur, PAYMENT_REF_MAX)
  return [
    String(orderNumber),
    cleanIban(sourceIban),
    c.iban,
    c.numeTitular,
    c.bic,
    '', // BeneficiaryFiscalCode — doar pentru Trezorerie
    formatBtAmount(c.suma),
    ref1,
    ref2,
    valueDate,
    'F',
  ].join(',')
}

export function buildBtCsv(lines: string[]): string {
  return [BT_CSV_HEADER, ...lines].join('\r\n') + '\r\n'
}
