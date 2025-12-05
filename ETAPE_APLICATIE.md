# Etape Aplicație Retur - Documentație Completă

Acest document prezintă toate etapele aplicației, ce se vede în frontend, ce texte pot fi modificate și ce accese API Shopify sunt necesare.

---

## 📋 CUPRINS

1. [Step 1 - Detalii Comandă](#step-1---detalii-comandă)
2. [Step 2 - Selectare Produse](#step-2---selectare-produse)
3. [Step 3 - Date Rambursare](#step-3---date-rambursare)
4. [Pagini Suplimentare](#pagini-suplimentare)
5. [Accese API Shopify Necesare](#accese-api-shopify-necesare)
6. [Funcționalități de Implementat](#funcționalități-de-implementat)

---

## STEP 1 - Detalii Comandă

### Ce se vede în frontend:

1. **Header**
   - Brand: "MAXARI" (poate fi modificat)
   - Titlu: "PROCES DE RETUR" (poate fi modificat)
   - Subtitlu: "Inițiază returul în câțiva pași simpli" (poate fi modificat)
   - Icon refresh în colțul dreapta sus

2. **Indicator de progres**
   - Step 1: "Detalii comandă" (ACTIV)
   - Step 2: "Produse" (inactiv)
   - Step 3: "Date rambursare" (inactiv)

3. **Formular căutare comandă**
   - **Câmp 1: Nume & Prenume**
     - Label: "Nume & Prenume"
     - Placeholder: "Introdu numele complete de pe comandă"
     - Validare: Required dacă nu sunt completate celelalte câmpuri
   
   - **Câmp 2: Număr comandă**
     - Label: "Număr comandă"
     - Placeholder: "Ex: #12345"
     - Hint: "Cel mai ușor mod de a găsi comanda"
     - Validare: Required dacă nu sunt completate celelalte câmpuri
   
   - **Câmp 3: Număr de telefon**
     - Label: "Număr de telefon"
     - Placeholder: "Sau introdu numărul de telefon folosit la comandă"
     - Validare: Required dacă nu sunt completate celelalte câmpuri
   
   - **Câmp 4: Email** (apare automat când este necesar)
     - Label: "Email"
     - Placeholder: "Introdu email-ul folosit la comandă"
     - Apare când: Nu s-a găsit comanda după număr comandă sau telefon
     - Mesaj: "Comanda nu a fost găsită după număr comandă sau telefon. Vă rugăm să introduceți email-ul."

4. **Mesaje informații**
   - Text default: "Vom încerca să găsim comanda pe baza informațiilor furnizate."
   - Text loading: "Căutăm comanda..."
   - Text nevoie email: "Vă rugăm să introduceți email-ul pentru a continua căutarea."

5. **Buton căutare**
   - Text: "CAUTĂ COMANDA"
   - Text loading: "CĂUTĂM..."
   - Stil: Gradient albastru-verde

6. **Mesaje eroare**
   - Afișare în casetă roșie cu border
   - Mesaje specifice pentru fiecare tip de eroare

### Logica de căutare (ordine):

1. **Prioritate 1**: Căutare după număr comandă
2. **Prioritate 2**: Căutare după telefon (dacă nu s-a găsit la pasul 1)
3. **Prioritate 3**: Căutare după nume (NU se validează doar după nume)
4. **Prioritate 4**: Căutare după email (apare câmpul automat)

### Accese API Shopify necesare:

- ✅ `read_orders` - Pentru căutare comenzi
- ⚠️ `read_customers` - Opțional, pentru validare suplimentară

### Date returnate de API:

```typescript
{
  id: string                    // ID comanda Shopify
  nume: string                  // Nume complet client
  numarComanda: string          // Număr comandă (#1001)
  telefon: string               // Telefon client
  email: string                 // Email client
  products: Array<{            // Lista produselor
    id: string                  // ID produs Shopify
    nume: string                // Nume produs
    cantitate: number          // Cantitate comandată
    pret: number               // Preț unitar
    variant_id: string         // ID variantă produs
  }>
  total: number                // Total comandă
  currency: string             // Monedă
  dataComanda: string          // Data comenzii
}
```

---

## STEP 2 - Selectare Produse

### Ce se vede în frontend:

1. **Titlu secțiune**
   - Text: "Selectează produsele pentru retur" (poate fi modificat)

2. **Lista produselor** (din comandă)
   - Pentru fiecare produs:
     - **Checkbox** pentru selectare/deselectare
     - **Nume produs** (bold)
     - **Cantitate**: "Cantitate: X buc"
     - **Preț**: "Preț: XX.XX RON"
     - **Imagine produs** (opțional, nu este implementat încă)
   
   - Când produsul este selectat:
     - **Dropdown "Motiv retur"** (required)
     - Opțiuni:
       - "Produs defect"
       - "Produs nu corespunde descrierii"
       - "Produs nu se potrivește"
       - "Am comandat greșit"
       - "Alt motiv"

3. **Butoane navigare**
   - Buton "ÎNAPOI" (gri)
   - Buton "CONTINUĂ" (gradient albastru-verde)

### Validări:

- Cel puțin un produs trebuie selectat
- Fiecare produs selectat trebuie să aibă motiv retur completat

### Accese API Shopify necesare:

- ✅ `read_orders` - Deja avem produsele din Step 1
- ⚠️ `read_products` - Pentru detalii suplimentare produse (imagini, descrieri)
- ⚠️ `read_product_listings` - Pentru imagini produse

### Date necesare pentru produse:

```typescript
{
  id: string              // ID produs
  nume: string            // Nume produs
  cantitate: number      // Cantitate comandată
  pret: number           // Preț unitar
  variant_id: string     // ID variantă
  imagine?: string       // URL imagine (de implementat)
  motivRetur: string    // Motiv retur selectat
  selected: boolean     // Dacă este selectat pentru retur
}
```

### Funcționalități de adăugat:

- [ ] Afișare imagini produse
- [ ] Posibilitate de a returna doar o parte din cantitate (ex: 2 din 3 bucăți)
- [ ] Validare că nu se returnează mai mult decât s-a comandat
- [ ] Afișare SKU / cod produs
- [ ] Afișare variantă produs (mărime, culoare, etc.)

---

## STEP 3 - Date Rambursare

### Ce se vede în frontend:

1. **Titlu secțiune**
   - Text: "Date rambursare" (poate fi modificat)

2. **Rezumat retur** (caseta gri)
   - Comandă: Număr comandă
   - Produse: Număr produse returnate
   - **Total rambursare**: Suma totală (bold)

3. **Metodă rambursare** (radio buttons)
   - Opțiune 1: "Card bancar"
   - Opțiune 2: "Cont bancar"
   - Opțiune 3: "Voucher magazin"
   
   - Când selectează "Card bancar":
     - Câmp: "Număr card *"
     - Placeholder: "1234 5678 9012 3456"
   
   - Când selectează "Cont bancar":
     - Câmp: "IBAN *"
     - Placeholder: "RO49 AAAA 1B31 0075 9384 0000"
     - Câmp: "Adresă completă *"
     - Placeholder: "Strada, număr, oraș, județ"

4. **Upload documente** (opțional)
   - Label: "Documente necesare (opțional)"
   - Acceptă: PDF, JPG, JPEG, PNG
   - Afișare lista fișiere încărcate cu buton "Șterge"

5. **Buton descărcare document**
   - Text: "Descarcă cererea de retur (PDF)"
   - Generează document text cu toate detaliile returului

6. **Butoane navigare**
   - Buton "ÎNAPOI" (gri)
   - Buton "FINALIZEAZĂ RETURUL" (gradient albastru-verde)

### Accese API Shopify necesare:

- ⚠️ `write_refunds` - Pentru crearea returului în Shopify
- ⚠️ `read_payments` - Pentru verificare metode de plată disponibile
- ⚠️ `write_draft_orders` - Pentru crearea comenzii de retur (dacă este necesar)
- ⚠️ `write_fulfillments` - Pentru gestionarea retururilor
- ⚠️ `read_orders` - Pentru verificare status comandă

### Date trimise la finalizare:

```typescript
{
  orderId: string              // ID comanda originală
  products: Array<{            // Produse returnate
    id: string
    variant_id: string
    quantity: number
    reason: string
  }>
  refundMethod: 'card' | 'cont' | 'voucher'
  refundDetails: {
    card?: string
    iban?: string
    address?: string
  }
  documents: File[]            // Documente încărcate
  totalRefund: number         // Suma totală de rambursat
}
```

### Funcționalități de adăugat:

- [ ] Generare PDF profesional (nu doar text)
- [ ] Validare IBAN
- [ ] Validare număr card (Luhn algorithm)
- [ ] Trimitere email de confirmare clientului
- [ ] Creare retur în Shopify cu status "pending"
- [ ] Generare etichetă retur (dacă Shopify suportă)
- [ ] Tracking status retur
- [ ] Notificări pentru fiecare etapă

---

## Pagini Suplimentare

### 1. Termeni & Condiții (`/termeni-conditii`)

**Texte editabile:**
- Titlu: "Termeni & Condiții"
- Secțiuni:
  - "Prezentare generală"
  - "Condiții de retur"
  - "Procesul de retur"
  - "Rambursare"

**Link în footer:** "Termeni & Condiții"

### 2. Politica de retur (`/politica-retur`)

**Texte editabile:**
- Titlu: "Politica de retur"
- Secțiuni:
  - "Dreptul de retur"
  - "Produse care nu pot fi returnate"
  - "Costuri de retur"
  - "Procesul de returnare"
  - "Contact"

**Link în footer:** "Politica de retur"

### 3. Contact (`/contact`)

**Texte editabile:**
- Titlu: "Contact"
- Informații contact:
  - Email: "contact@maxari.ro"
  - Telefon: "+40 123 456 789"
  - Program: "Luni - Vineri: 9:00 - 18:00"
- Formular contact:
  - Nume complet *
  - Email *
  - Telefon
  - Mesaj *

**Link în footer:** "Contact"

---

## Accese API Shopify Necesare

### Accese deja implementate:

✅ **read_orders** - Căutare și citire comenzi

### Accese necesare pentru funcționalități complete:

#### Pentru Step 1 (Detalii Comandă):
- ✅ `read_orders` - Deja implementat
- ⚠️ `read_customers` - Opțional, pentru validare suplimentară

#### Pentru Step 2 (Selectare Produse):
- ✅ `read_orders` - Deja avem produsele
- ⚠️ `read_products` - Pentru imagini și detalii produse
- ⚠️ `read_product_listings` - Pentru imagini produse

#### Pentru Step 3 (Date Rambursare):
- ⚠️ `write_refunds` - **CRITIC** - Pentru crearea returului
- ⚠️ `read_payments` - Pentru verificare metode de plată
- ⚠️ `read_orders` - Pentru verificare status și detalii comandă
- ⚠️ `write_fulfillments` - Pentru gestionarea retururilor

#### Pentru funcționalități avansate:
- ⚠️ `write_draft_orders` - Pentru crearea comenzii de retur
- ⚠️ `read_inventory` - Pentru verificare stoc la retur
- ⚠️ `write_orders` - Pentru actualizare status comandă

### Lista completă recomandată:

```env
# Accese necesare pentru funcționalitate completă:
read_orders          ✅ Deja implementat
read_customers        ⚠️ Recomandat
read_products         ⚠️ Pentru imagini produse
read_product_listings ⚠️ Pentru imagini produse
write_refunds         ⚠️ CRITIC - Pentru crearea returului
read_payments         ⚠️ Pentru verificare metode de plată
write_fulfillments    ⚠️ Pentru gestionarea retururilor
read_inventory        ⚠️ Opțional - Pentru verificare stoc
```

---

## Funcționalități de Implementat

### Prioritate Înaltă:

1. **Creare retur în Shopify** (`write_refunds`)
   - Când utilizatorul finalizează Step 3
   - Creare refund în Shopify cu produsele selectate
   - Setare status "pending" sau "approved"

2. **Generare PDF profesional**
   - Înlocuire generare text cu PDF real
   - Include logo, date completă, semnătură, etc.

3. **Trimite email confirmare**
   - Email către client cu detalii retur
   - Include document PDF atașat
   - Instrucțiuni pentru returnare fizică

### Prioritate Medie:

4. **Afisare imagini produse**
   - Preia imagini din Shopify API
   - Afișare în Step 2

5. **Validare cantități**
   - Nu permite retur mai mult decât comandat
   - Opțiune retur parțial (ex: 2 din 3 bucăți)

6. **Tracking status retur**
   - Pagină separată pentru verificare status
   - Actualizare automată din Shopify

### Prioritate Scăzută:

7. **Generare etichetă retur**
   - Dacă Shopify suportă generare etichetă
   - Descărcare PDF etichetă

8. **Dashboard admin**
   - Vizualizare toate retururile
   - Gestionare status retururi
   - Statistici

9. **Notificări**
   - Email pentru fiecare etapă
   - SMS opțional
   - Notificări în aplicație

---

## Texte Editabile în Frontend

Toate textele pot fi modificate direct în componentele React:

### OrderDetailsStep.tsx:
- "Nume & Prenume"
- "Introdu numele complete de pe comandă"
- "Număr comandă"
- "Ex: #12345"
- "Cel mai ușor mod de a găsi comanda"
- "Număr de telefon"
- "Sau introdu numărul de telefon folosit la comandă"
- "Email"
- "Vom încerca să găsim comanda pe baza informațiilor furnizate."
- "CAUTĂ COMANDA"

### ProductsStep.tsx:
- "Selectează produsele pentru retur"
- "Cantitate: X buc"
- "Preț: XX.XX RON"
- "Motiv retur *"
- "Selectează motivul..."
- Motivele retur (lista poate fi modificată)
- "ÎNAPOI"
- "CONTINUĂ"

### RefundDetailsStep.tsx:
- "Date rambursare"
- "Rezumat retur"
- "Comandă:"
- "Produse:"
- "Total rambursare:"
- "Metodă rambursare *"
- "Card bancar"
- "Cont bancar"
- "Voucher magazin"
- "Număr card *"
- "IBAN *"
- "Adresă completă *"
- "Documente necesare (opțional)"
- "Descarcă cererea de retur (PDF)"
- "ÎNAPOI"
- "FINALIZEAZĂ RETURUL"

### ReturnProcess.tsx:
- "MAXARI"
- "PROCES DE RETUR"
- "Inițiază returul în câțiva pași simpli"

---

## Concluzie

Aplicația are 3 etape principale + 3 pagini suplimentare. Pentru funcționalitate completă, este necesar să se adauge accesul `write_refunds` în Shopify API pentru crearea efectivă a returului.

**Următorul pas**: Configurare accese API Shopify și implementare creare retur în Shopify.

