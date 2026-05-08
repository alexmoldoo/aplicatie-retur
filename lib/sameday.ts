/**
 * SameDay Courier Client API wrapper.
 * „Third-party pickup": curierul ridică de la client și livrează la pickup point-ul nostru.
 * Plata AWB e suportată de noi (awbPayment=1).
 */

const SAMEDAY_BASE_URL = process.env.SAMEDAY_BASE_URL || 'https://api.sameday.ro'
const SAMEDAY_USERNAME = process.env.SAMEDAY_USERNAME || ''
const SAMEDAY_PASSWORD = process.env.SAMEDAY_PASSWORD || ''
const SAMEDAY_PICKUP_POINT_ID = process.env.SAMEDAY_PICKUP_POINT_ID || ''
const SAMEDAY_CONTACT_PERSON_ID = process.env.SAMEDAY_CONTACT_PERSON_ID || ''
const SAMEDAY_SERVICE_ID = process.env.SAMEDAY_SERVICE_ID || ''

export interface PickupAddress {
  name: string
  phone: string
  city: string
  county: string
  street: string
  postalCode?: string
  email?: string
}

export interface PackageInfo {
  weight: number       // kg
  width?: number       // cm
  height?: number      // cm
  length?: number      // cm
  observation?: string
}

export interface CreateAWBParams {
  pickupAddress: PickupAddress  // adresa clientului (third party)
  packageInfo: PackageInfo
  reference?: string             // returnId pentru tracking intern
}

export interface AWBResult {
  awbNumber: string
  awbPdfUrl: string | null
  cost: number
}

interface CachedToken {
  token: string
  expiresAt: number
}

let cachedToken: CachedToken | null = null

/**
 * Autentifică la SameDay.
 * POST /api/authentication cu headers X-AUTH-USERNAME / X-AUTH-PASSWORD.
 * Răspuns: { token, expire_at } — token TTL implicit ~12h.
 */
export async function authenticate(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now()) {
    return cachedToken.token
  }

  if (!SAMEDAY_USERNAME || !SAMEDAY_PASSWORD) {
    throw new Error('SAMEDAY_USERNAME / SAMEDAY_PASSWORD lipsesc din env.')
  }

  const res = await fetch(`${SAMEDAY_BASE_URL}/api/authenticate`, {
    method: 'POST',
    headers: {
      'X-AUTH-USERNAME': SAMEDAY_USERNAME,
      'X-AUTH-PASSWORD': SAMEDAY_PASSWORD,
    },
  })

  if (!res.ok) {
    throw new Error(`SameDay authenticate failed: ${res.status} ${res.statusText}`)
  }

  const data = await res.json()
  const token = data?.token
  if (!token) {
    throw new Error('SameDay authenticate: token lipsă în răspuns')
  }

  // expire_at = ISO date string. Lăsăm 5 min buffer.
  let expiresAt = Date.now() + 11 * 60 * 60 * 1000
  if (data.expire_at) {
    const parsed = Date.parse(data.expire_at)
    if (!Number.isNaN(parsed)) {
      expiresAt = parsed - 5 * 60 * 1000
    }
  }

  cachedToken = { token, expiresAt }
  return token
}

/**
 * Creează AWB de retur cu third-party pickup:
 *  - third party = clientul (de unde se ridică coletul)
 *  - awbRecipient = pickup point-ul nostru (unde ajunge coletul)
 *  - awbPayment = 1 (plătit de noi, contul curier)
 *
 * Necesită setate în env:
 *  - SAMEDAY_PICKUP_POINT_ID    (din GET /api/client/pickup-points)
 *  - SAMEDAY_CONTACT_PERSON_ID  (din același endpoint, pickupPoint.contactPersons[].id)
 *  - SAMEDAY_SERVICE_ID         (din GET /api/client/services)
 */
export async function createReturnAWB(params: CreateAWBParams): Promise<AWBResult> {
  if (!SAMEDAY_PICKUP_POINT_ID || !SAMEDAY_CONTACT_PERSON_ID || !SAMEDAY_SERVICE_ID) {
    throw new Error(
      'Configurare SameDay incompletă. Setați SAMEDAY_PICKUP_POINT_ID, SAMEDAY_CONTACT_PERSON_ID și SAMEDAY_SERVICE_ID din contul SameDay.'
    )
  }

  const token = await authenticate()

  // SameDay API folosește form-data (application/x-www-form-urlencoded) cu
  // chei compuse — nu JSON. Construim params plat.
  const form = new URLSearchParams()
  form.set('pickupPoint', SAMEDAY_PICKUP_POINT_ID)
  form.set('contactPerson', SAMEDAY_CONTACT_PERSON_ID)
  form.set('packageType', '0')                         // 0 = colet standard
  form.set('packageNumber', '1')
  form.set('packageWeight', String(params.packageInfo.weight))
  form.set('service', SAMEDAY_SERVICE_ID)
  form.set('awbPayment', '1')                          // 1 = plătit de client (noi)
  form.set('cashOnDelivery', '0')
  form.set('cashOnDeliveryReturns', '')
  form.set('insuredValue', '0')
  form.set('thirdPartyPickup', '1')                    // ridicare de la third party

  // Third party = clientul (cel de la care se ridică coletul)
  // SameDay nu acceptă orașe/județe ca text liber pe câmpurile `city/county`
  // (acolo se așteaptă ID-uri numerice). În schimb, trimitem `cityString` și
  // `countyString` — și API-ul rezolvă singur ID-urile (sau folosește codul poștal).
  form.set('thirdParty[name]', params.pickupAddress.name)
  form.set('thirdParty[phoneNumber]', params.pickupAddress.phone)
  form.set('thirdParty[personType]', '0')
  form.set('thirdParty[cityString]', params.pickupAddress.city)
  form.set('thirdParty[countyString]', params.pickupAddress.county)
  form.set('thirdParty[address]', params.pickupAddress.street)
  if (params.pickupAddress.postalCode) {
    form.set('thirdParty[postalCode]', params.pickupAddress.postalCode)
  }
  if (params.pickupAddress.email) {
    form.set('thirdParty[contactEmail]', params.pickupAddress.email)
  }

  // awbRecipient = noi. Chiar dacă pickup-ul e configurat prin `pickupPoint`,
  // API-ul SameDay validează câmpurile recipient. Trimitem adresa reală a
  // magazinului (RED MAXARI Mediaș) — coletul ajunge la pickup point.
  form.set('awbRecipient[name]', 'RED MAXARI')
  form.set('awbRecipient[phoneNumber]', '+40770404859')
  form.set('awbRecipient[personType]', '1') // 1 = juridic
  form.set('awbRecipient[companyName]', 'RED MAXARI')
  form.set('awbRecipient[cityString]', 'Mediaș')
  form.set('awbRecipient[countyString]', 'Sibiu')
  form.set('awbRecipient[address]', 'Șoseaua Sibiului, nr. 11')
  form.set('awbRecipient[postalCode]', '551129')

  // Parcels
  form.set('parcels[0][weight]', String(params.packageInfo.weight))
  if (params.packageInfo.width) form.set('parcels[0][width]', String(params.packageInfo.width))
  if (params.packageInfo.height) form.set('parcels[0][height]', String(params.packageInfo.height))
  if (params.packageInfo.length) form.set('parcels[0][length]', String(params.packageInfo.length))

  if (params.packageInfo.observation) {
    form.set('observation', params.packageInfo.observation)
  }
  if (params.reference) {
    form.set('clientInternalReference', params.reference)
  }

  const res = await fetch(`${SAMEDAY_BASE_URL}/api/awb`, {
    method: 'POST',
    headers: {
      'X-AUTH-TOKEN': token,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: form.toString(),
  })

  if (!res.ok) {
    const errText = await res.text()
    throw new Error(`SameDay createReturnAWB failed: ${res.status} ${errText}`)
  }

  const data = await res.json()
  const awbNumber = String(data.awbNumber ?? data.awb_number ?? data.awb ?? '')
  if (!awbNumber) {
    throw new Error('SameDay AWB lipsă în răspuns')
  }

  // PDF eticheta — endpoint dedicat în doc: /api/awb/download/{awbNumber}/{type}
  // type = 1 (A6) sau 0 (A4). Lăsăm A4.
  const awbPdfUrl = data.pdfLink || `${SAMEDAY_BASE_URL}/api/awb/download/${awbNumber}/0`

  return {
    awbNumber,
    awbPdfUrl,
    cost: typeof data.cost === 'number' ? data.cost : 19.99,
  }
}

export interface SameDayHistoryEvent {
  statusId: number
  status: string
  statusDate: string
  transitLocation?: string
}

export interface SameDayAWBStatus {
  awbNumber: string
  expeditionStatusId: number | null
  expeditionStatus: string | null
  history: SameDayHistoryEvent[]
}

/**
 * Tracking AWB curent.
 * GET /api/client/awb/{awbNumber}/status
 *
 * Răspuns așteptat (relevant): expeditionStatus(Id), expeditionHistory[].
 * Codurile statusId variază — folosim ID-ul când îl avem și fallback pe text.
 * 404 înseamnă AWB necunoscut la curier (poate fi încă neînregistrat) → null.
 */
export async function getAWBStatus(awbNumber: string): Promise<SameDayAWBStatus | null> {
  if (!awbNumber) return null
  const token = await authenticate()
  const res = await fetch(
    `${SAMEDAY_BASE_URL}/api/client/awb/${encodeURIComponent(awbNumber)}/status`,
    { headers: { 'X-AUTH-TOKEN': token } }
  )
  if (res.status === 404) return null
  if (!res.ok) {
    throw new Error(`SameDay getAWBStatus failed: ${res.status} ${res.statusText}`)
  }
  const data = await res.json().catch(() => ({} as any))

  const rawHistory: any[] = Array.isArray(data.expeditionHistory)
    ? data.expeditionHistory
    : Array.isArray(data.history)
      ? data.history
      : []

  const history: SameDayHistoryEvent[] = rawHistory.map((e: any) => ({
    statusId: Number(e.statusId ?? e.status_id ?? e.expeditionStatusId ?? 0),
    status: String(e.status ?? e.statusName ?? e.expeditionStatus ?? ''),
    statusDate: String(e.statusDate ?? e.status_date ?? e.date ?? ''),
    transitLocation: e.transitLocation ?? e.transit_location ?? e.location,
  }))

  return {
    awbNumber: String(data.awbNumber ?? awbNumber),
    expeditionStatusId:
      typeof data.expeditionStatusId === 'number'
        ? data.expeditionStatusId
        : typeof data.statusId === 'number'
          ? data.statusId
          : null,
    expeditionStatus:
      typeof data.expeditionStatus === 'string'
        ? data.expeditionStatus
        : typeof data.status === 'string'
          ? data.status
          : null,
    history,
  }
}
