# Ghid de Configurare Shopify API

Acest ghid te va ajuta să configurezi conectarea aplicației la Shopify API pentru validarea comenzilor.

## Pași de Configurare

### 1. Accesează Shopify Admin

- Loghează-te în contul tău Shopify Admin
- Navighează la **Settings** > **Apps and sales channels**

### 2. Creează o Aplicație

1. Click pe butonul **"Develop apps"** (sau "Manage private apps" în versiuni mai vechi)
2. Click pe **"Create an app"**
3. Dă un nume aplicației (ex: "Aplicație Retur")
4. Click pe **"Create app"**

### 3. Configurează Permisiunile API

1. În aplicația creată, mergi la secțiunea **"Admin API access scopes"**
2. Activează următoarele permisiuni:

#### ✅ Accese OBLIGATORII (pentru funcționalitate de bază):

- **`read_orders`** - **OBLIGATORIU**
  - Pentru căutare comenzi după număr comandă, telefon, email
  - Pentru citire detalii comenzi (produse, prețuri, date)
  - Pentru detectare metodă de plată (card/bancar)
  - Pentru verificare eligibilitate retur (data comenzii)

#### ⚠️ Accese RECOMANDATE (pentru funcționalități viitoare):

- **`write_refunds`** - Pentru crearea efectivă a returului în Shopify
  - Va fi necesar când implementăm crearea returului automat
  - Fără acest acces, returul se poate crea doar manual în Shopify

#### 📋 Accese OPȚIONALE:

- **`read_customers`** - Pentru validare suplimentară clienți (nu este folosit momentan)
- **`read_products`** - Pentru imagini și detalii produse (nu este folosit momentan)
- **`read_product_listings`** - Pentru imagini produse (nu este folosit momentan)

### 📝 Lista completă pentru copiere rapidă:

În Shopify Admin, când configurezi permisiunile, caută și activează:
```
✅ read_orders          (OBLIGATORIU)
⚠️ write_refunds        (Recomandat pentru viitor)
```

### 4. Instalează Aplicația

1. Click pe butonul **"Install app"** sau **"Save"**
2. Confirmă instalarea

### 5. Obține Access Token

1. După instalare, vei vedea secțiunea **"Admin API access token"**
2. Click pe **"Reveal token once"** sau **"Show token"**
3. **Copiază token-ul** - vei avea nevoie de el pentru configurare

⚠️ **IMPORTANT**: Token-ul este afișat o singură dată. Dacă îl pierzi, va trebui să generezi unul nou.

### 6. Obține Domain-ul Magazinului

1. Mergi la **Settings** > **Domains**
2. Găsește domain-ul tău Shopify (ex: `magazinul-meu.myshopify.com`)
3. **Nu include** `https://` sau `http://` - doar domain-ul (ex: `magazinul-meu.myshopify.com`)

### 7. Configurează Aplicația

1. În root-ul proiectului, creează fișierul `.env.local` (dacă nu există deja)
2. Adaugă următoarele linii:

```env
SHOPIFY_DOMAIN=magazinul-meu.myshopify.com
SHOPIFY_ACCESS_TOKEN=shpat_xxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

**Înlocuiește:**
- `magazinul-meu.myshopify.com` cu domain-ul tău real
- `shpat_xxxxxxxxxxxxxxxxxxxxxxxxxxxx` cu token-ul copiat la pasul 5

### 8. Verifică Configurarea

1. Repornește serverul de dezvoltare:
   ```bash
   # Oprește serverul (Ctrl+C) și repornește-l
   npm run dev
   ```

2. Testează aplicația introducând un număr de comandă real din magazinul tău Shopify

## Exemple de Configurare

### Exemplu `.env.local`:

```env
SHOPIFY_DOMAIN=my-awesome-shop.myshopify.com
SHOPIFY_ACCESS_TOKEN=shpat_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6
```

## Securitate

⚠️ **IMPORTANT pentru producție:**

1. **Nu versioniza** fișierul `.env.local` - este deja în `.gitignore`
2. Pentru producție (Vercel, Netlify, etc.), adaugă variabilele de mediu în panoul de control al platformei
3. Folosește token-uri cu permisiuni minime necesare
4. Regenerează token-ul dacă suspectezi că a fost compromis

## Troubleshooting

### Eroare: "Shopify API error: 401"
- Verifică dacă token-ul este corect
- Verifică dacă aplicația este instalată corect
- Asigură-te că token-ul nu a expirat

### Eroare: "Shopify API error: 403"
- Verifică dacă ai activat permisiunile necesare (`read_orders`)
- Asigură-te că aplicația este instalată

### Eroare: "Configurația Shopify nu este completă"
- Verifică dacă fișierul `.env.local` există
- Verifică dacă variabilele `SHOPIFY_DOMAIN` și `SHOPIFY_ACCESS_TOKEN` sunt setate corect
- Repornește serverul după modificarea `.env.local`

### Comenzile nu se găsesc
- Verifică dacă comenzile există în Shopify
- Verifică dacă numărul comenzii este corect (format: #1001, 1001, etc.)
- Verifică dacă telefonul/emailul este exact ca în Shopify

## Suport

Pentru probleme specifice Shopify API, consultă:
- [Shopify Admin API Documentation](https://shopify.dev/api/admin-rest)
- [Shopify API Authentication](https://shopify.dev/apps/auth)

