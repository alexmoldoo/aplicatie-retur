# Aplicație Retur - MAXARI

Aplicație web modernă pentru gestionarea procesului de retur al comenzilor, dezvoltată cu Next.js și React.

## Funcționalități

- **Step 1 - Detalii comandă**: Validare progresivă a comenzii prin Shopify API
  - Căutare după număr comandă (prioritate 1)
  - Căutare după număr de telefon (prioritate 2)
  - Căutare după nume complet (nu se validează doar după nume)
  - Căutare după email (apare automat când este necesar)
- **Step 2 - Selectare produse**: Selectare produse din comandă pentru retur cu specificarea motivului
- **Step 3 - Date rambursare**: Configurare metodă de rambursare și încărcare documente
- **Generare documente**: Descărcare cerere de retur în format text
- **Pagini suplimentare**: Termeni & Condiții, Politica de retur, Contact
- **Integrare Shopify**: Conectare directă cu Shopify API pentru validare comenzi reale

## Tehnologii

- Next.js 14
- React 18
- TypeScript
- CSS inline pentru styling

## Instalare

1. Instalează dependențele:
```bash
npm install
```

2. Configurează Shopify API:
   - Creează un fișier `.env.local` în root-ul proiectului
   - Completează cu datele tale Shopify:
   ```env
   SHOPIFY_DOMAIN=your-shop.myshopify.com
   SHOPIFY_ACCESS_TOKEN=your-access-token-here
   ```
   - Pentru a obține Access Token:
     1. Mergi în Shopify Admin > Settings > Apps and sales channels
     2. Click pe "Develop apps" > "Create an app"
     3. Dă un nume aplicației și creează-o
     4. În secțiunea "Admin API access scopes", activează:
        - `read_orders`
        - `read_customers` (opțional)
     5. Instalează aplicația și copiază "Admin API access token"

3. Rulează aplicația în modul de dezvoltare:
```bash
npm run dev
```

4. Deschide browserul la [http://localhost:3000](http://localhost:3000)

## Structura proiectului

```
├── app/
│   ├── layout.tsx          # Layout principal
│   ├── page.tsx             # Pagina principală
│   ├── globals.css          # Stiluri globale
│   ├── termeni-conditii/    # Pagina Termeni & Condiții
│   ├── politica-retur/      # Pagina Politica de retur
│   └── contact/             # Pagina Contact
├── app/
│   ├── api/
│   │   └── search-order/    # API route pentru căutare comenzi Shopify
│   └── ...
├── components/
│   ├── ReturnProcess.tsx    # Componenta principală pentru procesul de retur
│   ├── StepIndicator.tsx    # Indicator de progres pentru pași
│   ├── OrderDetailsStep.tsx # Step 1: Detalii comandă cu validare progresivă
│   ├── ProductsStep.tsx     # Step 2: Selectare produse
│   └── RefundDetailsStep.tsx # Step 3: Date rambursare
├── lib/
│   └── shopify.ts           # Serviciu pentru interacțiunea cu Shopify API
├── .env.local               # Configurație Shopify (nu se versionizează)
└── package.json
```

## Utilizare

1. **Inițiere retur**: Completează formularul cu detaliile comenzii
2. **Selectare produse**: Alege produsele pentru retur și specifică motivul
3. **Configurare rambursare**: Alege metoda de rambursare și încarcă documentele necesare
4. **Finalizare**: Trimite cererea și descarcă documentele generate

## Configurare Shopify API

Aplicația folosește Shopify Admin API pentru validarea comenzilor. Strategia de căutare este:

1. **Număr comandă** (prioritate 1) - Cel mai ușor și rapid
2. **Număr de telefon** (prioritate 2) - Dacă nu se găsește după număr comandă
3. **Nume complet** (prioritate 3) - Nu se validează doar după nume (sunt multe persoane cu același nume)
4. **Email** (prioritate 4) - Apare automat când este necesar, dacă nu s-a găsit după primele metode

## Note

- Aplicația este conectată la Shopify API pentru validare comenzi reale
- Funcționalitatea de generare PDF poate fi extinsă cu biblioteci precum jsPDF sau PDFKit
- Asigură-te că ai configurat corect variabilele de mediu în `.env.local`

## Dezvoltare viitoare

- Integrare cu API backend pentru validare comenzi reale
- Generare PDF profesional pentru cererea de retur
- Sistem de tracking pentru statusul returului
- Notificări email pentru fiecare etapă
- Dashboard admin pentru gestionarea retururilor

# aplicatie-retur
