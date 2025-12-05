'use client'

import { useState, FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { OrderData } from './ReturnProcess'
import VerificationPopup from './VerificationPopup'
import OrderSelection from './OrderSelection'
import { validateName, isValidOrderNumberFormat, normalizeOrderNumber } from '@/lib/order-validator'
import { isValidRomanianPhone } from '@/lib/phone-validator'

interface OrderDetailsStepProps {
  onSubmit: (data: OrderData) => void
  onOrderSelected?: (orders: any[]) => void // Callback pentru a trimite comenzile găsite la ReturnProcess
}

export default function OrderDetailsStep({ onSubmit, onOrderSelected }: OrderDetailsStepProps) {
  const router = useRouter()
  const [nume, setNume] = useState('')
  const [numarComanda, setNumarComanda] = useState('')
  const [telefon, setTelefon] = useState('')
  const [email, setEmail] = useState('')
  const [showEmail, setShowEmail] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [searchStep, setSearchStep] = useState<'initial' | 'searching' | 'needsEmail' | 'found' | 'notFound'>('initial')
  const [showVerificationPopup, setShowVerificationPopup] = useState(false)
  const [foundOrders, setFoundOrders] = useState<any[]>([])
  const [validationErrors, setValidationErrors] = useState<{
    nume?: string
    numarComanda?: string
    telefon?: string
    email?: string
  }>({})

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setValidationErrors({})
    
    // Verifică dacă este căutare doar cu email (fără comandă sau telefon)
    const isEmailOnlySearch = email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && !numarComanda && !telefon
    
    // Validare strictă: Numele este OBLIGATORIU (doar dacă NU se caută doar cu email)
    // Când se caută doar cu email, numele nu este obligatoriu
    if (!isEmailOnlySearch) {
      const nameValidation = validateName(nume)
      if (!nameValidation.valid) {
        setValidationErrors({ nume: nameValidation.error })
        setError(nameValidation.error || 'Numele este obligatoriu')
        return
      }
    }

    // Validare: Trebuie să existe fie număr comandă, fie telefon, fie email (cel puțin unul)
    if (!numarComanda && !telefon && !email) {
      setError('Introduceți numărul de telefon sau numărul de comandă pentru a găsi comanda.')
      setValidationErrors({
        numarComanda: 'Introduceți numărul de comandă sau telefonul',
        telefon: 'Introduceți numărul de telefon sau comanda',
      })
      return
    }

    // Validare număr comandă dacă este introdus
    if (numarComanda && !isValidOrderNumberFormat(numarComanda)) {
      setValidationErrors({ numarComanda: 'Format invalid' })
      return
    }

    // Validare număr telefon dacă este introdus
    if (telefon && telefon.trim().length > 0) {
      if (!isValidRomanianPhone(telefon)) {
        setError('Format număr de telefon invalid. Introduceți un număr românesc valid (ex: 0712345678 sau +40712345678).')
        setValidationErrors({ telefon: 'Format invalid. Număr românesc valid: 07xx xxx xxx sau +407xx xxx xxx' })
        return
      }
    }

    // Validare email format dacă este introdus (nu este obligatoriu)
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('Format email invalid.')
      setValidationErrors({ email: 'Format email invalid' })
      return
    }
    
    setError(null)
    setLoading(true)
    setSearchStep('searching')

    try {
      // Normalizează numărul de comandă pentru căutare
      const normalizedOrderNumber = numarComanda ? normalizeOrderNumber(numarComanda) : null

      // Verifică dacă este căutare doar cu email (fără comandă sau telefon)
      const isEmailOnlySearch = email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && !numarComanda && !telefon

      // Caută comanda folosind API-ul
      const response = await fetch('/api/search-order', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          orderNumber: normalizedOrderNumber,
          phone: telefon || null,
          fullName: isEmailOnlySearch ? null : (nume || null), // Nu trimite nume dacă e doar email
          email: email || null,
        }),
      })

      const result = await response.json()

      if (result.success && result.orders && result.orders.length > 0) {
        // Comenzi găsite - trimite comenzile la componenta părinte pentru a trece la step 2
        setLoading(false)
        setFoundOrders(result.orders)
        setSearchStep('found')
        
        // Trimite comenzile găsite la componenta părinte pentru a trece la step 2
        if (onOrderSelected) {
          onOrderSelected(result.orders)
        }
      } else {
        // Comanda nu a fost găsită
        setLoading(false)
        
        // Dacă s-a încercat cu număr comandă sau telefon și nu s-a găsit
        // Permite editarea tuturor câmpurilor, nu doar email
        if ((normalizedOrderNumber || telefon) && !email) {
          setShowEmail(true)
          setSearchStep('needsEmail')
          // Mesajul de eroare vine din API și este specific
          if (result.message) {
            setError(result.message)
          } else {
            setError('Comanda nu a fost găsită.')
          }
        } else if (email && result.message) {
          // S-a încercat și cu email și nu s-a găsit - verifică mesajul
          if (result.message.includes('Nu am găsit comenzi cu acest email')) {
            // Email-ul nu există în Shopify
            setError(result.message)
            setSearchStep('needsEmail')
          } else {
            // Altă eroare - afișează pop-up
            setSearchStep('notFound')
            setShowVerificationPopup(true)
          }
        } else {
          // Nu s-a găsit și nu avem email - cere email
          setShowEmail(true)
          setSearchStep('needsEmail')
          setError('Comanda nu a fost găsită. Vă rugăm să introduceți email-ul pentru a continua căutarea.')
        }
      }
    } catch (err) {
      setLoading(false)
      setSearchStep('initial')
      setError('A apărut o eroare la căutarea comenzii. Vă rugăm să încercați din nou.')
      console.error('Error searching order:', err)
    }
  }

  const handleVerificationConfirm = () => {
    setShowVerificationPopup(false)
    // Adaugă mesaj de eroare sus
    setError('Datele introduse până acum nu au fost găsite pe platforma noastră. Vă rugăm să ne contactați pentru a remedia problema.')
    // Redirecționează la contact cu parametru de eroare
    router.push('/contact?error=order_not_found')
  }

  const handleVerificationCancel = () => {
    setShowVerificationPopup(false)
    setSearchStep('initial')
    // Rămâne la aceleași date introduse
  }

  const handleOrderSelect = (order: any) => {
    // Pregătește datele pentru următorul pas
    const orderData: OrderData = {
      nume: order.nume,
      numarComanda: order.numarComanda,
      telefon: order.telefon,
      email: order.email,
      orderId: order.id,
      products: order.products,
    }
    
    onSubmit(orderData)
  }

  // Dacă s-au găsit comenzi, afișează selecția
  // OrderSelection va gestiona trecerea la step 2 prin onOrderSelected
  if (searchStep === 'found' && foundOrders.length > 0) {
    return (
      <>
        <OrderSelection orders={foundOrders} onSelectOrder={handleOrderSelect} />
      </>
    )
  }

  return (
    <>
      <VerificationPopup
        isOpen={showVerificationPopup}
        onConfirm={handleVerificationConfirm}
        onCancel={handleVerificationCancel}
      />

      <form onSubmit={handleSubmit} className="step-form">
        {/* Spațiu rezervat pentru erori */}
        <div style={{ minHeight: '40px', marginBottom: '16px' }}>
          {error && (
            <div style={{
              padding: '12px 16px',
              backgroundColor: '#ffebee',
              border: '1px solid #f44336',
              borderRadius: '8px',
              color: '#c62828',
              fontSize: '14px'
            }}>
              {error}
            </div>
          )}
        </div>

        <div style={{ marginBottom: '24px' }}>
          <label style={{
            display: 'block',
            fontWeight: 'bold',
            marginBottom: '8px',
            fontSize: '14px'
          }}>
            Nume & Prenume {!(email && !numarComanda && !telefon) && <span style={{ color: '#f44336' }}>*</span>}
          </label>
          <input
            type="text"
            value={nume}
            onChange={(e) => {
              setNume(e.target.value)
              if (validationErrors.nume) {
                const newErrors = { ...validationErrors }
                delete newErrors.nume
                setValidationErrors(newErrors)
              }
            }}
            placeholder="Introdu numele complete de pe comandă"
            required={!(email && !numarComanda && !telefon)}
            disabled={loading}
            style={{
              width: '100%',
              padding: '12px 16px',
              borderRadius: '8px',
              border: validationErrors.nume ? '2px solid #f44336' : '1px solid #e0e0e0',
              fontSize: '14px',
              outline: 'none',
              transition: 'border-color 0.3s ease',
              opacity: loading ? 0.6 : 1
            }}
            onFocus={(e) => e.target.style.borderColor = '#26a69a'}
            onBlur={(e) => {
              if (!validationErrors.nume) {
                e.target.style.borderColor = '#e0e0e0'
              }
            }}
          />
          {validationErrors.nume && (
            <p style={{
              fontSize: '12px',
              color: '#f44336',
              marginTop: '4px'
            }}>
              {validationErrors.nume}
            </p>
          )}
        </div>

        {/* Câmpuri pentru comandă SAU telefon */}
        <div style={{
          marginBottom: '24px',
          padding: '16px',
          backgroundColor: '#f5f5f5',
          borderRadius: '8px',
          border: '1px solid #e0e0e0'
        }}>
          <p style={{
            fontSize: '13px',
            fontWeight: 'bold',
            marginBottom: '16px',
            color: '#333',
            textAlign: 'center'
          }}>
            Introduceți <span style={{ color: '#f44336' }}>fie</span> numărul de comandă <span style={{ color: '#f44336' }}>fie</span> numărul de telefon
          </p>
          
          <div style={{ marginBottom: '16px' }}>
            <label style={{
              display: 'block',
              fontWeight: 'bold',
              marginBottom: '8px',
              fontSize: '14px'
            }}>
              Număr comandă {!telefon && <span style={{ color: '#f44336' }}>*</span>}
            </label>
            <input
              type="text"
              value={numarComanda}
              onChange={(e) => {
                setNumarComanda(e.target.value)
                // Dacă introduce comandă, șterge telefonul
                if (e.target.value && telefon) {
                  setTelefon('')
                }
                if (validationErrors.numarComanda) {
                  const newErrors = { ...validationErrors }
                  delete newErrors.numarComanda
                  setValidationErrors(newErrors)
                }
              }}
              placeholder="Ex: #MX12345 sau 12345"
              required={!telefon}
              disabled={loading}
              style={{
                width: '100%',
                padding: '12px 16px',
                borderRadius: '8px',
                border: validationErrors.numarComanda ? '2px solid #f44336' : '1px solid #e0e0e0',
                fontSize: '14px',
                outline: 'none',
                transition: 'border-color 0.3s ease',
                opacity: loading ? 0.5 : 1,
                backgroundColor: telefon ? '#f5f5f5' : '#fff'
              }}
              onFocus={(e) => {
                if (!telefon) {
                  e.target.style.borderColor = '#26a69a'
                }
              }}
              onBlur={(e) => {
                if (!validationErrors.numarComanda && !telefon) {
                  e.target.style.borderColor = '#e0e0e0'
                }
              }}
            />
            {validationErrors.numarComanda && (
              <p style={{
                fontSize: '12px',
                color: '#f44336',
                marginTop: '4px'
              }}>
                {validationErrors.numarComanda}
              </p>
            )}
          </div>

          <div style={{
            textAlign: 'center',
            margin: '12px 0',
            fontSize: '14px',
            fontWeight: 'bold',
            color: '#666'
          }}>
            SAU
          </div>

          <div>
            <label style={{
              display: 'block',
              fontWeight: 'bold',
              marginBottom: '8px',
              fontSize: '14px'
            }}>
              Număr de telefon {!numarComanda && <span style={{ color: '#f44336' }}>*</span>}
            </label>
            <input
              type="tel"
              value={telefon}
              onChange={(e) => {
                setTelefon(e.target.value)
                // Dacă introduce telefon, șterge comanda
                if (e.target.value && numarComanda) {
                  setNumarComanda('')
                }
                if (validationErrors.telefon) {
                  const newErrors = { ...validationErrors }
                  delete newErrors.telefon
                  setValidationErrors(newErrors)
                }
              }}
              placeholder="Introdu numărul de telefon"
              required={!numarComanda}
              disabled={loading}
              style={{
                width: '100%',
                padding: '12px 16px',
                borderRadius: '8px',
                border: validationErrors.telefon ? '2px solid #f44336' : '1px solid #e0e0e0',
                fontSize: '14px',
                outline: 'none',
                transition: 'border-color 0.3s ease',
                opacity: loading ? 0.5 : 1,
                backgroundColor: numarComanda ? '#f5f5f5' : '#fff'
              }}
              onFocus={(e) => {
                if (!numarComanda) {
                  e.target.style.borderColor = '#26a69a'
                }
              }}
              onBlur={(e) => {
                if (!validationErrors.telefon && !numarComanda) {
                  e.target.style.borderColor = '#e0e0e0'
                }
              }}
            />
            {validationErrors.telefon && (
              <p style={{
                fontSize: '12px',
                color: '#f44336',
                marginTop: '4px'
              }}>
                {validationErrors.telefon}
              </p>
            )}
          </div>
        </div>

        {/* Câmp email - apare doar când este necesar, dar nu este obligatoriu */}
        {showEmail && (
          <div style={{ 
            marginBottom: '24px',
            animation: 'fadeIn 0.3s ease-in',
            padding: '16px',
            backgroundColor: '#f5f5f5',
            borderRadius: '8px',
            border: '1px solid #e0e0e0'
          }}>
            <p style={{
              fontSize: '13px',
              color: '#666',
              marginBottom: '12px',
              fontStyle: 'italic'
            }}>
              Introdu un email pentru a extinde căutările
            </p>
            <label style={{
              display: 'block',
              fontWeight: 'bold',
              marginBottom: '8px',
              fontSize: '14px',
              color: '#26a69a'
            }}>
              Email (opțional)
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value)
                if (validationErrors.email) {
                  const newErrors = { ...validationErrors }
                  delete newErrors.email
                  setValidationErrors(newErrors)
                }
              }}
              placeholder="Introdu email-ul folosit la comandă (opțional)"
              disabled={loading}
              style={{
                width: '100%',
                padding: '12px 16px',
                borderRadius: '8px',
                border: validationErrors.email ? '2px solid #f44336' : '1px solid #e0e0e0',
                fontSize: '14px',
                outline: 'none',
                transition: 'border-color 0.3s ease',
                opacity: loading ? 0.6 : 1
              }}
              onFocus={(e) => e.target.style.borderColor = '#26a69a'}
              onBlur={(e) => {
                if (!validationErrors.email) {
                  e.target.style.borderColor = '#e0e0e0'
                }
              }}
            />
            {validationErrors.email && (
              <p style={{
                fontSize: '12px',
                color: '#f44336',
                marginTop: '4px'
              }}>
                {validationErrors.email}
              </p>
            )}
          </div>
        )}

        {/* Mesaj informativ */}
        <div style={{ minHeight: '60px', marginBottom: '24px' }}>
          <p style={{
            fontSize: '14px',
            color: '#666',
            textAlign: 'center'
          }}>
            {searchStep === 'searching' 
              ? 'Căutăm comanda...' 
              : searchStep === 'needsEmail'
              ? 'Vă rugăm să introduceți email-ul pentru a continua căutarea.'
              : 'Vom încerca să găsim comanda pe baza informațiilor furnizate.'}
          </p>
        </div>

        {/* Indicator de loading */}
        <div style={{ minHeight: '60px', marginBottom: '24px', textAlign: 'center' }}>
          {loading && (
            <div style={{
              display: 'inline-block',
              width: '40px',
              height: '40px',
              border: '4px solid #f3f3f3',
              borderTop: '4px solid #26a69a',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite'
            }} />
          )}
        </div>

        <button
          type="submit"
          disabled={loading}
          style={{
            width: '100%',
            padding: '16px',
            borderRadius: '8px',
            background: loading 
              ? '#ccc' 
              : 'linear-gradient(90deg, #2196F3 0%, #4CAF50 100%)',
            color: '#fff',
            border: 'none',
            fontSize: '16px',
            fontWeight: 'bold',
            textTransform: 'uppercase',
            cursor: loading ? 'not-allowed' : 'pointer',
            transition: 'transform 0.2s ease, box-shadow 0.2s ease',
            opacity: loading ? 0.6 : 1
          }}
          onMouseOver={(e) => {
            if (!loading) {
              e.currentTarget.style.transform = 'translateY(-2px)'
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)'
            }
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.transform = 'translateY(0)'
            e.currentTarget.style.boxShadow = 'none'
          }}
        >
          {loading ? 'CĂUTĂM...' : 'CAUTĂ COMANDA'}
        </button>

        <style jsx>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
          @keyframes fadeIn {
            from { opacity: 0; transform: translateY(-10px); }
            to { opacity: 1; transform: translateY(0); }
          }
        `}</style>
      </form>
    </>
  )
}
