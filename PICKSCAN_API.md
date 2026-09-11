# API pentru PickScan (aplicația de depozit)

Integrare server-to-server: PickScan scanează coletele care se întorc; când un AWB
aparține unei cereri de retur de aici, statusul cererii devine **PRIMIT**. Banii,
storno-ul și restul rămân manuale, în admin.

## Autentificare

O cheie secretă partajată, setată ca variabilă de mediu **`PICKSCAN_API_KEY`** în
Vercel (aplicația de retur) și în PickScan. Se trimite pe **fiecare** apel:

```
Authorization: Bearer <cheie>
```
(sau `X-API-Key: <cheie>`).

- cheie lipsă / greșită → **401** `{ "code": "unauthorized" }`
- cheia nu e configurată pe server → **503** `{ "code": "not_configured" }`

Generare cheie (o singură dată, pe orice calculator):
```bash
openssl rand -hex 32
```

Toate URL-urile de mai jos sunt relative la domeniul aplicației de retur, sub
`/api/integrations/pickscan/`.

---

## 1. Verificare că aplicația răspunde

`GET /api/integrations/pickscan/health`

```json
{ "success": true, "ok": true, "app": "aplicatie-retur", "time": "2026-09-11T08:53:29.989Z" }
```
Verifică și cheia: cu cheie greșită răspunde 401 — deci un singur apel testează
atât conexiunea cât și autentificarea.

---

## 2. Lista statusurilor

`GET /api/integrations/pickscan/statuses`

```json
{
  "success": true,
  "receptionSettable": ["PRIMIT"],
  "statuses": [
    { "code": "INITIAT",        "label": "Inițiat",           "rank": 0, "terminal": false, "auto": false, "receptionSettable": false },
    { "code": "PRELUAT_CURIER", "label": "Preluat de curier", "rank": 1, "terminal": false, "auto": true,  "receptionSettable": false },
    { "code": "IN_TRANZIT",     "label": "În tranzit",        "rank": 2, "terminal": false, "auto": true,  "receptionSettable": false },
    { "code": "LIVRAT",         "label": "Livrat",            "rank": 3, "terminal": false, "auto": true,  "receptionSettable": false },
    { "code": "PRIMIT",         "label": "Primit",            "rank": 4, "terminal": false, "auto": false, "receptionSettable": true  },
    { "code": "FINALIZAT",      "label": "Finalizat",         "rank": 5, "terminal": true,  "auto": false, "receptionSettable": false },
    { "code": "ANULAT",         "label": "Anulat",            "rank": -1,"terminal": true,  "auto": false, "receptionSettable": false }
  ]
}
```
- `receptionSettable` — statusurile pe care le poate pune un operator la recepție
  (momentan doar `PRIMIT`).
- `auto` — statusuri setate automat din tracking-ul curierului (SameDay).
- `terminal` — retururi rezolvate; nu mai apar în lista de mai jos.
- `rank` — ordinea în flux; nu se poate merge înapoi.

---

## 3. Retururile deschise (de interogat periodic, la câteva minute)

`GET /api/integrations/pickscan/returns` — opțional `?limit=N`

Întoarce **doar retururile nerezolvate** (nu FINALIZAT / ANULAT), cele mai noi primele.

```json
{
  "success": true,
  "count": 2,
  "returns": [
    {
      "idRetur": "RET-2026-000002",
      "awbNumber": "2AB1234567890",
      "numarComanda": "#MX38365",
      "shop": "maxari.ro",
      "status": "INITIAT",
      "statusLabel": "Inițiat",
      "metodaTrimitere": "curier",
      "createdAt": "2026-09-10T12:39:37.000Z"
    }
  ]
}
```
- `awbNumber` poate fi `null` dacă clientul nu a introdus încă un AWB
  (metoda „trimit eu cu un curier ales").
- `metodaTrimitere`: `curier` (AWB SameDay generat de app) sau `manual`.
- Nu există „data ultimei modificări" — lista e mică, se poate trage integral la fiecare
  interogare.

---

## 4. Schimbarea statusului la scanare

`POST /api/integrations/pickscan/status`

```json
{
  "awb": "2AB1234567890",
  "status": "PRIMIT",
  "scanId": "pickscan-7f3a9c-2026-09-11T10:00:00Z",
  "scannedAt": "2026-09-11T10:00:00Z",
  "operatorEmail": "depozit@exemplu.ro",
  "note": "colet intact"
}
```
- identificare: **`awb`** (AWB-ul scanat) **sau** `idRetur` — cel puțin unul
- `status` — obligatoriu, trebuie să fie din `receptionSettable`
- **`scanId` — obligatoriu, unic per scanare.** Același `scanId` trimis din nou nu
  produce nimic a doua oară (răspuns `duplicate: true`).
- `scannedAt` (ISO 8601), `operatorEmail`, `note` (max 500) — opționale, se
  păstrează în jurnalul de audit.

### Răspunsuri

Status schimbat:
```json
{ "success": true, "changed": true, "duplicate": false, "previousStatus": "INITIAT",
  "message": "Retur RET-2026-000002: „Inițiat\" → „Primit\".", "return": { ... } }
```

Deja în acel status (nimic de făcut):
```json
{ "success": true, "changed": false, "duplicate": false, "message": "Returul este deja „Primit\".", "return": { ... } }
```

Scanare deja procesată (același `scanId`):
```json
{ "success": true, "duplicate": true, "changed": false, "idRetur": "RET-2026-000002", "status": "PRIMIT" }
```

### Erori

| HTTP | `code` | Când |
|---|---|---|
| 400 | `missing_identifier` | lipsesc și `awb` și `idRetur` |
| 400 | `missing_scan_id` | lipsește `scanId` |
| 400 | `status_not_allowed` | statusul nu e în `receptionSettable` (răspunsul include `allowed`) |
| 400 | `note_too_long` / `invalid_scanned_at` | validare |
| 404 | `not_found` | AWB-ul nu aparține niciunei cereri de retur — **caz normal**, majoritatea coletelor scanate nu sunt retururi |
| 409 | `cancelled` | returul e **ANULAT** — a venit un colet care nu era așteptat; de semnalat operatorului |
| 409 | `backwards` | returul e deja într-un status mai avansat (ex. FINALIZAT) — nu se merge înapoi |
| 401 / 503 | `unauthorized` / `not_configured` | vezi Autentificare |

Toate erorile au forma `{ "success": false, "code": "...", "message": "..." }`;
la 409 se întoarce și `return` cu datele returului.

---

## Flux recomandat în PickScan

1. La pornire / periodic: `GET /returns` → memorează `awbNumber → idRetur`.
2. La fiecare scanare de AWB: `POST /status` cu `awb`, `status: "PRIMIT"`, `scanId` unic.
   - 200 `changed: true` → arată operatorului „retur RET-… primit"
   - 404 → nu e retur, ignoră
   - 409 `cancelled` → avertizează operatorul
3. La reîncercări (rețea picată etc.) retrimite **același `scanId`** — e sigur.
