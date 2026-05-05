# Accese API Shopify - Ghid Complet

Acest document explică exact ce accese API Shopify sunt necesare pentru aplicația de retur.

## 📋 Accese OBLIGATORII

### `read_orders` ✅ OBLIGATORIU

**Ce face:**
- Permite citirea comenzilor din Shopify
- Permite căutarea comenzilor după:
  - Număr comandă (`name`)
  - Email client (`email`)
  - Telefon client (`phone`)
- Permite accesul la datele comenzii:
  - Informații client (nume, email, telefon)
  - Lista produselor (`line_items`) cu:
    - Nume produs (`title`)
    - Cantitate (`quantity`)
    - Preț (`price`)
    - SKU (`sku`)
    - Variant ID (`variant_id`)
  - Data comenzii (`created_at`) - pentru calcul eligibilitate retur
  - Metoda de plată (`payment_gateway_names`, `payment_method`, `gateway`)
  - Total comandă (`total_price`)

**Cum se folosește în aplicație:**
- Step 1: Căutare comandă pentru validare
- Step 2: Afișare produse din comandă pentru retur
- Step 3: Detectare dacă comanda a fost plătită cu cardul

**Endpoint-uri folosite:**
```
GET /admin/api/2026-04/orders.json?name={orderNumber}&status=any
GET /admin/api/2026-04/orders.json?phone={phone}&status=any&limit=250
GET /admin/api/2026-04/orders.json?email={email}&status=any&limit=250
```

---

## ⚠️ Accese RECOMANDATE (pentru viitor)

### `write_refunds` ⚠️ RECOMANDAT

**Ce face:**
- Permite crearea retururilor în Shopify
- Permite procesarea rambursărilor automat

**Când va fi necesar:**
- Când implementăm crearea automată a returului după finalizarea Step 3
- Pentru procesarea automată a rambursărilor

**Endpoint-uri care vor fi folosite:**
```
POST /admin/api/2026-04/orders/{order_id}/refunds.json
```

**NOTĂ:** Momentan aplicația NU creează retururi automat în Shopify. Acest acces va fi necesar când implementăm această funcționalitate.

---

## 📋 Accese OPȚIONALE (nu sunt folosite momentan)

### `read_customers`
- **Status:** Nu este folosit
- **Motiv:** Datele clientului vin deja în `read_orders` prin `billing_address`

### `read_products`
- **Status:** Nu este folosit
- **Motiv:** Informațiile produselor vin deja în `read_orders` prin `line_items`
- **Viitor:** Poate fi folosit pentru imagini produse

### `read_product_listings`
- **Status:** Nu este folosit
- **Motiv:** Nu afișăm imagini produse momentan
- **Viitor:** Pentru afișare imagini produse în Step 2

---

## 🎯 Configurare Minimă Recomandată

Pentru funcționalitatea actuală, ai nevoie doar de:

```
✅ read_orders
```

Pentru funcționalitate completă (inclusiv creare retur automat):

```
✅ read_orders
⚠️ write_refunds
```

---

## 📝 Cum să configurezi în Shopify

1. **Mergi în Shopify Admin** → Settings → Apps and sales channels
2. **Click pe "Develop apps"** → Selectează aplicația ta
3. **Mergi la "Admin API access scopes"**
4. **Caută și activează:**
   - `read_orders` (OBLIGATORIU)
   - `write_refunds` (Recomandat)
5. **Click pe "Save"** sau "Install app"
6. **Copiază Access Token** din secțiunea "Admin API access token"

---

## 🔒 Securitate

- **Principiul minimului necesar:** Activează doar accesele de care ai nevoie
- **read_orders** este suficient pentru funcționalitatea de bază
- **write_refunds** va fi necesar doar când implementăm crearea automată a retururilor

---

## ❓ FAQ

**Q: De ce am nevoie de `read_orders`?**
A: Pentru că aplicația trebuie să găsească și să citească comenzile pentru validare și afișare produse.

**Q: De ce nu folosesc `read_customers`?**
A: Datele clientului (nume, email, telefon) vin deja în fiecare comandă prin `billing_address`, deci nu este necesar.

**Q: Când voi avea nevoie de `write_refunds`?**
A: Când implementăm funcționalitatea de creare automată a returului în Shopify după finalizarea Step 3.

**Q: Pot să folosesc aplicația fără `write_refunds`?**
A: Da! Aplicația funcționează perfect doar cu `read_orders`. `write_refunds` este pentru funcționalități viitoare.

---

## 📚 Resurse

- [Shopify Admin API Documentation](https://shopify.dev/api/admin-rest)
- [Shopify API Scopes](https://shopify.dev/api/usage/access-scopes)
- [Orders API Reference](https://shopify.dev/api/admin-rest/2026-04/resources/order)

