'use client'

import { useState, FormEvent, ChangeEvent, useEffect } from 'react'
import { RefundData, OrderData, Product } from './ReturnProcess'
import { validateRomanianIBAN } from '@/lib/iban-validator'

interface RefundDetailsStepProps {
  onSubmit: (data: RefundData) => void
  onBack: () => void
  orderData: OrderData | null
  products: Product[]
  initialRefundData?: RefundData | null
}

export default function RefundDetailsStep({
  onSubmit,
  onBack,
  orderData,
  products,
  initialRefundData
}: RefundDetailsStepProps) {
  const wasPaidWithCard = orderData?.wasPaidWithCard || false

  // Metoda este determinată automat de cum a fost plătită comanda — userul nu alege.
  // Card → refund pe cardul original; ramburs/transfer → cont bancar (necesită IBAN).
  const metodaRambursare: 'card' | 'cont' = wasPaidWithCard ? 'card' : 'cont'

  const [iban, setIban] = useState(initialRefundData?.iban || '')
  const [numeTitular, setNumeTitular] = useState(initialRefundData?.numeTitular || '')
  const [ibanError, setIbanError] = useState<string | null>(null)
  const [numeTitularError, setNumeTitularError] = useState<string | null>(null)
  // null = niciuna selectată (start curat); true = al meu; false = altă persoană
  const [contulEsteAlMeu, setContulEsteAlMeu] = useState<boolean | null>(
    initialRefundData?.contulEsteAlMeu ?? null
  )
  const [acordPrevederiLegale, setAcordPrevederiLegale] = useState(initialRefundData?.acordPrevederiLegale || false)
  const [acordError, setAcordError] = useState<string | null>(null)
  const [proprietarError, setProprietarError] = useState<string | null>(null)

  useEffect(() => {
    if (initialRefundData) {
      setIban(initialRefundData.iban || '')
      setNumeTitular(initialRefundData.numeTitular || '')
      setContulEsteAlMeu(initialRefundData.contulEsteAlMeu ?? null)
      setAcordPrevederiLegale(initialRefundData.acordPrevederiLegale || false)
    }
  }, [initialRefundData])

  // Doar produsele selectate apar în rezumatul de rambursare
  const selectedProducts = products.filter(p => p.selected && (p.cantitateReturnata || 0) > 0)

  const totalRefund = selectedProducts.reduce((sum, p) => {
    const cantitateReturnata = p.cantitateReturnata || (p.selected ? p.cantitate : 0)
    return sum + (p.pret * cantitateReturnata)
  }, 0)

  // Validare live pentru a putea afișa ✓ valid pe IBAN
  const cleanIban = iban.replace(/\s/g, '').toUpperCase()
  const ibanValidation = validateRomanianIBAN(cleanIban)
  const isIbanValid = cleanIban.length > 0 && ibanValidation.valid

  const handleIbanChange = (e: ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.toUpperCase()
    const limitedValue = value.slice(0, 29)
    setIban(limitedValue)
    setIbanError(null)
  }

  const validateNumeTitular = (nume: string): { valid: boolean } => {
    const trimmed = nume.trim()
    if (trimmed.length === 0) return { valid: false }
    const parts = trimmed.split(/\s+/).filter(p => p.length > 0)
    if (parts.length < 2) return { valid: false }
    const numeFamilie = parts[0]
    const prenume = parts.slice(1).join(' ')
    if (numeFamilie.length < 3 || prenume.length < 3) return { valid: false }
    return { valid: true }
  }
  const isNumeTitularValid = validateNumeTitular(numeTitular).valid

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    setIbanError(null)
    setNumeTitularError(null)
    setAcordError(null)
    setProprietarError(null)

    if (metodaRambursare === 'cont') {
      if (!ibanValidation.valid) {
        setIbanError(ibanValidation.error || 'IBAN invalid')
        return
      }

      if (contulEsteAlMeu === null) {
        setProprietarError('Te rugăm să specifici dacă contul e al tău sau al altcuiva.')
        return
      }

      if (!isNumeTitularValid) {
        setNumeTitularError('Introdu nume și prenume (minim 3 caractere fiecare)')
        return
      }

      if (contulEsteAlMeu === false && !acordPrevederiLegale) {
        setAcordError('Pentru transfer către altă persoană, trebuie să fii de acord cu prevederile legale.')
        return
      }
    }

    const refundData: RefundData = {
      metodaRambursare,
      documente: [],
      ...(metodaRambursare === 'cont' && {
        iban: cleanIban,
        numeTitular,
        contulEsteAlMeu: contulEsteAlMeu === true,
        acordPrevederiLegale: contulEsteAlMeu === false ? acordPrevederiLegale : undefined,
      }),
      ...(metodaRambursare === 'card' && wasPaidWithCard && {
        detaliiCard: 'refund_to_original_card',
      }),
    }

    onSubmit(refundData)
  }

  const formError = ibanError || numeTitularError || proprietarError || acordError

  return (
    <form onSubmit={handleSubmit} className="rd-form step-form-large">
      <div className="rd-header">
        <div className="rd-header-icon" aria-hidden="true">{wasPaidWithCard ? '💳' : '🏦'}</div>
        <h2 className="rd-title">Date pentru rambursare</h2>
        <p className="rd-subtitle">
          {wasPaidWithCard
            ? 'Banii merg automat pe cardul cu care ai plătit comanda.'
            : 'Completează contul bancar în care vrei să primești banii.'}
        </p>
      </div>

      <div className={`rd-error-slot ${formError ? 'rd-error-show' : ''}`}>
        {formError && (
          <div className="rd-error" role="alert">
            <span aria-hidden="true" className="rd-error-icon">⚠️</span>
            <span>{formError}</span>
          </div>
        )}
      </div>

      {/* Rezumat produse */}
      <div className="rd-card">
        <h4 className="rd-card-title">Produse selectate pentru retur</h4>

        <ul className="rd-products">
          {selectedProducts.map((product) => {
            const cantitate = product.cantitateReturnata || (product.selected ? product.cantitate : 0)
            const lineTotal = product.pret * cantitate
            return (
              <li key={product.id} className="rd-product">
                <div className="rd-product-main">
                  <div className="rd-product-name">{product.nume}</div>
                  {product.motivRetur && product.motivRetur.trim().length > 0 && (
                    <div className="rd-product-motiv">Motiv: {product.motivRetur}</div>
                  )}
                  <div className="rd-product-meta">
                    {cantitate} buc × {product.pret.toFixed(2)} RON
                  </div>
                </div>
                <div className="rd-product-total">{lineTotal.toFixed(2)} RON</div>
              </li>
            )
          })}
        </ul>

        <div className="rd-total">
          <span className="rd-total-label">Subtotal produse</span>
          <span className="rd-total-value">{totalRefund.toFixed(2)} RON</span>
        </div>
        <p className="rd-total-hint">
          Suma finală depinde de metoda de expediere aleasă în pasul următor.
        </p>
      </div>

      {/* Metoda de rambursare — informativă, fără alegere */}
      <div className="rd-section">
        <div className="rd-method rd-method-active rd-method-static">
          <div className="rd-method-body">
            <div className="rd-method-head">
              <span className="rd-method-icon" aria-hidden="true">{wasPaidWithCard ? '💳' : '🏦'}</span>
              <span className="rd-method-title">
                {wasPaidWithCard ? 'Refund pe cardul original' : 'Transfer în cont bancar'}
              </span>
            </div>
            <p className="rd-method-text">
              {wasPaidWithCard
                ? 'Comanda a fost plătită cu cardul, așa că rambursarea se face automat pe același card. Nu mai e nevoie de alte date din partea ta.'
                : 'Comanda a fost plătită ramburs/transfer, așa că rambursarea se face prin transfer bancar — completează IBAN-ul mai jos.'}
            </p>
          </div>
        </div>
      </div>

      {/* Detalii cont bancar */}
      {metodaRambursare === 'cont' && (
        <div className="rd-fadein">
          <div className="rd-field">
            <label className="rd-label" htmlFor="rd-iban">
              <span className="rd-label-icon" aria-hidden="true">🏦</span>
              IBAN
              <span className="rd-required">*</span>
            </label>
            <div className={`rd-input-wrap ${ibanError ? 'rd-error-state' : isIbanValid ? 'rd-valid-state' : ''}`}>
              <input
                id="rd-iban"
                type="text"
                value={iban}
                onChange={handleIbanChange}
                placeholder="ROxxxxxxxxxxxxxxxxxxxxxx"
                inputMode="text"
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
                maxLength={34}
                className="rd-input rd-input-mono"
              />
              {isIbanValid && !ibanError && (
                <span className="rd-check" aria-hidden="true">✓</span>
              )}
            </div>
            {ibanError ? (
              <p className="rd-hint rd-hint-error">{ibanError}</p>
            ) : (
              <p className="rd-hint">24 de caractere, începe cu RO</p>
            )}
          </div>

          <div className="rd-field">
            <label className="rd-label" htmlFor="rd-titular">
              <span className="rd-label-icon" aria-hidden="true">👤</span>
              Titularul contului
              <span className="rd-required">*</span>
            </label>
            <div className={`rd-input-wrap ${numeTitularError ? 'rd-error-state' : isNumeTitularValid ? 'rd-valid-state' : ''}`}>
              <input
                id="rd-titular"
                type="text"
                value={numeTitular}
                onChange={(e) => {
                  setNumeTitular(e.target.value)
                  if (numeTitularError) setNumeTitularError(null)
                }}
                placeholder="Nume Prenume"
                inputMode="text"
                autoComplete="name"
                className="rd-input"
              />
              {isNumeTitularValid && !numeTitularError && (
                <span className="rd-check" aria-hidden="true">✓</span>
              )}
            </div>
            {numeTitularError ? (
              <p className="rd-hint rd-hint-error">{numeTitularError}</p>
            ) : (
              <p className="rd-hint">Numele complet așa cum apare la bancă</p>
            )}
          </div>

          {/* Cui aparține contul — radio real, nu două checkbox-uri */}
          <div className="rd-section">
            <p className="rd-section-label">Cui aparține contul?</p>

            <label className={`rd-owner ${contulEsteAlMeu === true ? 'rd-owner-active' : ''}`}>
              <input
                type="radio"
                name="proprietarCont"
                checked={contulEsteAlMeu === true}
                onChange={() => {
                  setContulEsteAlMeu(true)
                  setAcordPrevederiLegale(false)
                  setAcordError(null)
                  setProprietarError(null)
                  setNumeTitularError(null)
                  if (orderData?.nume) setNumeTitular(orderData.nume)
                }}
                className="rd-owner-radio"
              />
              <div className="rd-owner-body">
                <span className="rd-owner-title">Contul este al meu</span>
                {orderData?.nume && (
                  <span className="rd-owner-sub">{orderData.nume}</span>
                )}
              </div>
            </label>

            <label className={`rd-owner ${contulEsteAlMeu === false ? 'rd-owner-active' : ''}`}>
              <input
                type="radio"
                name="proprietarCont"
                checked={contulEsteAlMeu === false}
                onChange={() => {
                  setContulEsteAlMeu(false)
                  setNumeTitular('')
                  setProprietarError(null)
                  setNumeTitularError(null)
                }}
                className="rd-owner-radio"
              />
              <div className="rd-owner-body">
                <span className="rd-owner-title">Transfer către altă persoană</span>
                <span className="rd-owner-sub">Cont pe alt nume — necesită acord legal</span>
              </div>
            </label>
          </div>

          {contulEsteAlMeu === false && (
            <div className="rd-legal rd-fadein">
              <label className="rd-legal-label">
                <input
                  type="checkbox"
                  checked={acordPrevederiLegale}
                  onChange={(e) => {
                    setAcordPrevederiLegale(e.target.checked)
                    if (e.target.checked) setAcordError(null)
                  }}
                  className="rd-legal-checkbox"
                />
                <div className="rd-legal-body">
                  <span className="rd-legal-title">Sunt de acord cu prevederile legale *</span>
                  <span className="rd-legal-text">
                    Confirm că transferul către o altă persoană este efectuat în conformitate cu legislația în vigoare.
                  </span>
                </div>
              </label>
            </div>
          )}
        </div>
      )}

      {/* Butoane navigare */}
      <div className="rd-actions">
        <button type="button" onClick={onBack} className="rd-back">
          ÎNAPOI
        </button>
        <button type="submit" className="rd-cta">
          CONTINUĂ
          <span className="rd-cta-arrow" aria-hidden="true">→</span>
        </button>
      </div>

      <style jsx>{`
        .rd-form {
          max-width: 560px;
          margin: 0 auto;
        }

        .rd-header {
          text-align: center;
          margin-bottom: 24px;
        }
        .rd-header-icon {
          font-size: 40px;
          margin-bottom: 8px;
        }
        .rd-title {
          font-size: 22px;
          font-weight: 700;
          color: #1a1a1a;
          margin: 0 0 6px 0;
          letter-spacing: -0.02em;
        }
        .rd-subtitle {
          font-size: 14px;
          color: #6b7280;
          margin: 0;
        }
        @media (min-width: 481px) {
          .rd-title { font-size: 26px; }
          .rd-subtitle { font-size: 15px; }
        }

        .rd-error-slot {
          min-height: 0;
          margin-bottom: 0;
          transition: min-height 0.25s ease, margin-bottom 0.25s ease;
        }
        .rd-error-show {
          min-height: 56px;
          margin-bottom: 8px;
        }
        .rd-error {
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
          animation: rd-fadein 0.3s ease;
        }
        .rd-error-icon { flex-shrink: 0; }

        /* Card produse */
        .rd-card {
          padding: 18px 18px 16px 18px;
          background: #fafafa;
          border: 1px solid #f0f0f0;
          border-radius: 12px;
          margin-bottom: 22px;
        }
        .rd-card-title {
          font-size: 14px;
          font-weight: 700;
          color: #374151;
          margin: 0 0 12px 0;
          letter-spacing: 0.01em;
        }
        .rd-products {
          list-style: none;
          margin: 0;
          padding: 0;
        }
        .rd-product {
          display: flex;
          gap: 12px;
          align-items: flex-start;
          padding: 12px 0;
          border-bottom: 1px solid #eef2f4;
        }
        .rd-product:last-child {
          border-bottom: none;
        }
        .rd-product-main { flex: 1; min-width: 0; }
        .rd-product-name {
          font-size: 14px;
          font-weight: 600;
          color: #111827;
          line-height: 1.35;
        }
        .rd-product-motiv {
          font-size: 12px;
          color: #6b7280;
          margin-top: 3px;
        }
        .rd-product-meta {
          font-size: 12px;
          color: #9ca3af;
          margin-top: 4px;
        }
        .rd-product-total {
          font-size: 14px;
          font-weight: 700;
          color: #111827;
          white-space: nowrap;
        }
        .rd-total {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-top: 14px;
          padding-top: 14px;
          border-top: 2px solid #e5e7eb;
        }
        .rd-total-label {
          font-size: 14px;
          font-weight: 700;
          color: #374151;
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }
        .rd-total-value {
          font-size: 22px;
          font-weight: 800;
          color: #26a69a;
        }
        .rd-total-hint {
          font-size: 12px;
          color: #9ca3af;
          margin: 8px 0 0 0;
          line-height: 1.4;
          font-style: italic;
        }

        /* Section */
        .rd-section { margin-bottom: 22px; }
        .rd-section-label {
          font-size: 13px;
          font-weight: 700;
          color: #374151;
          margin: 0 0 10px 0;
          letter-spacing: 0.01em;
        }

        /* Metoda */
        .rd-method-list {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .rd-method {
          display: flex;
          gap: 12px;
          align-items: flex-start;
          padding: 14px 16px;
          border-radius: 12px;
          border: 1.5px solid #e5e7eb;
          background: #fff;
          cursor: pointer;
          transition: border-color 0.2s ease, background-color 0.2s ease, box-shadow 0.2s ease;
        }
        .rd-method:hover {
          border-color: #cbd5e1;
        }
        .rd-method-active {
          border-color: #26a69a;
          background: linear-gradient(135deg, #f0fdfa 0%, #ecfeff 100%);
          box-shadow: 0 0 0 4px rgba(38, 166, 154, 0.10);
        }
        .rd-method-static { cursor: default; }
        .rd-method-static:hover { border-color: #26a69a; }
        .rd-method-radio {
          margin: 4px 0 0 0;
          width: 18px;
          height: 18px;
          accent-color: #26a69a;
          cursor: pointer;
          flex-shrink: 0;
        }
        .rd-method-body { flex: 1; min-width: 0; }
        .rd-method-head {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
          margin-bottom: 4px;
        }
        .rd-method-icon { font-size: 18px; }
        .rd-method-title {
          font-size: 15px;
          font-weight: 700;
          color: #111827;
        }
        .rd-method-text {
          font-size: 13px;
          color: #6b7280;
          margin: 0;
          line-height: 1.45;
        }

        /* Field — same visual language as os- */
        .rd-field { margin-bottom: 18px; }
        .rd-label {
          display: flex;
          align-items: center;
          gap: 6px;
          font-weight: 600;
          font-size: 13px;
          color: #374151;
          margin-bottom: 8px;
          letter-spacing: 0.01em;
        }
        .rd-label-icon { font-size: 15px; }
        .rd-required { color: #ef4444; margin-left: 2px; }

        .rd-input-wrap {
          position: relative;
          display: flex;
          align-items: center;
          border: 1.5px solid #e5e7eb;
          border-radius: 10px;
          background: #fff;
          transition: border-color 0.2s ease, box-shadow 0.2s ease;
        }
        .rd-input-wrap:focus-within {
          border-color: #26a69a;
          box-shadow: 0 0 0 4px rgba(38, 166, 154, 0.12);
        }
        .rd-input-wrap.rd-error-state {
          border-color: #ef4444;
          box-shadow: 0 0 0 4px rgba(239, 68, 68, 0.10);
        }
        .rd-input-wrap.rd-valid-state {
          border-color: #26a69a;
        }
        .rd-input {
          flex: 1;
          width: 100%;
          padding: 13px 14px;
          border: none;
          background: transparent;
          font-size: 16px;
          color: #111827;
          outline: none;
          border-radius: 10px;
        }
        .rd-input::placeholder { color: #9ca3af; }
        .rd-input-mono {
          font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
          letter-spacing: 1px;
        }
        .rd-check {
          color: #26a69a;
          font-weight: 700;
          font-size: 18px;
          padding-right: 14px;
          animation: rd-pop 0.25s ease;
        }
        .rd-hint {
          font-size: 12px;
          color: #9ca3af;
          margin: 6px 0 0 0;
          line-height: 1.4;
        }
        .rd-hint-error { color: #ef4444; }

        /* Owner radio cards */
        .rd-owner {
          display: flex;
          gap: 12px;
          align-items: center;
          padding: 12px 14px;
          border-radius: 10px;
          border: 1.5px solid #e5e7eb;
          background: #fff;
          cursor: pointer;
          margin-bottom: 8px;
          transition: border-color 0.2s ease, background-color 0.2s ease;
        }
        .rd-owner:last-child { margin-bottom: 0; }
        .rd-owner:hover { border-color: #cbd5e1; }
        .rd-owner-active {
          border-color: #26a69a;
          background: #f0fdfa;
        }
        .rd-owner-radio {
          width: 18px;
          height: 18px;
          accent-color: #26a69a;
          cursor: pointer;
          flex-shrink: 0;
        }
        .rd-owner-body {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }
        .rd-owner-title {
          font-size: 14px;
          font-weight: 600;
          color: #111827;
        }
        .rd-owner-sub {
          font-size: 12px;
          color: #6b7280;
        }

        /* Legal */
        .rd-legal {
          margin-top: 12px;
          padding: 14px 16px;
          background: #fff7ed;
          border: 1px solid #fed7aa;
          border-radius: 10px;
        }
        .rd-legal-label {
          display: flex;
          gap: 12px;
          align-items: flex-start;
          cursor: pointer;
        }
        .rd-legal-checkbox {
          margin-top: 2px;
          width: 18px;
          height: 18px;
          accent-color: #ea580c;
          cursor: pointer;
          flex-shrink: 0;
        }
        .rd-legal-body { display: flex; flex-direction: column; gap: 4px; }
        .rd-legal-title {
          font-size: 13px;
          font-weight: 700;
          color: #c2410c;
        }
        .rd-legal-text {
          font-size: 12px;
          color: #7c2d12;
          line-height: 1.45;
        }

        /* Actions */
        .rd-actions {
          display: flex;
          gap: 10px;
          margin-top: 24px;
        }
        .rd-back {
          flex: 1;
          padding: 14px 16px;
          border-radius: 12px;
          background: transparent;
          color: #6b7280;
          border: 1px solid #e5e7eb;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
          letter-spacing: 0.04em;
        }
        .rd-back:hover {
          background: #f9fafb;
          border-color: #d1d5db;
          color: #374151;
        }
        .rd-cta {
          flex: 2;
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
          transition: transform 0.15s ease, box-shadow 0.15s ease;
        }
        .rd-cta:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 22px rgba(33, 150, 243, 0.32);
        }
        .rd-cta:active {
          transform: translateY(0);
          box-shadow: 0 2px 8px rgba(33, 150, 243, 0.25);
        }
        .rd-cta-arrow {
          font-size: 18px;
          transition: transform 0.2s ease;
        }
        .rd-cta:hover .rd-cta-arrow { transform: translateX(4px); }

        .rd-fadein { animation: rd-fadein 0.25s ease; }

        @keyframes rd-fadein {
          from { opacity: 0; transform: translateY(4px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes rd-pop {
          from { transform: scale(0.6); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </form>
  )
}
