import Link from 'next/link'

const section: React.CSSProperties = { marginBottom: '32px', scrollMarginTop: '20px' }
const h2: React.CSSProperties = { fontSize: '20px', fontWeight: 700, marginBottom: '12px', color: '#0f172a' }
const h3: React.CSSProperties = { fontSize: '16px', fontWeight: 700, marginTop: '18px', marginBottom: '10px', color: '#0f172a' }
const ul: React.CSSProperties = { marginLeft: '20px', marginBottom: '12px' }
const ol: React.CSSProperties = { marginLeft: '20px', marginBottom: '12px' }
const inlineLink: React.CSSProperties = { color: '#0f766e', textDecoration: 'underline' }

export default function PoliticaRetur() {
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
      <h1 style={{ fontSize: '30px', fontWeight: 800, marginBottom: '6px', color: '#0f172a' }}>
        Politica de Retur și Rambursare Maxari.ro
      </h1>
      <p style={{ color: '#64748b', marginBottom: '6px', fontSize: '14px' }}>
        Ultima actualizare: 03.05.2026
      </p>
      <p style={{ color: '#64748b', marginBottom: '24px', fontSize: '14px' }}>
        Aplicabilă comenzilor efectuate pe:{' '}
        <a href="https://maxari.ro" style={inlineLink} target="_blank" rel="noopener noreferrer">
          maxari.ro
        </a>
      </p>

      <a
        href="#trimitere-colet"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '8px',
          padding: '10px 18px',
          borderRadius: '999px',
          background: 'linear-gradient(90deg, #2196F3 0%, #4CAF50 100%)',
          color: '#fff',
          textDecoration: 'none',
          fontSize: '14px',
          fontWeight: 700,
          marginBottom: '24px',
          boxShadow: '0 4px 12px rgba(33, 150, 243, 0.25)',
        }}
      >
        📦 Cum trimit coletul? →
      </a>

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
        Prezenta politică stabilește condițiile în care pot fi returnate produsele achiziționate
        prin magazinul online{' '}
        <a href="https://maxari.ro" style={inlineLink} target="_blank" rel="noopener noreferrer">
          maxari.ro
        </a>
        , precum și regulile privind rambursarea sumelor achitate.
        <br />
        <br />
        Prin plasarea unei comenzi pe maxari.ro, clientul confirmă că a citit, a înțeles și a
        acceptat <Link href="/termeni-conditii" style={inlineLink}>Termenii și Condițiile</Link>{' '}
        site-ului, inclusiv prezenta Politică de Retur și Rambursare.
      </div>

      <div style={{ lineHeight: 1.75, color: '#1e293b', fontSize: '15px' }}>
        <section id="drept-retragere" style={section}>
          <h2 style={h2}>1. Dreptul de retragere</h2>
          <p style={{ marginBottom: '12px' }}>
            Clientul consumator are dreptul legal de a se retrage din contract în termen de{' '}
            <strong>14 zile calendaristice</strong> de la data primirii produsului, fără a fi
            obligat să justifice decizia.
          </p>
          <p style={{ marginBottom: '12px' }}>
            Pentru respectarea termenului, cererea de retur trebuie transmisă înainte de expirarea
            celor 14 zile calendaristice.
          </p>
          <p style={{ marginBottom: '12px' }}>
            Dreptul de retragere nu reprezintă un drept de utilizare gratuită a produsului.
            Clientul are dreptul să examineze produsul doar în măsura necesară pentru stabilirea
            naturii, caracteristicilor și funcționării acestuia, așa cum ar fi posibil într-un
            magazin fizic.
          </p>
          <p>
            Clientul răspunde pentru orice diminuare a valorii produsului cauzată de manipularea,
            purtarea, folosirea, spălarea, deteriorarea, modificarea sau returnarea produsului
            într-o stare necorespunzătoare.
          </p>
        </section>

        <section id="produse-returnabile" style={section}>
          <h2 style={h2}>2. Produse care pot fi returnate</h2>
          <p style={{ marginBottom: '12px' }}>
            Pot fi returnate doar produsele care îndeplinesc cumulativ următoarele condiții:
          </p>
          <ol style={ol}>
            <li>au fost achiziționate de pe maxari.ro;</li>
            <li>cererea de retur a fost transmisă în termen de 14 zile calendaristice de la primirea produsului;</li>
            <li>sunt în stare originală;</li>
            <li>nu au fost purtate, folosite, spălate, modificate, murdărite, parfumate sau deteriorate;</li>
            <li>au toate etichetele originale atașate și intacte;</li>
            <li>sunt returnate în ambalajul original, dacă acesta face parte din produs;</li>
            <li>sunt însoțite de toate accesoriile, documentele, cutiile, pungile sau elementele primite la livrare;</li>
            <li>sunt trimise conform instrucțiunilor comunicate de Maxari.</li>
          </ol>
          <p>
            Maxari își rezervă dreptul de a refuza returul sau de a diminua suma rambursată dacă
            produsul returnat nu respectă condițiile de mai sus.
          </p>
        </section>

        <section id="produse-excluse" style={section}>
          <h2 style={h2}>3. Produse care nu pot fi returnate</h2>
          <p style={{ marginBottom: '12px' }}>
            Nu pot fi returnate, cu excepția cazurilor în care prezintă defecte sau neconformități
            dovedite:
          </p>
          <ol style={ol}>
            <li>produse personalizate sau realizate la comandă;</li>
            <li>produse sigilate care nu pot fi returnate din motive de igienă sau protecție a sănătății, dacă au fost desigilate;</li>
            <li>lenjerie intimă, produse de igienă personală sau produse similare, dacă au fost desigilate, probate ori manipulate într-un mod care le face improprii revânzării;</li>
            <li>produse cu urme de purtare, folosire, spălare, miros, pete sau deteriorări;</li>
            <li>produse fără etichetele originale atașate;</li>
            <li>produse returnate incomplet;</li>
            <li>produse care nu mai pot fi vândute ca produse noi;</li>
            <li>produse marcate ca neeligibile pentru retur, în măsura permisă de lege.</li>
          </ol>
          <p>
            Produsele achiziționate la reducere, în campanii promoționale sau în lichidare pot fi
            returnate doar dacă respectă condițiile legale și condițiile prezentei politici.
            Reducerea de preț nu acoperă produsele purtate, deteriorate, incomplete sau returnate
            într-o stare necorespunzătoare.
          </p>
        </section>

        <section id="initiere-retur" style={section}>
          <h2 style={h2}>4. Inițierea returului</h2>
          <p style={{ marginBottom: '12px' }}>
            Pentru inițierea returului, clientul trebuie să completeze cererea de retur prin
            aplicația pusă la dispoziție de Maxari sau să contacteze compania prin email.
          </p>
          <p style={{ marginBottom: '12px' }}>
            Clientul trebuie să furnizeze corect și complet datele necesare identificării comenzii
            și procesării returului, inclusiv:
          </p>
          <ul style={ul}>
            <li>numărul comenzii;</li>
            <li>numele persoanei care a plasat comanda;</li>
            <li>adresa de email sau numărul de telefon folosit la plasarea comenzii;</li>
            <li>produsul sau produsele returnate;</li>
            <li>motivul returului;</li>
            <li>datele necesare rambursării, dacă este cazul.</li>
          </ul>
          <p>
            Cererea incompletă, incorectă sau transmisă cu date care nu permit identificarea
            comenzii poate întârzia sau bloca procesarea returului până la clarificarea situației.
          </p>
        </section>

        <section id="formular" style={section}>
          <h2 style={h2}>5. Formularul de retur</h2>
          <p style={{ marginBottom: '12px' }}>
            Formularul de retur trebuie completat corect și atașat în colet.
          </p>
          <p style={{ marginBottom: '12px' }}>
            Dacă formularul nu poate fi atașat în colet, acesta trebuie transmis prin email
            înainte de expedierea coletului sau cel târziu la momentul expedierii.
          </p>
          <p>
            Lipsa formularului poate întârzia procesarea returului, în special dacă produsul sau
            comanda nu pot fi identificate clar.
          </p>
        </section>

        <section id="date-rambursare" style={section}>
          <h2 style={h2}>6. Date necesare pentru rambursare</h2>
          <p style={{ marginBottom: '12px' }}>
            Rambursarea se face, de regulă, prin aceeași metodă de plată folosită la plasarea
            comenzii.
          </p>
          <p style={{ marginBottom: '12px' }}>
            Dacă rambursarea se face prin transfer bancar, clientul trebuie să transmită:
          </p>
          <ul style={ul}>
            <li>IBAN-ul;</li>
            <li>numele titularului contului;</li>
            <li>datele comenzii.</li>
          </ul>
          <p>
            Maxari poate solicita informații sau documente suplimentare doar în situații
            justificate, precum neconcordanțe între date, suspiciuni de fraudă, plăți eronate,
            rambursări greșite sau imposibilitatea identificării persoanei îndreptățite să
            primească suma.
          </p>
        </section>

        <section id="trimitere-colet" style={section}>
          <h2 style={h2}>7. Trimiterea coletului retur</h2>
          <p style={{ marginBottom: '12px' }}>
            Clientul poate trimite coletul prin una dintre metodele disponibile în aplicația de
            retur sau comunicate de Maxari.
          </p>

          <h3 style={h3}>7.1. Ridicare prin curierul indicat de Maxari</h3>
          <p style={{ marginBottom: '12px' }}>
            Dacă această opțiune este disponibilă, clientul poate solicita ridicarea coletului
            prin curierul indicat de Maxari.
          </p>
          <p style={{ marginBottom: '12px' }}>
            Costul acestui serviciu este de <strong>19,99 RON</strong> și se deduce din suma
            rambursată.
          </p>
          <p>
            Clientul trebuie să predea coletul ambalat corespunzător. Dacă predarea coletului nu
            se poate realiza din culpa clientului, cererea de ridicare poate fi anulată, iar
            reluarea procedurii poate genera costuri suplimentare.
          </p>

          <h3 style={h3}>7.2. Trimitere prin curier ales de client</h3>
          <p style={{ marginBottom: '12px' }}>
            Clientul poate trimite coletul printr-un curier ales de el, pe propria cheltuială și
            răspundere.
          </p>
          <p style={{ marginBottom: '12px' }}>În acest caz:</p>
          <ul style={ul}>
            <li>costul transportului de retur este suportat de client;</li>
            <li>Maxari nu rambursează costul transportului de retur;</li>
            <li>coletul trebuie trimis obligatoriu cu ramburs 0;</li>
            <li>coletele cu plată la livrare, ramburs sau cu taxe de achitat de către Maxari vor fi refuzate;</li>
            <li>clientul trebuie să păstreze AWB-ul și dovada expedierii până la finalizarea returului.</li>
          </ul>

          <div
            style={{
              background: '#fef2f2',
              border: '2px solid #fca5a5',
              borderRadius: '12px',
              padding: '16px 20px',
              margin: '16px 0',
              fontSize: '14px',
              lineHeight: 1.7,
            }}
          >
            <p style={{ margin: 0, fontWeight: 700, color: '#b91c1c', marginBottom: '6px' }}>
              🚫 INTERZIS: colete cu plata la livrare (ramburs)
            </p>
            <p style={{ margin: 0, color: '#7f1d1d' }}>
              Coletele trimise cu ramburs sau cu taxe de achitat de către Maxari vor fi refuzate
              automat la curier. Trimite întotdeauna coletul cu ramburs 0 (preplătit).
            </p>
          </div>

          <p>
            Riscul pierderii sau deteriorării coletului în timpul transportului revine clientului
            atunci când acesta alege curierul. Recomandăm asigurarea coletului la valoarea
            produselor returnate.
          </p>
        </section>

        <section id="ambalare" style={section}>
          <h2 style={h2}>8. Ambalarea produselor returnate</h2>
          <p style={{ marginBottom: '12px' }}>
            Produsele trebuie ambalate corespunzător, astfel încât să fie protejate pe durata
            transportului.
          </p>
          <p style={{ marginBottom: '12px' }}>
            Produsul trebuie returnat împreună cu toate elementele primite la livrare, inclusiv
            ambalaj, etichete, accesorii, documente și formular de retur.
          </p>
          <p>
            Deteriorarea produsului în timpul transportului, cauzată de ambalarea necorespunzătoare,
            poate duce la refuzul returului sau la diminuarea sumei rambursate.
          </p>
        </section>

        <section id="verificare" style={section}>
          <h2 style={h2}>9. Verificarea returului</h2>
          <p style={{ marginBottom: '12px' }}>
            După primirea coletului, Maxari verifică produsul returnat.
          </p>
          <p style={{ marginBottom: '12px' }}>Verificarea urmărește:</p>
          <ul style={ul}>
            <li>identificarea comenzii;</li>
            <li>confirmarea produsului returnat;</li>
            <li>verificarea stării produsului;</li>
            <li>verificarea etichetelor, ambalajului și accesoriilor;</li>
            <li>stabilirea eligibilității returului;</li>
            <li>stabilirea sumei care poate fi rambursată.</li>
          </ul>
          <p>
            Maxari poate documenta starea produsului returnat prin fotografii, note interne de
            recepție sau alte mijloace necesare soluționării returului.
          </p>
        </section>

        <section id="rambursare" style={section}>
          <h2 style={h2}>10. Rambursarea sumelor</h2>
          <p style={{ marginBottom: '12px' }}>
            Rambursarea se face după primirea și verificarea produselor returnate.
          </p>
          <p style={{ marginBottom: '12px' }}>
            În cazul retragerii totale din contract, Maxari rambursează sumele achitate de client
            pentru comanda respectivă, inclusiv costul livrării inițiale standard, în conformitate
            cu legislația aplicabilă.
          </p>
          <p style={{ marginBottom: '12px' }}>
            Nu se rambursează costurile suplimentare rezultate din alegerea de către client a unei
            metode de livrare mai scumpe decât livrarea standard oferită de Maxari.
          </p>
          <p style={{ marginBottom: '12px' }}>
            În cazul returului parțial, se rambursează doar valoarea produselor returnate și
            acceptate la retur. Costul livrării inițiale nu se rambursează dacă restul comenzii
            rămâne la client.
          </p>
          <p style={{ marginBottom: '12px' }}>
            Costul transportului de retur este suportat de client, cu excepția cazurilor în care
            produsul livrat este greșit, defect sau neconform din culpa Maxari.
          </p>
          <p style={{ marginBottom: '12px' }}>
            Dacă clientul alege ridicarea coletului prin curierul pus la dispoziție de Maxari,
            costul acestui serviciu este de <strong>19,99 RON</strong> și se deduce din suma
            rambursată.
          </p>
          <p style={{ marginBottom: '12px' }}>
            Dacă clientul alege să trimită produsul printr-un curier ales de el, costul
            transportului de retur este achitat direct de client către curier și nu se rambursează
            de Maxari.
          </p>
          <p style={{ marginBottom: '12px' }}>
            Taxa aferentă metodei de plată ramburs, dacă a fost aplicată, este afișată separat la
            momentul plasării comenzii. În cazul retragerii totale din contract, aceasta se
            rambursează împreună cu celelalte sume achitate de client, în măsura în care legea
            impune acest lucru.
          </p>
          <p style={{ marginBottom: '12px' }}>
            Maxari își rezervă dreptul de a diminua suma rambursată dacă produsul este returnat
            purtat, folosit, spălat, deteriorat, murdărit, parfumat, incomplet, fără etichete,
            fără ambalaj sau într-o stare care nu permite revânzarea ca produs nou.
          </p>
          <p>
            Rambursarea se efectuează în termenul legal aplicabil, prin aceeași metodă de plată
            folosită la comandă sau prin transfer bancar, dacă este necesar.
          </p>
        </section>

        <section id="diminuare" style={section}>
          <h2 style={h2}>11. Diminuarea rambursării</h2>
          <p style={{ marginBottom: '12px' }}>
            Dacă produsul returnat nu mai poate fi vândut ca produs nou, Maxari poate diminua suma
            rambursată proporțional cu deprecierea produsului.
          </p>
          <p style={{ marginBottom: '12px' }}>
            Diminuarea poate fi aplicată în cazul produselor care prezintă:
          </p>
          <ul style={ul}>
            <li>urme de purtare;</li>
            <li>urme de folosire;</li>
            <li>pete;</li>
            <li>mirosuri;</li>
            <li>deteriorări;</li>
            <li>ambalaj lipsă sau deteriorat;</li>
            <li>etichete lipsă sau desprinse;</li>
            <li>accesorii lipsă;</li>
            <li>modificări;</li>
            <li>semne de spălare;</li>
            <li>produs incomplet;</li>
            <li>orice altă stare incompatibilă cu revânzarea ca produs nou.</li>
          </ul>
          <p style={{ marginBottom: '12px' }}>
            În funcție de starea produsului, Maxari poate decide:
          </p>
          <ol style={ol}>
            <li>acceptarea returului cu rambursare integrală;</li>
            <li>acceptarea returului cu rambursare parțială;</li>
            <li>refuzul returului.</li>
          </ol>
        </section>

        <section id="refuzate" style={section}>
          <h2 style={h2}>12. Retururi refuzate</h2>
          <p style={{ marginBottom: '12px' }}>Returul poate fi refuzat dacă:</p>
          <ol style={ol}>
            <li>produsul nu este eligibil pentru retur;</li>
            <li>termenul de 14 zile calendaristice a fost depășit;</li>
            <li>produsul prezintă urme de purtare, folosire, spălare, deteriorare, pete sau miros;</li>
            <li>produsul nu are etichetele originale atașate;</li>
            <li>produsul este returnat incomplet;</li>
            <li>produsul nu este cel livrat de Maxari;</li>
            <li>produsul a fost deteriorat din culpa clientului;</li>
            <li>coletul a fost trimis cu ramburs, plată la livrare sau taxe de achitat de către Maxari;</li>
            <li>clientul nu furnizează datele necesare identificării comenzii;</li>
            <li>există indicii de fraudă, abuz sau utilizare necorespunzătoare a politicii de retur.</li>
          </ol>
          <p>
            În cazul unui retur refuzat, clientul va fi informat cu privire la motivul refuzului.
            Produsul poate fi retrimis clientului, iar costul reexpedierii poate fi suportat de
            client.
          </p>
        </section>

        <section id="defecte" style={section}>
          <h2 style={h2}>13. Produse defecte, deteriorate sau livrate greșit</h2>
          <p style={{ marginBottom: '12px' }}>
            Dacă produsul primit este defect, deteriorat în transport sau diferit de cel comandat,
            clientul trebuie să contacteze Maxari în cel mai scurt timp, de preferat în maximum{' '}
            <strong>48 de ore</strong> de la primirea coletului.
          </p>
          <p style={{ marginBottom: '12px' }}>Sesizarea trebuie să includă:</p>
          <ul style={ul}>
            <li>numărul comenzii;</li>
            <li>descrierea problemei;</li>
            <li>fotografii clare ale produsului;</li>
            <li>fotografii ale ambalajului;</li>
            <li>fotografii ale etichetei de transport, dacă este cazul.</li>
          </ul>
          <p style={{ marginBottom: '12px' }}>
            Dacă sesizarea este confirmată, Maxari poate decide, în funcție de situație:
          </p>
          <ol style={ol}>
            <li>înlocuirea produsului;</li>
            <li>remedierea problemei;</li>
            <li>rambursarea sumei achitate;</li>
            <li>emiterea unui AWB gratuit pentru retur.</li>
          </ol>
          <p style={{ marginBottom: '12px' }}>
            În cazul produselor greșite, defecte sau neconforme din culpa Maxari, costul
            transportului de retur este suportat de Maxari.
          </p>
          <p>
            Termenul de 48 de ore este recomandat pentru documentarea rapidă a situațiilor de
            transport sau livrare greșită și nu limitează drepturile legale ale clientului privind
            garanția sau conformitatea produselor.
          </p>
        </section>

        <section id="schimb" style={section}>
          <h2 style={h2}>14. Schimbul de produse</h2>
          <p style={{ marginBottom: '12px' }}>
            Schimbul de produse este posibil doar dacă Maxari acceptă această opțiune și dacă
            produsul dorit este disponibil în stoc.
          </p>
          <p style={{ marginBottom: '12px' }}>
            În lipsa disponibilității produsului solicitat la schimb, clientul poate returna
            produsul conform prezentei politici și poate plasa o comandă nouă.
          </p>
          <p>
            Maxari nu garantează rezervarea produselor pentru schimb până la finalizarea returului
            și confirmarea disponibilității în stoc.
          </p>
        </section>

        <section id="abuzive" style={section}>
          <h2 style={h2}>15. Retururi abuzive sau repetate</h2>
          <p style={{ marginBottom: '12px' }}>
            Maxari își rezervă dreptul de a analiza și restricționa retururile care indică un
            comportament abuziv, fraudulos sau contrar bunei-credințe.
          </p>
          <p style={{ marginBottom: '12px' }}>Pot fi considerate abuzive:</p>
          <ul style={ul}>
            <li>retururile repetate ale produselor purtate sau deteriorate;</li>
            <li>folosirea produselor înainte de retur;</li>
            <li>returnarea altor produse decât cele livrate;</li>
            <li>trimiterea de colete goale sau incomplete;</li>
            <li>transmiterea de date false sau contradictorii;</li>
            <li>solicitarea rambursării fără returnarea produsului;</li>
            <li>folosirea politicii de retur pentru testare, purtare temporară sau avantaj nejustificat.</li>
          </ul>
          <p>
            În astfel de situații, Maxari poate refuza returul, poate solicita verificări
            suplimentare sau poate limita accesul la anumite facilități operaționale, cu
            respectarea legislației aplicabile.
          </p>
        </section>

        <section id="litigii" style={section}>
          <h2 style={h2}>16. Reclamații și litigii</h2>
          <p style={{ marginBottom: '12px' }}>
            Pentru orice nemulțumire legată de retur, clientul trebuie să contacteze Maxari în
            primă instanță, folosind datele din secțiunea Contact.
          </p>
          <p style={{ marginBottom: '12px' }}>
            Maxari va analiza reclamația și va răspunde în termenul legal aplicabil.
          </p>
          <p>
            Dacă soluția oferită nu este considerată satisfăcătoare, clientul se poate adresa
            autorităților competente sau instanțelor de judecată competente potrivit legii.
          </p>
        </section>

        <section id="date-personale" style={section}>
          <h2 style={h2}>17. Date personale</h2>
          <p style={{ marginBottom: '12px' }}>
            Pentru procesarea retururilor, Maxari poate prelucra date personale precum:
          </p>
          <ul style={ul}>
            <li>nume și prenume;</li>
            <li>email;</li>
            <li>telefon;</li>
            <li>adresă;</li>
            <li>date despre comandă;</li>
            <li>produse returnate;</li>
            <li>motivul returului;</li>
            <li>IBAN și titular cont, dacă este cazul;</li>
            <li>semnătură pe formularul de retur;</li>
            <li>corespondență privind returul.</li>
          </ul>
          <p style={{ marginBottom: '12px' }}>
            Datele sunt folosite pentru gestionarea returului, procesarea rambursării, respectarea
            obligațiilor legale, prevenirea fraudelor și apărarea drepturilor Maxari.
          </p>
          <p>
            Datele pot fi transmise către curieri, procesatori de plăți, furnizori tehnici,
            contabili sau autorități, doar dacă este necesar și conform legii.
          </p>
        </section>

        <section id="modificari" style={section}>
          <h2 style={h2}>18. Modificarea politicii</h2>
          <p style={{ marginBottom: '12px' }}>
            Maxari poate modifica prezenta politică pentru a reflecta schimbări legislative,
            comerciale, operaționale sau logistice.
          </p>
          <p>
            Versiunea aplicabilă este cea publicată pe site la momentul plasării comenzii, cu
            excepția cazului în care legea prevede altfel.
          </p>
        </section>

        <section id="contact" style={section}>
          <h2 style={h2}>19. Contact</h2>
          <p style={{ marginBottom: '12px' }}>
            Pentru întrebări sau solicitări privind retururile:
          </p>
          <ul style={ul}>
            <li>Email: <a href="mailto:info@maxari.ro" style={inlineLink}>info@maxari.ro</a></li>
            <li>Program relații clienți: Luni – Vineri, 12:00 – 16:00</li>
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
