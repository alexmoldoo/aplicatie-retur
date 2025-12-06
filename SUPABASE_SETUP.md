# Ghid Configurare Supabase

Acest ghid te va ajuta să configurezi Supabase pentru stocarea persistentă a datelor în producție.

## Pași de Configurare

### 1. Creează Cont Supabase

1. Mergi la [supabase.com](https://supabase.com)
2. Sign up cu GitHub sau email
3. Creează un proiect nou
4. Așteaptă câteva minute până când proiectul este gata

### 2. Obține Credențialele

1. În Supabase Dashboard → Project Settings → API
2. Copiază următoarele:
   - **Project URL** (ex: `https://xxxxx.supabase.co`)
   - **anon public** key (cheia publică)
   - **service_role** key (cheia secretă - NU o partaja niciodată!)

### 3. Creează Schema Bazei de Date

1. Mergi la Supabase Dashboard → SQL Editor
2. Click pe "New query"
3. Copiază și rulează următorul SQL:

```sql
-- Tabel utilizatori admin
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nume TEXT NOT NULL,
  prenume TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabel configurație aplicație
CREATE TABLE app_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shopify_domain TEXT DEFAULT '',
  shopify_access_token TEXT DEFAULT '',
  shop_title TEXT DEFAULT '',
  excluded_skus JSONB DEFAULT '[]'::jsonb,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Inserează configurația inițială
INSERT INTO app_config (id) VALUES (gen_random_uuid());

-- Tabel retururi
CREATE TABLE returns (
  id_retur TEXT PRIMARY KEY,
  numar_comanda TEXT NOT NULL,
  order_data JSONB NOT NULL,
  products JSONB NOT NULL,
  refund_data JSONB NOT NULL,
  signature TEXT NOT NULL,
  total_refund DECIMAL(10,2) NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('INITIAT', 'IN_ASTEPTARE_COLET', 'COLET_PRIMIT', 'PROCESAT', 'FINALIZAT', 'ANULAT')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  pdf_path TEXT,
  qr_code_data TEXT,
  awb_number TEXT,
  shipping_receipt_photo TEXT,
  package_label_photo TEXT
);

-- Indexuri pentru performanță
CREATE INDEX idx_returns_numar_comanda ON returns(numar_comanda);
CREATE INDEX idx_returns_status ON returns(status);
CREATE INDEX idx_returns_created_at ON returns(created_at DESC);
CREATE INDEX idx_users_email ON users(email);
```

4. Click pe "Run" pentru a executa query-ul

### 4. Configurează Variabilele de Mediu în Vercel

1. Mergi la Vercel Dashboard → Project → Settings → Environment Variables
2. Adaugă următoarele variabile:

```
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**IMPORTANT**: 
- Înlocuiește `xxxxx.supabase.co` cu URL-ul tău real
- Folosește cheia `anon public` pentru `SUPABASE_ANON_KEY`
- Folosește cheia `service_role` pentru `SUPABASE_SERVICE_ROLE_KEY`
- **NU** partaja niciodată `SUPABASE_SERVICE_ROLE_KEY` public!

### 5. Redeploy Aplicația

1. După ce ai adăugat variabilele de mediu în Vercel
2. Mergi la Deployments
3. Click pe "Redeploy" pentru ultimul deployment
4. Sau fă un push nou în Git pentru a declanșa un deployment automat

### 6. Verifică Configurarea

1. Accesează aplicația ta deployată
2. Mergi la `/admin`
3. Creează un cont admin nou (sau loghează-te dacă ai unul existent)
4. Configurează Shopify
5. Verifică că datele se salvează corect

## Fallback pentru Development Local

Dacă nu configurezi Supabase local, aplicația va folosi automat fișierele JSON din directorul `data/` pentru development. Acest lucru este util pentru testare locală fără să ai nevoie de Supabase.

Pentru a folosi Supabase și local, adaugă variabilele de mediu în fișierul `.env.local`:

```env
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

## Migrare Date Existente

Dacă ai date existente în fișierele JSON (`data/users.json`, `data/config.json`, `data/returns.json`), poți migra manual datele în Supabase:

1. **Utilizatori**: Inserează manual în tabelul `users` din Supabase Dashboard → Table Editor
2. **Configurație**: Inserează manual în tabelul `app_config`
3. **Retururi**: Inserează manual în tabelul `returns` (sau creează un script de migrare)

## Securitate

⚠️ **IMPORTANT**:
- `SUPABASE_SERVICE_ROLE_KEY` are acces complet la baza de date - NU o partaja niciodată!
- Folosește `SUPABASE_ANON_KEY` doar pentru operatii publice (dacă este necesar)
- Nu versioniza cheile în Git - sunt deja în `.gitignore`
- Pentru producție, folosește întotdeauna variabilele de mediu din Vercel

## Troubleshooting

### Eroare: "Supabase not configured"
- Verifică dacă variabilele de mediu sunt setate corect în Vercel
- Verifică dacă ai făcut redeploy după adăugarea variabilelor

### Eroare: "relation does not exist"
- Verifică dacă ai rulat SQL-ul pentru crearea tabelelor
- Verifică dacă ai selectat proiectul corect în Supabase

### Datele nu se salvează
- Verifică log-urile din Vercel pentru erori
- Verifică dacă cheia `service_role` este corectă
- Verifică dacă tabelele există în Supabase

## Suport

Pentru probleme sau întrebări:
- [Documentația Supabase](https://supabase.com/docs)
- [Supabase Discord](https://discord.supabase.com)

