interface StepIndicatorProps {
  currentStep: number
}

export default function StepIndicator({ currentStep }: StepIndicatorProps) {
  const steps = [
    { number: 1, label: 'Căutare comandă' },
    { number: 2, label: 'Comandă' },
    { number: 3, label: 'Produse' },
    { number: 4, label: 'Date rambursare' },
    { number: 5, label: 'Informații' },
  ]

  return (
    <div style={{
      display: 'flex',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      marginBottom: '30px',
      position: 'relative',
      width: '100%',
      padding: '0',
      boxSizing: 'border-box'
    }}>
      {steps.map((step, index) => {
        const isActive = currentStep >= step.number
        const isCurrent = currentStep === step.number
        
        return (
          <div key={step.number} style={{ 
            display: 'flex', 
            alignItems: 'center', 
            flexDirection: 'column',
            flex: '1',
            minWidth: 0,
            position: 'relative',
            zIndex: 2
          }}>
            {/* Linia de conectare înainte de număr */}
            {index > 0 && (
              <div style={{
                position: 'absolute',
                left: '0',
                top: '16px',
                width: '50%',
                height: '2px',
                backgroundColor: currentStep >= step.number ? '#26a69a' : '#e0e0e0',
                zIndex: 0
              }} />
            )}
            
            {/* Numărul */}
            <div style={{
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              backgroundColor: isActive ? '#26a69a' : '#e0e0e0',
              color: isActive ? '#fff' : '#999',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 'bold',
              fontSize: '14px',
              marginBottom: '6px',
              transition: 'all 0.3s ease',
              border: isCurrent ? '2px solid #26a69a' : 'none',
              boxShadow: isCurrent ? '0 0 0 2px rgba(38, 166, 154, 0.2)' : 'none',
              flexShrink: 0,
              position: 'relative',
              zIndex: 1
            }}>
              {step.number}
            </div>
            
            {/* Linia de conectare după număr */}
            {index < steps.length - 1 && (
              <div style={{
                position: 'absolute',
                right: '0',
                top: '16px',
                width: '50%',
                height: '2px',
                backgroundColor: currentStep > step.number ? '#26a69a' : '#e0e0e0',
                zIndex: 0
              }} />
            )}
            
            {/* Label */}
            <span style={{
              fontSize: '9px',
              color: isActive ? '#26a69a' : '#999',
              fontWeight: isCurrent ? 'bold' : 'normal',
              textAlign: 'center',
              lineHeight: '1.2',
              wordBreak: 'break-word',
              maxWidth: '100%',
              padding: '0 2px'
            }}>
              {step.label}
            </span>
          </div>
        )
      })}
    </div>
  )
}
