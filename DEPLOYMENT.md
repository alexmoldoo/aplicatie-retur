# Ghid Deployment pe xpy.ro

Acest ghid te va ajuta să deploy aplicația pe domeniul tău xpy.ro.

## Structura aplicației

- **Aplicația principală**: `/` - Procesul de retur pentru clienți
- **Panou Admin**: `/admin` - Configurare Shopify și SKU-uri excluse

## Pași pentru deployment

### 1. Pregătire aplicație

Aplicația este pregătită pentru deployment. Toate funcționalitățile sunt implementate:
- ✅ Sistem autentificare admin
- ✅ Dashboard configurare Shopify
- ✅ Gestionare SKU-uri excluse
- ✅ Conectare configurație cu aplicația de retur

### 2. Opțiuni de hosting

#### Opțiunea 1: Vercel (Recomandat - GRATUIT)

1. **Creează cont Vercel**:
   - Mergi la [vercel.com](https://vercel.com)
   - Sign up cu GitHub/GitLab/Bitbucket

2. **Deploy aplicația**:
   ```bash
   # Instalează Vercel CLI
   npm i -g vercel
   
   # Deploy
   vercel
   ```

3. **Configurează domeniul**:
   - În Vercel Dashboard → Project → Settings → Domains
   - Adaugă domeniul `xpy.ro`
   - Configurează DNS-ul conform instrucțiunilor Vercel

#### Opțiunea 2: Netlify (GRATUIT)

1. **Creează cont Netlify**
2. **Deploy din Git** sau folosește Netlify CLI
3. **Configurează domeniul** în Netlify Dashboard

#### Opțiunea 3: Server propriu (VPS)

1. **Instalează Node.js** pe server
2. **Clonează repository-ul**
3. **Instalează dependențele**: `npm install`
4. **Build aplicația**: `npm run build`
5. **Rulează**: `npm start`
6. **Configurează Nginx** ca reverse proxy
7. **Configurează SSL** cu Let's Encrypt

### 3. Configurare DNS pentru xpy.ro

Adaugă următoarele înregistrări DNS:

```
Type: A
Name: @
Value: [IP-ul serverului sau Vercel/Netlify]

Type: CNAME
Name: www
Value: xpy.ro
```

### 4. Variabile de mediu (opțional)

Dacă vrei să folosești variabile de mediu în loc de configurarea din admin:

```env
SHOPIFY_DOMAIN=magazinul-meu.myshopify.com
SHOPIFY_ACCESS_TOKEN=shpat_xxxxxxxxxxxx
```

**NOTĂ**: Configurația din `/admin` are prioritate peste variabilele de mediu.

### 5. Prima utilizare

1. **Accesează** `https://xpy.ro/admin`
2. **Creează cont admin**:
   - Nume, Prenume, Email, Parolă
   - Minim 6 caractere pentru parolă
3. **Configurează Shopify**:
   - Titlu magazin (ex: MAXARI.RO)
   - Domain Shopify (ex: magazinul-meu.myshopify.com)
   - Access Token Shopify
4. **Configurează SKU-uri excluse**:
   - Adaugă SKU-urile care nu pot fi returnate
   - Default: RMA-009, RMA-025

### 6. Testare

1. **Testează aplicația de retur**:
   - Accesează `https://xpy.ro`
   - Completează formularul de retur
   - Verifică că comanda se găsește în Shopify

2. **Testează configurarea**:
   - Modifică SKU-uri excluse în admin
   - Verifică că produsele cu aceste SKU-uri nu pot fi returnate

## Structura fișierelor de date

Aplicația stochează datele în directorul `data/`:
- `data/users.json` - Utilizatori admin
- `data/config.json` - Configurație Shopify și SKU-uri

**IMPORTANT**: Aceste fișiere NU sunt versionate în Git (sunt în .gitignore).

## Securitate

- Parolele sunt hash-uite cu SHA-256
- Sesiunile sunt stocate în cookies httpOnly
- Token-urile Shopify sunt stocate local, nu în Git
- Rutele admin necesită autentificare

## Suport

Pentru probleme sau întrebări:
- Verifică log-urile serverului
- Verifică configurația în `/admin`
- Asigură-te că Shopify API are permisiunile necesare

## Next Steps

După deployment:
1. Configurează Shopify API (vezi SHOPIFY_SETUP.md)
2. Testează procesul complet de retur
3. Personalizează textele în `config/texts.ts` dacă este necesar

