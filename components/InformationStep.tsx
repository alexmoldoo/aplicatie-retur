'use client'

import { useState, useEffect } from 'react'
import { Product, ShippingAddress } from './ReturnProcess'

interface InformationStepProps {
  onSubmit: (shippingInfo: {
    metodaTrimitere: 'curier' | 'manual'
    costTransport: number
    pickupContact?: ShippingAddress & { email?: string }
    codeRedemption?: string
  }) => void
  onBack: () => void
  products: Product[]
  initialShipping?: ShippingAddress
  customerEmail?: string
}

interface AdresaRetur {
  companie: string
  strada: string
  oras: string
  judet: string
  codPostal: string
  tara: string
  telefon: string
}

interface TransportCosts {
  curier: number
}

const FALLBACK_ADRESA: AdresaRetur = {
  companie: 'Maxari',
  strada: 'Șoseaua Sibiului, nr. 11',
  oras: 'Mediaș',
  judet: 'Sibiu',
  codPostal: '551129',
  tara: 'România',
  telefon: '-',
}
const FALLBACK_COSTS: TransportCosts = { curier: 19.99 }

type Metoda = 'curier' | 'manual' | null

export default function InformationStep({ onSubmit, onBack, products, initialShipping, customerEmail }: InformationStepProps) {
  const [adresa, setAdresa] = useState<AdresaRetur>(FALLBACK_ADRESA)
  const [costuri, setCosturi] = useState<TransportCosts>(FALLBACK_COSTS)
  const [metoda, setMetoda] = useState<Metoda>(null)
  const [accept, setAccept] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  // Cod de retur gratuit — opțional. Două tipuri:
  // - `free_shipping`: ascunde opțiunea „manual", forțează curier cu cost 0.
  // - `direct_refund` (cod cu D): ascunde TOATE metodele — clientul nu mai trimite
  //   coletul, banii vin direct.
  // Validare reală se face și server-side la submit.
  const [codeInput, setCodeInput] = useState('')
  const [appliedCode, setAppliedCode] = useState<string | null>(null)
  const [appliedKind, setAppliedKind] = useState<'free_shipping' | 'direct_refund' | null>(null)
  const [codeChecking, setCodeChecking] = useState(false)
  const [codeError, setCodeError] = useState<string | null>(null)

  // Adresa de pickup — pre-completată din comanda Shopify, editabilă de client
  const [pickup, setPickup] = useState({
    nume: initialShipping?.nume || '',
    telefon: initialShipping?.telefon || '',
    email: customerEmail || '',
    strada: initialShipping?.strada || '',
    oras: initialShipping?.oras || '',
    judet: initialShipping?.judet || '',
    codPostal: initialShipping?.codPostal || '',
    tara: initialShipping?.tara || 'România',
  })

  const updatePickup = (field: keyof typeof pickup, value: string) => {
    setPickup(prev => ({ ...prev, [field]: value }))
  }

  useEffect(() => {
    fetch('/api/config/return-info')
      .then(r => r.json())
      .then(d => {
        if (d.success) {
          if (d.adresaRetur) setAdresa(d.adresaRetur)
          if (d.transportCosts?.curier != null) {
            setCosturi({ curier: d.transportCosts.curier })
          }
        }
      })
      .catch(() => {})
  }, [])

  const subtotal = products
    .filter(p => p.selected && (p.cantitateReturnata || 0) > 0)
    .reduce((sum, p) => sum + p.pret * (p.cantitateReturnata || 0), 0)

  const codeApplied = !!appliedCode
  const isDirectRefund = appliedKind === 'direct_refund'
  const cost = codeApplied ? 0 : (metoda === 'curier' ? costuri.curier : 0)
  const totalRefund = Math.max(0, subtotal - cost)

  const showTelefon = adresa.telefon && adresa.telefon.trim() !== '' && adresa.telefon.trim() !== '-'

  const applyCode = async () => {
    setCodeError(null)
    const trimmed = codeInput.trim().toUpperCase()
    if (!trimmed) {
      setCodeError('Introdu un cod.')
      return
    }
    setCodeChecking(true)
    try {
      const r = await fetch('/api/returns/codes/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: trimmed }),
      })
      const data = await r.json()
      if (data.valid) {
        const kind: 'free_shipping' | 'direct_refund' = data.kind === 'direct_refund' ? 'direct_refund' : 'free_shipping'
        setAppliedCode(trimmed)
        setAppliedKind(kind)
        setCodeInput(trimmed)
        // Forțăm „curier" ca să trecem de checkout-ul de metoda în handleContinue.
        // Pentru `direct_refund` serverul ignoră oricum metoda și sare peste AWB.
        setMetoda('curier')
        setCodeError(null)
      } else {
        setAppliedCode(null)
        setAppliedKind(null)
        setCodeError(data.message || 'Cod invalid.')
      }
    } catch {
      setCodeError('Eroare la verificare. Reîncearcă.')
    } finally {
      setCodeChecking(false)
    }
  }

  const clearCode = () => {
    setAppliedCode(null)
    setAppliedKind(null)
    setCodeInput('')
    setCodeError(null)
  }

  const handleCopyAdresa = async () => {
    const lines = [
      adresa.companie,
      adresa.strada,
      `${adresa.oras}, ${adresa.judet} ${adresa.codPostal}`,
      adresa.tara,
    ]
    if (showTelefon) lines.push(`Tel: ${adresa.telefon}`)
    const text = lines.join('\n')
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // ignore
    }
  }

  const handleContinue = () => {
    setError(null)
    if (!metoda) {
      setError('Alege o metodă de trimitere a coletului.')
      return
    }
    if (!accept) {
      setError('Trebuie să confirmi că ai citit informațiile.')
      return
    }

    let pickupContact: (ShippingAddress & { email?: string }) | undefined
    // Pentru decont direct nu trebuie pickup — magazinul nu mai ridică nimic.
    if (metoda === 'curier' && !isDirectRefund) {
      const missing: string[] = []
      if (!pickup.nume.trim()) missing.push('nume')
      if (!pickup.telefon.trim()) missing.push('telefon')
      if (!pickup.email.trim()) missing.push('email')
      if (!pickup.strada.trim() || pickup.strada.trim().length < 3) missing.push('stradă')
      if (!pickup.oras.trim()) missing.push('oraș')
      if (!pickup.judet.trim()) missing.push('județ')
      if (!pickup.codPostal.trim()) missing.push('cod poștal')
      if (missing.length > 0) {
        setError(`Completează adresa de ridicare: ${missing.join(', ')}.`)
        return
      }
      pickupContact = {
        nume: pickup.nume.trim(),
        telefon: pickup.telefon.trim(),
        email: pickup.email.trim(),
        strada: pickup.strada.trim(),
        oras: pickup.oras.trim(),
        judet: pickup.judet.trim(),
        codPostal: pickup.codPostal.trim(),
        tara: pickup.tara.trim() || 'România',
      }
    }

    onSubmit({
      metodaTrimitere: metoda,
      costTransport: cost,
      pickupContact,
      codeRedemption: appliedCode || undefined,
    })
  }

  return (
    <div className="is-form step-form-large">
      <div className="is-header">
        <div className="is-header-icon" aria-hidden="true">{isDirectRefund ? '💸' : '📦'}</div>
        <h2 className="is-title">{isDirectRefund ? 'Aproape gata' : 'Cum trimiți coletul'}</h2>
        <p className="is-subtitle">
          {isDirectRefund
            ? 'Codul tău forțează decont direct — nu mai e nevoie să trimiți coletul.'
            : 'Coletul îl trimiți tu către noi. Alege metoda care ți se potrivește.'}
        </p>
      </div>

      {error && (
        <div className="is-error" role="alert">
          <span aria-hidden="true">⚠️</span>
          <span>{error}</span>
        </div>
      )}

      {/* Pregătește coletul — ascuns pentru decont direct (nu mai trimite colet) */}
      {!isDirectRefund && (
        <div className="is-card">
          <h3 className="is-card-title">📦 Pregătește coletul</h3>
          <ul className="is-checklist">
            <li>Produsele în starea originală, cu etichetele intacte</li>
            <li>Include în colet formularul de retur (PDF) descărcat la pasul următor</li>
            <li>Ambalează atent ca produsele să nu se deterioreze pe drum</li>
          </ul>
        </div>
      )}

      {/* Cum trimiți */}
      <div className="is-card">
        <h3 className="is-card-title">{isDirectRefund ? '🎟️ Cod retur gratuit' : '🚚 Cum trimiți coletul'}</h3>
        {!isDirectRefund && (
          <p className="is-card-text">Alege metoda — costul se scade direct din suma rambursată.</p>
        )}

        {/* Cod retur gratuit — opțional */}
        <div className={`is-code-box ${codeApplied ? 'is-code-box-applied' : ''}`}>
          {codeApplied ? (
            <div className="is-code-applied">
              <span className="is-code-applied-icon" aria-hidden="true">🎟️</span>
              <div className="is-code-applied-body">
                <div className="is-code-applied-title">Cod aplicat: <code>{appliedCode}</code></div>
                <div className="is-code-applied-sub">
                  {isDirectRefund
                    ? 'Nu trebuie să trimiți coletul. Banii vor fi rambursați direct în contul tău și poți păstra produsul.'
                    : 'Curierul vine la tine fără cost — primești refund integral.'}
                </div>
              </div>
              <button type="button" onClick={clearCode} className="is-code-clear">Elimină</button>
            </div>
          ) : (
            <>
              <label htmlFor="freeReturnCode" className="is-code-label">
                Ai un cod de retur gratuit? <span className="is-code-optional">(opțional)</span>
              </label>
              <div className="is-code-row">
                <input
                  id="freeReturnCode"
                  type="text"
                  value={codeInput}
                  onChange={(e) => { setCodeInput(e.target.value.toUpperCase()); setCodeError(null) }}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); applyCode() } }}
                  placeholder="ex: 7392K sau D7392K"
                  maxLength={10}
                  inputMode="text"
                  autoCapitalize="characters"
                  className="is-code-input"
                />
                <button
                  type="button"
                  onClick={applyCode}
                  disabled={codeChecking || !codeInput.trim()}
                  className="is-code-btn"
                >
                  {codeChecking ? 'Verific…' : 'Aplică'}
                </button>
              </div>
              {codeError && <p className="is-code-error">{codeError}</p>}
            </>
          )}
        </div>

        <div className="is-methods">
          {/* Decont direct — nu mai cere nicio decizie de expediere. */}
          {isDirectRefund && (
            <div className="is-direct-refund-notice">
              <span className="is-direct-refund-icon" aria-hidden="true">✅</span>
              <div className="is-direct-refund-body">
                <strong className="is-direct-refund-title">Nu trebuie să trimiți coletul</strong>
                <p className="is-direct-refund-text">
                  Magazinul va rambursa direct suma integrală în contul tău (IBAN-ul completat la pasul anterior). Poți păstra produsul.
                </p>
              </div>
            </div>
          )}

          {/* Curier — ascuns când e decont direct */}
          {!isDirectRefund && (
          <label className={`is-method ${metoda === 'curier' ? 'is-method-active' : ''}`}>
            <input
              type="radio"
              name="metodaTrimitere"
              checked={metoda === 'curier'}
              onChange={() => setMetoda('curier')}
              className="is-method-radio"
            />
            <div className="is-method-body">
              <div className="is-method-head">
                <span className="is-method-icon">🏠</span>
                <span className="is-method-title">Curier la adresă</span>
                {codeApplied ? (
                  <span className="is-method-cost is-method-free">Gratuit (cod aplicat)</span>
                ) : (
                  <span className="is-method-cost">−{costuri.curier.toFixed(2)} RON</span>
                )}
              </div>
              <p className="is-method-text">
                Curierul SameDay vine să ridice coletul de la adresa ta. Doar îl predai.
              </p>
            </div>
          </label>
          )}

          {/* Formular adresă pickup — afișat doar când curier, NU pentru decont direct */}
          {metoda === 'curier' && !isDirectRefund && (
            <div className="is-pickup-form">
              <div className="is-pickup-head">
                <span className="is-pickup-title">📍 Adresa de unde ridicăm coletul</span>
                <span className="is-pickup-hint">Pre-completată din comandă — modifică dacă e nevoie</span>
              </div>
              <div className="is-pickup-grid">
                <label className="is-pickup-field">
                  <span>Nume complet</span>
                  <input type="text" value={pickup.nume} onChange={e => updatePickup('nume', e.target.value)} placeholder="Ion Popescu" />
                </label>
                <label className="is-pickup-field">
                  <span>Telefon</span>
                  <input type="tel" value={pickup.telefon} onChange={e => updatePickup('telefon', e.target.value)} placeholder="07xx xxx xxx" />
                </label>
                <label className="is-pickup-field is-pickup-field-full">
                  <span>Email</span>
                  <input type="email" value={pickup.email} onChange={e => updatePickup('email', e.target.value)} placeholder="email@exemplu.ro" />
                </label>
                <label className="is-pickup-field is-pickup-field-full">
                  <span>Stradă, număr, bloc, scară, ap</span>
                  <input type="text" value={pickup.strada} onChange={e => updatePickup('strada', e.target.value)} placeholder="Str. Mihai Eminescu nr. 25, bl. A1, ap. 12" />
                </label>
                <label className="is-pickup-field">
                  <span>Oraș</span>
                  <input type="text" value={pickup.oras} onChange={e => updatePickup('oras', e.target.value)} placeholder="Cluj-Napoca" />
                </label>
                <label className="is-pickup-field">
                  <span>Județ</span>
                  <input type="text" value={pickup.judet} onChange={e => updatePickup('judet', e.target.value)} placeholder="Cluj" />
                </label>
                <label className="is-pickup-field">
                  <span>Cod poștal</span>
                  <input type="text" value={pickup.codPostal} onChange={e => updatePickup('codPostal', e.target.value)} placeholder="400123" />
                </label>
              </div>
              <p className="is-pickup-note">
                Curierul SameDay va veni la adresa de mai sus în 1–2 zile lucrătoare. Ai grijă să fii acasă sau să predai coletul cuiva — eticheta o aduce curierul, tu doar o lipești pe colet.
              </p>
            </div>
          )}

          {/* Manual — ascuns când codul gratuit e aplicat (codul forțează curier) */}
          {!codeApplied && (
            <label className={`is-method ${metoda === 'manual' ? 'is-method-active' : ''}`}>
              <input
                type="radio"
                name="metodaTrimitere"
                checked={metoda === 'manual'}
                onChange={() => setMetoda('manual')}
                className="is-method-radio"
              />
              <div className="is-method-body">
                <div className="is-method-head">
                  <span className="is-method-icon">📮</span>
                  <span className="is-method-title">Trimit eu cu un curier ales de mine</span>
                  <span className="is-method-cost is-method-free">Refund integral</span>
                </div>
                <p className="is-method-text">
                  Alegi orice curier și plătești expedierea direct la el. Primești toți banii înapoi.
                </p>
              </div>
            </label>
          )}

          {/* Adresa de retur — afișată doar pentru manual */}
          {metoda === 'manual' && !codeApplied && (
            <div className="is-card is-address-card">
              <div className="is-card-head">
                <h3 className="is-card-title">📍 Adresa de retur</h3>
                <button type="button" onClick={handleCopyAdresa} className="is-copy-btn">
                  {copied ? '✓ Copiat' : 'Copiază'}
                </button>
              </div>
              <p className="is-card-text">Trimite coletul la adresa de mai jos cu orice curier preferi.</p>
              <div className="is-address">
                <div className="is-address-row">
                  <span className="is-address-label">Destinatar:</span>
                  <span className="is-address-value is-address-name">{adresa.companie}</span>
                </div>
                <div className="is-address-row">
                  <span className="is-address-label">Stradă:</span>
                  <span className="is-address-value">{adresa.strada}</span>
                </div>
                <div className="is-address-row">
                  <span className="is-address-label">Oraș:</span>
                  <span className="is-address-value">{adresa.oras}</span>
                </div>
                <div className="is-address-row">
                  <span className="is-address-label">Județ:</span>
                  <span className="is-address-value">{adresa.judet}</span>
                </div>
                <div className="is-address-row">
                  <span className="is-address-label">Cod poștal:</span>
                  <span className="is-address-value">{adresa.codPostal}</span>
                </div>
                <div className="is-address-row">
                  <span className="is-address-label">Țară:</span>
                  <span className="is-address-value">{adresa.tara}</span>
                </div>
                <div className="is-address-row">
                  <span className="is-address-label">Nr. telefon:</span>
                  <span className="is-address-value is-address-phone">{showTelefon ? adresa.telefon : '-'}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Rezumat refund */}
      <div className="is-summary">
        <div className="is-summary-row">
          <span>Subtotal produse</span>
          <span>{subtotal.toFixed(2)} RON</span>
        </div>
        <div className="is-summary-row">
          <span>Cost transport</span>
          <span className={cost > 0 ? 'is-summary-cost' : ''}>
            {cost > 0 ? `−${cost.toFixed(2)} RON` : '0,00 RON'}
          </span>
        </div>
        <div className="is-summary-total">
          <span>Total rambursare</span>
          <span className="is-summary-total-value">{totalRefund.toFixed(2)} RON</span>
        </div>
      </div>

      {/* Confirmare citire */}
      <label className="is-accept">
        <input
          type="checkbox"
          checked={accept}
          onChange={e => setAccept(e.target.checked)}
          className="is-accept-checkbox"
        />
        <span>{isDirectRefund ? 'Am citit informațiile de mai sus.' : 'Am citit informațiile de mai sus și înțeleg cum trimit coletul.'}</span>
      </label>

      {/* Butoane */}
      <div className="is-actions">
        <button type="button" onClick={onBack} className="is-back">ÎNAPOI</button>
        <button type="button" onClick={handleContinue} className="is-cta">
          CONTINUĂ
          <span className="is-cta-arrow" aria-hidden="true">→</span>
        </button>
      </div>

      <style jsx>{`
        .is-form {
          max-width: 600px;
          margin: 0 auto;
        }
        .is-header {
          text-align: center;
          margin-bottom: 24px;
        }
        .is-header-icon { font-size: 40px; margin-bottom: 8px; }
        .is-title {
          font-size: 22px;
          font-weight: 700;
          color: #1a1a1a;
          margin: 0 0 6px 0;
          letter-spacing: -0.02em;
        }
        .is-subtitle { font-size: 14px; color: #6b7280; margin: 0; }
        @media (min-width: 481px) {
          .is-title { font-size: 26px; }
          .is-subtitle { font-size: 15px; }
        }

        .is-error {
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
          margin-bottom: 12px;
          animation: is-fadein 0.3s ease;
        }

        .is-card {
          padding: 18px;
          background: #fafafa;
          border: 1px solid #f0f0f0;
          border-radius: 12px;
          margin-bottom: 18px;
        }
        .is-address-card {
          margin-top: 4px;
          margin-bottom: 0;
          background: #fff;
          border: 1.5px solid #26a69a;
          animation: is-fadein 0.25s ease;
        }
        .is-card-head {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 12px;
          gap: 12px;
        }
        .is-card-title {
          font-size: 14px;
          font-weight: 700;
          color: #374151;
          margin: 0 0 8px 0;
          letter-spacing: 0.01em;
        }
        .is-card-head .is-card-title { margin: 0; }
        .is-card-text {
          font-size: 13px;
          color: #6b7280;
          margin: 0 0 14px 0;
        }
        .is-copy-btn {
          padding: 6px 12px;
          border-radius: 8px;
          background: #fff;
          border: 1px solid #d1d5db;
          color: #374151;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
        }
        .is-copy-btn:hover {
          background: #f3f4f6;
          border-color: #9ca3af;
        }

        .is-address {
          font-size: 14px;
          color: #111827;
          line-height: 1.5;
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .is-address-row {
          display: grid;
          grid-template-columns: 110px 1fr;
          gap: 8px;
          align-items: baseline;
        }
        .is-address-label {
          font-size: 13px;
          color: #6b7280;
          font-weight: 600;
        }
        .is-address-value {
          color: #111827;
          word-break: break-word;
        }
        .is-address-name {
          font-weight: 700;
        }
        .is-address-phone {
          color: #26a69a;
          font-weight: 600;
        }
        @media (max-width: 480px) {
          .is-address-row {
            grid-template-columns: 100px 1fr;
          }
        }

        .is-checklist {
          list-style: none;
          padding: 0;
          margin: 0;
          font-size: 13px;
          color: #374151;
        }
        .is-checklist li {
          position: relative;
          padding: 6px 0 6px 28px;
          line-height: 1.5;
        }
        .is-checklist li::before {
          content: '✓';
          position: absolute;
          left: 6px;
          top: 6px;
          color: #26a69a;
          font-weight: 700;
        }

        /* Cod retur gratuit */
        .is-code-box {
          margin-bottom: 14px;
          padding: 12px 14px;
          background: #fff;
          border: 1px dashed #d1d5db;
          border-radius: 10px;
        }
        .is-code-box-applied {
          background: linear-gradient(135deg, #f0fdfa 0%, #ecfeff 100%);
          border: 1.5px solid #26a69a;
          border-style: solid;
        }
        .is-code-label {
          display: block;
          font-size: 13px;
          font-weight: 600;
          color: #374151;
          margin-bottom: 8px;
        }
        .is-code-optional {
          color: #9ca3af;
          font-weight: 400;
          font-size: 12px;
        }
        .is-code-row {
          display: flex;
          gap: 8px;
        }
        .is-code-input {
          flex: 1;
          padding: 10px 12px;
          border: 1px solid #d1d5db;
          border-radius: 8px;
          font-size: 15px;
          font-family: monospace;
          font-weight: 700;
          letter-spacing: 0.1em;
          color: #111827;
          background: #fff;
          text-transform: uppercase;
        }
        .is-code-input:focus {
          outline: none;
          border-color: #26a69a;
          box-shadow: 0 0 0 3px rgba(38, 166, 154, 0.15);
        }
        .is-code-btn {
          padding: 10px 16px;
          border-radius: 8px;
          background: #26a69a;
          color: #fff;
          border: none;
          font-size: 13px;
          font-weight: 700;
          cursor: pointer;
          white-space: nowrap;
          transition: background 0.15s ease, opacity 0.15s ease;
        }
        .is-code-btn:hover:not(:disabled) { background: #1e8e83; }
        .is-code-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .is-code-error {
          margin: 8px 0 0 0;
          font-size: 12px;
          color: #b91c1c;
        }
        .is-code-applied {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .is-code-applied-icon { font-size: 24px; }
        .is-code-applied-body { flex: 1; min-width: 0; }
        .is-code-applied-title {
          font-size: 14px;
          font-weight: 700;
          color: #0f766e;
        }
        .is-code-applied-title code {
          font-family: monospace;
          letter-spacing: 0.1em;
          background: rgba(15, 118, 110, 0.08);
          padding: 2px 6px;
          border-radius: 4px;
        }
        .is-code-applied-sub {
          font-size: 12px;
          color: #374151;
          margin-top: 2px;
        }
        .is-code-clear {
          padding: 6px 10px;
          background: transparent;
          color: #6b7280;
          border: 1px solid #d1d5db;
          border-radius: 6px;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
        }
        .is-direct-refund-notice {
          margin-top: 16px;
          padding: 16px 18px;
          background: linear-gradient(180deg, #ecfdf5 0%, #f0fdf4 100%);
          border: 1px solid #a7f3d0;
          border-radius: 12px;
          display: flex;
          gap: 14px;
          align-items: flex-start;
        }
        .is-direct-refund-icon { font-size: 24px; line-height: 1; }
        .is-direct-refund-body { flex: 1; min-width: 0; }
        .is-direct-refund-title {
          display: block;
          font-size: 14px;
          font-weight: 700;
          color: #047857;
          margin-bottom: 4px;
        }
        .is-direct-refund-text {
          font-size: 13px;
          color: #374151;
          line-height: 1.5;
          margin: 0;
        }
        .is-code-clear:hover {
          background: #f9fafb;
          color: #374151;
        }

        .is-methods {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .is-method {
          display: flex;
          gap: 12px;
          align-items: flex-start;
          padding: 14px 16px;
          border-radius: 12px;
          border: 1.5px solid #e5e7eb;
          background: #fff;
          cursor: pointer;
          transition: all 0.2s ease;
        }
        .is-method:hover { border-color: #cbd5e1; }
        .is-method-active {
          border-color: #26a69a;
          background: linear-gradient(135deg, #f0fdfa 0%, #ecfeff 100%);
          box-shadow: 0 0 0 4px rgba(38, 166, 154, 0.10);
        }
        .is-method-radio {
          margin-top: 4px;
          width: 18px;
          height: 18px;
          accent-color: #26a69a;
          cursor: pointer;
          flex-shrink: 0;
        }
        .is-method-body { flex: 1; min-width: 0; }
        .is-method-head {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
          margin-bottom: 4px;
        }
        .is-method-icon { font-size: 18px; }
        .is-method-title {
          font-size: 15px;
          font-weight: 700;
          color: #111827;
          flex: 1;
        }
        .is-method-cost {
          font-size: 13px;
          font-weight: 700;
          color: #c2410c;
          background: #fff7ed;
          padding: 3px 10px;
          border-radius: 999px;
          white-space: nowrap;
        }
        .is-method-free {
          color: #047857;
          background: #d1fae5;
        }
        .is-method-text {
          font-size: 13px;
          color: #6b7280;
          margin: 0;
          line-height: 1.45;
        }

        /* Summary */
        .is-summary {
          padding: 16px 18px;
          background: #fff;
          border: 1.5px solid #26a69a;
          border-radius: 12px;
          margin-bottom: 18px;
        }
        .is-summary-row {
          display: flex;
          justify-content: space-between;
          font-size: 14px;
          color: #374151;
          padding: 4px 0;
        }
        .is-summary-cost { color: #c2410c; font-weight: 600; }
        .is-summary-total {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-top: 10px;
          padding-top: 10px;
          border-top: 1px solid #e5e7eb;
          font-size: 14px;
          font-weight: 700;
          color: #111827;
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }
        .is-summary-total-value {
          font-size: 22px;
          color: #26a69a;
          font-weight: 800;
        }

        /* Accept */
        .is-accept {
          display: flex;
          gap: 10px;
          align-items: flex-start;
          padding: 12px 14px;
          background: #fafafa;
          border: 1px solid #e5e7eb;
          border-radius: 10px;
          cursor: pointer;
          font-size: 13px;
          color: #374151;
          line-height: 1.5;
          margin-bottom: 18px;
        }
        .is-accept-checkbox {
          margin-top: 1px;
          width: 18px;
          height: 18px;
          accent-color: #26a69a;
          cursor: pointer;
          flex-shrink: 0;
        }

        /* Actions */
        .is-actions {
          display: flex;
          gap: 10px;
        }
        .is-back {
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
        .is-back:hover {
          background: #f9fafb;
          border-color: #d1d5db;
          color: #374151;
        }
        .is-cta {
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
        .is-cta:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 22px rgba(33, 150, 243, 0.32);
        }
        .is-cta:active {
          transform: translateY(0);
        }
        .is-cta-arrow {
          font-size: 18px;
          transition: transform 0.2s ease;
        }
        .is-cta:hover .is-cta-arrow { transform: translateX(4px); }

        /* Pickup form */
        .is-pickup-form {
          margin-top: 4px;
          padding: 16px;
          background: #fff;
          border: 1.5px solid #26a69a;
          border-radius: 12px;
          animation: is-fadein 0.25s ease;
        }
        .is-pickup-head { margin-bottom: 12px; }
        .is-pickup-title {
          display: block;
          font-size: 14px;
          font-weight: 700;
          color: #0f766e;
          margin-bottom: 2px;
        }
        .is-pickup-hint {
          display: block;
          font-size: 12px;
          color: #6b7280;
        }
        .is-pickup-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
        }
        .is-pickup-field {
          display: flex;
          flex-direction: column;
          gap: 4px;
          font-size: 12px;
          color: #374151;
          font-weight: 600;
        }
        .is-pickup-field-full { grid-column: 1 / -1; }
        .is-pickup-field input {
          padding: 10px 12px;
          border: 1px solid #d1d5db;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 400;
          color: #111827;
          background: #fff;
          transition: border-color 0.15s ease, box-shadow 0.15s ease;
        }
        .is-pickup-field input:focus {
          outline: none;
          border-color: #26a69a;
          box-shadow: 0 0 0 3px rgba(38, 166, 154, 0.15);
        }
        .is-pickup-note {
          margin: 12px 0 0 0;
          padding: 10px 12px;
          background: #f0fdfa;
          border-left: 3px solid #26a69a;
          border-radius: 6px;
          font-size: 12px;
          line-height: 1.5;
          color: #0f766e;
        }
        @media (max-width: 480px) {
          .is-pickup-grid { grid-template-columns: 1fr; }
        }

        @keyframes is-fadein {
          from { opacity: 0; transform: translateY(4px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  )
}
