import jsPDF from 'jspdf'
import { Return } from './db'

const ASCII_MAP: Record<string, string> = {
  ă: 'a', â: 'a', î: 'i', ș: 's', ş: 's', ț: 't', ţ: 't',
  Ă: 'A', Â: 'A', Î: 'I', Ș: 'S', Ş: 'S', Ț: 'T', Ţ: 'T',
}
function ascii(s: string | undefined | null): string {
  if (!s) return ''
  return s.replace(/[ăâîșşțţĂÂÎȘŞȚŢ]/g, c => ASCII_MAP[c] || c)
}

const METHOD_LABEL: Record<string, string> = {
  curier: 'Curier SameDay (ridicare de la client)',
  manual: 'Curier ales de client (manual)',
}

interface ReturAddr {
  companie?: string
  strada?: string
  oras?: string
  judet?: string
  codPostal?: string
  tara?: string
  telefon?: string
}

function readConfig(): { adresaRetur?: ReturAddr; logo?: string | null } {
  // Doar pe server; pdf se generează în /api/returns/create
  if (typeof window !== 'undefined') return {}
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const fs = require('fs')
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const path = require('path')
    const raw = fs.readFileSync(path.join(process.cwd(), 'data', 'config.json'), 'utf-8')
    const cfg = JSON.parse(raw)
    return {
      adresaRetur: cfg.adresaRetur || {},
      logo: cfg.branding?.logo || null,
    }
  } catch {
    return {}
  }
}

/**
 * Generează un PDF cu formularul de retur — 1 pagină A4.
 */
export async function generateReturnPDF(
  returnData: Return,
  qrCodeDataUrl: string
): Promise<Buffer> {
  const pdf = new jsPDF({ unit: 'mm', format: 'a4' })
  const W = pdf.internal.pageSize.getWidth()  // 210
  const H = pdf.internal.pageSize.getHeight() // 297
  const M = 12 // margin
  const colGap = 6
  const colW = (W - 2 * M - colGap) / 2

  const cfg = readConfig()
  const logoDataUrl = cfg.logo

  // --- Header (alb cu accent teal jos) ---
  const HEADER_H = 22
  pdf.setFillColor(255, 255, 255)
  pdf.rect(0, 0, W, HEADER_H, 'F')

  // Logo stânga (sau text fallback)
  let logoOk = false
  if (logoDataUrl) {
    try {
      const fmt = /^data:image\/png/.test(logoDataUrl) ? 'PNG'
        : /^data:image\/webp/.test(logoDataUrl) ? 'WEBP'
        : 'JPEG'
      pdf.addImage(logoDataUrl, fmt, M, 4, 32, 14, undefined, 'FAST')
      logoOk = true
    } catch (e) {
      console.error('logo add failed', e)
    }
  }
  if (!logoOk) {
    pdf.setTextColor(38, 166, 154)
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(16)
    pdf.text('MAXARI', M, 13)
  }

  pdf.setTextColor(40, 40, 40)
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(12)
  pdf.text('FORMULAR DE RETUR', W / 2, 12, { align: 'center' })
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(9)
  pdf.setTextColor(85, 85, 85)
  const dateStr = new Date(returnData.createdAt).toLocaleDateString('ro-RO')
  pdf.text(ascii(returnData.idRetur) + '   ·   ' + dateStr, W - M, 12, { align: 'right' })

  // Linie teal sub header
  pdf.setDrawColor(38, 166, 154)
  pdf.setLineWidth(0.6)
  pdf.line(M, HEADER_H, W - M, HEADER_H)
  pdf.setTextColor(0, 0, 0)

  // --- Two-column upper area ---
  let yL = 26
  let yR = 26
  const xL = M
  const xR = M + colW + colGap

  // Helper: card title
  const cardTitle = (text: string, x: number, y: number) => {
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(9)
    pdf.setTextColor(38, 166, 154)
    pdf.text(text.toUpperCase(), x, y)
    pdf.setDrawColor(38, 166, 154)
    pdf.setLineWidth(0.3)
    pdf.line(x, y + 1.2, x + colW, y + 1.2)
    pdf.setTextColor(0, 0, 0)
    return y + 5
  }

  const kv = (label: string, value: string, x: number, y: number) => {
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(8)
    pdf.setTextColor(85, 85, 85)
    pdf.text(ascii(label), x, y)
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(9)
    pdf.setTextColor(0, 0, 0)
    const lines = pdf.splitTextToSize(ascii(value || '-'), colW - 30)
    pdf.text(lines, x + 28, y)
    return y + 4 + (lines.length - 1) * 3.6
  }

  // LEFT COL — date comanda + metoda
  yL = cardTitle('Date client / comanda', xL, yL)
  yL = kv('Nume:', returnData.orderData.nume, xL, yL)
  yL = kv('Comanda:', returnData.numarComanda, xL, yL)
  yL = kv('ID retur:', returnData.idRetur, xL, yL)

  yL += 3
  yL = cardTitle('Metoda de expediere', xL, yL)
  const metoda = returnData.refundData.metodaTrimitere
  if (metoda) {
    yL = kv('Metoda:', METHOD_LABEL[metoda] || metoda, xL, yL)
  }
  if (returnData.awbNumber) {
    yL = kv('AWB:', returnData.awbNumber, xL, yL)
  }

  // Doar pentru manual: afișăm adresa de retur
  if (metoda === 'manual') {
    const adr = cfg.adresaRetur || {}
    yL += 3
    yL = cardTitle('Trimite coletul la', xL, yL)
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(9)
    const lines = [
      adr.companie || 'Maxari',
      adr.strada || '',
      `${adr.oras || ''}, ${adr.judet || ''} ${adr.codPostal || ''}`.trim().replace(/^,\s*/, ''),
      adr.tara || 'Romania',
    ].filter(Boolean)
    if (adr.telefon && adr.telefon.trim() !== '-') lines.push('Tel: ' + adr.telefon)
    lines.forEach(l => {
      pdf.text(ascii(l), xL, yL)
      yL += 4
    })
  }

  // RIGHT COL — refund + sumar
  yR = cardTitle('Date rambursare', xR, yR)
  if (returnData.refundData.metodaRambursare === 'card') {
    yR = kv('Metoda:', 'Refund pe cardul original', xR, yR)
  } else {
    yR = kv('IBAN:', returnData.refundData.iban || '-', xR, yR)
    yR = kv('Titular:', returnData.refundData.numeTitular || '-', xR, yR)
  }

  yR += 3
  yR = cardTitle('Sumar financiar', xR, yR)
  const subtotal = returnData.refundData.subtotalProduse ?? returnData.totalRefund
  const cost = returnData.refundData.costTransport || 0
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(9)
  pdf.text('Subtotal produse:', xR, yR)
  pdf.text(`${subtotal.toFixed(2)} RON`, xR + colW, yR, { align: 'right' })
  yR += 5
  pdf.text('Cost transport:', xR, yR)
  pdf.text(cost > 0 ? `-${cost.toFixed(2)} RON` : '0.00 RON', xR + colW, yR, { align: 'right' })
  yR += 6
  pdf.setDrawColor(200, 200, 200)
  pdf.line(xR, yR - 2, xR + colW, yR - 2)
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(11)
  pdf.text('TOTAL DE RAMBURSAT:', xR, yR + 2)
  pdf.setTextColor(38, 166, 154)
  pdf.text(`${returnData.totalRefund.toFixed(2)} RON`, xR + colW, yR + 2, { align: 'right' })
  pdf.setTextColor(0, 0, 0)
  yR += 8

  // --- Products table ---
  let y = Math.max(yL, yR) + 4
  if (y < 80) y = 80

  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(9)
  pdf.setTextColor(38, 166, 154)
  pdf.text('PRODUSE RETURNATE', M, y)
  pdf.setDrawColor(38, 166, 154)
  pdf.setLineWidth(0.3)
  pdf.line(M, y + 1.2, W - M, y + 1.2)
  pdf.setTextColor(0, 0, 0)
  y += 5

  // Coloane: # | Produs | Cant | Pret | Total | Motiv
  const COLS = {
    n: { x: M, w: 6 },
    name: { x: M + 6, w: 70 },
    qty: { x: M + 76, w: 12 },
    price: { x: M + 88, w: 22 },
    total: { x: M + 110, w: 22 },
    reason: { x: M + 132, w: W - M - (M + 132) },
  }

  pdf.setFillColor(245, 245, 245)
  pdf.rect(M, y, W - 2 * M, 6, 'F')
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(8)
  pdf.text('#', COLS.n.x + 1, y + 4)
  pdf.text('Produs', COLS.name.x + 1, y + 4)
  pdf.text('Cant.', COLS.qty.x + 1, y + 4)
  pdf.text('Pret unit.', COLS.price.x + 1, y + 4)
  pdf.text('Total', COLS.total.x + 1, y + 4)
  pdf.text('Motiv retur', COLS.reason.x + 1, y + 4)
  y += 7

  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(8)
  const items = returnData.products.filter(p => p.selected || p.cantitateReturnata > 0)

  items.forEach((p, idx) => {
    const qty = p.cantitateReturnata || (p.selected ? p.cantitate : 0)
    const total = p.pret * qty
    const nameLines = pdf.splitTextToSize(ascii(p.nume), COLS.name.w - 2)
    const reasonText = ascii(p.motivRetur || '') + (p.alteMotive ? ` — ${ascii(p.alteMotive)}` : '')
    const reasonLines = pdf.splitTextToSize(reasonText || '-', COLS.reason.w - 2)
    const rowH = Math.max(nameLines.length, reasonLines.length, 1) * 3.6 + 2

    if (idx % 2 === 1) {
      pdf.setFillColor(250, 250, 250)
      pdf.rect(M, y - 1, W - 2 * M, rowH, 'F')
    }

    pdf.text(String(idx + 1), COLS.n.x + 1, y + 3)
    pdf.text(nameLines, COLS.name.x + 1, y + 3)
    pdf.text(String(qty), COLS.qty.x + 1, y + 3)
    pdf.text(`${p.pret.toFixed(2)} RON`, COLS.price.x + 1, y + 3)
    pdf.text(`${total.toFixed(2)} RON`, COLS.total.x + 1, y + 3)
    pdf.text(reasonLines, COLS.reason.x + 1, y + 3)

    y += rowH
  })

  pdf.setDrawColor(220, 220, 220)
  pdf.line(M, y + 1, W - M, y + 1)
  y += 6

  // --- Footer: signature (left) + QR (right) ---
  const footerTop = Math.max(y, H - 50)
  const sigX = M
  const sigW = 70
  const sigH = 25

  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(8)
  pdf.setTextColor(85, 85, 85)
  pdf.text('SEMNATURA CLIENT', sigX, footerTop)
  pdf.setDrawColor(180, 180, 180)
  pdf.setLineWidth(0.2)
  pdf.line(sigX, footerTop + sigH + 2, sigX + sigW, footerTop + sigH + 2)
  pdf.setFontSize(7)
  pdf.setTextColor(140, 140, 140)
  pdf.text('Semnatura indica acordul cu termenii de retur.', sigX, footerTop + sigH + 6)
  pdf.setTextColor(0, 0, 0)

  if (returnData.signature) {
    try {
      pdf.addImage(returnData.signature, 'PNG', sigX, footerTop + 2, sigW, sigH)
    } catch (e) {
      console.error('signature add failed', e)
    }
  }

  // QR right
  const qrSize = 28
  const qrX = W - M - qrSize
  const qrY = footerTop
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(8)
  pdf.setTextColor(85, 85, 85)
  pdf.text('STATUS RETUR', qrX + qrSize / 2, qrY, { align: 'center' })
  try {
    pdf.addImage(qrCodeDataUrl, 'PNG', qrX, qrY + 2, qrSize, qrSize)
  } catch (e) {
    console.error('qr add failed', e)
  }
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(7)
  pdf.setTextColor(85, 85, 85)
  pdf.text('Scaneaza pentru detalii', qrX + qrSize / 2, qrY + qrSize + 5, { align: 'center' })
  pdf.setTextColor(0, 0, 0)

  // --- Bottom note bar ---
  const noteY = H - 12
  pdf.setDrawColor(38, 166, 154)
  pdf.setLineWidth(0.3)
  pdf.line(M, noteY - 4, W - M, noteY - 4)
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(7)
  pdf.setTextColor(110, 110, 110)
  const noteParts = [
    'Coletul se trimite cu ramburs 0',
    'Produsele trebuie sa fie in starea originala, cu etichetele intacte',
    `Generat: ${new Date(returnData.createdAt).toLocaleString('ro-RO')}`,
  ]
  pdf.text(ascii(noteParts.join('  ·  ')), W / 2, noteY, { align: 'center' })

  const pdfOutput = pdf.output('arraybuffer')
  return Buffer.from(pdfOutput)
}
