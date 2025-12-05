'use client'

import { useState, FormEvent, ChangeEvent, useEffect } from 'react'
import { RefundData, OrderData, Product } from './ReturnProcess'
import { validateRomanianIBAN, formatIBAN } from '@/lib/iban-validator'

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
  
  // Inițializare: dacă există date inițiale, le folosim, altfel folosim valorile default
  const [metodaRambursare, setMetodaRambursare] = useState<'card' | 'cont'>(
    initialRefundData?.metodaRambursare || (wasPaidWithCard ? 'card' : 'cont')
  )
  const [iban, setIban] = useState(initialRefundData?.iban || '')
  const [numeTitular, setNumeTitular] = useState(initialRefundData?.numeTitular || '')
  const [ibanError, setIbanError] = useState<string | null>(null)
  const [numeTitularError, setNumeTitularError] = useState<string | null>(null)
  const [contulEsteAlMeu, setContulEsteAlMeu] = useState(initialRefundData?.contulEsteAlMeu ?? true)
  const [acordPrevederiLegale, setAcordPrevederiLegale] = useState(initialRefundData?.acordPrevederiLegale || false)
  const [refundPeCard, setRefundPeCard] = useState(wasPaidWithCard) // Preselectat dacă a fost plătit cu cardul

  // Efect pentru a actualiza starea când se schimbă wasPaidWithCard sau initialRefundData
  useEffect(() => {
    if (initialRefundData) {
      // Dacă avem date inițiale, le folosim
      setMetodaRambursare(initialRefundData.metodaRambursare || (wasPaidWithCard ? 'card' : 'cont'))
      setIban(initialRefundData.iban || '')
      setNumeTitular(initialRefundData.numeTitular || '')
      setContulEsteAlMeu(initialRefundData.contulEsteAlMeu ?? true)
      setAcordPrevederiLegale(initialRefundData.acordPrevederiLegale || false)
    } else if (wasPaidWithCard) {
      setMetodaRambursare('card')
      setRefundPeCard(true)
    } else {
      setMetodaRambursare('cont')
      setRefundPeCard(false)
    }
  }, [wasPaidWithCard, initialRefundData])

  // Calculează totalul pe baza cantității returnate (nu totale)
  const totalRefund = products.reduce((sum, p) => {
    const cantitateReturnata = p.cantitateReturnata || (p.selected ? p.cantitate : 0)
    return sum + (p.pret * cantitateReturnata)
  }, 0)

  const handleIbanChange = (e: ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.toUpperCase()
    // Limitează la 29 caractere (24 caractere IBAN + 5 spații)
    const limitedValue = value.slice(0, 29)
    setIban(limitedValue)
    // Nu validăm în timp real, doar la submit
    setIbanError(null)
  }


  // Validare nume titular: minim 3 caractere pentru nume și 3 pentru prenume
  const validateNumeTitular = (nume: string): { valid: boolean } => {
    const trimmed = nume.trim()
    if (trimmed.length === 0) {
      return { valid: false }
    }
    
    const parts = trimmed.split(/\s+/).filter(p => p.length > 0)
    if (parts.length < 2) {
      return { valid: false }
    }
    
    const numeFamilie = parts[0]
    const prenume = parts.slice(1).join(' ')
    
    if (numeFamilie.length < 3 || prenume.length < 3) {
      return { valid: false }
    }
    
    return { valid: true }
  }

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    
    // Validare IBAN DOAR la submit (nu în timp real)
    if (metodaRambursare === 'cont') {
      // Validare IBAN (acceptă atât cu spații cât și fără)
      const cleanIban = iban.replace(/\s/g, '').toUpperCase()
      const validation = validateRomanianIBAN(cleanIban)
      if (!validation.valid) {
        setIbanError(validation.error || 'IBAN invalid')
        return
      }
      
      // Validare nume titular DOAR la submit
      const numeValidation = validateNumeTitular(numeTitular)
      if (!numeValidation.valid) {
        setNumeTitularError('Nume incomplet')
        return
      } else {
        setNumeTitularError(null)
      }
      
      // Dacă contul nu este al clientului, trebuie să fie de acord cu prevederile legale
      if (!contulEsteAlMeu && !acordPrevederiLegale) {
        alert('Pentru transfer către altă persoană, trebuie să fiți de acord cu prevederile legale.')
        return
      }
    }
    
    const refundData: RefundData = {
      metodaRambursare,
      documente: [], // Nu mai folosim documente
      ...(metodaRambursare === 'cont' && {
        iban: iban.replace(/\s/g, ''), // IBAN fără spații
        numeTitular,
        contulEsteAlMeu,
        acordPrevederiLegale: !contulEsteAlMeu ? acordPrevederiLegale : undefined,
      }),
      ...(metodaRambursare === 'card' && wasPaidWithCard && {
        detaliiCard: 'refund_to_original_card',
      }),
    }

    onSubmit(refundData)
  }

  const generateDocument = () => {
    const content = `
CERERE DE RETUR
================

Date comandă:
- Nume: ${orderData?.nume}
- Număr comandă: ${orderData?.numarComanda}
- Telefon: ${orderData?.telefon}

Produse returnate:
${products.map(p => `- ${p.nume} (${p.cantitate} buc) - ${p.pret.toFixed(2)} RON${p.motivRetur ? ` - Motiv: ${p.motivRetur}` : ''}`).join('\n')}

Total rambursare: ${totalRefund.toFixed(2)} RON

Metodă rambursare: ${metodaRambursare === 'card' ? 'Card bancar' : 'Cont bancar'}
${metodaRambursare === 'cont' ? `IBAN: ${iban}\nNume titular: ${numeTitular}` : ''}

Data: ${new Date().toLocaleDateString('ro-RO')}
    `
    
    const blob = new Blob([content], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `cerere-retur-${orderData?.numarComanda}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <form onSubmit={handleSubmit} className="step-form-large">
      <h3 style={{
        fontSize: '20px',
        fontWeight: 'bold',
        marginBottom: '24px'
      }}>
        Date rambursare
      </h3>

      {/* Spațiu rezervat pentru erori */}
      <div style={{ minHeight: '40px', marginBottom: '16px' }}>
        {(ibanError || numeTitularError) && (
          <div style={{
            padding: '12px 16px',
            backgroundColor: '#ffebee',
            border: '1px solid #f44336',
            borderRadius: '8px',
            color: '#c62828',
            fontSize: '14px',
            marginBottom: '16px'
          }}>
            {ibanError || numeTitularError}
          </div>
        )}
      </div>

      {/* Tabel cu produsele selectate */}
      <div style={{
        marginBottom: '24px',
        overflowX: 'auto'
      }}>
        <h4 style={{
          fontSize: '16px',
          fontWeight: 'bold',
          marginBottom: '12px'
        }}>
          Produse selectate pentru retur
        </h4>
        <table style={{
          width: '100%',
          borderCollapse: 'collapse',
          backgroundColor: '#fff',
          borderRadius: '8px',
          overflow: 'hidden',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
        }}>
          <thead>
            <tr style={{
              backgroundColor: '#f5f5f5',
              borderBottom: '2px solid #e0e0e0'
            }}>
              <th style={{
                padding: '12px',
                textAlign: 'left',
                fontWeight: 'bold',
                fontSize: '14px',
                borderBottom: '1px solid #e0e0e0'
              }}>Produs</th>
              <th style={{
                padding: '12px',
                textAlign: 'center',
                fontWeight: 'bold',
                fontSize: '14px',
                borderBottom: '1px solid #e0e0e0'
              }}>Cantitate</th>
              <th style={{
                padding: '12px',
                textAlign: 'right',
                fontWeight: 'bold',
                fontSize: '14px',
                borderBottom: '1px solid #e0e0e0'
              }}>Preț unitar</th>
              <th style={{
                padding: '12px',
                textAlign: 'right',
                fontWeight: 'bold',
                fontSize: '14px',
                borderBottom: '1px solid #e0e0e0'
              }}>Total</th>
            </tr>
          </thead>
          <tbody>
            {products.map((product, index) => (
              <tr key={product.id} style={{
                borderBottom: index < products.length - 1 ? '1px solid #e0e0e0' : 'none'
              }}>
                <td style={{ padding: '12px', fontSize: '14px' }}>
                  {product.nume}
                  {product.motivRetur && product.motivRetur.trim().length > 0 && (
                    <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
                      Motiv: {product.motivRetur}
                    </div>
                  )}
                </td>
                <td style={{ padding: '12px', textAlign: 'center', fontSize: '14px' }}>
                  {product.cantitateReturnata || (product.selected ? product.cantitate : 0)} buc
                </td>
                <td style={{ padding: '12px', textAlign: 'right', fontSize: '14px' }}>
                  {product.pret.toFixed(2)} RON
                </td>
                <td style={{ padding: '12px', textAlign: 'right', fontSize: '14px', fontWeight: 'bold' }}>
                  {(product.pret * (product.cantitateReturnata || (product.selected ? product.cantitate : 0))).toFixed(2)} RON
                </td>
              </tr>
            ))}
            <tr style={{
              backgroundColor: '#f5f5f5',
              borderTop: '2px solid #e0e0e0'
            }}>
              <td colSpan={3} style={{
                padding: '12px',
                textAlign: 'right',
                fontWeight: 'bold',
                fontSize: '16px'
              }}>
                Total rambursare:
              </td>
              <td style={{
                padding: '12px',
                textAlign: 'right',
                fontWeight: 'bold',
                fontSize: '18px',
                color: '#26a69a'
              }}>
                {totalRefund.toFixed(2)} RON
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Metodă rambursare */}
      <div style={{ marginBottom: '24px' }}>
        <label style={{
          display: 'block',
          fontWeight: 'bold',
          marginBottom: '12px',
          fontSize: '14px'
        }}>
        Metodă rambursare *
        </label>
        
        {wasPaidWithCard ? (
          // Două opțiuni când comanda a fost plătită cu cardul
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {/* Opțiunea Card bancar (preselectată) */}
            <label
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                padding: '16px',
                borderRadius: '8px',
                border: metodaRambursare === 'card' ? '2px solid #26a69a' : '1px solid #e0e0e0',
                backgroundColor: metodaRambursare === 'card' ? '#e8f5e9' : '#f5f5f5',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
              onMouseOver={(e) => {
                if (metodaRambursare !== 'card') {
                  e.currentTarget.style.backgroundColor = '#f0f0f0'
                }
              }}
              onMouseOut={(e) => {
                if (metodaRambursare !== 'card') {
                  e.currentTarget.style.backgroundColor = '#f5f5f5'
                }
              }}
            >
              <input
                type="radio"
                name="metodaRambursare"
                value="card"
                checked={metodaRambursare === 'card'}
                onChange={(e) => {
                  setMetodaRambursare('card')
                  setRefundPeCard(true)
                }}
                style={{
                  marginRight: '12px',
                  marginTop: '2px',
                  width: '20px',
                  height: '20px',
                  cursor: 'pointer'
                }}
              />
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#26a69a" strokeWidth="2">
                    <rect x="1" y="4" width="22" height="16" rx="2" ry="2"/>
                    <line x1="1" y1="10" x2="23" y2="10"/>
                  </svg>
                  <span style={{ fontSize: '16px', fontWeight: 'bold', color: '#26a69a' }}>
                    Card bancar
                  </span>
                </div>
                <p style={{
                  fontSize: '14px',
                  color: '#666',
                  marginTop: '4px',
                  marginLeft: '32px'
                }}>
                  Refund direct pe cardul folosit la comandă. Rambursarea se va face automat pe cardul original.
                </p>
              </div>
            </label>

            {/* Opțiunea Cont bancar */}
            <label
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                padding: '16px',
                borderRadius: '8px',
                border: metodaRambursare === 'cont' ? '2px solid #26a69a' : '1px solid #e0e0e0',
                backgroundColor: metodaRambursare === 'cont' ? '#e8f5e9' : '#f5f5f5',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
              onMouseOver={(e) => {
                if (metodaRambursare !== 'cont') {
                  e.currentTarget.style.backgroundColor = '#f0f0f0'
                }
              }}
              onMouseOut={(e) => {
                if (metodaRambursare !== 'cont') {
                  e.currentTarget.style.backgroundColor = '#f5f5f5'
                }
              }}
            >
              <input
                type="radio"
                name="metodaRambursare"
                value="cont"
                checked={metodaRambursare === 'cont'}
                onChange={(e) => {
                  setMetodaRambursare('cont')
                  setRefundPeCard(false)
                }}
                style={{
                  marginRight: '12px',
                  marginTop: '2px',
                  width: '20px',
                  height: '20px',
                  cursor: 'pointer'
                }}
              />
              <div style={{ flex: 1 }}>
                <span style={{ fontSize: '16px', fontWeight: 'bold' }}>
                  Cont bancar
                </span>
                <p style={{
                  fontSize: '14px',
                  color: '#666',
                  marginTop: '4px'
                }}>
                  Rambursarea se va face prin transfer bancar în contul indicat mai jos.
                </p>
              </div>
            </label>
          </div>
        ) : (
          // Doar cont bancar când comanda NU a fost plătită cu cardul
          <div style={{
            padding: '16px',
            backgroundColor: '#f5f5f5',
            borderRadius: '8px',
            border: '1px solid #e0e0e0'
          }}>
            <span style={{ fontSize: '16px', fontWeight: 'bold' }}>Cont bancar</span>
            <p style={{
              fontSize: '14px',
              color: '#666',
              marginTop: '8px'
            }}>
              Rambursarea se va face prin transfer bancar în contul indicat mai jos.
            </p>
          </div>
        )}
      </div>

      {/* Detalii cont bancar - afișat doar când se selectează cont bancar */}
      {metodaRambursare === 'cont' && (
        <>
              {/* Notificare discretă când comanda a fost plătită cu cardul */}
              {wasPaidWithCard && (
                <div style={{
                  marginBottom: '20px',
                  padding: '12px 16px',
                  backgroundColor: '#e3f2fd',
                  border: '1px solid #90caf9',
                  borderRadius: '8px',
                  fontSize: '14px',
                  color: '#1565c0',
                  lineHeight: '1.5'
                }}>
                  <strong>ℹ️ Informație:</strong> Am observat că această comandă a fost plătită cu cardul. Dacă dorești, poți alege transfer bancar în contul indicat mai jos.
                </div>
              )}

              <div style={{ marginBottom: '24px' }}>
                <label style={{
                  display: 'block',
                  fontWeight: 'bold',
                  marginBottom: '8px',
                  fontSize: '14px'
                }}>
                  IBAN
                </label>
                <input
                  type="text"
                  value={iban}
                  onChange={handleIbanChange}
                  placeholder="ROxxxxxxxxxxx"
                  required
                  maxLength={34} // Permite atât cu spații cât și fără
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    borderRadius: '8px',
                    border: ibanError ? '2px solid #f44336' : '1px solid #e0e0e0',
                    fontSize: '14px',
                    outline: 'none',
                    fontFamily: 'monospace',
                    letterSpacing: '1px'
                  }}
                />
                {ibanError && (
                  <p style={{
                    fontSize: '12px',
                    color: '#f44336',
                    marginTop: '4px'
                  }}>
                    {ibanError}
                  </p>
                )}
              </div>

              <div style={{ marginBottom: '24px' }}>
                <label style={{
                  display: 'block',
                  fontWeight: 'bold',
                  marginBottom: '8px',
                  fontSize: '14px'
                }}>
                  Titularul contului (obligatoriu)
                </label>
                <input
                  type="text"
                  value={numeTitular}
                  onChange={(e) => {
                    setNumeTitular(e.target.value)
                    // Șterge eroarea când utilizatorul începe să scrie
                    if (numeTitularError) {
                      setNumeTitularError(null)
                    }
                  }}
                  placeholder="Nume complet al titularului contului"
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    borderRadius: '8px',
                    border: numeTitularError ? '1px solid #f44336' : '1px solid #e0e0e0',
                    fontSize: '14px',
                    outline: 'none'
                  }}
                />
                {numeTitularError && (
                  <p style={{
                    color: '#f44336',
                    fontSize: '12px',
                    marginTop: '4px',
                    marginBottom: 0
                  }}>
                    {numeTitularError}
                  </p>
                )}
              </div>

              {/* Checkbox: Contul este al meu sau al altcuiva */}
              <div style={{ marginBottom: '24px' }}>
                <label style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  cursor: 'pointer',
                  padding: '12px',
                  border: '1px solid #e0e0e0',
                  borderRadius: '8px',
                  backgroundColor: '#fff'
                }}>
                  <input
                    type="checkbox"
                    checked={contulEsteAlMeu}
                    onChange={(e) => {
                      setContulEsteAlMeu(e.target.checked)
                      if (e.target.checked) {
                        setAcordPrevederiLegale(false)
                        // Preumple numele din comandă dacă este disponibil
                        if (orderData?.nume) {
                          setNumeTitular(orderData.nume)
                        }
                      }
                    }}
                    style={{
                      marginRight: '12px',
                      marginTop: '2px',
                      width: '20px',
                      height: '20px',
                      cursor: 'pointer'
                    }}
                  />
                  <div style={{ flex: 1 }}>
                    <span style={{ fontSize: '14px', fontWeight: 'bold' }}>
                      Contul este al meu ({orderData?.nume || 'N/A'})
                    </span>
                  </div>
                </label>

                <label style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  cursor: 'pointer',
                  padding: '12px',
                  border: '1px solid #e0e0e0',
                  borderRadius: '8px',
                  backgroundColor: '#fff',
                  marginTop: '8px'
                }}>
                  <input
                    type="checkbox"
                    checked={!contulEsteAlMeu}
                    onChange={(e) => {
                      setContulEsteAlMeu(!e.target.checked)
                      if (e.target.checked) {
                        setNumeTitular('')
                      }
                    }}
                    style={{
                      marginRight: '12px',
                      marginTop: '2px',
                      width: '20px',
                      height: '20px',
                      cursor: 'pointer'
                    }}
                  />
                  <div style={{ flex: 1 }}>
                    <span style={{ fontSize: '14px', fontWeight: 'bold' }}>
                      Transfer către altă persoană
                    </span>
                  </div>
                </label>
              </div>

              {/* Acord prevederi legale pentru transfer către altă persoană */}
              {!contulEsteAlMeu && (
                <div style={{
                  marginBottom: '24px',
                  padding: '16px',
                  backgroundColor: '#fff3e0',
                  border: '1px solid #ff9800',
                  borderRadius: '8px'
                }}>
                  <label style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    cursor: 'pointer'
                  }}>
                    <input
                      type="checkbox"
                      checked={acordPrevederiLegale}
                      onChange={(e) => setAcordPrevederiLegale(e.target.checked)}
                      required={!contulEsteAlMeu}
                      style={{
                        marginRight: '12px',
                        marginTop: '2px',
                        width: '20px',
                        height: '20px',
                        cursor: 'pointer'
                      }}
                    />
                    <div style={{ flex: 1 }}>
                      <span style={{ fontSize: '14px', fontWeight: 'bold', color: '#e65100' }}>
                        Sunt de acord cu toate prevederile legale *
                      </span>
                      <p style={{
                        fontSize: '12px',
                        color: '#666',
                        marginTop: '4px'
                      }}>
                        Confirm că transferul către o altă persoană este efectuat în conformitate cu legislația în vigoare 
                        și sunt de acord cu toate prevederile legale aplicabile.
                      </p>
                    </div>
                  </label>
                </div>
              )}
          </>
      )}


      {/* Butoane navigare */}
      <div style={{
        display: 'flex',
        gap: '12px'
      }}>
        <button
          type="button"
          onClick={onBack}
          style={{
            flex: 1,
            padding: '16px',
            borderRadius: '8px',
            backgroundColor: '#e0e0e0',
            color: '#333',
            border: 'none',
            fontSize: '16px',
            fontWeight: 'bold',
            cursor: 'pointer',
            transition: 'background-color 0.2s ease'
          }}
          onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#d0d0d0'}
          onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#e0e0e0'}
        >
          ÎNAPOI
        </button>
        <button
          type="submit"
          style={{
            flex: 1,
            padding: '16px',
            borderRadius: '8px',
            background: 'linear-gradient(90deg, #2196F3 0%, #4CAF50 100%)',
            color: '#fff',
            border: 'none',
            fontSize: '16px',
            fontWeight: 'bold',
            textTransform: 'uppercase',
            cursor: 'pointer',
            transition: 'transform 0.2s ease, box-shadow 0.2s ease'
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.transform = 'translateY(-2px)'
            e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)'
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.transform = 'translateY(0)'
            e.currentTarget.style.boxShadow = 'none'
          }}
        >
          CONTINUĂ
        </button>
      </div>
    </form>
  )
}
