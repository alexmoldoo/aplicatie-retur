'use client'

import { useState, FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { OrderData } from './ReturnProcess'
import VerificationPopup from './VerificationPopup'
import OrderSelection from './OrderSelection'
import { validateName, isValidOrderNumberFormat, normalizeOrderNumber } from '@/lib/order-validator'
import { isValidRomanianPhone, formatPhoneAsTyped } from '@/lib/phone-validator'

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
  // Honeypot — câmp ascuns ce nu trebuie completat decât de boți
  const [hp, setHp] = useState('')
  // Marca timpului când userul a încărcat formularul (pentru detectare bot prea-rapid)
  const [formStartedAt] = useState<number>(() => Date.now())

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
      setValidationErrors({ numarComanda: 'Folosește doar cifre sau formatul #MX12345.' })
      setError('Numărul de comandă pare invalid. Verifică emailul de confirmare a comenzii pentru numărul exact.')
      return
    }

    // Validare număr telefon dacă este introdus
    if (telefon && telefon.trim().length > 0) {
      if (!isValidRomanianPhone(telefon)) {
        setError('Numărul de telefon nu pare valid. Folosește formatul 0712 345 678 sau +40 712 345 678.')
        setValidationErrors({ telefon: 'Format invalid. Ex: 0712 345 678' })
        return
      }
    }

    // Validare email format dacă este introdus (nu este obligatoriu)
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('Adresa de email nu pare validă. Verifică să fie scrisă corect (ex: nume@exemplu.ro).')
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
          _hp: hp,
          _formStartedAt: formStartedAt,
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
        // Comanda nu a fost găsită — mesaj generic pentru toate cazurile
        setLoading(false)
        const genericMessage = result.message || 'Comanda nu a fost găsită. Verifică datele introduse și încearcă din nou.'

        if (email) {
          // Userul a încercat deja cu email și tot nu am găsit → afișăm pop-up de verificare
          setSearchStep('notFound')
          setShowVerificationPopup(true)
        } else {
          // Nu există email încă — îl oferim ca alternativă, fără să spunem ce câmp e greșit
          setShowEmail(true)
          setSearchStep('needsEmail')
          setError(genericMessage)
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

  const handleResetAll = () => {
    setNume('')
    setNumarComanda('')
    setTelefon('')
    setEmail('')
    setShowEmail(false)
    setError(null)
    setValidationErrors({})
    setSearchStep('initial')
    setFoundOrders([])
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

      <form onSubmit={handleSubmit} className="step-form os-form">
        {/* Honeypot — invizibil pentru oameni, vizibil pentru boți care completează tot */}
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            left: '-10000px',
            top: 'auto',
            width: '1px',
            height: '1px',
            overflow: 'hidden',
          }}
        >
          <label htmlFor="website_url">Website (lasă gol)</label>
          <input
            type="text"
            id="website_url"
            name="website_url"
            tabIndex={-1}
            autoComplete="off"
            value={hp}
            onChange={(e) => setHp(e.target.value)}
          />
        </div>

        {/* Header */}
        <div className="os-header">
          <div className="os-header-icon" aria-hidden="true">📦</div>
          <h2 className="os-title">Hai să găsim comanda ta</h2>
          <p className="os-subtitle">Completează datele de mai jos. E rapid și 100% sigur.</p>
        </div>

        {/* Eroare — animată */}
        <div className={`os-error-slot ${error ? 'os-error-show' : ''}`}>
          {error && (
            <div className="os-error">
              <span aria-hidden="true" className="os-error-icon">⚠️</span>
              <span>{error}</span>
            </div>
          )}
        </div>

        {/* Nume & Prenume */}
        <div className="os-field">
          <label className="os-label" htmlFor="os-nume">
            <span className="os-label-icon" aria-hidden="true">👤</span>
            Nume & Prenume
            {!(email && !numarComanda && !telefon) && <span className="os-required">*</span>}
          </label>
          <div className={`os-input-wrap ${validationErrors.nume ? 'os-error-state' : ''} ${nume && !validationErrors.nume ? 'os-valid-state' : ''}`}>
            <input
              id="os-nume"
              type="text"
              className="os-input"
              value={nume}
              onChange={(e) => {
                setNume(e.target.value)
                if (validationErrors.nume) {
                  const newErrors = { ...validationErrors }
                  delete newErrors.nume
                  setValidationErrors(newErrors)
                }
              }}
              placeholder="Ex: Ion Popescu"
              required={!(email && !numarComanda && !telefon)}
              disabled={loading}
              autoComplete="name"
              autoCapitalize="words"
              inputMode="text"
            />
            {nume && !validationErrors.nume && <span className="os-check" aria-hidden="true">✓</span>}
          </div>
          {validationErrors.nume ? (
            <p className="os-hint os-hint-error">{validationErrors.nume}</p>
          ) : (
            <p className="os-hint">Așa cum apare pe comandă</p>
          )}
        </div>

        {/* Comandă SAU telefon */}
        <div className="os-card">
          <p className="os-card-title">
            Introdu <strong>fie</strong> numărul de comandă <strong>fie</strong> numărul de telefon
          </p>

          <div className="os-field">
            <label className="os-label" htmlFor="os-comanda">
              <span className="os-label-icon" aria-hidden="true">🧾</span>
              Număr comandă
              {!telefon && <span className="os-required">*</span>}
            </label>
            <div className={`os-input-wrap ${validationErrors.numarComanda ? 'os-error-state' : ''} ${numarComanda && !validationErrors.numarComanda ? 'os-valid-state' : ''} ${telefon ? 'os-disabled-soft' : ''}`}>
              <input
                id="os-comanda"
                type="text"
                className="os-input"
                value={numarComanda}
                onChange={(e) => {
                  setNumarComanda(e.target.value)
                  if (e.target.value && telefon) setTelefon('')
                  if (validationErrors.numarComanda) {
                    const newErrors = { ...validationErrors }
                    delete newErrors.numarComanda
                    setValidationErrors(newErrors)
                  }
                }}
                placeholder="Ex: #MX12345 sau 12345"
                required={!telefon}
                disabled={loading}
                autoComplete="off"
                inputMode="text"
                onBlur={() => {
                  const trimmed = numarComanda.trim()
                  if (trimmed && /^\d+$/.test(trimmed)) {
                    setNumarComanda(`#MX${trimmed}`)
                  }
                }}
              />
              {numarComanda && !validationErrors.numarComanda && <span className="os-check" aria-hidden="true">✓</span>}
            </div>
            {validationErrors.numarComanda ? (
              <p className="os-hint os-hint-error">{validationErrors.numarComanda}</p>
            ) : (
              <p className="os-hint">Îl găsești în emailul de confirmare (ex: #MX12345)</p>
            )}
          </div>

          <div className="os-divider">
            <span>SAU</span>
          </div>

          <div className="os-field">
            <label className="os-label" htmlFor="os-telefon">
              <span className="os-label-icon" aria-hidden="true">📞</span>
              Număr de telefon
              {!numarComanda && <span className="os-required">*</span>}
            </label>
            <div className={`os-input-wrap ${validationErrors.telefon ? 'os-error-state' : ''} ${telefon && !validationErrors.telefon ? 'os-valid-state' : ''} ${numarComanda ? 'os-disabled-soft' : ''}`}>
              <input
                id="os-telefon"
                type="tel"
                className="os-input"
                value={telefon}
                onChange={(e) => {
                  const formatted = formatPhoneAsTyped(e.target.value)
                  setTelefon(formatted)
                  if (formatted && numarComanda) setNumarComanda('')
                  if (validationErrors.telefon) {
                    const newErrors = { ...validationErrors }
                    delete newErrors.telefon
                    setValidationErrors(newErrors)
                  }
                }}
                placeholder="0712 345 678"
                required={!numarComanda}
                disabled={loading}
                autoComplete="tel"
                inputMode="tel"
              />
              {telefon && !validationErrors.telefon && <span className="os-check" aria-hidden="true">✓</span>}
            </div>
            {validationErrors.telefon ? (
              <p className="os-hint os-hint-error">{validationErrors.telefon}</p>
            ) : (
              <p className="os-hint">Numărul folosit la plasarea comenzii</p>
            )}
          </div>
        </div>

        {/* Email opțional */}
        {showEmail && (
          <div className="os-card os-card-accent os-fadein">
            <p className="os-card-hint">
              <span aria-hidden="true">✉️</span> Adaugă un email pentru a extinde căutările
            </p>
            <div className="os-field">
              <label className="os-label" htmlFor="os-email">
                <span className="os-label-icon" aria-hidden="true">✉️</span>
                Email (opțional)
              </label>
              <div className={`os-input-wrap ${validationErrors.email ? 'os-error-state' : ''} ${email && !validationErrors.email ? 'os-valid-state' : ''}`}>
                <input
                  id="os-email"
                  type="email"
                  className="os-input"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value)
                    if (validationErrors.email) {
                      const newErrors = { ...validationErrors }
                      delete newErrors.email
                      setValidationErrors(newErrors)
                    }
                  }}
                  placeholder="nume@exemplu.ro"
                  disabled={loading}
                  autoComplete="email"
                  inputMode="email"
                />
                {email && !validationErrors.email && <span className="os-check" aria-hidden="true">✓</span>}
              </div>
              {validationErrors.email && <p className="os-hint os-hint-error">{validationErrors.email}</p>}
            </div>
          </div>
        )}

        {/* Stare căutare */}
        <p className="os-status">
          {searchStep === 'searching'
            ? 'Căutăm comanda...'
            : searchStep === 'needsEmail'
            ? 'Adaugă email-ul pentru a continua căutarea.'
            : 'Vom încerca să găsim comanda pe baza informațiilor furnizate.'}
        </p>

        {/* Loading spinner */}
        {loading && (
          <div className="os-loading">
            <div className="os-spinner" />
          </div>
        )}

        {/* CTA */}
        <button type="submit" disabled={loading} className="os-cta">
          {loading ? (
            <>CĂUTĂM<span className="os-dots"><span>.</span><span>.</span><span>.</span></span></>
          ) : (
            <>
              <span className="os-cta-icon" aria-hidden="true">🔍</span>
              CAUTĂ COMANDA
              <span className="os-cta-arrow" aria-hidden="true">→</span>
            </>
          )}
        </button>

        {(nume || numarComanda || telefon || email) && !loading && (
          <button type="button" onClick={handleResetAll} className="os-reset">
            ✕ Șterge tot și reîncepe
          </button>
        )}

        {/* U7 — link spre contact */}
        <div className="os-help-wrap">
          <button
            type="button"
            onClick={() => router.push('/contact?reason=cant_find_order')}
            className="os-help-link"
          >
            Nu-mi găsesc comanda — am nevoie de ajutor
          </button>
        </div>

        <style jsx>{`
          .os-form {
            max-width: 480px;
            margin: 0 auto;
          }

          /* Header */
          .os-header {
            text-align: center;
            margin-bottom: 24px;
          }
          .os-header-icon {
            font-size: 40px;
            margin-bottom: 8px;
          }
          .os-title {
            font-size: 22px;
            font-weight: 700;
            color: #1a1a1a;
            margin: 0 0 6px 0;
            letter-spacing: -0.02em;
          }
          .os-subtitle {
            font-size: 14px;
            color: #6b7280;
            margin: 0;
          }
          @media (min-width: 481px) {
            .os-title { font-size: 26px; }
            .os-subtitle { font-size: 15px; }
          }

          /* Error */
          .os-error-slot {
            min-height: 0;
            margin-bottom: 0;
            transition: min-height 0.25s ease, margin-bottom 0.25s ease;
          }
          .os-error-show {
            min-height: 56px;
            margin-bottom: 8px;
          }
          .os-error {
            display: flex;
            gap: 10px;
            align-items: flex-start;
            padding: 12px 14px;
            background: linear-gradient(135deg, #fff5f5 0%, #ffebee 100%);
            border: 1px solid #fecaca;
            border-radius: 10px;
            color: #b91c1c;
            font-size: 14px;
            line-height: 1.5;
            animation: os-fadein 0.3s ease;
          }
          .os-error-icon { flex-shrink: 0; }

          /* Field */
          .os-field { margin-bottom: 18px; }
          .os-label {
            display: flex;
            align-items: center;
            gap: 6px;
            font-weight: 600;
            font-size: 13px;
            color: #374151;
            margin-bottom: 8px;
            letter-spacing: 0.01em;
          }
          .os-label-icon { font-size: 15px; }
          .os-required {
            color: #ef4444;
            margin-left: 2px;
          }

          /* Input wrap */
          .os-input-wrap {
            position: relative;
            display: flex;
            align-items: center;
            border: 1.5px solid #e5e7eb;
            border-radius: 10px;
            background: #fff;
            transition: border-color 0.2s ease, box-shadow 0.2s ease, background-color 0.2s ease;
          }
          .os-input-wrap:focus-within {
            border-color: #26a69a;
            box-shadow: 0 0 0 4px rgba(38, 166, 154, 0.12);
          }
          .os-input-wrap.os-error-state {
            border-color: #ef4444;
            box-shadow: 0 0 0 4px rgba(239, 68, 68, 0.10);
          }
          .os-input-wrap.os-valid-state {
            border-color: #26a69a;
          }
          .os-input-wrap.os-disabled-soft {
            background-color: #f9fafb;
            opacity: 0.7;
          }
          .os-input {
            flex: 1;
            width: 100%;
            padding: 13px 14px;
            border: none;
            background: transparent;
            font-size: 16px; /* 16px previne zoom pe iOS */
            color: #111827;
            outline: none;
            border-radius: 10px;
          }
          .os-input::placeholder { color: #9ca3af; }
          .os-input:disabled { cursor: not-allowed; }
          .os-check {
            color: #26a69a;
            font-weight: 700;
            font-size: 18px;
            padding-right: 14px;
            animation: os-pop 0.25s ease;
          }

          /* Hints */
          .os-hint {
            font-size: 12px;
            color: #9ca3af;
            margin: 6px 0 0 0;
            line-height: 1.4;
          }
          .os-hint-error { color: #ef4444; }

          /* Card group (comandă/telefon, email) */
          .os-card {
            padding: 18px 16px;
            background: #fafafa;
            border: 1px solid #f0f0f0;
            border-radius: 12px;
            margin-bottom: 20px;
          }
          .os-card-accent {
            background: linear-gradient(135deg, #f0fdfa 0%, #ecfeff 100%);
            border-color: #ccfbf1;
          }
          .os-card-title {
            font-size: 13px;
            color: #4b5563;
            margin: 0 0 14px 0;
            text-align: center;
          }
          .os-card-title strong { color: #ef4444; }
          .os-card-hint {
            font-size: 13px;
            color: #0f766e;
            margin: 0 0 12px 0;
            font-style: italic;
            display: flex;
            align-items: center;
            gap: 6px;
          }

          /* Divider SAU */
          .os-divider {
            display: flex;
            align-items: center;
            gap: 12px;
            margin: 14px 0;
          }
          .os-divider::before,
          .os-divider::after {
            content: '';
            flex: 1;
            height: 1px;
            background: #e5e7eb;
          }
          .os-divider span {
            font-size: 12px;
            font-weight: 700;
            color: #9ca3af;
            letter-spacing: 0.1em;
          }

          /* Status */
          .os-status {
            font-size: 13px;
            color: #6b7280;
            text-align: center;
            margin: 0 0 16px 0;
            min-height: 20px;
          }

          /* Loading */
          .os-loading {
            text-align: center;
            margin-bottom: 16px;
          }
          .os-spinner {
            display: inline-block;
            width: 36px;
            height: 36px;
            border: 3px solid #e5e7eb;
            border-top-color: #26a69a;
            border-radius: 50%;
            animation: os-spin 0.8s linear infinite;
          }

          /* CTA */
          .os-cta {
            width: 100%;
            padding: 16px 20px;
            border: none;
            border-radius: 12px;
            background: linear-gradient(90deg, #2196f3 0%, #4caf50 100%);
            color: #fff;
            font-size: 15px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 10px;
            box-shadow: 0 4px 14px rgba(33, 150, 243, 0.25);
            transition: transform 0.15s ease, box-shadow 0.15s ease, opacity 0.2s ease;
          }
          .os-cta:hover:not(:disabled) {
            transform: translateY(-2px);
            box-shadow: 0 8px 22px rgba(33, 150, 243, 0.32);
          }
          .os-cta:active:not(:disabled) {
            transform: translateY(0);
            box-shadow: 0 2px 8px rgba(33, 150, 243, 0.25);
          }
          .os-cta:disabled {
            background: #d1d5db;
            cursor: not-allowed;
            box-shadow: none;
            opacity: 0.8;
          }
          .os-cta-icon { font-size: 16px; }
          .os-cta-arrow {
            font-size: 18px;
            transition: transform 0.2s ease;
          }
          .os-cta:hover:not(:disabled) .os-cta-arrow { transform: translateX(4px); }
          .os-dots span {
            display: inline-block;
            animation: os-blink 1.4s infinite both;
          }
          .os-dots span:nth-child(2) { animation-delay: 0.2s; }
          .os-dots span:nth-child(3) { animation-delay: 0.4s; }

          /* Reset */
          .os-reset {
            width: 100%;
            margin-top: 10px;
            padding: 11px;
            border-radius: 10px;
            background: transparent;
            color: #6b7280;
            border: 1px solid #e5e7eb;
            font-size: 13px;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.2s ease;
          }
          .os-reset:hover {
            background: #f9fafb;
            border-color: #d1d5db;
            color: #374151;
          }

          /* Help link */
          .os-help-wrap {
            margin-top: 18px;
            text-align: center;
          }
          .os-help-link {
            background: none;
            border: none;
            color: #26a69a;
            font-size: 13px;
            text-decoration: underline;
            text-underline-offset: 3px;
            cursor: pointer;
            padding: 8px;
            transition: color 0.2s ease;
          }
          .os-help-link:hover { color: #00897b; }

          /* Animations */
          .os-fadein { animation: os-fadein 0.35s ease; }
          @keyframes os-spin {
            to { transform: rotate(360deg); }
          }
          @keyframes os-fadein {
            from { opacity: 0; transform: translateY(-6px); }
            to { opacity: 1; transform: translateY(0); }
          }
          @keyframes os-pop {
            from { opacity: 0; transform: scale(0.5); }
            to { opacity: 1; transform: scale(1); }
          }
          @keyframes os-blink {
            0%, 80%, 100% { opacity: 0.3; }
            40% { opacity: 1; }
          }
        `}</style>
      </form>
    </>
  )
}
