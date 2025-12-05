'use client'

interface VerificationPopupProps {
  isOpen: boolean
  onConfirm: () => void
  onCancel: () => void
}

export default function VerificationPopup({ isOpen, onConfirm, onCancel }: VerificationPopupProps) {
  if (!isOpen) return null

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '20px'
    }}>
      <div style={{
        backgroundColor: '#fff',
        borderRadius: '16px',
        padding: '32px',
        maxWidth: '500px',
        width: '100%',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)'
      }}>
        <h3 style={{
          fontSize: '20px',
          fontWeight: 'bold',
          marginBottom: '16px',
          textAlign: 'center'
        }}>
          Verificare comandă
        </h3>
        
        <p style={{
          fontSize: '16px',
          marginBottom: '24px',
          textAlign: 'center',
          lineHeight: '1.6'
        }}>
          Am încercat să căutăm o comandă pentru retur pe <strong>maxari.ro</strong>.
          <br />
          <br />
          Sunteți sigur că aceasta este site-ul de unde ați comandat?
        </p>

        <div style={{
          display: 'flex',
          gap: '12px',
          marginTop: '24px'
        }}>
          <button
            onClick={onCancel}
            style={{
              flex: 1,
              padding: '12px 24px',
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
            NU
          </button>
          <button
            onClick={onConfirm}
            style={{
              flex: 1,
              padding: '12px 24px',
              borderRadius: '8px',
              background: 'linear-gradient(90deg, #2196F3 0%, #4CAF50 100%)',
              color: '#fff',
              border: 'none',
              fontSize: '16px',
              fontWeight: 'bold',
              cursor: 'pointer',
              transition: 'transform 0.2s ease'
            }}
            onMouseOver={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
            onMouseOut={(e) => e.currentTarget.style.transform = 'translateY(0)'}
          >
            DA
          </button>
        </div>
      </div>
    </div>
  )
}

