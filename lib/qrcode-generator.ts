import QRCode from 'qrcode'

/**
 * Generează un QR code ca data URL (PNG)
 * @param idRetur - ID-ul returului (ex: "RET-2025-000123")
 * @param baseUrl - URL-ul de bază pentru generarea link-ului către pagina de detalii (opțional)
 * @returns Promise<string> - Data URL al QR code-ului
 */
export async function generateQRCode(idRetur: string, baseUrl?: string): Promise<string> {
  try {
    // Dacă baseUrl este furnizat, generează QR cu link către pagina de detalii
    // Altfel, generează doar ID-ul (comportament actual pentru compatibilitate)
    const qrContent = baseUrl ? `${baseUrl}/admin/returns/${idRetur}` : idRetur
    
    const qrCodeDataUrl = await QRCode.toDataURL(qrContent, {
      errorCorrectionLevel: 'M',
      type: 'image/png',
      width: 200,
      margin: 2,
    })
    return qrCodeDataUrl
  } catch (error) {
    console.error('Error generating QR code:', error)
    throw new Error('Failed to generate QR code')
  }
}

/**
 * Generează un QR code ca buffer (pentru salvare directă)
 * @param idRetur - ID-ul returului
 * @param baseUrl - URL-ul de bază pentru generarea link-ului către pagina de detalii (opțional)
 * @returns Promise<Buffer> - Buffer al QR code-ului
 */
export async function generateQRCodeBuffer(idRetur: string, baseUrl?: string): Promise<Buffer> {
  try {
    // Dacă baseUrl este furnizat, generează QR cu link către pagina de detalii
    // Altfel, generează doar ID-ul (comportament actual pentru compatibilitate)
    const qrContent = baseUrl ? `${baseUrl}/admin/returns/${idRetur}` : idRetur
    
    const qrCodeBuffer = await QRCode.toBuffer(qrContent, {
      errorCorrectionLevel: 'M',
      type: 'png',
      width: 200,
      margin: 2,
    })
    return qrCodeBuffer
  } catch (error) {
    console.error('Error generating QR code buffer:', error)
    throw new Error('Failed to generate QR code buffer')
  }
}

