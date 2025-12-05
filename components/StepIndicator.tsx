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
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: '30px',
      position: 'relative',
      gap: '8px'
    }}>
      {steps.map((step, index) => {
        const isActive = currentStep >= step.number
        const isCurrent = currentStep === step.number
        
        return (
          <div key={step.number} style={{ 
            display: 'flex', 
            alignItems: 'center', 
            flexDirection: 'column',
            minWidth: '80px'
          }}>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '50%',
              backgroundColor: isActive ? '#26a69a' : '#e0e0e0',
              color: isActive ? '#fff' : '#999',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 'bold',
              fontSize: '16px',
              marginBottom: '8px',
              transition: 'all 0.3s ease',
              border: isCurrent ? '3px solid #26a69a' : 'none',
              boxShadow: isCurrent ? '0 0 0 3px rgba(38, 166, 154, 0.2)' : 'none'
            }}>
              {step.number}
            </div>
            <span style={{
              fontSize: '11px',
              color: isActive ? '#26a69a' : '#999',
              fontWeight: isCurrent ? 'bold' : 'normal',
              textAlign: 'center',
              lineHeight: '1.2'
            }}>
              {step.label}
            </span>
            {index < steps.length - 1 && (
              <div style={{
                position: 'absolute',
                left: `calc(${(index + 1) * 20}% + 20px)`,
                top: '20px',
                width: 'calc(20% - 40px)',
                height: '2px',
                backgroundColor: currentStep > step.number ? '#26a69a' : '#e0e0e0',
                zIndex: -1,
                transition: 'all 0.3s ease'
              }} />
            )}
          </div>
        )
      })}
    </div>
  )
}
