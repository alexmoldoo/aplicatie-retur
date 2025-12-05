import jsPDF from 'jspdf'
import { Return } from './db'

/**
 * Generează PDF-ul pentru un retur
 * @param returnData - Datele returului
 * @param qrCodeDataUrl - Data URL al QR code-ului
 * @returns Buffer - Buffer al PDF-ului generat
 */
export async function generateReturnPDF(
  returnData: Return,
  qrCodeDataUrl: string
): Promise<Buffer> {
  const pdf = new jsPDF()
  const pageWidth = pdf.internal.pageSize.getWidth()
  const pageHeight = pdf.internal.pageSize.getHeight()
  const margin = 20
  let yPosition = margin

  // Title
  pdf.setFontSize(20)
  pdf.setFont('helvetica', 'bold')
  pdf.text('RETURN FORM', pageWidth / 2, yPosition, { align: 'center' })
  yPosition += 12

  // Return ID
  pdf.setFontSize(14)
  pdf.setFont('helvetica', 'bold')
  pdf.text(`Return ID: ${returnData.idRetur}`, margin, yPosition)
  yPosition += 10

  // Order Information Section
  pdf.setFontSize(12)
  pdf.setFont('helvetica', 'bold')
  pdf.text('Order Information:', margin, yPosition)
  yPosition += 8

  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(10)
  pdf.text(`Order Number: ${returnData.numarComanda}`, margin, yPosition)
  yPosition += 6
  pdf.text(`Customer Name: ${returnData.orderData.nume}`, margin, yPosition)
  yPosition += 11

  // Products Section
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(12)
  pdf.text('Products Returned:', margin, yPosition)
  yPosition += 8

  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(10)
  
  const returnedProducts = returnData.products.filter(
    p => p.selected || p.cantitateReturnata > 0
  )
  
  returnedProducts.forEach((product, index) => {
    if (yPosition > pageHeight - 40) {
      pdf.addPage()
      yPosition = margin
    }
    
    const quantity = product.cantitateReturnata || (product.selected ? product.cantitate : 0)
    pdf.text(`${index + 1}. ${product.nume}`, margin, yPosition)
    yPosition += 5
    pdf.text(`   Quantity: ${quantity} | Unit Price: ${product.pret.toFixed(2)} RON`, margin + 5, yPosition)
    yPosition += 5
    pdf.text(`   Total: ${(product.pret * quantity).toFixed(2)} RON`, margin + 5, yPosition)
    if (product.motivRetur) {
      yPosition += 5
      pdf.text(`   Reason: ${product.motivRetur}`, margin + 5, yPosition)
    }
    yPosition += 8
  })
  yPosition += 5

  // Refund Information Section
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(12)
  pdf.text('Refund Information:', margin, yPosition)
  yPosition += 8

  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(10)
  pdf.text(`Total Refund: ${returnData.totalRefund.toFixed(2)} RON`, margin, yPosition)
  yPosition += 6

  if (returnData.refundData.iban) {
    pdf.text(`IBAN: ${returnData.refundData.iban}`, margin, yPosition)
    yPosition += 6
  }
  if (returnData.refundData.numeTitular) {
    pdf.text(`Account Holder: ${returnData.refundData.numeTitular}`, margin, yPosition)
    yPosition += 6
  }
  yPosition += 10

  // Signature Section
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(12)
  pdf.text('Customer Signature:', margin, yPosition)
  yPosition += 8

  // Add signature image
  if (returnData.signature) {
    try {
      const imgWidth = 80
      const imgHeight = 40
      pdf.addImage(returnData.signature, 'PNG', margin, yPosition, imgWidth, imgHeight)
      yPosition += 45
    } catch (error) {
      console.error('Error adding signature to PDF:', error)
      pdf.text('Signature not available', margin, yPosition)
      yPosition += 8
    }
  }
  yPosition += 5

  // QR Code Section
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(12)
  pdf.text('Return ID QR Code:', margin, yPosition)
  yPosition += 8

  // Add QR code image
  try {
    const qrSize = 50
    const qrX = pageWidth - margin - qrSize
    pdf.addImage(qrCodeDataUrl, 'PNG', qrX, yPosition - 8, qrSize, qrSize)
    yPosition += 55
  } catch (error) {
    console.error('Error adding QR code to PDF:', error)
    pdf.text('QR Code not available', margin, yPosition)
    yPosition += 8
  }

  // Date and Terms
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(9)
  pdf.text(`Date: ${new Date(returnData.createdAt).toLocaleDateString('en-US')}`, margin, yPosition)
  yPosition += 6

  // Important Notes
  if (yPosition > pageHeight - 30) {
    pdf.addPage()
    yPosition = margin
  }

  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(10)
  pdf.text('Important Notes:', margin, yPosition)
  yPosition += 8

  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(9)
  const notes = [
    'Package must be sent with COD 0 (mandatory)',
    'Shipping cost is fully covered by the customer',
    'Products must be properly packaged',
    'Return address: maxari, Anghel I. Saligny Street 40, CT Park Cargo Terminal, Oradea, 410085, Bihor, Romania',
  ]

  notes.forEach(note => {
    if (yPosition > pageHeight - 15) {
      pdf.addPage()
      yPosition = margin
    }
    pdf.text(`• ${note}`, margin + 5, yPosition)
    yPosition += 6
  })

  // Convert to buffer
  const pdfOutput = pdf.output('arraybuffer')
  return Buffer.from(pdfOutput)
}

