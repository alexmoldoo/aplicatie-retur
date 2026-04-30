'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { getLedColor } from '@/lib/eligibility'

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
  const defaultOrder = orders.find(o => o.eligibility.status === 'eligible') || orders[0]
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(
    defaultOrder ? defaultOrder.id : null
  )
  const [showExpiredConfirm, setShowExpiredConfirm] = useState(false)

  useEffect(() => {
    if (defaultOrder && selectedOrderId === null) {
      setSelectedOrderId(defaultOrder.id)
    }
  }, [orders.length])

  const selectedOrder = orders.find(o => o.id === selectedOrderId)

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

  return (
    <div className="step-container os-sel-form">
      <div className="os-sel-header">
        <div className="os-sel-header-icon" aria-hidden="true">📋</div>
        <h2 className="os-sel-title">
          {orders.length === 1 ? 'Comanda găsită' : `Am găsit ${orders.length} comenzi`}
        </h2>
        <p className="os-sel-subtitle">
          {orders.length === 1
            ? 'Verifică detaliile și continuă procesul de retur.'
            : 'Alege comanda pentru care vrei să inițiezi returul.'}
        </p>
      </div>

      <div className="os-sel-list">
        {orders.map((order) => {
          const ledColor = getLedColor(order.eligibility.status)
          const isSelected = selectedOrderId === order.id
          const eligibilityText = getEligibilityText(order)
          // F1 — thumbnails: ia primele 4 imagini unice
          const thumbnails = order.products
            .filter(p => p.imagine && !p.id.startsWith('shipping-'))
            .slice(0, 4)
          const remaining = order.products.filter(p => !p.id.startsWith('shipping-')).length - thumbnails.length

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

      <div className="os-sel-note">
        <strong>Notă:</strong> Dacă comanda nu e eligibilă, ne poți contacta pentru opțiuni extinse.
      </div>

      {selectedOrderId && (
        <div className="os-sel-actions">
          {onBack && (
            <button onClick={onBack} className="os-sel-back">← Înapoi</button>
          )}
          <button onClick={handleContinue} className="os-sel-continue">
            Continuă
            <span className="os-sel-arrow" aria-hidden="true">→</span>
          </button>
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
