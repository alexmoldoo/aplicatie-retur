'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { getLedColor } from '@/lib/eligibility'

type ReturnStatus = 'INITIAT' | 'IN_ASTEPTARE_COLET' | 'COLET_PRIMIT' | 'PROCESAT' | 'FINALIZAT' | 'ANULAT'

interface ExistingReturnInfo {
  idRetur: string
  status: ReturnStatus
  awbNumber: string | null
  createdAt: string
  totalRefund: number
  metodaTrimitere: 'curier' | 'manual' | null
}

interface Order {
  id: string
  nume: string
  numarComanda: string
  telefon: string
  email: string
  products: Array<{
    id: string
    nume: string
    cantitate: number
    pret: number
    variant_id?: string
    sku?: string
    imagine?: string
  }>
  total: number
  currency: string
  dataComanda: string
  eligibility: {
    status: 'eligible' | 'warning' | 'expired'
    daysRemaining: number
    daysSinceOrder: number
    message?: string
  }
  sessionToken?: string
  existingReturn?: ExistingReturnInfo | null
}

const RETURN_STATUS_LABEL: Record<ReturnStatus, string> = {
  INITIAT: 'Inițiat',
  IN_ASTEPTARE_COLET: 'În așteptarea coletului',
  COLET_PRIMIT: 'Colet primit',
  PROCESAT: 'În procesare',
  FINALIZAT: 'Finalizat (rambursat)',
  ANULAT: 'Anulat',
}

function isCancellableStatus(status: ReturnStatus): boolean {
  return status === 'INITIAT' || status === 'IN_ASTEPTARE_COLET'
}

/** Self-cancel permis doar fără AWB (metoda „manual"). Cu AWB → cerere admin prin email. */
function canSelfCancel(er: ExistingReturnInfo): boolean {
  return isCancellableStatus(er.status) && !er.awbNumber
}

function returnStatusColor(status: ReturnStatus): { bg: string; fg: string; border: string } {
  switch (status) {
    case 'INITIAT':
    case 'IN_ASTEPTARE_COLET':
      return { bg: '#fef3c7', fg: '#92400e', border: '#fcd34d' }
    case 'COLET_PRIMIT':
    case 'PROCESAT':
      return { bg: '#dbeafe', fg: '#1e40af', border: '#93c5fd' }
    case 'FINALIZAT':
      return { bg: '#dcfce7', fg: '#166534', border: '#86efac' }
    case 'ANULAT':
      return { bg: '#f3f4f6', fg: '#6b7280', border: '#d1d5db' }
  }
}

interface OrderSelectionProps {
  orders: Order[]
  onSelectOrder: (order: Order) => void
  onBack?: () => void
}

/**
 * Returnează data limită pentru retur (creată + 18 zile, ultima zi inclusiv)
 */
function getDeadlineDate(orderDate: string): Date {
  const d = new Date(orderDate)
  d.setDate(d.getDate() + 18)
  return d
}

function formatRoDate(d: Date): string {
  return d.toLocaleDateString('ro-RO', { day: 'numeric', month: 'long', year: 'numeric' })
}

/**
 * Generează un mesaj clar despre eligibilitate cu data limită
 */
function getEligibilityText(order: Order): string {
  const deadline = getDeadlineDate(order.dataComanda)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  deadline.setHours(0, 0, 0, 0)
  const daysLeft = Math.ceil((deadline.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))

  if (order.eligibility.status === 'expired') {
    return `Termenul de retur a expirat pe ${formatRoDate(deadline)}`
  }
  if (daysLeft <= 0) {
    return `Ultima zi pentru retur este azi (${formatRoDate(deadline)})`
  }
  if (daysLeft === 1) {
    return `Mai ai 1 zi — ultima zi: mâine (${formatRoDate(deadline)})`
  }
  return `Mai ai ${daysLeft} zile — ultima zi: ${formatRoDate(deadline)}`
}

export default function OrderSelection({ orders, onSelectOrder, onBack }: OrderSelectionProps) {
  const router = useRouter()
  // Set local de retururi anulate în această sesiune — folosit ca să debloceze imediat
  // comanda în UI fără să așteptăm cache-ul de 60s al search-order.
  const [cancelledReturnIds, setCancelledReturnIds] = useState<Set<string>>(new Set())

  // Aplică override-ul local pentru comenzile cu retur anulat în această sesiune
  const ordersView = orders.map(o => {
    if (o.existingReturn && cancelledReturnIds.has(o.existingReturn.idRetur)) {
      return { ...o, existingReturn: null }
    }
    return o
  })

  // Comenzile fără retur activ sunt selectabile pentru retur nou
  const selectableOrders = ordersView.filter(o => !o.existingReturn)
  const defaultOrder =
    selectableOrders.find(o => o.eligibility.status === 'eligible') || selectableOrders[0] || null
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(
    defaultOrder ? defaultOrder.id : null
  )
  const [showExpiredConfirm, setShowExpiredConfirm] = useState(false)
  const [cancellingId, setCancellingId] = useState<string | null>(null)
  const [cancelError, setCancelError] = useState<string | null>(null)

  useEffect(() => {
    if (defaultOrder && selectedOrderId === null) {
      setSelectedOrderId(defaultOrder.id)
    }
  }, [ordersView.length, defaultOrder?.id])

  const selectedOrder = ordersView.find(o => o.id === selectedOrderId)

  const handleDownloadReturnPdf = (idRetur: string, sessionToken?: string) => {
    const qs = sessionToken ? `?token=${encodeURIComponent(sessionToken)}` : ''
    window.open(`/api/returns/${encodeURIComponent(idRetur)}/pdf${qs}`, '_blank', 'noopener')
  }

  const handleCancelReturn = async (order: Order) => {
    if (!order.existingReturn) return
    if (!order.sessionToken) {
      setCancelError('Sesiune expirată. Reîncarcă pagina și caută din nou comanda.')
      return
    }
    const confirmed = window.confirm(
      `Sigur vrei să anulezi returul ${order.existingReturn.idRetur}?\n\nVei putea iniția un nou retur după anulare. Dacă ai trimis deja coletul, contactează-ne pe info@maxari.ro.`
    )
    if (!confirmed) return

    setCancellingId(order.existingReturn.idRetur)
    setCancelError(null)
    try {
      const res = await fetch(`/api/returns/${encodeURIComponent(order.existingReturn.idRetur)}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionToken: order.sessionToken }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) {
        setCancelError(data?.message || 'Anularea a eșuat. Încearcă din nou.')
        setCancellingId(null)
        return
      }
      // Marchează returul ca anulat local — comanda devine imediat selectabilă pentru retur nou
      setCancelledReturnIds(prev => {
        const next = new Set(prev)
        next.add(order.existingReturn!.idRetur)
        return next
      })
      setCancellingId(null)
    } catch (e) {
      console.error('cancel return failed', e)
      setCancelError('Eroare de rețea la anularea returului.')
      setCancellingId(null)
    }
  }

  const handleContinue = () => {
    if (!selectedOrder) return
    // F4 — confirmare la comandă expirată
    if (selectedOrder.eligibility.status === 'expired') {
      setShowExpiredConfirm(true)
      return
    }
    onSelectOrder(selectedOrder)
  }

  const handleGoToContact = () => {
    if (!selectedOrder) return
    setShowExpiredConfirm(false)
    const params = new URLSearchParams({
      reason: 'expired_order',
      order: selectedOrder.numarComanda,
    })
    router.push(`/contact?${params.toString()}`)
  }

  const statusLabel = (status: 'eligible' | 'warning' | 'expired') => {
    if (status === 'eligible') return 'Eligibil'
    if (status === 'warning') return 'Atenție'
    return 'Expirat'
  }

  const allHaveReturns = ordersView.length > 0 && selectableOrders.length === 0
  const someHaveReturns = !allHaveReturns && ordersView.some(o => o.existingReturn)

  return (
    <div className="step-container os-sel-form">
      <div className="os-sel-header">
        <div className="os-sel-header-icon" aria-hidden="true">📋</div>
        <h2 className="os-sel-title">
          {allHaveReturns
            ? orders.length === 1
              ? 'Ai deja un retur pe această comandă'
              : 'Ai retururi active pe aceste comenzi'
            : orders.length === 1
            ? 'Comanda găsită'
            : `Am găsit ${orders.length} comenzi`}
        </h2>
        <p className="os-sel-subtitle">
          {allHaveReturns
            ? 'Poți descărca PDF-ul sau, dacă încă nu ai trimis coletul, anula returul.'
            : someHaveReturns
            ? 'Comenzile cu retur activ sunt blocate; alege una fără retur sau gestionează cele existente.'
            : orders.length === 1
            ? 'Verifică detaliile și continuă procesul de retur.'
            : 'Alege comanda pentru care vrei să inițiezi returul.'}
        </p>
      </div>

      <div className="os-sel-list">
        {ordersView.map((order) => {
          const ledColor = getLedColor(order.eligibility.status)
          const isSelected = selectedOrderId === order.id
          const eligibilityText = getEligibilityText(order)
          // F1 — thumbnails: ia primele 4 imagini unice
          const thumbnails = order.products
            .filter(p => p.imagine && !p.id.startsWith('shipping-'))
            .slice(0, 4)
          const remaining = order.products.filter(p => !p.id.startsWith('shipping-')).length - thumbnails.length
          const er = order.existingReturn || null

          // Comenzile cu retur activ — card non-selectabil cu acțiuni dedicate
          if (er) {
            const colors = returnStatusColor(er.status)
            const cancellable = canSelfCancel(er)
            const cancelLockedByAwb = isCancellableStatus(er.status) && !!er.awbNumber
            const isCancelling = cancellingId === er.idRetur
            return (
              <div key={order.id} className="os-sel-card os-sel-card-locked">
                <div className="os-sel-radio os-sel-radio-locked" aria-hidden="true">
                  <span style={{ fontSize: 13 }}>🔒</span>
                </div>
                <div className="os-sel-card-body">
                  <div className="os-sel-card-top">
                    <div>
                      <h4 className="os-sel-order-number">Comandă {order.numarComanda}</h4>
                      <p className="os-sel-meta">
                        <span aria-hidden="true">📅</span>{' '}
                        {new Date(order.dataComanda).toLocaleDateString('ro-RO', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </p>
                    </div>
                    <div
                      className="os-sel-pill"
                      style={{ backgroundColor: colors.bg, color: colors.fg, borderColor: colors.border }}
                    >
                      <span className="os-sel-pill-dot" style={{ backgroundColor: colors.fg }} />
                      {RETURN_STATUS_LABEL[er.status]}
                    </div>
                  </div>

                  <div className="os-sel-er-info">
                    <div className="os-sel-er-line">
                      <span className="os-sel-er-label">Nr. retur:</span>
                      <strong>{er.idRetur}</strong>
                    </div>
                    {er.awbNumber && (
                      <div className="os-sel-er-line">
                        <span className="os-sel-er-label">AWB:</span>
                        <strong>{er.awbNumber}</strong>
                        <span className="os-sel-er-hint">
                          ({er.metodaTrimitere === 'curier' ? 'curier Maxari' : 'expediere'})
                        </span>
                      </div>
                    )}
                    <div className="os-sel-er-line">
                      <span className="os-sel-er-label">Inițiat:</span>
                      <strong>{new Date(er.createdAt).toLocaleDateString('ro-RO', { day: 'numeric', month: 'short', year: 'numeric' })}</strong>
                    </div>
                    <div className="os-sel-er-line">
                      <span className="os-sel-er-label">Total rambursat:</span>
                      <strong>{er.totalRefund.toFixed(2)} RON</strong>
                    </div>
                  </div>

                  <div className="os-sel-er-msg">
                    {er.status === 'FINALIZAT' ? (
                      <>✅ Returul a fost finalizat și suma a fost rambursată.</>
                    ) : er.status === 'PROCESAT' || er.status === 'COLET_PRIMIT' ? (
                      <>📦 Coletul a fost primit la noi și e în procesare.</>
                    ) : (
                      <>⏳ Returul este înregistrat. Așteptăm coletul tău.</>
                    )}
                  </div>

                  <div className="os-sel-er-actions">
                    <button
                      type="button"
                      onClick={() => handleDownloadReturnPdf(er.idRetur, order.sessionToken)}
                      className="os-sel-er-btn os-sel-er-btn-primary"
                    >
                      📄 Descarcă PDF retur
                    </button>
                    {cancellable && (
                      <button
                        type="button"
                        onClick={() => handleCancelReturn(order)}
                        disabled={isCancelling}
                        className="os-sel-er-btn os-sel-er-btn-danger"
                      >
                        {isCancelling ? 'Se anulează…' : '✖ Anulează retur'}
                      </button>
                    )}
                  </div>

                  {cancelLockedByAwb && (
                    <div className="os-sel-er-cancel-note">
                      Pentru anulare contactează-ne pe{' '}
                      <a href="mailto:info@maxari.ro?subject=Anulare%20retur" className="os-sel-er-cancel-link">
                        info@maxari.ro
                      </a>{' '}
                      — AWB-ul de curier e deja generat și anularea trebuie aprobată de noi.
                    </div>
                  )}
                </div>
              </div>
            )
          }

          return (
            <div
              key={order.id}
              role="button"
              tabIndex={0}
              onClick={() => setSelectedOrderId(order.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  setSelectedOrderId(order.id)
                }
              }}
              className={`os-sel-card ${isSelected ? 'os-sel-card-selected' : ''} os-sel-status-${order.eligibility.status}`}
            >
              {/* Radio indicator */}
              <div className={`os-sel-radio ${isSelected ? 'os-sel-radio-on' : ''}`} aria-hidden="true">
                {isSelected && <div className="os-sel-radio-dot" />}
              </div>

              <div className="os-sel-card-body">
                <div className="os-sel-card-top">
                  <div>
                    <h4 className="os-sel-order-number">Comandă {order.numarComanda}</h4>
                    <p className="os-sel-meta">
                      <span aria-hidden="true">📅</span> {new Date(order.dataComanda).toLocaleDateString('ro-RO', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </p>
                  </div>
                  <div
                    className="os-sel-pill"
                    style={{ backgroundColor: `${ledColor}1a`, color: ledColor, borderColor: `${ledColor}55` }}
                  >
                    <span className="os-sel-pill-dot" style={{ backgroundColor: ledColor }} />
                    {statusLabel(order.eligibility.status)}
                  </div>
                </div>

                {/* Thumbnails */}
                {thumbnails.length > 0 && (
                  <div className="os-sel-thumbs">
                    {thumbnails.map((p) => (
                      <div key={p.id} className="os-sel-thumb">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={p.imagine} alt={p.nume} loading="lazy" />
                      </div>
                    ))}
                    {remaining > 0 && (
                      <div className="os-sel-thumb os-sel-thumb-more">+{remaining}</div>
                    )}
                  </div>
                )}

                {/* Bottom info */}
                <div className="os-sel-card-bottom">
                  <span className="os-sel-bottom-item">
                    <span aria-hidden="true">📦</span>
                    {order.products.filter(p => !p.id.startsWith('shipping-')).length} produs(e)
                  </span>
                  <span className="os-sel-bottom-item os-sel-bottom-strong">
                    <span aria-hidden="true">💰</span>
                    {order.total.toFixed(2)} {order.currency}
                  </span>
                </div>

                {/* Eligibility line */}
                <div
                  className="os-sel-elig"
                  style={{
                    backgroundColor: `${ledColor}12`,
                    borderColor: `${ledColor}40`,
                    color: order.eligibility.status === 'expired' ? '#b91c1c' : order.eligibility.status === 'warning' ? '#b45309' : '#15803d',
                  }}
                >
                  <span aria-hidden="true">
                    {order.eligibility.status === 'expired' ? '⛔' : order.eligibility.status === 'warning' ? '⏰' : '✅'}
                  </span>
                  <span>{eligibilityText}</span>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {cancelError && (
        <div className="os-sel-cancel-error">⚠️ {cancelError}</div>
      )}

      <div className="os-sel-note">
        <strong>Notă:</strong> Dacă comanda nu e eligibilă, ne poți contacta pentru opțiuni extinse.
      </div>

      {(selectedOrderId || (allHaveReturns && onBack)) && (
        <div className="os-sel-actions">
          {onBack && (
            <button onClick={onBack} className="os-sel-back">← Caută altă comandă</button>
          )}
          {selectedOrderId && (
            <button onClick={handleContinue} className="os-sel-continue">
              Continuă
              <span className="os-sel-arrow" aria-hidden="true">→</span>
            </button>
          )}
        </div>
      )}

      {/* F4 — Modal de confirmare pentru comenzi expirate */}
      {showExpiredConfirm && selectedOrder && (
        <div className="os-modal-backdrop" onClick={() => setShowExpiredConfirm(false)}>
          <div className="os-modal" onClick={(e) => e.stopPropagation()}>
            <div className="os-modal-icon" aria-hidden="true">⚠️</div>
            <h3 className="os-modal-title">Termenul de retur a expirat</h3>
            <p className="os-modal-text">
              Comanda <strong>{selectedOrder.numarComanda}</strong> a depășit perioada de 15 zile pentru retur standard,
              așa că nu o putem procesa automat.
              <br /><br />
              Te rugăm să ne contactezi și să ne explici situația — echipa noastră va analiza cazul tău
              și îți va răspunde cât mai curând posibil.
            </p>
            <div className="os-modal-actions">
              <button onClick={() => setShowExpiredConfirm(false)} className="os-modal-cancel">
                Anulează
              </button>
              <button onClick={handleGoToContact} className="os-modal-confirm">
                Contactează-ne
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .os-sel-form {
          max-width: 560px;
          margin: 0 auto;
        }

        /* Header */
        .os-sel-header {
          text-align: center;
          margin-bottom: 24px;
        }
        .os-sel-header-icon {
          font-size: 38px;
          margin-bottom: 8px;
        }
        .os-sel-title {
          font-size: 22px;
          font-weight: 700;
          color: #1a1a1a;
          margin: 0 0 6px 0;
          letter-spacing: -0.02em;
        }
        .os-sel-subtitle {
          font-size: 14px;
          color: #6b7280;
          margin: 0;
        }
        @media (min-width: 481px) {
          .os-sel-title { font-size: 26px; }
          .os-sel-subtitle { font-size: 15px; }
        }

        /* List */
        .os-sel-list {
          display: flex;
          flex-direction: column;
          gap: 14px;
          margin-bottom: 18px;
        }

        /* Card */
        .os-sel-card {
          display: flex;
          gap: 14px;
          padding: 18px;
          background: #fff;
          border: 1.5px solid #e5e7eb;
          border-radius: 14px;
          cursor: pointer;
          transition: border-color 0.2s ease, background 0.2s ease, box-shadow 0.2s ease, transform 0.1s ease;
          outline: none;
        }
        .os-sel-card:hover {
          border-color: #26a69a;
          background: #fafafa;
        }
        .os-sel-card:focus-visible {
          box-shadow: 0 0 0 3px rgba(38, 166, 154, 0.25);
        }
        .os-sel-card-selected {
          border-color: #26a69a;
          background: linear-gradient(135deg, #f0fdfa 0%, #ffffff 100%);
          box-shadow: 0 4px 14px rgba(38, 166, 154, 0.15);
        }
        .os-sel-status-expired:not(.os-sel-card-selected) {
          opacity: 0.85;
        }

        /* Radio */
        .os-sel-radio {
          flex-shrink: 0;
          width: 22px;
          height: 22px;
          border: 2px solid #d1d5db;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s ease;
          margin-top: 2px;
        }
        .os-sel-radio-on {
          border-color: #26a69a;
        }
        .os-sel-radio-dot {
          width: 12px;
          height: 12px;
          border-radius: 50%;
          background: #26a69a;
          animation: os-sel-pop 0.2s ease;
        }

        /* Card body */
        .os-sel-card-body {
          flex: 1;
          min-width: 0;
        }
        .os-sel-card-top {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 12px;
          margin-bottom: 12px;
        }
        .os-sel-order-number {
          font-size: 16px;
          font-weight: 700;
          color: #111827;
          margin: 0 0 4px 0;
        }
        .os-sel-meta {
          font-size: 13px;
          color: #6b7280;
          margin: 0;
          display: flex;
          align-items: center;
          gap: 4px;
        }

        /* Pill */
        .os-sel-pill {
          flex-shrink: 0;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 5px 10px;
          border-radius: 999px;
          font-size: 12px;
          font-weight: 600;
          border: 1px solid;
        }
        .os-sel-pill-dot {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          box-shadow: 0 0 6px currentColor;
        }

        /* Thumbnails */
        .os-sel-thumbs {
          display: flex;
          gap: 6px;
          margin-bottom: 12px;
          flex-wrap: wrap;
        }
        .os-sel-thumb {
          width: 48px;
          height: 48px;
          border-radius: 8px;
          overflow: hidden;
          background: #f3f4f6;
          border: 1px solid #e5e7eb;
          flex-shrink: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 12px;
          font-weight: 600;
          color: #6b7280;
        }
        .os-sel-thumb img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        .os-sel-thumb-more {
          background: linear-gradient(135deg, #f3f4f6 0%, #e5e7eb 100%);
        }

        /* Bottom */
        .os-sel-card-bottom {
          display: flex;
          gap: 16px;
          margin-bottom: 10px;
          flex-wrap: wrap;
        }
        .os-sel-bottom-item {
          font-size: 13px;
          color: #4b5563;
          display: flex;
          align-items: center;
          gap: 4px;
        }
        .os-sel-bottom-strong {
          font-weight: 600;
          color: #111827;
        }

        /* Eligibility line */
        .os-sel-elig {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 9px 12px;
          border-radius: 8px;
          font-size: 13px;
          font-weight: 500;
          border: 1px solid;
        }

        /* Locked card (existing return) */
        .os-sel-card-locked {
          background: linear-gradient(135deg, #fafafa 0%, #f9fafb 100%);
          border-color: #e5e7eb;
          cursor: default;
        }
        .os-sel-card-locked:hover {
          border-color: #e5e7eb;
          background: linear-gradient(135deg, #fafafa 0%, #f9fafb 100%);
        }
        .os-sel-radio-locked {
          border-color: #cbd5e1;
          background: #f1f5f9;
        }
        .os-sel-er-info {
          display: grid;
          gap: 6px;
          margin: 6px 0 12px 0;
          padding: 12px 14px;
          background: #fff;
          border: 1px solid #e5e7eb;
          border-radius: 10px;
          font-size: 13px;
          color: #374151;
        }
        .os-sel-er-line {
          display: flex;
          gap: 8px;
          align-items: baseline;
          flex-wrap: wrap;
        }
        .os-sel-er-label {
          color: #6b7280;
          min-width: 110px;
        }
        .os-sel-er-line strong {
          color: #111827;
          font-weight: 600;
        }
        .os-sel-er-hint {
          color: #6b7280;
          font-size: 12px;
        }
        .os-sel-er-msg {
          padding: 9px 12px;
          border-radius: 8px;
          background: #f0fdfa;
          border: 1px solid #99f6e4;
          color: #115e59;
          font-size: 13px;
          font-weight: 500;
          margin-bottom: 12px;
        }
        .os-sel-er-actions {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }
        .os-sel-er-btn {
          flex: 1;
          min-width: 140px;
          padding: 10px 14px;
          border-radius: 9px;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.15s ease;
          border: 1.5px solid transparent;
        }
        .os-sel-er-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
        .os-sel-er-btn-primary {
          background: #fff;
          border-color: #26a69a;
          color: #0f766e;
        }
        .os-sel-er-btn-primary:hover:not(:disabled) {
          background: #f0fdfa;
        }
        .os-sel-er-btn-danger {
          background: #fff;
          border-color: #fca5a5;
          color: #b91c1c;
        }
        .os-sel-er-btn-danger:hover:not(:disabled) {
          background: #fef2f2;
        }
        .os-sel-er-cancel-note {
          margin-top: 10px;
          padding: 9px 12px;
          background: #fffbeb;
          border: 1px solid #fde68a;
          color: #854d0e;
          border-radius: 8px;
          font-size: 12.5px;
          line-height: 1.55;
        }
        .os-sel-er-cancel-link {
          color: #854d0e;
          font-weight: 600;
          text-decoration: underline;
        }
        .os-sel-cancel-error {
          padding: 10px 14px;
          background: #fef2f2;
          border: 1px solid #fecaca;
          color: #b91c1c;
          border-radius: 10px;
          font-size: 13px;
          margin-bottom: 14px;
        }

        /* Note */
        .os-sel-note {
          padding: 12px 14px;
          background: #f9fafb;
          border: 1px solid #f0f0f0;
          border-radius: 10px;
          font-size: 13px;
          color: #6b7280;
          margin-bottom: 18px;
        }

        /* Actions */
        .os-sel-actions {
          display: flex;
          gap: 12px;
          align-items: stretch;
        }
        .os-sel-back {
          padding: 13px 22px;
          border-radius: 10px;
          border: 1.5px solid #e5e7eb;
          background: #fff;
          color: #4b5563;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
        }
        .os-sel-back:hover {
          border-color: #26a69a;
          color: #26a69a;
        }
        .os-sel-continue {
          flex: 1;
          padding: 13px 22px;
          border-radius: 10px;
          border: none;
          background: linear-gradient(90deg, #2196f3 0%, #4caf50 100%);
          color: #fff;
          font-size: 15px;
          font-weight: 700;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          box-shadow: 0 4px 14px rgba(33, 150, 243, 0.25);
          transition: transform 0.15s ease, box-shadow 0.15s ease;
        }
        .os-sel-continue:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 22px rgba(33, 150, 243, 0.32);
        }
        .os-sel-arrow {
          font-size: 18px;
          transition: transform 0.2s ease;
        }
        .os-sel-continue:hover .os-sel-arrow { transform: translateX(4px); }

        /* Modal */
        .os-modal-backdrop {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.5);
          backdrop-filter: blur(4px);
          z-index: 1000;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
          animation: os-sel-fade 0.2s ease;
        }
        .os-modal {
          background: #fff;
          border-radius: 16px;
          padding: 28px;
          max-width: 420px;
          width: 100%;
          box-shadow: 0 20px 50px rgba(0, 0, 0, 0.3);
          text-align: center;
          animation: os-sel-pop 0.25s ease;
        }
        .os-modal-icon {
          font-size: 48px;
          margin-bottom: 12px;
        }
        .os-modal-title {
          font-size: 20px;
          font-weight: 700;
          color: #111827;
          margin: 0 0 12px 0;
        }
        .os-modal-text {
          font-size: 14px;
          color: #4b5563;
          line-height: 1.6;
          margin: 0 0 24px 0;
        }
        .os-modal-text strong {
          color: #111827;
        }
        .os-modal-actions {
          display: flex;
          gap: 10px;
        }
        .os-modal-cancel,
        .os-modal-confirm {
          flex: 1;
          padding: 12px;
          border-radius: 10px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
        }
        .os-modal-cancel {
          border: 1.5px solid #e5e7eb;
          background: #fff;
          color: #4b5563;
        }
        .os-modal-cancel:hover {
          border-color: #9ca3af;
          background: #f9fafb;
        }
        .os-modal-confirm {
          border: none;
          background: linear-gradient(90deg, #f97316 0%, #ef4444 100%);
          color: #fff;
          box-shadow: 0 4px 12px rgba(239, 68, 68, 0.3);
        }
        .os-modal-confirm:hover {
          transform: translateY(-1px);
          box-shadow: 0 6px 18px rgba(239, 68, 68, 0.4);
        }

        @keyframes os-sel-pop {
          from { opacity: 0; transform: scale(0.9); }
          to { opacity: 1; transform: scale(1); }
        }
        @keyframes os-sel-fade {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `}</style>
    </div>
  )
}
