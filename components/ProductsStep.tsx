'use client'

import { useState, FormEvent, useEffect } from 'react'
import { Product } from './ReturnProcess'

interface ProductsStepProps {
  products: Product[]
  onSubmit: (products: Product[]) => void
  onBack: () => void
}

const motivuriRetur = [
  'Produs necorespunzător/greșit',
  'Produs defect',
  'Nu corespunde așteptărilor',
  'Alte motive'
]

export default function ProductsStep({ products, onSubmit, onBack }: ProductsStepProps) {
  const [excludedSKUs, setExcludedSKUs] = useState<string[]>(['RMA-009', 'RMA-025'])
  const [error, setError] = useState<string | null>(null)
  
  // Produsele NU sunt selectate default - trebuie selectate manual
  const [selectedProducts, setSelectedProducts] = useState<Product[]>(
    products.map(p => ({ 
      ...p, 
      selected: false, // Nu sunt selectate default
      cantitateReturnata: 0, // Cantitatea selectată pentru retur (0 = neselectat)
      alteMotive: p.alteMotive || '' // Câmp pentru "Alte motive"
    }))
  )

  // Încarcă SKU-urile excluse din configurație
  useEffect(() => {
    fetch('/api/config/excluded-skus')
      .then(res => res.json())
      .then(data => {
        if (data.success && data.excludedSKUs) {
          setExcludedSKUs(data.excludedSKUs)
        }
      })
      .catch(error => {
        console.error('Error loading excluded SKUs:', error)
        // Folosește valorile default dacă API-ul eșuează
      })
  }, [])

  const handleProductChange = (productId: string, field: keyof Product, value: any) => {
    setSelectedProducts(prev => prev.map(p => 
      p.id === productId ? { ...p, [field]: value } : p
    ))
  }

  const toggleProduct = (productId: string) => {
    setSelectedProducts(prev => prev.map(p => {
      if (p.id === productId) {
        const newSelected = !(p.selected ?? false)
        // Când selectezi, setează cantitatea returnată la cantitatea disponibilă sau 1
        const cantitateReturnata = newSelected ? (p.cantitate || 1) : 0
        return { 
          ...p, 
          selected: newSelected,
          cantitateReturnata: cantitateReturnata,
          // Setează automat motivRetur la '' când se selectează produsul
          motivRetur: newSelected ? '' : p.motivRetur
        }
      }
      return p
    }))
  }

  const handleQuantityChange = (productId: string, newQuantity: number) => {
    setSelectedProducts(prev => prev.map(p => {
      if (p.id === productId) {
        const quantity = Math.max(0, Math.min(newQuantity, p.cantitate)) // Limitează între 0 și cantitatea disponibilă
        return { 
          ...p, 
          cantitateReturnata: quantity,
          selected: quantity > 0 // Selectat dacă cantitatea > 0
        }
      }
      return p
    }))
  }

  // Verifică dacă un produs este transport (nu necesită motiv retur)
  const isTransport = (product: Product) => {
    // Verifică dacă numele produsului conține cuvinte cheie pentru transport
    const transportKeywords = ['transport', 'livrare', 'shipping', 'delivery', 'curier', 'standard', 'serviciu']
    const productName = product.nume.toLowerCase()
    return transportKeywords.some(keyword => productName.includes(keyword))
  }

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    
    // Verifică dacă există produse selectate
    const hasSelectedProducts = selectedProducts.some(p => {
      if (!p.selected) return false
      const cantitateReturnata = p.cantitateReturnata || (p.selected ? (p.cantitate || 1) : 0)
      return cantitateReturnata > 0
    })
    
    if (!hasSelectedProducts) {
      setError('Vă rugăm să selectați cel puțin un produs pentru retur.')
      return
    }
    
    // Filtrează produsele selectate (cu cantitate > 0) - motivul retur nu mai este obligatoriu
    const productsToReturn = selectedProducts.filter(p => {
      if (!p.selected) return false
      const cantitateReturnata = p.cantitateReturnata || (p.selected ? (p.cantitate || 1) : 0)
      return cantitateReturnata > 0
    })
    
    // Asigură-te că toate produsele au cantitateReturnata setată corect
    const productsWithQuantity = productsToReturn.map(p => ({
      ...p,
      cantitateReturnata: p.cantitateReturnata || (p.selected ? (p.cantitate || 1) : 0),
      // Păstrează motivRetur doar dacă există, altfel lasă-l gol
      motivRetur: p.motivRetur || ''
    }))
    onSubmit(productsWithQuantity)
  }

  // Verifică dacă un produs poate fi returnat (nu este în lista de excludere)
  const canReturnProduct = (product: Product) => {
    if (!product.sku) return true // Dacă nu are SKU, poate fi returnat
    return !excludedSKUs.includes(product.sku.toUpperCase())
  }

  // Sortează produsele: restricționate (portocaliu) la final
  const sortedProducts = [...selectedProducts].sort((a, b) => {
    const aCanReturn = canReturnProduct(a)
    const bCanReturn = canReturnProduct(b)
    if (aCanReturn && !bCanReturn) return -1 // A poate fi returnat, B nu → A înainte
    if (!aCanReturn && bCanReturn) return 1  // A nu poate fi returnat, B da → B înainte
    return 0 // Ambele la fel → păstrează ordinea
  })

  // Redenumește transportul
  const normalizeProductName = (name: string) => {
    const transportKeywords = ['transport', 'livrare', 'shipping', 'delivery', 'curier', 'standard']
    const lowerName = name.toLowerCase()
    if (transportKeywords.some(keyword => lowerName.includes(keyword))) {
      return 'Transport / Serviciu de livrare'
    }
    return name
  }

  return (
    <form onSubmit={handleSubmit} className="step-form-large">
      <h3 style={{
        fontSize: '20px',
        fontWeight: 'bold',
        marginBottom: '24px'
      }}>
        Selectează produsele pentru retur
      </h3>

      {/* Spațiu rezervat pentru erori */}
      <div style={{ minHeight: '40px', marginBottom: '16px' }}>
        {error && (
          <div style={{
            marginTop: '24px',
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

      {sortedProducts.map((product) => {
        const canReturn = canReturnProduct(product)
        
        return (
          <div
            key={product.id}
            style={{
              border: canReturn ? '1px solid #e0e0e0' : '1px solid #ff9800',
              borderRadius: '8px',
              padding: '20px',
              marginBottom: '16px',
              backgroundColor: canReturn ? '#fafafa' : '#fff3e0',
              opacity: canReturn ? 1 : 0.7
            }}
          >
            {!canReturn && (
              <div style={{
                padding: '8px 12px',
                backgroundColor: '#ff9800',
                color: '#fff',
                borderRadius: '6px',
                marginBottom: '12px',
                fontSize: '14px',
                fontWeight: 'bold'
              }}>
                ⚠️ Această taxă nu poate fi returnată
              </div>
            )}

            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              marginBottom: '12px'
            }}>
              <div style={{ flex: 1 }}>
                <h4 style={{
                  fontSize: '16px',
                  fontWeight: 'bold',
                  marginBottom: '8px'
                }}>
                  {normalizeProductName(product.nume)}
                </h4>
                <p style={{ fontSize: '14px', color: '#666' }}>
                  Cantitate: {product.cantitate} buc
                </p>
                <p style={{ fontSize: '14px', color: '#666' }}>
                  Preț: {product.pret.toFixed(2)} RON
                </p>
                {product.sku && (
                  <p style={{ fontSize: '12px', color: '#999', marginTop: '4px' }}>
                    SKU: {product.sku}
                  </p>
                )}
              </div>
              {canReturn && (
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'flex-end',
                  gap: '8px'
                }}>
                  <label style={{
                    display: 'flex',
                    alignItems: 'center',
                    cursor: 'pointer'
                  }}>
                    <input
                      type="checkbox"
                      checked={product.selected ?? false}
                      onChange={() => toggleProduct(product.id)}
                      disabled={!canReturn}
                      style={{
                        width: '20px',
                        height: '20px',
                        cursor: canReturn ? 'pointer' : 'not-allowed'
                      }}
                    />
                  </label>
                  {product.selected && product.cantitate > 1 && (
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}>
                      <label style={{
                        fontSize: '12px',
                        color: '#666',
                        fontWeight: 'bold'
                      }}>
                        Cantitate:
                      </label>
                      <input
                        type="number"
                        min="1"
                        max={product.cantitate}
                        value={product.cantitateReturnata || 1}
                        onChange={(e) => handleQuantityChange(product.id, parseInt(e.target.value) || 1)}
                        style={{
                          width: '60px',
                          padding: '4px 8px',
                          borderRadius: '4px',
                          border: '1px solid #e0e0e0',
                          fontSize: '14px',
                          textAlign: 'center'
                        }}
                      />
                      <span style={{
                        fontSize: '12px',
                        color: '#666'
                      }}>
                        / {product.cantitate}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {product.selected && canReturn && !isTransport({ ...product, nume: normalizeProductName(product.nume) }) && (
              <div style={{ marginTop: '12px' }}>
                <label style={{
                  display: 'block',
                  fontWeight: 'bold',
                  marginBottom: '8px',
                  fontSize: '14px'
                }}>
                  Motiv retur
                </label>
                <select
                  value={product.motivRetur || ''}
                  onChange={(e) => handleProductChange(product.id, 'motivRetur', e.target.value)}
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    borderRadius: '8px',
                    border: (!product.motivRetur || product.motivRetur.length === 0) && product.selected && error
                      ? '1px solid #f44336' 
                      : '1px solid #e0e0e0',
                    fontSize: '14px',
                    outline: 'none',
                    backgroundColor: '#fff'
                  }}
                >
                  <option value="">Selectează motivul...</option>
                  {motivuriRetur.map(motiv => (
                    <option key={motiv} value={motiv}>{motiv}</option>
                  ))}
                </select>

                {/* Câmp text pentru "Alte motive" */}
                {product.motivRetur === 'Alte motive' && (
                  <div style={{ marginTop: '12px' }}>
                    <label style={{
                      display: 'block',
                      fontWeight: 'bold',
                      marginBottom: '8px',
                      fontSize: '14px'
                    }}>
                      Specificați motivul
                    </label>
                    <textarea
                      value={product.alteMotive || ''}
                      onChange={(e) => handleProductChange(product.id, 'alteMotive', e.target.value)}
                      placeholder="Descrieți motivul returului..."
                      rows={3}
                      style={{
                        width: '100%',
                        padding: '12px 16px',
                        borderRadius: '8px',
                        border: '1px solid #e0e0e0',
                        fontSize: '14px',
                        outline: 'none',
                        resize: 'vertical'
                      }}
                    />
                  </div>
                )}
              </div>
            )}

            {/* Transport - nu afișăm nimic, doar rămâne selectat */}
          </div>
        )
      })}

      {/* Afișare eroare inline */}
      <div style={{
        display: 'flex',
        gap: '12px',
        marginTop: '24px'
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

