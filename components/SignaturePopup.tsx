'use client'

import { useState, useRef, useEffect } from 'react'
import { OrderData, Product, RefundData } from './ReturnProcess'
// Remove static import, use dynamic import instead

function triggerBrowserDownload(blob: Blob, fileName: string) {
  const url = window.URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  window.URL.revokeObjectURL(url)
}

interface SignaturePopupProps {
  isOpen: boolean
  onClose: () => void
  onBack?: () => void
  orderData: OrderData | null
  products: Product[]
  refundData: RefundData | null
  sessionToken?: string | null
}

export default function SignaturePopup({
  isOpen,
  onClose,
  onBack,
  orderData,
  products,
  refundData,
  sessionToken
}: SignaturePopupProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [hasSignature, setHasSignature] = useState(false)
  const [pdfGenerated, setPdfGenerated] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  // Guard sincron împotriva dublu-submit. State-ul React e async — nu blochează
  // două click-uri rapide înainte de re-render. `useRef` actualizează imediat.
  const submitInFlight = useRef(false)
  const [awbNumber, setAwbNumber] = useState<string | null>(null)
  const [awbPdfUrl, setAwbPdfUrl] = useState<string | null>(null)

  // Sume calculate pentru rezumat
  const selectedItems = products.filter(p => p.selected && (p.cantitateReturnata || 0) > 0)
  const subtotal = selectedItems.reduce((sum, p) => sum + p.pret * (p.cantitateReturnata || 0), 0)
  const costTransport = refundData?.costTransport || 0
  const totalRefund = Math.max(0, subtotal - costTransport)
  const metodaTrimitere = refundData?.metodaTrimitere || 'manual'

  const metodaLabel: Record<string, string> = {
    curier: '🏠 Curier la adresă',
    manual: '📮 Trimit eu cu un curier ales',
  }

  useEffect(() => {
    if (isOpen && canvasRef.current) {
      const canvas = canvasRef.current
      const ctx = canvas.getContext('2d')
      if (ctx) {
        ctx.strokeStyle = '#000'
        ctx.lineWidth = 2
        ctx.lineCap = 'round'
        ctx.lineJoin = 'round'
      }
    }
  }, [isOpen])

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    setIsDrawing(true)
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const rect = canvas.getBoundingClientRect()
    const x = 'touches' in e ? e.touches[0].clientX - rect.left : e.clientX - rect.left
    const y = 'touches' in e ? e.touches[0].clientY - rect.top : e.clientY - rect.top

    ctx.beginPath()
    ctx.moveTo(x, y)
  }

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return

    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const rect = canvas.getBoundingClientRect()
    const x = 'touches' in e ? e.touches[0].clientX - rect.left : e.clientX - rect.left
    const y = 'touches' in e ? e.touches[0].clientY - rect.top : e.clientY - rect.top

    ctx.lineTo(x, y)
    ctx.stroke()
    setHasSignature(true)
  }

  const stopDrawing = () => {
    setIsDrawing(false)
  }

  const clearSignature = () => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.clearRect(0, 0, canvas.width, canvas.height)
    setHasSignature(false)
  }

  const generatePDF = async () => {
    if (submitInFlight.current || isGenerating) {
      return
    }
    submitInFlight.current = true

    if (!orderData || !products || !refundData) {
      submitInFlight.current = false
      alert('Date lipsă. Vă rugăm să vă întoarceți și să completați toți pașii.')
      return
    }
    
    if (!hasSignature) {
      submitInFlight.current = false
      alert('Vă rugăm să semnați formularul înainte de a genera PDF-ul.')
      return
    }

    if (typeof window === 'undefined') {
      submitInFlight.current = false
      return
    }

    setIsGenerating(true)
    
    try {

      // Obține semnătura din canvas
      const canvas = canvasRef.current
      if (!canvas) {
        throw new Error('Canvas not found')
      }
      
      const signatureDataUrl = canvas.toDataURL('image/png')
      
      // Pregătește datele pentru trimitere
      // orderData: doar nume (fără email și telefon)
      // refundData: include IBAN, numeTitular și datele de expediere alese în Pas 5
      // orderContact: contact + adresă de livrare a comenzii (pentru pickup AWB SameDay).
      //   Nu se persistă pe retur — folosit doar pentru a chema API SameDay.
      const ship = orderData.shippingAddress
      const requestData = {
        orderData: {
          nume: orderData.nume,
          numarComanda: orderData.numarComanda,
        },
        orderContact: {
          nume: ship?.nume || orderData.nume,
          telefon: ship?.telefon || orderData.telefon,
          email: orderData.email,
          strada: ship?.strada || '',
          oras: ship?.oras || '',
          judet: ship?.judet || '',
          codPostal: ship?.codPostal || '',
          tara: ship?.tara || '',
        },
        products: products.filter(p => p.selected && (p.cantitateReturnata || 0) > 0),
        refundData: {
          iban: refundData.iban,
          numeTitular: refundData.numeTitular,
          metodaTrimitere: refundData.metodaTrimitere,
          costTransport: refundData.costTransport,
        },
        codeRedemption: refundData.codeRedemption,
        signature: signatureDataUrl,
        sessionToken,
      }
      
      // Trimite datele la backend
      const response = await fetch('/api/returns/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData),
      })
      
      const result = await response.json()
      
      if (!result.success) {
        throw new Error(result.message || 'Failed to create return')
      }
      
      // Obține PDF-ul ca blob (pdfPath include deja token-ul de sesiune)
      const pdfUrl0 = result.pdfPath
        ? `${result.pdfPath}${result.pdfPath.includes('?') ? '&' : '?'}token=${encodeURIComponent(sessionToken || '')}`
        : ''
      const pdfResponse = await fetch(pdfUrl0)
      const pdfBlob = await pdfResponse.blob()
      const fileName = `${result.returnId}.pdf`

      // Pe mobil (iOS/Android) deschidem direct sheet-ul nativ de share — userul
      // poate alege „Save to Files", „Mail", „WhatsApp" etc. fără să iasă din
      // sesiunea curentă. Pe desktop sau dacă API-ul lipsește, fallback la link
      // de download clasic.
      const pdfFile = new File([pdfBlob], fileName, { type: 'application/pdf' })
      const nav = navigator as Navigator & {
        canShare?: (data: { files: File[] }) => boolean
        share?: (data: { files: File[]; title?: string; text?: string }) => Promise<void>
      }
      const canShareFiles = !!(nav.canShare && nav.canShare({ files: [pdfFile] }) && nav.share)

      if (canShareFiles) {
        try {
          await nav.share!({
            files: [pdfFile],
            title: `Retur ${result.returnId}`,
            text: `Formular retur ${result.returnId}`,
          })
        } catch (err: any) {
          // AbortError = userul a închis sheet-ul. Nu fallback la download — l-am
          // deranja cu o descărcare după ce a ales să nu salveze.
          if (err?.name !== 'AbortError') {
            console.warn('Share failed, falling back to download:', err)
            triggerBrowserDownload(pdfBlob, fileName)
          }
        }
      } else {
        triggerBrowserDownload(pdfBlob, fileName)
      }

      // Salvează AWB-ul pentru afișare (dacă există)
      if (result.awbNumber) setAwbNumber(result.awbNumber)
      if (result.awbPdfUrl) setAwbPdfUrl(result.awbPdfUrl)

      setPdfGenerated(true)
      setIsGenerating(false)
      submitInFlight.current = false
    } catch (error) {
      console.error('Error generating PDF:', error)
      setIsGenerating(false)
      submitInFlight.current = false
      alert(`Eroare la generarea PDF-ului: ${error instanceof Error ? error.message : 'Eroare necunoscută'}. Vă rugăm să încercați din nou.`)
    }
  }

  if (!isOpen) return null

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '20px'
      }}
      onClick={(e) => {
        // Prevent closing when clicking on background
        if (e.target === e.currentTarget) {
          e.preventDefault()
          e.stopPropagation()
        }
      }}
    >
      <div
        style={{
          backgroundColor: '#fff',
          borderRadius: '16px',
          padding: '32px',
          maxWidth: '600px',
          width: '100%',
          maxHeight: '90vh',
          overflowY: 'auto',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
          position: 'relative'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '16px',
            right: '16px',
            width: '32px',
            height: '32px',
            borderRadius: '50%',
            border: 'none',
            backgroundColor: '#f5f5f5',
            color: '#333',
            fontSize: '20px',
            fontWeight: 'bold',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'background-color 0.2s ease'
          }}
          onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#e0e0e0'}
          onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#f5f5f5'}
        >
          ×
        </button>

        {/* Title */}
        <h2 style={{
          fontSize: '24px',
          fontWeight: 'bold',
          marginBottom: '20px',
          textAlign: 'center',
          paddingRight: '40px'
        }}>
          Confirmare retur și semnătură
        </h2>

        {/* Introductory Text */}
        <p style={{
          fontSize: '14px',
          lineHeight: '1.6',
          marginBottom: '20px',
          color: '#666'
        }}>
          Vă rugăm să verificați datele returului încă o dată și să semnați mai jos. După semnare, veți putea descărca formularul de retur (PDF), pe care vă recomandăm să îl imprimați și să îl includeți în colet.
        </p>

        {/* Rezumat retur */}
        <div style={{
          padding: '16px',
          backgroundColor: '#f0fdfa',
          border: '1px solid #99f6e4',
          borderRadius: '10px',
          marginBottom: '16px'
        }}>
          <p style={{ fontSize: '13px', fontWeight: 700, color: '#0f766e', margin: '0 0 10px 0' }}>
            Rezumat retur
          </p>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', color: '#374151', padding: '3px 0' }}>
            <span>Subtotal produse</span>
            <span>{subtotal.toFixed(2)} RON</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', color: '#374151', padding: '3px 0' }}>
            <span>Metodă trimitere</span>
            <span style={{ fontWeight: 600 }}>{metodaLabel[metodaTrimitere]}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', color: '#374151', padding: '3px 0' }}>
            <span>Cost transport</span>
            <span style={{ color: costTransport > 0 ? '#c2410c' : '#047857', fontWeight: 600 }}>
              {costTransport > 0 ? `−${costTransport.toFixed(2)} RON` : '0,00 RON'}
            </span>
          </div>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginTop: 8,
            paddingTop: 8,
            borderTop: '1px solid #99f6e4',
            fontSize: '14px',
            fontWeight: 700,
            color: '#111827',
          }}>
            <span style={{ textTransform: 'uppercase', letterSpacing: '0.04em' }}>Total rambursare</span>
            <span style={{ fontSize: 18, color: '#26a69a', fontWeight: 800 }}>{totalRefund.toFixed(2)} RON</span>
          </div>
        </div>

        {/* Agreement Text */}
        <div style={{
          padding: '14px 16px',
          backgroundColor: '#f9f9f9',
          borderRadius: '8px',
          marginBottom: '20px'
        }}>
          <p style={{ fontSize: '13px', color: '#374151', margin: 0, lineHeight: 1.6 }}>
            Prin semnătură confirm că datele sunt corecte și că am citit instrucțiunile de expediere.
          </p>
        </div>

        {/* Signature Field */}
        <div style={{ marginBottom: '20px' }}>
          <p style={{
            fontSize: '14px',
            fontWeight: 'bold',
            marginBottom: '8px'
          }}>
            Semnați în caseta de mai sus
          </p>
          <div style={{
            border: '2px solid #e0e0e0',
            borderRadius: '8px',
            padding: '8px',
            backgroundColor: '#fff'
          }}>
            <canvas
              ref={canvasRef}
              width={500}
              height={150}
              style={{
                width: '100%',
                height: '150px',
                border: '1px solid #ddd',
                borderRadius: '4px',
                cursor: 'crosshair',
                touchAction: 'none'
              }}
              onMouseDown={startDrawing}
              onMouseMove={draw}
              onMouseUp={stopDrawing}
              onMouseLeave={stopDrawing}
              onTouchStart={startDrawing}
              onTouchMove={draw}
              onTouchEnd={stopDrawing}
            />
          </div>
          <button
            onClick={clearSignature}
            style={{
              marginTop: '8px',
              padding: '6px 12px',
              borderRadius: '4px',
              border: '1px solid #e0e0e0',
              backgroundColor: '#fff',
              color: '#666',
              fontSize: '12px',
              cursor: 'pointer'
            }}
          >
            Șterge semnătura
          </button>
        </div>

        {/* Action Buttons */}
        {!pdfGenerated && (
          <div style={{ display: 'flex', gap: '10px', marginBottom: '12px' }}>
            {onBack && (
              <button
                onClick={onBack}
                disabled={isGenerating}
                style={{
                  flex: '0 0 auto',
                  padding: '14px 18px',
                  borderRadius: '8px',
                  background: 'transparent',
                  color: '#6b7280',
                  border: '1px solid #e5e7eb',
                  fontSize: '14px',
                  fontWeight: 600,
                  cursor: isGenerating ? 'not-allowed' : 'pointer',
                  opacity: isGenerating ? 0.5 : 1,
                  transition: 'all 0.2s ease',
                  letterSpacing: '0.04em',
                }}
              >
                ← ÎNAPOI
              </button>
            )}
            <button
              onClick={generatePDF}
              disabled={!hasSignature || isGenerating}
              style={{
                flex: 1,
                padding: '16px',
                borderRadius: '8px',
                background: (hasSignature && !isGenerating)
                  ? 'linear-gradient(90deg, #2196F3 0%, #4CAF50 100%)'
                  : '#ccc',
                color: '#fff',
                border: 'none',
                fontSize: '16px',
                fontWeight: 'bold',
                cursor: (hasSignature && !isGenerating) ? 'pointer' : 'not-allowed',
                opacity: (hasSignature && !isGenerating) ? 1 : 0.6,
                transition: 'all 0.3s ease',
              }}
            >
              {isGenerating ? 'Se generează PDF-ul...' : 'Generează și descarcă formularul de retur (PDF)'}
            </button>
          </div>
        )}

        {/* Confirmation Message */}
        {pdfGenerated && (
          <div style={{
            padding: '16px',
            backgroundColor: '#e8f5e9',
            borderRadius: '8px',
            marginBottom: '12px',
            textAlign: 'center'
          }}>
            <p style={{
              fontSize: '16px',
              fontWeight: 'bold',
              color: '#2e7d32',
              marginBottom: '12px'
            }}>
              ✅ Formularul a fost generat și descărcat.
            </p>

            {awbNumber && (
              <div style={{
                background: '#fff',
                border: '1px solid #99f6e4',
                borderRadius: 8,
                padding: '12px 14px',
                marginBottom: 12,
                textAlign: 'left'
              }}>
                <p style={{ fontSize: 12, color: '#0f766e', margin: '0 0 4px 0', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  AWB SameDay
                </p>
                <p style={{ fontSize: 16, color: '#111827', margin: 0, fontFamily: 'ui-monospace, monospace', fontWeight: 700 }}>
                  {awbNumber}
                </p>
                {awbPdfUrl && (
                  <a
                    href={awbPdfUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: 'inline-block',
                      marginTop: 10,
                      padding: '8px 14px',
                      background: '#26a69a',
                      color: '#fff',
                      borderRadius: 6,
                      fontSize: 13,
                      fontWeight: 600,
                      textDecoration: 'none',
                    }}
                  >
                    Descarcă eticheta SameDay (PDF)
                  </a>
                )}
                <p style={{ fontSize: 12, color: '#6b7280', margin: '8px 0 0 0', lineHeight: 1.5 }}>
                  Curierul SameDay va veni la adresa ta. Asigură-te că coletul e ambalat și gata de ridicare.
                </p>
              </div>
            )}

            <button
              onClick={onClose}
              style={{
                padding: '10px 24px',
                borderRadius: '8px',
                backgroundColor: '#26a69a',
                color: '#fff',
                border: 'none',
                fontSize: '14px',
                fontWeight: 'bold',
                cursor: 'pointer',
                transition: 'background-color 0.2s ease'
              }}
              onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#219a8e'}
              onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#26a69a'}
            >
              Am înțeles
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

