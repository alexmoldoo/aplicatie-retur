'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'

interface ReturnData {
  idRetur: string
  numarComanda: string
  orderData: {
    nume: string
    numarComanda: string
  }
  products: Array<{
    id: string
    nume: string
    cantitateReturnata: number
    pret: number
    motivRetur: string
  }>
  refundData: {
    iban?: string
    numeTitular?: string
  }
  signature: string
  totalRefund: number
  status: 'INITIAT' | 'IN_ASTEPTARE_COLET' | 'COLET_PRIMIT' | 'PROCESAT' | 'FINALIZAT' | 'ANULAT'
  createdAt: string
  pdfPath: string
  qrCodeData: string
  awbNumber?: string
  shippingReceiptPhoto?: string
  packageLabelPhoto?: string
}

export default function ReturnDetailsPage() {
  const params = useParams()
  const router = useRouter()
  const [returnData, setReturnData] = useState<ReturnData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isEditMode, setIsEditMode] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editedData, setEditedData] = useState<ReturnData | null>(null)

  useEffect(() => {
    loadReturnDetails()
  }, [params.id])

  const loadReturnDetails = async () => {
    try {
      const response = await fetch(`/api/returns/${params.id}`)
      const data = await response.json()
      
      if (data.success) {
        setReturnData(data.return)
        setEditedData(data.return)
      } else {
        setError(data.message || 'Eroare la încărcarea detaliilor returului')
      }
    } catch (error) {
      setError('Eroare la conectare. Vă rugăm să încercați din nou.')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!returnData) return
    
    const confirmed = window.confirm(`Ești sigur că vrei să ștergi returul ${returnData.idRetur}?\n\nAceastă acțiune nu poate fi anulată!`)
    if (!confirmed) return

    try {
      const response = await fetch(`/api/returns/${params.id}`, {
        method: 'DELETE',
      })

      const data = await response.json()
      if (data.success) {
        alert('Retur șters cu succes!')
        router.push('/admin')
      } else {
        alert('Eroare la ștergere: ' + (data.message || 'Eroare necunoscută'))
      }
    } catch (error) {
      alert('Eroare la conectare.')
    }
  }

  const handleSave = async () => {
    if (!editedData) return

    setSaving(true)
    try {
      const response = await fetch(`/api/returns/${params.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editedData),
      })

      const data = await response.json()
      if (data.success) {
        setReturnData(data.return)
        setEditedData(data.return)
        setIsEditMode(false)
        alert('Modificări salvate cu succes!')
      } else {
        alert('Eroare la salvare: ' + (data.message || 'Eroare necunoscută'))
      }
    } catch (error) {
      alert('Eroare la conectare.')
    } finally {
      setSaving(false)
    }
  }

  const handleCancel = () => {
    if (returnData) {
      setEditedData(returnData)
    }
    setIsEditMode(false)
  }

  const recalculateTotal = () => {
    if (!editedData) return
    
    const newTotal = editedData.products.reduce((sum, p) => {
      return sum + (p.pret * p.cantitateReturnata)
    }, 0)
    
    setEditedData({ ...editedData, totalRefund: newTotal })
  }

  const addProduct = () => {
    if (!editedData) return
    
    const newProduct = {
      id: `new-${Date.now()}`,
      nume: '',
      cantitateReturnata: 1,
      pret: 0,
      motivRetur: '',
    }
    
    setEditedData({
      ...editedData,
      products: [...editedData.products, newProduct]
    })
  }

  const removeProduct = (productId: string) => {
    if (!editedData) return
    
    setEditedData({
      ...editedData,
      products: editedData.products.filter(p => p.id !== productId)
    })
    recalculateTotal()
  }

  const updateProduct = (productId: string, field: string, value: any) => {
    if (!editedData) return
    
    setEditedData({
      ...editedData,
      products: editedData.products.map(p => 
        p.id === productId ? { ...p, [field]: value } : p
      )
    })
    
    if (field === 'pret' || field === 'cantitateReturnata') {
      setTimeout(recalculateTotal, 100)
    }
  }

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

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '50vh',
        backgroundColor: '#f5f5f5'
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
          <p style={{ fontSize: '16px', color: '#666' }}>Se încarcă...</p>
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

  if (error || !returnData || !editedData) {
    return (
      <div style={{
        padding: '40px',
        textAlign: 'center',
        backgroundColor: '#f5f5f5',
        minHeight: '50vh',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center'
      }}>
        <p style={{ fontSize: '18px', color: '#f44336', marginBottom: '20px', fontWeight: 'bold' }}>
          {error || 'Returul nu a fost găsit'}
        </p>
        <button
          onClick={() => router.push('/admin')}
          style={{
            padding: '12px 24px',
            borderRadius: '8px',
            backgroundColor: '#26a69a',
            color: '#fff',
            border: 'none',
            fontSize: '14px',
            fontWeight: 'bold',
            cursor: 'pointer',
            boxShadow: '0 2px 8px rgba(38, 166, 154, 0.3)'
          }}
        >
          Înapoi la Admin
        </button>
      </div>
    )
  }

  const dataToDisplay = isEditMode ? editedData : returnData

  return (
    <div style={{
      backgroundColor: '#f5f5f5',
      minHeight: '100vh',
      padding: '20px'
    }}>
      <div style={{
        backgroundColor: '#fff',
        borderRadius: '16px',
        padding: '40px',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.1)',
        maxWidth: '1200px',
        margin: '0 auto'
      }}>
        {/* Header */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: '30px',
          paddingBottom: '20px',
          borderBottom: '2px solid #e0e0e0'
        }}>
          <div>
            <h1 style={{
              fontSize: '12px',
              fontWeight: 'bold',
              textTransform: 'uppercase',
              marginBottom: '10px',
              letterSpacing: '1px',
              color: '#666'
            }}>ADMIN PANEL</h1>
            <h2 style={{
              fontSize: '32px',
              fontWeight: 'bold',
              textTransform: 'uppercase',
              marginBottom: '8px',
              color: '#333'
            }}>EDITOR RETUR</h2>
            <p style={{
              fontSize: '14px',
              color: '#666'
            }}>ID Retur: {dataToDisplay.idRetur}</p>
          </div>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            {!isEditMode ? (
              <>
                <button
                  onClick={() => setIsEditMode(true)}
                  style={{
                    padding: '12px 24px',
                    borderRadius: '8px',
                    backgroundColor: '#26a69a',
                    color: '#fff',
                    border: 'none',
                    fontSize: '14px',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    boxShadow: '0 2px 8px rgba(38, 166, 154, 0.3)'
                  }}
                >
                  Editează
                </button>
                <button
                  onClick={() => window.open(`/api/returns/${dataToDisplay.idRetur}/pdf`, '_blank')}
                  style={{
                    padding: '12px 24px',
                    borderRadius: '8px',
                    backgroundColor: '#2196F3',
                    color: '#fff',
                    border: 'none',
                    fontSize: '14px',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    boxShadow: '0 2px 8px rgba(33, 150, 243, 0.3)'
                  }}
                >
                  Descarcă PDF
                </button>
                <button
                  onClick={handleDelete}
                  style={{
                    padding: '12px 24px',
                    borderRadius: '8px',
                    backgroundColor: '#f44336',
                    color: '#fff',
                    border: 'none',
                    fontSize: '14px',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    boxShadow: '0 2px 8px rgba(244, 67, 54, 0.3)'
                  }}
                >
                  Șterge
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  style={{
                    padding: '12px 24px',
                    borderRadius: '8px',
                    backgroundColor: saving ? '#ccc' : '#4CAF50',
                    color: '#fff',
                    border: 'none',
                    fontSize: '14px',
                    fontWeight: 'bold',
                    cursor: saving ? 'not-allowed' : 'pointer',
                    boxShadow: saving ? 'none' : '0 2px 8px rgba(76, 175, 80, 0.3)'
                  }}
                >
                  {saving ? 'Se salvează...' : 'Salvează'}
                </button>
                <button
                  onClick={handleCancel}
                  disabled={saving}
                  style={{
                    padding: '12px 24px',
                    borderRadius: '8px',
                    backgroundColor: '#e0e0e0',
                    color: '#333',
                    border: 'none',
                    fontSize: '14px',
                    fontWeight: 'bold',
                    cursor: saving ? 'not-allowed' : 'pointer'
                  }}
                >
                  Anulează
                </button>
              </>
            )}
            <button
              onClick={() => router.push('/admin')}
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
              Înapoi
            </button>
          </div>
        </div>

        {/* Informații generale */}
        <div style={{
          backgroundColor: '#f9f9f9',
          borderRadius: '12px',
          padding: '24px',
          marginBottom: '24px'
        }}>
          <h2 style={{
            fontSize: '18px',
            fontWeight: 'bold',
            marginBottom: '20px',
            color: '#333'
          }}>
            Informații generale
          </h2>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
            gap: '20px'
          }}>
            <div>
              <label style={{
                display: 'block',
                fontSize: '12px',
                color: '#666',
                marginBottom: '6px',
                fontWeight: 'bold'
              }}>
                ID Retur
              </label>
              <div style={{
                padding: '10px',
                backgroundColor: '#fff',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: 'bold',
                color: '#26a69a',
                border: '1px solid #e0e0e0'
              }}>
                {dataToDisplay.idRetur}
              </div>
            </div>
            
            <div>
              <label style={{
                display: 'block',
                fontSize: '12px',
                color: '#666',
                marginBottom: '6px',
                fontWeight: 'bold'
              }}>
                Număr Comandă {isEditMode && <span style={{ color: '#f44336' }}>*</span>}
              </label>
              {isEditMode ? (
                <input
                  type="text"
                  value={editedData.orderData.numarComanda}
                  onChange={(e) => setEditedData({
                    ...editedData,
                    orderData: { ...editedData.orderData, numarComanda: e.target.value },
                    numarComanda: e.target.value
                  })}
                  style={{
                    width: '100%',
                    padding: '10px',
                    borderRadius: '8px',
                    border: '1px solid #e0e0e0',
                    fontSize: '14px',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              ) : (
                <div style={{
                  padding: '10px',
                  backgroundColor: '#fff',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: 'bold',
                  border: '1px solid #e0e0e0'
                }}>
                  {dataToDisplay.numarComanda}
                </div>
              )}
            </div>

            <div>
              <label style={{
                display: 'block',
                fontSize: '12px',
                color: '#666',
                marginBottom: '6px',
                fontWeight: 'bold'
              }}>
                Nume Client {isEditMode && <span style={{ color: '#f44336' }}>*</span>}
              </label>
              {isEditMode ? (
                <input
                  type="text"
                  value={editedData.orderData.nume}
                  onChange={(e) => setEditedData({
                    ...editedData,
                    orderData: { ...editedData.orderData, nume: e.target.value }
                  })}
                  style={{
                    width: '100%',
                    padding: '10px',
                    borderRadius: '8px',
                    border: '1px solid #e0e0e0',
                    fontSize: '14px',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              ) : (
                <div style={{
                  padding: '10px',
                  backgroundColor: '#fff',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: 'bold',
                  border: '1px solid #e0e0e0'
                }}>
                  {dataToDisplay.orderData.nume}
                </div>
              )}
            </div>

            <div>
              <label style={{
                display: 'block',
                fontSize: '12px',
                color: '#666',
                marginBottom: '6px',
                fontWeight: 'bold'
              }}>
                Status
              </label>
              <select
                value={dataToDisplay.status}
                onChange={(e) => {
                  if (isEditMode) {
                    setEditedData({ ...editedData, status: e.target.value as any })
                  }
                }}
                disabled={!isEditMode}
                style={{
                  width: '100%',
                  padding: '10px',
                  borderRadius: '8px',
                  border: '1px solid #e0e0e0',
                  fontSize: '14px',
                  backgroundColor: isEditMode ? '#fff' : '#f5f5f5',
                  cursor: isEditMode ? 'pointer' : 'not-allowed',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              >
                <option value="INITIAT">Inițiat</option>
                <option value="IN_ASTEPTARE_COLET">În așteptarea coletului</option>
                <option value="COLET_PRIMIT">Colet primit</option>
                <option value="PROCESAT">Procesat</option>
                <option value="FINALIZAT">Finalizat</option>
                <option value="ANULAT">Anulat</option>
              </select>
            </div>

            <div>
              <label style={{
                display: 'block',
                fontSize: '12px',
                color: '#666',
                marginBottom: '6px',
                fontWeight: 'bold'
              }}>
                Data Creării
              </label>
              <div style={{
                padding: '10px',
                backgroundColor: '#f5f5f5',
                borderRadius: '8px',
                fontSize: '14px',
                border: '1px solid #e0e0e0'
              }}>
                {new Date(dataToDisplay.createdAt).toLocaleString('ro-RO')}
              </div>
            </div>

            <div>
              <label style={{
                display: 'block',
                fontSize: '12px',
                color: '#666',
                marginBottom: '6px',
                fontWeight: 'bold'
              }}>
                Total Rambursare {isEditMode && <span style={{ color: '#f44336' }}>*</span>}
              </label>
              <div style={{ display: 'flex', gap: '8px' }}>
                {isEditMode ? (
                  <>
                    <input
                      type="number"
                      step="0.01"
                      value={editedData.totalRefund}
                      onChange={(e) => setEditedData({
                        ...editedData,
                        totalRefund: parseFloat(e.target.value) || 0
                      })}
                      style={{
                        flex: 1,
                        padding: '10px',
                        borderRadius: '8px',
                        border: '1px solid #e0e0e0',
                        fontSize: '14px',
                        outline: 'none',
                        boxSizing: 'border-box'
                      }}
                    />
                    <button
                      onClick={recalculateTotal}
                      type="button"
                      style={{
                        padding: '10px 16px',
                        borderRadius: '8px',
                        backgroundColor: '#26a69a',
                        color: '#fff',
                        border: 'none',
                        fontSize: '12px',
                        fontWeight: 'bold',
                        cursor: 'pointer',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      Recalculează
                    </button>
                  </>
                ) : (
                  <div style={{
                    flex: 1,
                    padding: '10px',
                    backgroundColor: '#fff',
                    borderRadius: '8px',
                    fontSize: '18px',
                    fontWeight: 'bold',
                    color: '#26a69a',
                    border: '1px solid #e0e0e0'
                  }}>
                    {dataToDisplay.totalRefund.toFixed(2)} RON
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Produse returnate */}
        <div style={{
          backgroundColor: '#f9f9f9',
          borderRadius: '12px',
          padding: '24px',
          marginBottom: '24px'
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '20px'
          }}>
            <h2 style={{
              fontSize: '18px',
              fontWeight: 'bold',
              color: '#333'
            }}>
              Produse returnate
            </h2>
            {isEditMode && (
              <button
                onClick={addProduct}
                type="button"
                style={{
                  padding: '10px 20px',
                  borderRadius: '8px',
                  backgroundColor: '#4CAF50',
                  color: '#fff',
                  border: 'none',
                  fontSize: '14px',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  boxShadow: '0 2px 8px rgba(76, 175, 80, 0.3)'
                }}
              >
                + Adaugă produs
              </button>
            )}
          </div>
          <div style={{
            overflowX: 'auto',
            backgroundColor: '#fff',
            borderRadius: '8px',
            border: '1px solid #e0e0e0'
          }}>
            <table style={{
              width: '100%',
              borderCollapse: 'collapse'
            }}>
              <thead>
                <tr style={{ backgroundColor: '#f5f5f5' }}>
                  <th style={{
                    padding: '12px',
                    textAlign: 'left',
                    borderBottom: '2px solid #e0e0e0',
                    fontSize: '14px',
                    fontWeight: 'bold',
                    color: '#333'
                  }}>
                    Produs
                  </th>
                  <th style={{
                    padding: '12px',
                    textAlign: 'center',
                    borderBottom: '2px solid #e0e0e0',
                    fontSize: '14px',
                    fontWeight: 'bold',
                    color: '#333'
                  }}>
                    Cantitate
                  </th>
                  <th style={{
                    padding: '12px',
                    textAlign: 'right',
                    borderBottom: '2px solid #e0e0e0',
                    fontSize: '14px',
                    fontWeight: 'bold',
                    color: '#333'
                  }}>
                    Preț unitar
                  </th>
                  <th style={{
                    padding: '12px',
                    textAlign: 'right',
                    borderBottom: '2px solid #e0e0e0',
                    fontSize: '14px',
                    fontWeight: 'bold',
                    color: '#333'
                  }}>
                    Total
                  </th>
                  <th style={{
                    padding: '12px',
                    textAlign: 'left',
                    borderBottom: '2px solid #e0e0e0',
                    fontSize: '14px',
                    fontWeight: 'bold',
                    color: '#333'
                  }}>
                    Motiv retur
                  </th>
                  {isEditMode && (
                    <th style={{
                      padding: '12px',
                      textAlign: 'center',
                      borderBottom: '2px solid #e0e0e0',
                      fontSize: '14px',
                      fontWeight: 'bold',
                      color: '#333'
                    }}>
                      Acțiuni
                    </th>
                  )}
                </tr>
              </thead>
              <tbody>
                {dataToDisplay.products.map((product, index) => (
                  <tr key={product.id} style={{
                    borderBottom: index < dataToDisplay.products.length - 1 ? '1px solid #e0e0e0' : 'none'
                  }}>
                    <td style={{ padding: '12px' }}>
                      {isEditMode ? (
                        <input
                          type="text"
                          value={product.nume}
                          onChange={(e) => updateProduct(product.id, 'nume', e.target.value)}
                          style={{
                            width: '100%',
                            padding: '8px',
                            borderRadius: '6px',
                            border: '1px solid #e0e0e0',
                            fontSize: '14px',
                            outline: 'none',
                            boxSizing: 'border-box'
                          }}
                        />
                      ) : (
                        <span style={{ fontSize: '14px', color: '#333' }}>{product.nume}</span>
                      )}
                    </td>
                    <td style={{ padding: '12px', textAlign: 'center' }}>
                      {isEditMode ? (
                        <input
                          type="number"
                          min="1"
                          value={product.cantitateReturnata}
                          onChange={(e) => updateProduct(product.id, 'cantitateReturnata', parseInt(e.target.value) || 1)}
                          style={{
                            width: '70px',
                            padding: '8px',
                            borderRadius: '6px',
                            border: '1px solid #e0e0e0',
                            fontSize: '14px',
                            textAlign: 'center',
                            outline: 'none',
                            boxSizing: 'border-box'
                          }}
                        />
                      ) : (
                        <span style={{ fontSize: '14px', color: '#333' }}>{product.cantitateReturnata}</span>
                      )}
                    </td>
                    <td style={{ padding: '12px', textAlign: 'right' }}>
                      {isEditMode ? (
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={product.pret}
                          onChange={(e) => updateProduct(product.id, 'pret', parseFloat(e.target.value) || 0)}
                          style={{
                            width: '100px',
                            padding: '8px',
                            borderRadius: '6px',
                            border: '1px solid #e0e0e0',
                            fontSize: '14px',
                            textAlign: 'right',
                            outline: 'none',
                            boxSizing: 'border-box'
                          }}
                        />
                      ) : (
                        <span style={{ fontSize: '14px', color: '#333' }}>{product.pret.toFixed(2)} RON</span>
                      )}
                    </td>
                    <td style={{
                      padding: '12px',
                      textAlign: 'right',
                      fontWeight: 'bold',
                      color: '#26a69a'
                    }}>
                      {(product.pret * product.cantitateReturnata).toFixed(2)} RON
                    </td>
                    <td style={{ padding: '12px' }}>
                      {isEditMode ? (
                        <textarea
                          value={product.motivRetur}
                          onChange={(e) => updateProduct(product.id, 'motivRetur', e.target.value)}
                          rows={2}
                          style={{
                            width: '100%',
                            padding: '8px',
                            borderRadius: '6px',
                            border: '1px solid #e0e0e0',
                            fontSize: '14px',
                            outline: 'none',
                            resize: 'vertical',
                            boxSizing: 'border-box',
                            fontFamily: 'inherit'
                          }}
                        />
                      ) : (
                        <span style={{ fontSize: '14px', color: '#666' }}>{product.motivRetur}</span>
                      )}
                    </td>
                    {isEditMode && (
                      <td style={{ padding: '12px', textAlign: 'center' }}>
                        <button
                          onClick={() => removeProduct(product.id)}
                          type="button"
                          style={{
                            padding: '6px 12px',
                            borderRadius: '6px',
                            backgroundColor: '#f44336',
                            color: '#fff',
                            border: 'none',
                            fontSize: '12px',
                            fontWeight: 'bold',
                            cursor: 'pointer'
                          }}
                        >
                          Șterge
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Date rambursare */}
        <div style={{
          backgroundColor: '#f9f9f9',
          borderRadius: '12px',
          padding: '24px',
          marginBottom: '24px'
        }}>
          <h2 style={{
            fontSize: '18px',
            fontWeight: 'bold',
            marginBottom: '20px',
            color: '#333'
          }}>
            Date rambursare
          </h2>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
            gap: '20px'
          }}>
            <div>
              <label style={{
                display: 'block',
                fontSize: '12px',
                color: '#666',
                marginBottom: '6px',
                fontWeight: 'bold'
              }}>
                IBAN {isEditMode && <span style={{ color: '#f44336' }}>*</span>}
              </label>
              {isEditMode ? (
                <input
                  type="text"
                  value={editedData.refundData.iban || ''}
                  onChange={(e) => setEditedData({
                    ...editedData,
                    refundData: { ...editedData.refundData, iban: e.target.value }
                  })}
                  placeholder="RO48BTRLRONCRT0CK8989101"
                  style={{
                    width: '100%',
                    padding: '10px',
                    borderRadius: '8px',
                    border: '1px solid #e0e0e0',
                    fontSize: '14px',
                    fontFamily: 'monospace',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              ) : (
                <div style={{
                  padding: '10px',
                  backgroundColor: '#fff',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: 'bold',
                  fontFamily: 'monospace',
                  border: '1px solid #e0e0e0',
                  minHeight: '40px',
                  color: dataToDisplay.refundData.iban ? '#333' : '#999'
                }}>
                  {dataToDisplay.refundData.iban || '(necompletat)'}
                </div>
              )}
            </div>

            <div>
              <label style={{
                display: 'block',
                fontSize: '12px',
                color: '#666',
                marginBottom: '6px',
                fontWeight: 'bold'
              }}>
                Nume Titular {isEditMode && <span style={{ color: '#f44336' }}>*</span>}
              </label>
              {isEditMode ? (
                <input
                  type="text"
                  value={editedData.refundData.numeTitular || ''}
                  onChange={(e) => setEditedData({
                    ...editedData,
                    refundData: { ...editedData.refundData, numeTitular: e.target.value }
                  })}
                  placeholder="Nume complet titular cont"
                  style={{
                    width: '100%',
                    padding: '10px',
                    borderRadius: '8px',
                    border: '1px solid #e0e0e0',
                    fontSize: '14px',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              ) : (
                <div style={{
                  padding: '10px',
                  backgroundColor: '#fff',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: 'bold',
                  border: '1px solid #e0e0e0',
                  minHeight: '40px',
                  color: dataToDisplay.refundData.numeTitular ? '#333' : '#999'
                }}>
                  {dataToDisplay.refundData.numeTitular || '(necompletat)'}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* AWB și documente */}
        <div style={{
          backgroundColor: '#f9f9f9',
          borderRadius: '12px',
          padding: '24px',
          marginBottom: '24px'
        }}>
          <h2 style={{
            fontSize: '18px',
            fontWeight: 'bold',
            marginBottom: '20px',
            color: '#333'
          }}>
            AWB și documente
          </h2>
          <div style={{ marginBottom: '20px' }}>
            <label style={{
              display: 'block',
              fontSize: '12px',
              color: '#666',
              marginBottom: '6px',
              fontWeight: 'bold'
            }}>
              Număr AWB
            </label>
            {isEditMode ? (
              <input
                type="text"
                value={editedData.awbNumber || ''}
                onChange={(e) => setEditedData({
                  ...editedData,
                  awbNumber: e.target.value
                })}
                placeholder="Introdu număr AWB"
                style={{
                  width: '100%',
                  padding: '10px',
                  borderRadius: '8px',
                  border: '1px solid #e0e0e0',
                  fontSize: '14px',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              />
            ) : (
              <div style={{
                padding: '10px',
                backgroundColor: '#fff',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: 'bold',
                border: '1px solid #e0e0e0',
                minHeight: '40px',
                color: dataToDisplay.awbNumber ? '#333' : '#999'
              }}>
                {dataToDisplay.awbNumber || '(necompletat)'}
              </div>
            )}
          </div>
          {(dataToDisplay.shippingReceiptPhoto || dataToDisplay.packageLabelPhoto) && (
            <div>
              <p style={{
                fontSize: '14px',
                fontWeight: 'bold',
                marginBottom: '12px',
                color: '#333'
              }}>
                Documente încărcate:
              </p>
              <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                {dataToDisplay.shippingReceiptPhoto && (
                  <div>
                    <p style={{
                      fontSize: '12px',
                      color: '#666',
                      marginBottom: '4px',
                      fontWeight: 'bold'
                    }}>
                      Chitanță expediere
                    </p>
                    <img
                      src={dataToDisplay.shippingReceiptPhoto}
                      alt="Chitanță"
                      style={{
                        maxWidth: '200px',
                        border: '1px solid #e0e0e0',
                        borderRadius: '8px',
                        padding: '8px',
                        backgroundColor: '#fff'
                      }}
                    />
                  </div>
                )}
                {dataToDisplay.packageLabelPhoto && (
                  <div>
                    <p style={{
                      fontSize: '12px',
                      color: '#666',
                      marginBottom: '4px',
                      fontWeight: 'bold'
                    }}>
                      Etichetă colet
                    </p>
                    <img
                      src={dataToDisplay.packageLabelPhoto}
                      alt="Etichetă"
                      style={{
                        maxWidth: '200px',
                        border: '1px solid #e0e0e0',
                        borderRadius: '8px',
                        padding: '8px',
                        backgroundColor: '#fff'
                      }}
                    />
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Semnătură și QR Code */}
        <div style={{
          backgroundColor: '#f9f9f9',
          borderRadius: '12px',
          padding: '24px',
          marginBottom: '24px'
        }}>
          <h2 style={{
            fontSize: '18px',
            fontWeight: 'bold',
            marginBottom: '20px',
            color: '#333'
          }}>
            Semnătură și QR Code
          </h2>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
            gap: '24px'
          }}>
            {dataToDisplay.signature && (
              <div>
                <p style={{
                  fontSize: '12px',
                  color: '#666',
                  marginBottom: '8px',
                  fontWeight: 'bold'
                }}>
                  Semnătură client
                </p>
                <img
                  src={dataToDisplay.signature}
                  alt="Semnătură"
                  style={{
                    maxWidth: '100%',
                    border: '1px solid #e0e0e0',
                    borderRadius: '8px',
                    padding: '8px',
                    backgroundColor: '#fff'
                  }}
                />
              </div>
            )}
            {dataToDisplay.qrCodeData && (
              <div>
                <p style={{
                  fontSize: '12px',
                  color: '#666',
                  marginBottom: '8px',
                  fontWeight: 'bold'
                }}>
                  QR Code
                </p>
                <img
                  src={dataToDisplay.qrCodeData}
                  alt="QR Code"
                  style={{
                    maxWidth: '200px',
                    border: '1px solid #e0e0e0',
                    borderRadius: '8px',
                    padding: '8px',
                    backgroundColor: '#fff'
                  }}
                />
                <p style={{
                  fontSize: '12px',
                  marginTop: '8px',
                  color: '#666'
                }}>
                  Link: /admin/returns/{dataToDisplay.idRetur}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
