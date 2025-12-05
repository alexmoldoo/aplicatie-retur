'use client'

import { useState, useEffect, FormEvent } from 'react'

interface AdminDashboardProps {
  onLogout: () => void
}

export default function AdminDashboard({ onLogout }: AdminDashboardProps) {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  
  const [shopifyDomain, setShopifyDomain] = useState('')
  const [shopifyAccessToken, setShopifyAccessToken] = useState('')
  const [shopTitle, setShopTitle] = useState('')
  const [isShopifyConnected, setIsShopifyConnected] = useState(false)
  const [showShopifyEdit, setShowShopifyEdit] = useState(false)
  const [excludedSKUs, setExcludedSKUs] = useState<string[]>(['RMA-009', 'RMA-025'])
  const [newSKU, setNewSKU] = useState('')
  
  // Returns state
  const [returns, setReturns] = useState<any[]>([])
  const [returnsLoading, setReturnsLoading] = useState(false)
  const [selectedStatus, setSelectedStatus] = useState<string>('')
  const [searchQuery, setSearchQuery] = useState('')
  const [activeTab, setActiveTab] = useState<'config' | 'returns'>('config')

  useEffect(() => {
    loadConfig()
  }, [])

  // Încarcă retururile când se schimbă tab-ul la 'returns'
  useEffect(() => {
    if (activeTab === 'returns') {
      loadReturns()
    }
  }, [activeTab, selectedStatus])

  const loadConfig = async () => {
    try {
      const response = await fetch('/api/config')
      const data = await response.json()
      
      if (data.success) {
        setShopifyDomain(data.config.shopify.domain || '')
        setShopTitle(data.config.shopify.shopTitle || '')
        setExcludedSKUs(data.config.excludedSKUs || ['RMA-009', 'RMA-025'])
        
        // Verifică dacă Shopify este conectat
        const connected = data.config.shopify.accessTokenConfigured && 
                         data.config.shopify.domain && 
                         data.config.shopify.shopTitle
        setIsShopifyConnected(connected)
      }
    } catch (error) {
      setError('Eroare la încărcarea configurației')
    } finally {
      setLoading(false)
    }
  }

  const loadReturns = async () => {
    setReturnsLoading(true)
    setError(null)
    
    try {
      // Construiește URL-ul cu parametrii de filtrare
      const params = new URLSearchParams()
      if (selectedStatus) {
        params.append('status', selectedStatus)
      }
      
      const url = `/api/returns${params.toString() ? `?${params.toString()}` : ''}`
      const response = await fetch(url)
      const data = await response.json()
      
      if (data.success) {
        let filteredReturns = data.returns || []
        
        // Aplică filtrarea după search query dacă există
        if (searchQuery.trim()) {
          const query = searchQuery.toLowerCase().trim()
          filteredReturns = filteredReturns.filter((ret: any) => 
            ret.idRetur.toLowerCase().includes(query) ||
            ret.numarComanda.toLowerCase().includes(query) ||
            (ret.orderData?.nume && ret.orderData.nume.toLowerCase().includes(query))
          )
        }
        
        setReturns(filteredReturns)
      } else {
        setError(data.message || 'Eroare la încărcarea retururilor')
        setReturns([])
      }
    } catch (error) {
      setError('Eroare la conectare. Vă rugăm să încercați din nou.')
      setReturns([])
    } finally {
      setReturnsLoading(false)
    }
  }

  const handleSaveSKUs = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(null)
    setSaving(true)

    try {
      const response = await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          excludedSKUs: excludedSKUs,
        }),
      })

      const data = await response.json()

      if (data.success) {
        setSuccess('SKU-uri excluse salvate cu succes!')
        setTimeout(() => setSuccess(null), 3000)
      } else {
        setError(data.message || 'Eroare la salvarea configurației')
      }
    } catch (error) {
      setError('Eroare la conectare. Vă rugăm să încercați din nou.')
    } finally {
      setSaving(false)
    }
  }

  const handleSaveShopify = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(null)
    setSaving(true)

    // Validare
    if (!shopTitle || !shopifyDomain || !shopifyAccessToken) {
      setError('Toate câmpurile Shopify sunt obligatorii')
      setSaving(false)
      return
    }

    try {
      const response = await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shopify: {
            domain: shopifyDomain,
            accessToken: shopifyAccessToken,
            shopTitle: shopTitle,
          },
        }),
      })

      const data = await response.json()

      if (data.success) {
        setSuccess('Configurație Shopify salvată cu succes!')
        setIsShopifyConnected(true)
        setShowShopifyEdit(false)
        setShopifyAccessToken('') // Șterge token-ul din formular pentru securitate
        setTimeout(() => setSuccess(null), 3000)
      } else {
        setError(data.message || 'Eroare la salvarea configurației')
      }
    } catch (error) {
      setError('Eroare la conectare. Vă rugăm să încercați din nou.')
    } finally {
      setSaving(false)
    }
  }

  const handleAddSKU = () => {
    if (newSKU.trim() && !excludedSKUs.includes(newSKU.trim().toUpperCase())) {
      setExcludedSKUs([...excludedSKUs, newSKU.trim().toUpperCase()])
      setNewSKU('')
    }
  }

  const handleRemoveSKU = (sku: string) => {
    setExcludedSKUs(excludedSKUs.filter(s => s !== sku))
  }

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
      onLogout()
    } catch (error) {
      console.error('Error logging out:', error)
    }
  }

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '50vh'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: '50px',
            height: '50px',
            border: '4px solid #f3f3f3',
            borderTop: '4px solid #26a69a',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 20px'
          }} />
          <p>Se încarcă...</p>
        </div>
        <style jsx>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    )
  }

  return (
    <div style={{
      maxWidth: '1000px',
      margin: '0 auto'
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '32px',
        paddingBottom: '20px',
        borderBottom: '2px solid #e0e0e0'
      }}>
        <div>
          <h1 style={{
            fontSize: '32px',
            fontWeight: 'bold',
            marginBottom: '4px'
          }}>
            Panou Admin
          </h1>
          <p style={{ fontSize: '14px', color: '#666' }}>
            Configurează aplicația de retur
          </p>
        </div>
        <button
          onClick={handleLogout}
          style={{
            padding: '10px 20px',
            borderRadius: '8px',
            backgroundColor: '#f44336',
            color: '#fff',
            border: 'none',
            fontSize: '14px',
            fontWeight: 'bold',
            cursor: 'pointer'
          }}
        >
          Deconectare
        </button>
      </div>

      {error && (
        <div style={{
          padding: '12px 16px',
          backgroundColor: '#ffebee',
          border: '1px solid #f44336',
          borderRadius: '8px',
          color: '#c62828',
          marginBottom: '24px',
          fontSize: '14px'
        }}>
          {error}
        </div>
      )}

      {success && (
        <div style={{
          padding: '12px 16px',
          backgroundColor: '#e8f5e9',
          border: '1px solid #4CAF50',
          borderRadius: '8px',
          color: '#2e7d32',
          marginBottom: '24px',
          fontSize: '14px'
        }}>
          {success}
        </div>
      )}

      {/* Tabs Navigation */}
      <div style={{
        display: 'flex',
        gap: '12px',
        marginBottom: '24px',
        borderBottom: '2px solid #e0e0e0'
      }}>
        <button
          onClick={() => setActiveTab('config')}
          style={{
            padding: '12px 24px',
            fontSize: '16px',
            fontWeight: 'bold',
            backgroundColor: 'transparent',
            color: activeTab === 'config' ? '#26a69a' : '#666',
            border: 'none',
            borderBottom: activeTab === 'config' ? '3px solid #26a69a' : '3px solid transparent',
            cursor: 'pointer',
            transition: 'all 0.2s'
          }}
        >
          ⚙️ Configurare
        </button>
        <button
          onClick={() => setActiveTab('returns')}
          style={{
            padding: '12px 24px',
            fontSize: '16px',
            fontWeight: 'bold',
            backgroundColor: 'transparent',
            color: activeTab === 'returns' ? '#26a69a' : '#666',
            border: 'none',
            borderBottom: activeTab === 'returns' ? '3px solid #26a69a' : '3px solid transparent',
            cursor: 'pointer',
            transition: 'all 0.2s'
          }}
        >
          📦 Retururi ({returns.length})
        </button>
      </div>

      {/* Config Tab */}
      {activeTab === 'config' && (
        <>
      {/* Configurație Shopify */}
      <div style={{
        backgroundColor: '#fff',
        borderRadius: '16px',
        padding: '32px',
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
        marginBottom: '24px'
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '24px'
        }}>
          <h2 style={{
            fontSize: '20px',
            fontWeight: 'bold'
          }}>
            Configurare Shopify
          </h2>
          {isShopifyConnected && !showShopifyEdit && (
            <button
              type="button"
              onClick={() => setShowShopifyEdit(true)}
              style={{
                padding: '8px 16px',
                borderRadius: '8px',
                backgroundColor: '#26a69a',
                color: '#fff',
                border: 'none',
                fontSize: '14px',
                fontWeight: 'bold',
                cursor: 'pointer'
              }}
            >
              Editează
            </button>
          )}
        </div>

        {isShopifyConnected && !showShopifyEdit ? (
          // Afișează status conectat
          <div style={{
            padding: '20px',
            backgroundColor: '#e8f5e9',
            border: '2px solid #4CAF50',
            borderRadius: '12px'
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              marginBottom: '16px'
            }}>
              <div style={{
                width: '16px',
                height: '16px',
                borderRadius: '50%',
                backgroundColor: '#4CAF50',
                boxShadow: '0 0 8px #4CAF50'
              }} />
              <span style={{
                fontSize: '18px',
                fontWeight: 'bold',
                color: '#2e7d32'
              }}>
                Magazinul este conectat
              </span>
            </div>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'auto 1fr',
              gap: '12px 24px',
              fontSize: '14px',
              color: '#333'
            }}>
              <span style={{ fontWeight: 'bold' }}>Titlu magazin:</span>
              <span>{shopTitle}</span>
              <span style={{ fontWeight: 'bold' }}>Domain:</span>
              <span>{shopifyDomain}</span>
              <span style={{ fontWeight: 'bold' }}>Status:</span>
              <span style={{ color: '#4CAF50', fontWeight: 'bold' }}>✓ Conectat</span>
            </div>
          </div>
        ) : (
          // Formular configurare Shopify
          <form onSubmit={handleSaveShopify}>
            <div style={{ marginBottom: '20px' }}>
              <label style={{
                display: 'block',
                fontWeight: 'bold',
                marginBottom: '8px',
                fontSize: '14px'
              }}>
                Titlu magazin *
              </label>
              <input
                type="text"
                value={shopTitle}
                onChange={(e) => setShopTitle(e.target.value)}
                placeholder="Ex: MAXARI.RO"
                required
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  borderRadius: '8px',
                  border: '1px solid #e0e0e0',
                  fontSize: '14px',
                  outline: 'none'
                }}
              />
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{
                display: 'block',
                fontWeight: 'bold',
                marginBottom: '8px',
                fontSize: '14px'
              }}>
                Domain Shopify *
              </label>
              <input
                type="text"
                value={shopifyDomain}
                onChange={(e) => setShopifyDomain(e.target.value)}
                placeholder="magazinul-meu.myshopify.com"
                required
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  borderRadius: '8px',
                  border: '1px solid #e0e0e0',
                  fontSize: '14px',
                  outline: 'none'
                }}
              />
              <p style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
                Doar domain-ul, fără https:// (ex: magazinul-meu.myshopify.com)
              </p>
            </div>

            <div style={{ marginBottom: '24px' }}>
              <label style={{
                display: 'block',
                fontWeight: 'bold',
                marginBottom: '8px',
                fontSize: '14px'
              }}>
                Access Token Shopify *
              </label>
              <input
                type="password"
                value={shopifyAccessToken}
                onChange={(e) => setShopifyAccessToken(e.target.value)}
                placeholder={isShopifyConnected ? 'Lăsați gol pentru a păstra token-ul existent' : 'shpat_xxxxxxxxxxxxxxxx'}
                required={!isShopifyConnected}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  borderRadius: '8px',
                  border: '1px solid #e0e0e0',
                  fontSize: '14px',
                  outline: 'none',
                  fontFamily: 'monospace'
                }}
              />
              <p style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
                {isShopifyConnected 
                  ? 'Lăsați gol pentru a păstra token-ul existent sau introduceți unul nou pentru a-l înlocui'
                  : 'Introdu token-ul pentru prima configurare'}
              </p>
            </div>

            <div style={{
              display: 'flex',
              gap: '12px'
            }}>
              <button
                type="submit"
                disabled={saving}
                style={{
                  flex: 1,
                  padding: '12px 24px',
                  borderRadius: '8px',
                  background: saving ? '#ccc' : 'linear-gradient(90deg, #2196F3 0%, #4CAF50 100%)',
                  color: '#fff',
                  border: 'none',
                  fontSize: '14px',
                  fontWeight: 'bold',
                  cursor: saving ? 'not-allowed' : 'pointer',
                  opacity: saving ? 0.6 : 1
                }}
              >
                {saving ? 'Se salvează...' : 'Salvează configurația Shopify'}
              </button>
              {showShopifyEdit && (
                <button
                  type="button"
                  onClick={() => {
                    setShowShopifyEdit(false)
                    setShopifyAccessToken('')
                    loadConfig()
                  }}
                  style={{
                    padding: '12px 24px',
                    borderRadius: '8px',
                    backgroundColor: '#e0e0e0',
                    color: '#333',
                    border: 'none',
                    fontSize: '14px',
                    fontWeight: 'bold',
                    cursor: 'pointer'
                  }}
                >
                  Anulează
                </button>
              )}
            </div>
          </form>
        )}
      </div>

      {/* SKU-uri excluse */}
      <form onSubmit={handleSaveSKUs}>
        <div style={{
          backgroundColor: '#fff',
          borderRadius: '16px',
          padding: '32px',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
          marginBottom: '24px'
        }}>
          <h2 style={{
            fontSize: '20px',
            fontWeight: 'bold',
            marginBottom: '24px'
          }}>
            SKU-uri excluse de la retur
          </h2>

          <div style={{
            display: 'flex',
            gap: '8px',
            marginBottom: '20px'
          }}>
            <input
              type="text"
              value={newSKU}
              onChange={(e) => setNewSKU(e.target.value.toUpperCase())}
              placeholder="Ex: RMA-009"
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  handleAddSKU()
                }
              }}
              style={{
                flex: 1,
                padding: '12px 16px',
                borderRadius: '8px',
                border: '1px solid #e0e0e0',
                fontSize: '14px',
                outline: 'none'
              }}
            />
            <button
              type="button"
              onClick={handleAddSKU}
              style={{
                padding: '12px 24px',
                borderRadius: '8px',
                backgroundColor: '#26a69a',
                color: '#fff',
                border: 'none',
                fontSize: '14px',
                fontWeight: 'bold',
                cursor: 'pointer'
              }}
            >
              Adaugă
            </button>
          </div>

          <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '8px',
            marginBottom: '24px'
          }}>
            {excludedSKUs.map(sku => (
              <div
                key={sku}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '8px 12px',
                  backgroundColor: '#f5f5f5',
                  borderRadius: '6px',
                  border: '1px solid #e0e0e0'
                }}
              >
                <span style={{ fontSize: '14px', fontWeight: 'bold' }}>{sku}</span>
                <button
                  type="button"
                  onClick={() => handleRemoveSKU(sku)}
                  style={{
                    backgroundColor: '#f44336',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '4px',
                    width: '20px',
                    height: '20px',
                    cursor: 'pointer',
                    fontSize: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  ×
                </button>
              </div>
            ))}
          </div>

          {excludedSKUs.length === 0 && (
            <p style={{ fontSize: '14px', color: '#666', fontStyle: 'italic', marginBottom: '24px' }}>
              Nu există SKU-uri excluse. Toate produsele pot fi returnate.
            </p>
          )}

          <button
            type="submit"
            disabled={saving}
            style={{
              width: '100%',
              padding: '12px 24px',
              borderRadius: '8px',
              background: saving ? '#ccc' : 'linear-gradient(90deg, #2196F3 0%, #4CAF50 100%)',
              color: '#fff',
              border: 'none',
              fontSize: '14px',
              fontWeight: 'bold',
              cursor: saving ? 'not-allowed' : 'pointer',
              opacity: saving ? 0.6 : 1
            }}
          >
            {saving ? 'Se salvează...' : 'Salvează SKU-uri excluse'}
          </button>
        </div>
      </form>
        </>
      )}

      {/* Returns Tab */}
      {activeTab === 'returns' && (
        <div>
          {/* Filtre și căutare */}
          <div style={{
            display: 'flex',
            gap: '16px',
            marginBottom: '24px',
            flexWrap: 'wrap'
          }}>
            <input
              type="text"
              placeholder="Caută după ID retur, număr comandă sau nume client..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                flex: 1,
                minWidth: '200px',
                padding: '10px',
                borderRadius: '8px',
                border: '1px solid #e0e0e0',
                fontSize: '14px'
              }}
            />
            <select
              value={selectedStatus}
              onChange={(e) => {
                setSelectedStatus(e.target.value)
                setTimeout(() => loadReturns(), 100)
              }}
              style={{
                padding: '10px',
                borderRadius: '8px',
                border: '1px solid #e0e0e0',
                fontSize: '14px',
                cursor: 'pointer'
              }}
            >
              <option value="">Toate statusurile</option>
              <option value="INITIAT">Inițiat</option>
              <option value="IN_ASTEPTARE_COLET">În așteptarea coletului</option>
              <option value="COLET_PRIMIT">Colet primit</option>
              <option value="PROCESAT">Procesat</option>
              <option value="FINALIZAT">Finalizat</option>
              <option value="ANULAT">Anulat</option>
            </select>
            <button
              onClick={loadReturns}
              style={{
                padding: '10px 20px',
                borderRadius: '8px',
                backgroundColor: '#26a69a',
                color: '#fff',
                border: 'none',
                fontSize: '14px',
                fontWeight: 'bold',
                cursor: 'pointer'
              }}
            >
              Reîncarcă
            </button>
          </div>

          {/* Tabel retururi */}
          {returnsLoading ? (
            <div style={{ textAlign: 'center', padding: '40px' }}>
              <p>Se încarcă retururile...</p>
            </div>
          ) : returns.length === 0 ? (
            <div style={{
              padding: '40px',
              textAlign: 'center',
              backgroundColor: '#fff',
              borderRadius: '8px',
              border: '1px solid #e0e0e0'
            }}>
              <p style={{ fontSize: '16px', color: '#666' }}>
                {searchQuery || selectedStatus 
                  ? 'Nu s-au găsit retururi care să corespundă criteriilor de căutare.'
                  : 'Nu există retururi încă.'}
              </p>
            </div>
          ) : (
            <div style={{
              backgroundColor: '#fff',
              borderRadius: '8px',
              border: '1px solid #e0e0e0',
              overflow: 'hidden'
            }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f5f5f5' }}>
                    <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #e0e0e0', fontSize: '14px', fontWeight: 'bold' }}>ID Retur</th>
                    <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #e0e0e0', fontSize: '14px', fontWeight: 'bold' }}>Număr Comandă</th>
                    <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #e0e0e0', fontSize: '14px', fontWeight: 'bold' }}>Nume Client</th>
                    <th style={{ padding: '12px', textAlign: 'right', borderBottom: '2px solid #e0e0e0', fontSize: '14px', fontWeight: 'bold' }}>Total Rambursare</th>
                    <th style={{ padding: '12px', textAlign: 'center', borderBottom: '2px solid #e0e0e0', fontSize: '14px', fontWeight: 'bold' }}>Status</th>
                    <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #e0e0e0', fontSize: '14px', fontWeight: 'bold' }}>Data Creării</th>
                    <th style={{ padding: '12px', textAlign: 'center', borderBottom: '2px solid #e0e0e0', fontSize: '14px', fontWeight: 'bold' }}>Acțiuni</th>
                  </tr>
                </thead>
                <tbody>
                  {returns.map((ret: any, index: number) => {
                    const getStatusColor = (status: string) => {
                      switch (status) {
                        case 'INITIAT': return '#2196F3'
                        case 'IN_ASTEPTARE_COLET': return '#FF9800'
                        case 'COLET_PRIMIT': return '#9C27B0'
                        case 'PROCESAT': return '#00BCD4'
                        case 'FINALIZAT': return '#4CAF50'
                        case 'ANULAT': return '#f44336'
                        default: return '#666'
                      }
                    }

                    const getStatusLabel = (status: string) => {
                      switch (status) {
                        case 'INITIAT': return 'Inițiat'
                        case 'IN_ASTEPTARE_COLET': return 'În așteptarea coletului'
                        case 'COLET_PRIMIT': return 'Colet primit'
                        case 'PROCESAT': return 'Procesat'
                        case 'FINALIZAT': return 'Finalizat'
                        case 'ANULAT': return 'Anulat'
                        default: return status
                      }
                    }

                    return (
                      <tr 
                        key={ret.idRetur}
                        style={{
                          borderBottom: index < returns.length - 1 ? '1px solid #e0e0e0' : 'none',
                          cursor: 'pointer',
                          transition: 'background-color 0.2s'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f9f9f9'}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#fff'}
                        onClick={() => window.location.href = `/admin/returns/${ret.idRetur}`}
                      >
                        <td style={{ padding: '12px', fontSize: '14px', fontWeight: 'bold', color: '#26a69a' }}>
                          {ret.idRetur}
                        </td>
                        <td style={{ padding: '12px', fontSize: '14px' }}>
                          {ret.numarComanda}
                        </td>
                        <td style={{ padding: '12px', fontSize: '14px' }}>
                          {ret.orderData?.nume || 'N/A'}
                        </td>
                        <td style={{ padding: '12px', textAlign: 'right', fontSize: '14px', fontWeight: 'bold' }}>
                          {ret.totalRefund?.toFixed(2) || '0.00'} RON
                        </td>
                        <td style={{ padding: '12px', textAlign: 'center' }}>
                          <span style={{
                            padding: '4px 12px',
                            borderRadius: '12px',
                            fontSize: '12px',
                            fontWeight: 'bold',
                            color: '#fff',
                            backgroundColor: getStatusColor(ret.status)
                          }}>
                            {getStatusLabel(ret.status)}
                          </span>
                        </td>
                        <td style={{ padding: '12px', fontSize: '14px', color: '#666' }}>
                          {new Date(ret.createdAt).toLocaleDateString('ro-RO')}
                        </td>
                        <td style={{ padding: '12px', textAlign: 'center' }}>
                          <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                window.location.href = `/admin/returns/${ret.idRetur}`
                              }}
                              style={{
                                padding: '6px 12px',
                                borderRadius: '6px',
                                backgroundColor: '#26a69a',
                                color: '#fff',
                                border: 'none',
                                fontSize: '12px',
                                fontWeight: 'bold',
                                cursor: 'pointer'
                              }}
                            >
                              Detalii
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                window.open(`/api/returns/${ret.idRetur}/pdf`, '_blank')
                              }}
                              style={{
                                padding: '6px 12px',
                                borderRadius: '6px',
                                backgroundColor: '#2196F3',
                                color: '#fff',
                                border: 'none',
                                fontSize: '12px',
                                fontWeight: 'bold',
                                cursor: 'pointer'
                              }}
                            >
                              PDF
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
