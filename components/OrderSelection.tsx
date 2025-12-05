'use client'

import { useState, useEffect } from 'react'
import { getLedColor } from '@/lib/eligibility'
import { OrderData } from './ReturnProcess'

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
  onBack?: () => void // Buton înapoi
}

export default function OrderSelection({ orders, onSelectOrder, onBack }: OrderSelectionProps) {
  // Selectează default prima comandă eligibilă, sau prima comandă dacă nu există eligibile
  const defaultOrder = orders.find(o => o.eligibility.status === 'eligible') || orders[0]
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(
    defaultOrder ? defaultOrder.id : null
  )

  useEffect(() => {
    // Selectează default prima comandă eligibilă sau prima comandă (dar NU trece automat)
    if (defaultOrder && selectedOrderId === null) {
      setSelectedOrderId(defaultOrder.id)
    }
  }, [orders.length])

  const handleSelectOrder = (order: Order) => {
    // Doar selectează comanda, NU trece automat la step 3
    setSelectedOrderId(order.id)
    // NU apelăm onSelectOrder aici - doar când se apasă "Continuă"
  }

  const handleContinue = () => {
    // Când se apasă "Continuă", trimite comanda selectată
    const selected = orders.find(o => o.id === selectedOrderId)
    if (selected) {
      onSelectOrder(selected)
    }
  }

  return (
    <div className="step-container">
      <h3 style={{
        fontSize: '20px',
        fontWeight: 'bold',
        marginBottom: '24px'
      }}>
        {orders.length === 1 
          ? 'Comanda găsită' 
          : `Am găsit ${orders.length} comenzi`}
      </h3>

      {orders.length === 1 && orders[0].eligibility.status === 'eligible' && (
        <div style={{
          padding: '16px',
          backgroundColor: '#e8f5e9',
          border: '1px solid #4CAF50',
          borderRadius: '8px',
          marginBottom: '24px',
          fontSize: '14px',
          color: '#2e7d32'
        }}>
          Această comandă este eligibilă pentru returul standard de 15 zile de la primire.
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {orders.map((order) => {
          const ledColor = getLedColor(order.eligibility.status)
          const isSelected = selectedOrderId === order.id

          return (
            <div
              key={order.id}
              onClick={() => {
                // Doar selectează comanda, nu trece automat
                setSelectedOrderId(order.id)
              }}
              style={{
                border: `2px solid ${isSelected ? '#26a69a' : '#e0e0e0'}`,
                borderRadius: '12px',
                padding: '20px',
                backgroundColor: isSelected ? '#f5f5f5' : '#fff',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                position: 'relative'
              }}
              onMouseOver={(e) => {
                if (!isSelected) {
                  e.currentTarget.style.borderColor = '#26a69a'
                  e.currentTarget.style.backgroundColor = '#fafafa'
                }
              }}
              onMouseOut={(e) => {
                if (!isSelected) {
                  e.currentTarget.style.borderColor = '#e0e0e0'
                  e.currentTarget.style.backgroundColor = '#fff'
                }
              }}
            >
              {/* Led indicator */}
              <div style={{
                position: 'absolute',
                top: '20px',
                left: '20px',
                width: '12px',
                height: '12px',
                borderRadius: '50%',
                backgroundColor: ledColor,
                boxShadow: `0 0 8px ${ledColor}`,
              }} />

              <div style={{ marginLeft: '24px' }}>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  marginBottom: '12px'
                }}>
                  <div>
                    <h4 style={{
                      fontSize: '18px',
                      fontWeight: 'bold',
                      marginBottom: '4px'
                    }}>
                      Comandă {order.numarComanda}
                    </h4>
                    <p style={{ fontSize: '14px', color: '#666' }}>
                      Plasată pe: {new Date(order.dataComanda).toLocaleDateString('ro-RO')}
                    </p>
                    <p style={{ fontSize: '14px', color: '#666' }}>
                      {order.products.length} produs(e) • Total: {order.total.toFixed(2)} {order.currency}
                    </p>
                  </div>
                </div>

                {/* Mesaj eligibilitate */}
                {order.eligibility.status === 'expired' && (
                  <div style={{
                    padding: '12px',
                    backgroundColor: '#ffebee',
                    border: '1px solid #f44336',
                    borderRadius: '8px',
                    marginTop: '12px',
                    fontSize: '14px',
                    color: '#c62828'
                  }}>
                    <strong>{order.eligibility.message}</strong>
                    <br />
                    Vă rugăm să ne contactați pentru eligibilitate extinsă.
                  </div>
                )}

                {order.eligibility.status === 'warning' && (
                  <div style={{
                    padding: '12px',
                    backgroundColor: '#fff8e1',
                    border: '1px solid #FFC107',
                    borderRadius: '8px',
                    marginTop: '12px',
                    fontSize: '14px',
                    color: '#f57c00'
                  }}>
                    <strong>{order.eligibility.message}</strong>
                  </div>
                )}

                {order.eligibility.status === 'eligible' && (
                  <div style={{
                    padding: '12px',
                    backgroundColor: '#e8f5e9',
                    border: '1px solid #4CAF50',
                    borderRadius: '8px',
                    marginTop: '12px',
                    fontSize: '14px',
                    color: '#2e7d32'
                  }}>
                    Eligibil pentru retur
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      <div style={{
        marginTop: '24px',
        padding: '16px',
        backgroundColor: '#f5f5f5',
        borderRadius: '8px',
        fontSize: '14px',
        color: '#666'
      }}>
        <strong>Notă:</strong> Dacă comanda nu este eligibilă pentru retur, vă rugăm să ne contactați pentru a discuta opțiunile disponibile.
      </div>

      {/* Buton Continuă (dacă o comandă este selectată) */}
      {selectedOrderId && (
        <div style={{ marginTop: '24px', display: 'flex', gap: '12px', justifyContent: 'space-between' }}>
          {onBack && (
            <button
              onClick={onBack}
              style={{
                padding: '12px 24px',
                borderRadius: '8px',
                border: '1px solid #e0e0e0',
                backgroundColor: '#fff',
                color: '#666',
                fontSize: '14px',
                fontWeight: 'bold',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.borderColor = '#26a69a'
                e.currentTarget.style.color = '#26a69a'
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.borderColor = '#e0e0e0'
                e.currentTarget.style.color = '#666'
              }}
            >
              Înapoi
            </button>
          )}
          <button
            onClick={handleContinue}
            style={{
              padding: '12px 24px',
              borderRadius: '8px',
              background: 'linear-gradient(90deg, #2196F3 0%, #4CAF50 100%)',
              color: '#fff',
              border: 'none',
              fontSize: '14px',
              fontWeight: 'bold',
              cursor: 'pointer',
              transition: 'opacity 0.2s ease',
              flex: 1,
              marginLeft: onBack ? '12px' : '0'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.opacity = '0.9'
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.opacity = '1'
            }}
          >
            Continuă
          </button>
        </div>
      )}
    </div>
  )
}

