import Link from 'next/link'

export default function PoliticaRetur() {
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
        Politica de retur
      </h1>
      
      <div style={{ lineHeight: '1.8', color: '#333' }}>
        <section style={{ marginBottom: '30px' }}>
          <h2 style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '15px' }}>
            Dreptul de retur
          </h2>
          <p style={{ marginBottom: '15px' }}>
            Conform legislației în vigoare, aveți dreptul să returnați produsele achiziționate în termen de 14 zile
            calendaristice de la data primirii acestora, fără a fi nevoie să indicați un motiv.
          </p>
        </section>

        <section style={{ marginBottom: '30px' }}>
          <h2 style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '15px' }}>
            Produse care nu pot fi returnate
          </h2>
          <p style={{ marginBottom: '15px' }}>
            Nu pot fi returnate următoarele categorii de produse:
          </p>
          <ul style={{ marginLeft: '20px', marginBottom: '15px' }}>
            <li>Produse personalizate sau făcute la comandă</li>
            <li>Produse perisabile</li>
            <li>Produse sigilate care au fost deschise și nu pot fi returnate din motive de igienă</li>
            <li>Produse deteriorate din cauza utilizării necorespunzătoare</li>
          </ul>
        </section>

        <section style={{ marginBottom: '30px' }}>
          <h2 style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '15px' }}>
            Costuri de retur
          </h2>
          <p style={{ marginBottom: '15px' }}>
            Costurile de transport pentru returnarea produselor sunt suportate de client, cu excepția cazurilor
            în care produsul este defect sau nu corespunde comenzii efectuate.
          </p>
        </section>

        <section style={{ marginBottom: '30px' }}>
          <h2 style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '15px' }}>
            Procesul de returnare
          </h2>
          <ol style={{ marginLeft: '20px', marginBottom: '15px' }}>
            <li style={{ marginBottom: '10px' }}>Completați formularul de retur disponibil pe platformă</li>
            <li style={{ marginBottom: '10px' }}>Așteptați confirmarea cererii de retur</li>
            <li style={{ marginBottom: '10px' }}>Ambalaj produsele corespunzător și trimiteți-le la adresa indicată</li>
            <li style={{ marginBottom: '10px' }}>După verificarea produselor, veți primi rambursarea</li>
          </ol>
        </section>

        <section style={{ marginBottom: '30px' }}>
          <h2 style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '15px' }}>
            Contact
          </h2>
          <p style={{ marginBottom: '15px' }}>
            Pentru întrebări sau asistență privind procesul de retur, vă rugăm să ne contactați la adresa
            de email sau telefonul indicat în secțiunea de contact.
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

