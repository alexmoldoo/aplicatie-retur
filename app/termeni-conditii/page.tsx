import Link from 'next/link'

const section: React.CSSProperties = { marginBottom: '32px', scrollMarginTop: '20px' }
const h2: React.CSSProperties = { fontSize: '20px', fontWeight: 700, marginBottom: '12px', color: '#0f172a' }
const ul: React.CSSProperties = { marginLeft: '20px', marginBottom: '12px' }
const ol: React.CSSProperties = { marginLeft: '20px', marginBottom: '12px' }
const tocLink: React.CSSProperties = { color: '#0f766e', textDecoration: 'none' }
const inlineLink: React.CSSProperties = { color: '#0f766e', textDecoration: 'underline' }

export default function TermeniConditii() {
  return (
    <div
      style={{
        backgroundColor: '#fff',
        borderRadius: '16px',
        padding: '40px',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.06)',
        maxWidth: '900px',
        margin: '0 auto',
      }}
    >
      <h1 style={{ fontSize: '30px', fontWeight: 800, marginBottom: '8px', color: '#0f172a' }}>
        Termeni și Condiții
      </h1>
      <p style={{ color: '#64748b', marginBottom: '24px', fontSize: '14px' }}>
        Ultima actualizare: 03.05.2026
      </p>

      <div
        style={{
          background: '#f0fdfa',
          border: '1px solid #99f6e4',
          borderRadius: '12px',
          padding: '16px 20px',
          marginBottom: '28px',
          fontSize: '14px',
          lineHeight: 1.7,
          color: '#0f172a',
        }}
      >
        Acești termeni reglementează utilizarea platformei de retur disponibilă la{' '}
        <strong>xpy.ro</strong> de către clienții magazinului <strong>maxari.ro</strong>. Prin
        accesarea și folosirea platformei, sunteți de acord cu prevederile de mai jos. Dacă nu
        sunteți de acord cu acești termeni, vă rugăm să nu utilizați platforma.
      </div>

      <div
        style={{
          background: '#f8fafc',
          border: '1px solid #e2e8f0',
          borderRadius: '12px',
          padding: '20px 24px',
          marginBottom: '32px',
        }}
      >
        <h3 style={{ fontSize: '14px', fontWeight: 700, marginBottom: '12px', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Cuprins
        </h3>
        <ol style={{ marginLeft: '20px', lineHeight: 1.9, fontSize: '14px' }}>
          <li><a href="#parti" style={tocLink}>Părțile contractuale</a></li>
          <li><a href="#definitii" style={tocLink}>Definiții</a></li>
          <li><a href="#obiect" style={tocLink}>Obiectul platformei</a></li>
          <li><a href="#acces" style={tocLink}>Acces și utilizare</a></li>
          <li><a href="#obligatii-client" style={tocLink}>Obligațiile clientului</a></li>
          <li><a href="#obligatii-operator" style={tocLink}>Obligațiile operatorului</a></li>
          <li><a href="#date-comanda" style={tocLink}>Date despre comandă</a></li>
          <li><a href="#proprietate" style={tocLink}>Drepturi de proprietate intelectuală</a></li>
          <li><a href="#raspundere" style={tocLink}>Limitarea răspunderii</a></li>
          <li><a href="#disponibilitate" style={tocLink}>Disponibilitatea serviciului</a></li>
          <li><a href="#suspendare" style={tocLink}>Suspendarea accesului</a></li>
          <li><a href="#date-personale" style={tocLink}>Prelucrarea datelor personale</a></li>
          <li><a href="#litigii" style={tocLink}>Soluționarea litigiilor</a></li>
          <li><a href="#modificari" style={tocLink}>Modificarea termenilor</a></li>
          <li><a href="#contact" style={tocLink}>Contact</a></li>
        </ol>
      </div>

      <div style={{ lineHeight: 1.75, color: '#1e293b', fontSize: '15px' }}>
        <section id="parti" style={section}>
          <h2 style={h2}>1. Părțile contractuale</h2>
          <p style={{ marginBottom: '12px' }}>
            <strong>Operatorul magazinului online (Vânzător):</strong>
          </p>
          <ul style={ul}>
            <li>Denumire comercială: <strong>Maxari</strong></li>
            <li>Magazin online: <a href="https://maxari.ro" style={inlineLink} target="_blank" rel="noopener noreferrer">maxari.ro</a></li>
            <li>Sediu social / punct de lucru: Șoseaua Sibiului nr. 11, Mediaș, jud. Sibiu, 551129</li>
            <li>E-mail: <a href="mailto:info@maxari.ro" style={inlineLink}>info@maxari.ro</a></li>
          </ul>
          <p style={{ marginBottom: '12px' }}>
            <strong>Furnizorul platformei de retur (Operatorul tehnic):</strong>
          </p>
          <ul style={ul}>
            <li>Platformă: <strong>xpy.ro</strong></li>
            <li>Rol: găzduiește și operează aplicația web prin care se derulează procesul de retur</li>
          </ul>
          <p>
            <strong>Clientul (Utilizatorul):</strong> persoana fizică sau juridică care a efectuat
            o comandă pe maxari.ro și folosește platforma xpy.ro pentru a iniția un retur.
          </p>
        </section>

        <section id="definitii" style={section}>
          <h2 style={h2}>2. Definiții</h2>
          <ul style={ul}>
            <li><strong>Platformă</strong> – aplicația web disponibilă la xpy.ro folosită pentru gestiunea returului.</li>
            <li><strong>Comandă</strong> – tranzacția efectuată anterior pe maxari.ro, identificabilă prin număr de comandă.</li>
            <li><strong>Retur</strong> – cererea clientului de a returna produse achiziționate, în conformitate cu Politica de retur.</li>
            <li><strong>AWB</strong> – Air Waybill, eticheta unică emisă de curier (SameDay) pentru transport.</li>
            <li><strong>Refund / Rambursare</strong> – returnarea sumei plătite de client pentru produsele returnate acceptate.</li>
            <li><strong>Date personale</strong> – orice informații care identifică clientul (nume, adresă, telefon, email, IBAN etc.).</li>
          </ul>
        </section>

        <section id="obiect" style={section}>
          <h2 style={h2}>3. Obiectul platformei</h2>
          <p style={{ marginBottom: '12px' }}>
            Platforma xpy.ro pune la dispoziția clienților maxari.ro un instrument digital prin
            care pot:
          </p>
          <ul style={ul}>
            <li>identifica o comandă efectuată anterior;</li>
            <li>selecta produsele pe care doresc să le returneze și motivul returului;</li>
            <li>completa datele necesare pentru rambursare (card sau IBAN);</li>
            <li>alege metoda de expediere a coletului (prin curierul nostru sau pe cont propriu);</li>
            <li>genera un formular PDF semnat electronic, ce însoțește coletul de retur.</li>
          </ul>
          <p>
            Platforma este oferită gratuit clienților maxari.ro pentru gestionarea unui retur
            valid conform legislației și{' '}
            <Link href="/politica-retur" style={inlineLink}>Politicii de retur</Link>.
          </p>
        </section>

        <section id="acces" style={section}>
          <h2 style={h2}>4. Acces și utilizare</h2>
          <p style={{ marginBottom: '12px' }}>
            Accesul la platformă este liber, fără cont. Identificarea comenzii se face pe baza
            numărului de comandă și a unui email/telefon asociat acelei comenzi.
          </p>
          <p style={{ marginBottom: '12px' }}>
            Prin utilizarea platformei, clientul declară că:
          </p>
          <ul style={ul}>
            <li>are vârsta legală pentru a încheia tranzacții (18 ani împliniți) sau acționează cu acordul reprezentantului legal;</li>
            <li>datele introduse îi aparțin sau are dreptul să le folosească;</li>
            <li>nu va încerca să acceseze comenzi care nu îi aparțin;</li>
            <li>nu va folosi platforma pentru fraudă, abuz sau în scop ilicit.</li>
          </ul>
        </section>

        <section id="obligatii-client" style={section}>
          <h2 style={h2}>5. Obligațiile clientului</h2>
          <ul style={ul}>
            <li>Să furnizeze date corecte, complete și actualizate (nume, adresă, IBAN dacă e cazul, motiv retur).</li>
            <li>Să respecte condițiile produsului prevăzute în <Link href="/politica-retur" style={inlineLink}>Politica de retur</Link> (stare originală, etichete, ambalaj).</li>
            <li>Să trimită coletul în maxim 5 zile lucrătoare de la generarea formularului de retur.</li>
            <li>Pentru opțiunea „expediez singur”: <strong>nu trimite niciodată coletul cu plată ramburs (cu plata la livrare)</strong>. Coletele cu ramburs vor fi refuzate.</li>
            <li>Să suporte costurile de retur dacă a ales această variantă (curierul nostru deduce costul din rambursare; expedierea pe cont propriu = clientul plătește direct curierului).</li>
            <li>Să nu introducă conținut malițios, să nu încerce să obstrucționeze funcționarea platformei și să nu folosească roboți sau scripturi automatizate.</li>
          </ul>
        </section>

        <section id="obligatii-operator" style={section}>
          <h2 style={h2}>6. Obligațiile operatorului</h2>
          <ul style={ul}>
            <li>Să asigure funcționarea platformei la parametri rezonabili (best effort, fără SLA explicit).</li>
            <li>Să proceseze cererea de retur în termenele prevăzute de Politica de retur și de legislația în vigoare.</li>
            <li>Să confirme primirea coletului și să demareze procedura de rambursare după verificarea produselor.</li>
            <li>Să protejeze datele personale conform GDPR și a politicii de confidențialitate.</li>
            <li>Să furnizeze suport pe email <a href="mailto:info@maxari.ro" style={inlineLink}>info@maxari.ro</a> în programul de lucru.</li>
          </ul>
        </section>

        <section id="date-comanda" style={section}>
          <h2 style={h2}>7. Date despre comandă</h2>
          <p style={{ marginBottom: '12px' }}>
            Pentru a permite identificarea comenzii și verificarea eligibilității, platforma se
            conectează la baza de date a magazinului maxari.ro și citește (read-only) datele
            comenzii (produse, prețuri, adresă livrare, status).
          </p>
          <p>
            Aceste date sunt utilizate exclusiv pentru procesarea returului în desfășurare. Nu
            sunt partajate cu terți, cu excepția curierului SameDay (pentru generarea AWB) și
            instituțiilor abilitate, dacă legea o cere.
          </p>
        </section>

        <section id="proprietate" style={section}>
          <h2 style={h2}>8. Drepturi de proprietate intelectuală</h2>
          <p style={{ marginBottom: '12px' }}>
            Platforma xpy.ro, codul sursă, design-ul, textele, sigla și orice alte materiale sunt
            protejate de legea drepturilor de autor și aparțin operatorului tehnic, respectiv
            magazinului maxari.ro pentru elementele specifice de brand.
          </p>
          <p>
            Este interzisă copierea, redistribuirea, modificarea sau utilizarea comercială a
            oricărei părți a platformei fără acordul scris prealabil.
          </p>
        </section>

        <section id="raspundere" style={section}>
          <h2 style={h2}>9. Limitarea răspunderii</h2>
          <p style={{ marginBottom: '12px' }}>
            Platforma este oferită „așa cum este”. Operatorul nu garantează funcționarea
            neîntreruptă, lipsa erorilor sau compatibilitatea cu orice configurație de browser /
            dispozitiv.
          </p>
          <p style={{ marginBottom: '12px' }}>
            Operatorul nu este răspunzător pentru:
          </p>
          <ul style={ul}>
            <li>Pierderea sau deteriorarea coletului în tranzit, dacă este expediat de client cu un curier ales de el.</li>
            <li>Întârzieri ale curierului SameDay sau ale băncii la efectuarea rambursării.</li>
            <li>Date introduse greșit de client (IBAN incorect, adresă incorectă etc.) — în acest caz, clientul este responsabil de eventualele costuri suplimentare.</li>
            <li>Pierderi indirecte, pierdere de profit, daune morale.</li>
          </ul>
          <p>
            Răspunderea totală a operatorului, în orice circumstanță, este limitată la valoarea
            comenzii care face obiectul returului.
          </p>
        </section>

        <section id="disponibilitate" style={section}>
          <h2 style={h2}>10. Disponibilitatea serviciului</h2>
          <p>
            Operatorul depune eforturi rezonabile pentru a menține platforma disponibilă 24/7,
            dar nu garantează acest lucru. Pot exista perioade de mentenanță planificate sau
            întreruperi neașteptate. În aceste situații, clienții pot iniția returul prin email
            la <a href="mailto:info@maxari.ro" style={inlineLink}>info@maxari.ro</a>.
          </p>
        </section>

        <section id="suspendare" style={section}>
          <h2 style={h2}>11. Suspendarea accesului</h2>
          <p style={{ marginBottom: '12px' }}>
            Operatorul își rezervă dreptul de a suspenda sau bloca accesul la platformă oricărui
            utilizator care:
          </p>
          <ul style={ul}>
            <li>încearcă să fraudeze sistemul (returnare repetată, produse înlocuite cu altele etc.);</li>
            <li>folosește abuziv platforma (multiple cereri identice, scripturi automatizate);</li>
            <li>introduce date false în mod intenționat;</li>
            <li>aduce atingere securității, integrității sau funcționării platformei.</li>
          </ul>
          <p>
            Suspendarea nu afectează drepturile legale ale consumatorului în privința unei
            comenzi deja efectuate.
          </p>
        </section>

        <section id="date-personale" style={section}>
          <h2 style={h2}>12. Prelucrarea datelor personale</h2>
          <p style={{ marginBottom: '12px' }}>
            Prelucrarea datelor personale se face în conformitate cu Regulamentul (UE) 2016/679
            (GDPR) și legislația națională aplicabilă. Detalii complete despre categoriile de
            date colectate, scopuri, durată de stocare și drepturile dumneavoastră (acces,
            rectificare, ștergere, portabilitate, opoziție) sunt disponibile în{' '}
            <Link href="/politica-retur#date-personale" style={inlineLink}>Politica de retur — secțiunea Date personale</Link>.
          </p>
          <p>
            Pentru orice cerere privind datele personale, contactați-ne la{' '}
            <a href="mailto:info@maxari.ro" style={inlineLink}>info@maxari.ro</a>.
          </p>
        </section>

        <section id="litigii" style={section}>
          <h2 style={h2}>13. Soluționarea litigiilor</h2>
          <p style={{ marginBottom: '12px' }}>
            În cazul unui diferend, vă rugăm să ne contactați mai întâi pe email pentru a încerca
            o soluționare amiabilă. Dacă nu se ajunge la un acord, clientul are la dispoziție:
          </p>
          <ul style={ul}>
            <li>
              Sesizarea Autorității Naționale pentru Protecția Consumatorilor (ANPC):{' '}
              <a href="https://anpc.ro" style={inlineLink} target="_blank" rel="noopener noreferrer">anpc.ro</a>
            </li>
            <li>
              Soluționarea Alternativă a Litigiilor (SAL):{' '}
              <a href="https://anpc.ro/ce-este-sal/" style={inlineLink} target="_blank" rel="noopener noreferrer">anpc.ro/ce-este-sal</a>
            </li>
            <li>
              Platforma europeană de soluționare online a litigiilor (SOL):{' '}
              <a href="https://ec.europa.eu/consumers/odr" style={inlineLink} target="_blank" rel="noopener noreferrer">ec.europa.eu/consumers/odr</a>
            </li>
            <li>Instanțele competente din România.</li>
          </ul>
          <p>
            Legea aplicabilă este legea română. Limba contractului este româna.
          </p>
        </section>

        <section id="modificari" style={section}>
          <h2 style={h2}>14. Modificarea termenilor</h2>
          <p>
            Operatorul își rezervă dreptul de a modifica acești termeni în orice moment, fără
            notificare prealabilă. Versiunea aplicabilă este cea publicată pe această pagină la
            momentul inițierii returului. Recomandăm consultarea periodică a paginii.
          </p>
        </section>

        <section id="contact" style={section}>
          <h2 style={h2}>15. Contact</h2>
          <p style={{ marginBottom: '12px' }}>
            Pentru întrebări legate de acești termeni sau de procesul de retur:
          </p>
          <ul style={ul}>
            <li>Email: <a href="mailto:info@maxari.ro" style={inlineLink}>info@maxari.ro</a></li>
            <li>Adresă: Șoseaua Sibiului nr. 11, Mediaș, jud. Sibiu, 551129, România</li>
            <li>Program: Luni – Vineri, 12:00 – 16:00</li>
          </ul>
        </section>
      </div>

      <div style={{ marginTop: '40px', textAlign: 'center', borderTop: '1px solid #e2e8f0', paddingTop: '24px' }}>
        <Link
          href="/"
          style={{
            color: '#0f766e',
            textDecoration: 'none',
            fontWeight: 600,
            fontSize: '15px',
          }}
        >
          ← Înapoi la procesul de retur
        </Link>
      </div>
    </div>
  )
}
