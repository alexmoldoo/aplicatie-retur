'use client'

import { useState } from 'react'

interface InformationStepProps {
  onSubmit: () => void
  onBack: () => void
}

export default function InformationStep({ onSubmit, onBack }: InformationStepProps) {
  const [hasRead, setHasRead] = useState(false)
  const [scrollPosition, setScrollPosition] = useState(0)

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget
    const scrollTop = target.scrollTop
    const scrollHeight = target.scrollHeight
    const clientHeight = target.clientHeight
    
    const scrolled = (scrollTop / (scrollHeight - clientHeight)) * 100
    setScrollPosition(scrolled)
    
    // Consideră că a citit dacă a scrollat până la 95%
    if (scrolled >= 95) {
      setHasRead(true)
    }
  }

  return (
    <div className="step-container-large">
      <h2 style={{
        fontSize: '24px',
        fontWeight: 'bold',
        marginBottom: '20px',
        textAlign: 'center'
      }}>
        Informații importante despre retur
      </h2>

      <div
        onScroll={handleScroll}
        style={{
          maxHeight: '400px',
          overflowY: 'auto',
          padding: '20px',
          backgroundColor: '#f9f9f9',
          borderRadius: '12px',
          border: '1px solid #e0e0e0',
          marginBottom: '20px',
          lineHeight: '1.6'
        }}
      >
        <div style={{ marginBottom: '20px' }}>
          <h3 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '10px', color: '#26a69a' }}>
            Pașii pentru retur
          </h3>
          <ol style={{ paddingLeft: '20px' }}>
            <li style={{ marginBottom: '8px' }}>Selectați produsele pe care doriți să le returnați</li>
            <li style={{ marginBottom: '8px' }}>Indicați motivul returului pentru fiecare produs</li>
            <li style={{ marginBottom: '8px' }}>Completați datele pentru rambursare</li>
            <li style={{ marginBottom: '8px' }}>Încărcați documentele necesare</li>
            <li style={{ marginBottom: '8px' }}>Trimiteți cererea de retur</li>
          </ol>
        </div>

        <div style={{ marginBottom: '20px' }}>
          <h3 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '10px', color: '#26a69a' }}>
            Condiții de eligibilitate
          </h3>
          <ul style={{ paddingLeft: '20px' }}>
            <li style={{ marginBottom: '8px' }}>Produsele trebuie să fie returnate în termen de 15 zile de la primire</li>
            <li style={{ marginBottom: '8px' }}>Produsele trebuie să fie în stare originală, nefolosite</li>
            <li style={{ marginBottom: '8px' }}>Etichetele și ambalajul original trebuie să fie intacte</li>
            <li style={{ marginBottom: '8px' }}>Unele produse nu pot fi returnate (verificați lista de SKU-uri excluse)</li>
          </ul>
        </div>

        <div style={{ marginBottom: '20px' }}>
          <h3 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '10px', color: '#26a69a' }}>
            Metode de rambursare
          </h3>
          <p style={{ marginBottom: '10px' }}>
            Rambursarea se poate face prin:
          </p>
          <ul style={{ paddingLeft: '20px' }}>
            <li style={{ marginBottom: '8px' }}><strong>Cont bancar:</strong> IBAN valid românesc</li>
            <li style={{ marginBottom: '8px' }}><strong>Card:</strong> Dacă comanda a fost plătită cu cardul</li>
          </ul>
        </div>

        <div style={{ marginBottom: '20px' }}>
          <h3 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '10px', color: '#26a69a' }}>
            Documente necesare
          </h3>
          <ul style={{ paddingLeft: '20px' }}>
            <li style={{ marginBottom: '8px' }}>Factura originală sau copie</li>
            <li style={{ marginBottom: '8px' }}>Formularul de retur completat</li>
            <li style={{ marginBottom: '8px' }}>Dovada de expediere (după trimiterea coletului)</li>
          </ul>
        </div>

        <div style={{ marginBottom: '20px' }}>
          <h3 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '10px', color: '#26a69a' }}>
            Timp de procesare
          </h3>
          <p>
            După primirea coletului, procesarea returului durează între 5-10 zile lucrătoare. 
            Rambursarea va fi efectuată în contul indicat în termen de 14 zile de la aprobarea returului.
          </p>
        </div>

        <div style={{ 
          marginTop: '30px',
          padding: '15px',
          backgroundColor: '#fff3cd',
          borderRadius: '8px',
          border: '1px solid #ffc107'
        }}>
          <p style={{ margin: 0, fontWeight: 'bold', color: '#856404' }}>
            ⚠️ Important: Vă rugăm să citiți toate informațiile de mai sus înainte de a continua.
          </p>
        </div>
      </div>

      {/* Indicator de progres */}
      <div style={{
        marginBottom: '20px',
        textAlign: 'center'
      }}>
        <div style={{
          width: '100%',
          height: '6px',
          backgroundColor: '#e0e0e0',
          borderRadius: '3px',
          overflow: 'hidden',
          marginBottom: '8px'
        }}>
          <div style={{
            width: `${scrollPosition}%`,
            height: '100%',
            backgroundColor: '#26a69a',
            transition: 'width 0.3s ease'
          }} />
        </div>
        <p style={{ fontSize: '12px', color: '#666' }}>
          {scrollPosition >= 95 ? '✓ Ați citit toate informațiile' : `Progres: ${Math.round(scrollPosition)}%`}
        </p>
      </div>

      {/* Butoane */}
      <div style={{
        display: 'flex',
        gap: '12px',
        justifyContent: 'space-between'
      }}>
        <button
          onClick={onBack}
          style={{
            flex: 1,
            padding: '14px',
            borderRadius: '8px',
            backgroundColor: '#e0e0e0',
            color: '#333',
            border: 'none',
            fontSize: '16px',
            fontWeight: 'bold',
            cursor: 'pointer',
            transition: 'background-color 0.3s ease'
          }}
          onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#d0d0d0'}
          onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#e0e0e0'}
        >
          ÎNAPOI
        </button>
        <button
          onClick={onSubmit}
          disabled={!hasRead}
          style={{
            flex: 1,
            padding: '14px',
            borderRadius: '8px',
            background: hasRead 
              ? 'linear-gradient(90deg, #2196F3 0%, #4CAF50 100%)'
              : '#ccc',
            color: '#fff',
            border: 'none',
            fontSize: '16px',
            fontWeight: 'bold',
            textTransform: 'uppercase',
            cursor: hasRead ? 'pointer' : 'not-allowed',
            opacity: hasRead ? 1 : 0.6,
            transition: 'all 0.3s ease'
          }}
        >
          CONTINUĂ
        </button>
      </div>

      {!hasRead && (
        <p style={{
          textAlign: 'center',
          fontSize: '12px',
          color: '#f44336',
          marginTop: '10px'
        }}>
          Vă rugăm să citiți toate informațiile pentru a continua
        </p>
      )}
    </div>
  )
}

