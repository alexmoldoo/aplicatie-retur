'use client'

import { useState, useEffect } from 'react'
import StepIndicator from './StepIndicator'
import OrderDetailsStep from './OrderDetailsStep'
import OrderSelection from './OrderSelection'
import ProductsStep from './ProductsStep'
import RefundDetailsStep from './RefundDetailsStep'
import InformationStep from './InformationStep'
import SignaturePopup from './SignaturePopup'

export interface OrderData {
  nume: string
  numarComanda: string
  telefon: string
  email?: string
  orderId?: string
  paymentMethod?: string // Metoda de plată (ex: "card", "bank_transfer", etc.)
  wasPaidWithCard?: boolean // Dacă a fost plătită cu cardul
  products?: Array<{
    id: string
    nume: string
    cantitate: number
    pret: number
    variant_id?: string
  }>
}

export interface Product {
  id: string
  nume: string
  cantitate: number // Cantitatea totală din comandă
  cantitateReturnata: number // Cantitatea selectată pentru retur (1, 2, etc.)
  pret: number // Prețul unitar (după discount dacă există)
  pretInitial?: number // Prețul inițial înainte de discount
  discount?: number // Valoarea discount-ului aplicat
  motivRetur: string
  selected?: boolean
  variant_id?: string
  sku?: string
  alteMotive?: string // Pentru câmpul "Alte motive"
  imagine?: string
}

export interface RefundData {
  metodaRambursare: 'card' | 'cont'
  detaliiCard?: string
  iban?: string
  numeTitular?: string
  contulEsteAlMeu?: boolean // Dacă contul este al clientului sau al altcuiva
  acordPrevederiLegale?: boolean // Acord pentru transfer către altă persoană
  documente: File[]
}

export default function ReturnProcess() {
  const [currentStep, setCurrentStep] = useState(1)
  const [orderData, setOrderData] = useState<OrderData | null>(null)
  const [products, setProducts] = useState<Product[]>([])
  const [refundData, setRefundData] = useState<RefundData | null>(null)
  const [shopTitle, setShopTitle] = useState('MAXARI.RO')
  const [foundOrders, setFoundOrders] = useState<any[]>([]) // Comenzile găsite în step 1
  const [showSignaturePopup, setShowSignaturePopup] = useState(false) // Control pentru pop-up semnătură

  useEffect(() => {
    // Încarcă titlul magazinului din configurație
    fetch('/api/config')
      .then(res => res.json())
      .then(data => {
        if (data.success && data.config?.shopify?.shopTitle) {
          setShopTitle(data.config.shopify.shopTitle)
        }
      })
      .catch(() => {
        // Folosește default dacă nu se poate încărca
      })
  }, [])

  const handleOrderSubmit = (data: OrderData) => {
    setOrderData(data)
    // Produsele vin din datele comenzii găsite prin Shopify API
    if (data.products && data.products.length > 0) {
      setProducts(data.products.map((p: any) => ({
        id: p.id,
        nume: p.nume,
        cantitate: p.cantitate,
        cantitateReturnata: 0, // Cantitatea selectată pentru retur (0 = neselectat)
        pret: p.pret,
        pretInitial: p.pretInitial,
        discount: p.discount,
        motivRetur: '',
        variant_id: p.variant_id,
        sku: p.sku,
      })))
    } else {
      // Fallback dacă nu avem produse (nu ar trebui să se întâmple)
      setProducts([])
    }
  }

  // Callback când se găsesc comenzi în step 1 - trece automat la step 2
  const handleOrdersFound = (orders: any[]) => {
    setFoundOrders(orders)
    setCurrentStep(2) // Trece automat la step 2 pentru a afișa comenzile
  }

  // Callback când se selectează o comandă din step 2
  const handleSelectOrderFromList = (selectedOrder: any) => {
    // Pregătește datele comenzii selectate
    const data: OrderData = {
      nume: selectedOrder.nume,
      numarComanda: selectedOrder.numarComanda,
      telefon: selectedOrder.telefon,
      email: selectedOrder.email,
      orderId: selectedOrder.id,
      paymentMethod: selectedOrder.paymentMethod,
      wasPaidWithCard: selectedOrder.wasPaidWithCard,
      products: selectedOrder.products,
    }
    setOrderData(data)
    
    // Pregătește produsele pentru step 3
    if (selectedOrder.products && selectedOrder.products.length > 0) {
      setProducts(selectedOrder.products.map((p: any) => ({
        id: p.id,
        nume: p.nume,
        cantitate: p.cantitate,
        cantitateReturnata: 0, // Cantitatea selectată pentru retur (0 = neselectat)
        pret: p.pret,
        pretInitial: p.pretInitial,
        discount: p.discount,
        motivRetur: '',
        variant_id: p.variant_id,
        sku: p.sku,
      })))
    } else {
      setProducts([])
    }
    
    // Trece la step 3 (produse)
    setCurrentStep(3)
  }

  const handleProductsSubmit = (selectedProducts: Product[]) => {
    setProducts(selectedProducts)
    setCurrentStep(4) // Trece la Step 4 (date rambursare)
  }

  const handleRefundSubmit = (data: RefundData) => {
    setRefundData(data)
    setCurrentStep(5) // Mergi la step 5 (informații)
  }

  const handleInformationSubmit = () => {
    // Deschide pop-up-ul cu semnătură în loc de alert
    // Returul se creează DOAR după semnătură + generare PDF
    if (orderData && products.length > 0 && refundData) {
      setShowSignaturePopup(true)
    } else {
      alert('Date incomplete. Vă rugăm să completați toate pașii.')
    }
  }

  const handleSignaturePopupClose = () => {
    setShowSignaturePopup(false)
    // După închiderea pop-up-ului (după generare PDF), resetează procesul
    setCurrentStep(1)
    setOrderData(null)
    setProducts([])
    setRefundData(null)
  }

  return (
    <div className="return-container" style={{
      borderRadius: '16px',
      boxShadow: '0 4px 20px rgba(0, 0, 0, 0.1)',
      width: '100%',
      maxWidth: '800px',
      margin: '0 auto',
      position: 'relative',
      boxSizing: 'border-box'
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: '30px'
      }}>
        <div>
          <h1 style={{
            fontSize: '12px',
            fontWeight: 'bold',
            textTransform: 'uppercase',
            marginBottom: '10px',
            letterSpacing: '1px'
          }}>{shopTitle}</h1>
          <h2 style={{
            fontSize: '32px',
            fontWeight: 'bold',
            textTransform: 'uppercase',
            marginBottom: '8px'
          }}>PROCES DE RETUR</h2>
          <p style={{
            fontSize: '14px',
            color: '#666'
          }}>Inițiază returul în câțiva pași simpli</p>
        </div>
        <div style={{
          width: '50px',
          height: '50px',
          borderRadius: '50%',
          backgroundColor: '#26a69a',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          boxShadow: '0 2px 8px rgba(38, 166, 154, 0.3)'
        }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 18l6-6-6-6"/>
            <path d="M3 12h18"/>
          </svg>
        </div>
      </div>

      {/* Step Indicator */}
      <StepIndicator currentStep={currentStep} />

      {/* Step Content */}
      <div style={{ marginTop: '40px' }}>
        {currentStep === 1 && (
          <OrderDetailsStep onSubmit={handleOrderSubmit} onOrderSelected={handleOrdersFound} />
        )}
        {currentStep === 2 && foundOrders.length > 0 && (
          <OrderSelection 
            orders={foundOrders}
            onSelectOrder={handleSelectOrderFromList}
            onBack={() => setCurrentStep(1)} // Buton înapoi la step 1
          />
        )}
        {currentStep === 3 && (
          <ProductsStep 
            products={products} 
            onSubmit={handleProductsSubmit}
            onBack={() => setCurrentStep(2)}
          />
        )}
        {currentStep === 4 && (
          <RefundDetailsStep 
            onSubmit={handleRefundSubmit}
            onBack={() => setCurrentStep(3)}
            orderData={orderData}
            products={products}
            initialRefundData={refundData}
          />
        )}
        {currentStep === 5 && (
          <InformationStep 
            onSubmit={handleInformationSubmit}
            onBack={() => setCurrentStep(4)}
          />
        )}
      </div>

      {/* Pop-up semnătură */}
      {showSignaturePopup && orderData && refundData && (
        <SignaturePopup
          isOpen={showSignaturePopup}
          onClose={handleSignaturePopupClose}
          orderData={orderData}
          products={products}
          refundData={refundData}
        />
      )}
    </div>
  )
}

