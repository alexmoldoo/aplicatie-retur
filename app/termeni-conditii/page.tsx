import Link from 'next/link'

export default function TermeniConditii() {
  return (
    <div style={{
      backgroundColor: '#fff',
      borderRadius: '16px',
      padding: '40px',
      boxShadow: '0 4px 20px rgba(0, 0, 0, 0.1)',
      maxWidth: '800px',
      margin: '0 auto',
      minHeight: '60vh'
    }}>
      <h1 style={{
        fontSize: '32px',
        fontWeight: 'bold',
        marginBottom: '30px'
      }}>
        Termeni & Condiții
      </h1>
      
      <div style={{ lineHeight: '1.8', color: '#333' }}>
        <section style={{ marginBottom: '30px' }}>
          <h2 style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '15px' }}>
            1. Prezentare generală
          </h2>
          <p style={{ marginBottom: '15px' }}>
            Prin utilizarea acestui serviciu de retur, acceptați termenii și condițiile prezentate mai jos.
            Vă rugăm să citiți cu atenție acest document înainte de a iniția un proces de retur.
          </p>
        </section>

        <section style={{ marginBottom: '30px' }}>
          <h2 style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '15px' }}>
            2. Condiții de retur
          </h2>
          <p style={{ marginBottom: '15px' }}>
            Produsele pot fi returnate în termen de 14 zile de la data primirii comenzii, cu condiția să fie:
          </p>
          <ul style={{ marginLeft: '20px', marginBottom: '15px' }}>
            <li>În stare originală, nevândute și nefolosite</li>
            <li>În ambalajul original, nedeteriorat</li>
            <li>Însoțite de toate accesoriile și documentația inclusă</li>
          </ul>
        </section>

        <section style={{ marginBottom: '30px' }}>
          <h2 style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '15px' }}>
            3. Procesul de retur
          </h2>
          <p style={{ marginBottom: '15px' }}>
            Pentru a iniția un retur, trebuie să completați formularul disponibil pe această platformă,
            furnizând toate informațiile necesare despre comandă și produsele pe care doriți să le returnați.
          </p>
        </section>

        <section style={{ marginBottom: '30px' }}>
          <h2 style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '15px' }}>
            4. Rambursare
          </h2>
          <p style={{ marginBottom: '15px' }}>
            Rambursarea se va face în termen de 14 zile de la confirmarea primirii produselor returnate,
            folosind aceeași metodă de plată utilizată pentru comandă sau o metodă alternativă convenită.
          </p>
        </section>
      </div>

      <div style={{ marginTop: '40px', textAlign: 'center' }}>
        <Link href="/" style={{
          color: '#26a69a',
          textDecoration: 'none',
          fontWeight: 'bold'
        }}>
          ← Înapoi la procesul de retur
        </Link>
      </div>
    </div>
  )
}

