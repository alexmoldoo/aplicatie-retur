'use client'

import { useState, useRef, useEffect } from 'react'
import { OrderData, Product, RefundData } from './ReturnProcess'
// Remove static import, use dynamic import instead

interface SignaturePopupProps {
  isOpen: boolean
  onClose: () => void
  orderData: OrderData | null
  products: Product[]
  refundData: RefundData | null
}

export default function SignaturePopup({
  isOpen,
  onClose,
  orderData,
  products,
  refundData
}: SignaturePopupProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [hasSignature, setHasSignature] = useState(false)
  const [pdfGenerated, setPdfGenerated] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)

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
    if (isGenerating) {
      return
    }
    
    if (!orderData || !products || !refundData) {
      alert('Date lipsă. Vă rugăm să vă întoarceți și să completați toți pașii.')
      return
    }
    
    if (!hasSignature) {
      alert('Vă rugăm să semnați formularul înainte de a genera PDF-ul.')
      return
    }
    
    if (typeof window === 'undefined') {
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
      // refundData: doar IBAN și numeTitular (fără metodaRambursare)
      const requestData = {
        orderData: {
          nume: orderData.nume,
          numarComanda: orderData.numarComanda,
        },
        products,
        refundData: {
          iban: refundData.iban,
          numeTitular: refundData.numeTitular,
        },
        signature: signatureDataUrl,
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
      
      // Descarcă PDF-ul generat
      const pdfResponse = await fetch(result.pdfPath)
      const pdfBlob = await pdfResponse.blob()
      const pdfUrl = window.URL.createObjectURL(pdfBlob)
      const link = document.createElement('a')
      link.href = pdfUrl
      link.download = `${result.returnId}.pdf`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(pdfUrl)
      
      setPdfGenerated(true)
      setIsGenerating(false)
    } catch (error) {
      console.error('Error generating PDF:', error)
      setIsGenerating(false)
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

        {/* Agreement Text */}
        <div style={{
          padding: '16px',
          backgroundColor: '#f9f9f9',
          borderRadius: '8px',
          marginBottom: '20px'
        }}>
          <p style={{
            fontSize: '14px',
            fontWeight: 'bold',
            marginBottom: '10px'
          }}>
            Prin semnarea acestui formular:
          </p>
          <ul style={{
            paddingLeft: '20px',
            margin: 0,
            fontSize: '14px',
            lineHeight: '1.8'
          }}>
            <li>Confirm că datele introduse sunt corecte și complete;</li>
            <li>Confirm că am citit și înțeles instrucțiunile de expediere;</li>
            <li>Sunt de acord să trimit coletul cu ramburs 0 și să suport costul de expediere.</li>
          </ul>
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

        {/* Generate PDF Button */}
        {!pdfGenerated && (
          <button
            onClick={generatePDF}
            disabled={!hasSignature || isGenerating}
            style={{
              width: '100%',
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
              marginBottom: '12px'
            }}
          >
            {isGenerating ? 'Se generează PDF-ul...' : 'Generează și descarcă formularul de retur (PDF)'}
          </button>
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
              ✅ Formularul a fost generat.
            </p>
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

