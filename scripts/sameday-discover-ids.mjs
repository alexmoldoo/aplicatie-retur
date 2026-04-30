#!/usr/bin/env node
/**
 * Descoperă ID-urile de care are nevoie aplicația în .env.local pentru SameDay:
 *   - SAMEDAY_PICKUP_POINT_ID
 *   - SAMEDAY_CONTACT_PERSON_ID
 *   - SAMEDAY_SERVICE_ID
 *
 * Rulare:
 *   SAMEDAY_USERNAME='user' SAMEDAY_PASSWORD='parola' node scripts/sameday-discover-ids.mjs
 *
 * Pentru sandbox (testare):
 *   SAMEDAY_BASE_URL='https://sameday-api.demo.zitec.com' \
 *   SAMEDAY_USERNAME='user' SAMEDAY_PASSWORD='parola' \
 *   node scripts/sameday-discover-ids.mjs
 *
 * Datele tale NU părăsesc mașina ta. Scriptul vorbește direct cu API-ul SameDay.
 */

const BASE_URL = process.env.SAMEDAY_BASE_URL || 'https://api.sameday.ro'
const USERNAME = process.env.SAMEDAY_USERNAME
const PASSWORD = process.env.SAMEDAY_PASSWORD

if (!USERNAME || !PASSWORD) {
  console.error('❌ Lipsesc SAMEDAY_USERNAME / SAMEDAY_PASSWORD în env.\n')
  console.error('Exemplu:')
  console.error("  SAMEDAY_USERNAME='user' SAMEDAY_PASSWORD='parola' node scripts/sameday-discover-ids.mjs")
  process.exit(1)
}

console.log(`🔐 Autentificare la ${BASE_URL}...`)

const authRes = await fetch(`${BASE_URL}/api/authenticate`, {
  method: 'POST',
  headers: {
    'X-AUTH-USERNAME': USERNAME,
    'X-AUTH-PASSWORD': PASSWORD,
  },
})

if (!authRes.ok) {
  const text = await authRes.text()
  console.error(`❌ Autentificare eșuată: ${authRes.status} ${authRes.statusText}`)
  console.error(text)
  process.exit(1)
}

const authData = await authRes.json()
const token = authData.token
if (!token) {
  console.error('❌ Token lipsă în răspuns:', authData)
  process.exit(1)
}

console.log('✅ Autentificat. Token expiră:', authData.expire_at || '(necunoscut)')
console.log()

// 1. Pickup points
console.log('📍 Pickup points (SAMEDAY_PICKUP_POINT_ID + SAMEDAY_CONTACT_PERSON_ID):')
const ppRes = await fetch(`${BASE_URL}/api/client/pickup-points`, {
  headers: { 'X-AUTH-TOKEN': token },
})
if (!ppRes.ok) {
  console.error(`   ⚠️  Eroare la /api/client/pickup-points: ${ppRes.status}`)
} else {
  const ppData = await ppRes.json()
  const points = ppData.data || ppData || []
  if (points.length === 0) {
    console.log('   (niciun pickup point — configurează unul în panel.sameday.ro)')
  } else {
    points.forEach((p, i) => {
      console.log(`   [${i + 1}] id=${p.id}  alias="${p.alias || p.name || ''}"`)
      console.log(`        ${p.address || ''}, ${p.city?.name || p.city || ''}, ${p.county?.name || p.county || ''}`)
      const contacts = p.contactPersons || p.pickupPointContactPersons || []
      if (contacts.length === 0) {
        console.log('        (fără contact persons — adaugă unul în panel)')
      } else {
        contacts.forEach((c) => {
          console.log(`        contactPerson id=${c.id}  name="${c.name || ''}"  phone="${c.phoneNumber || c.phone || ''}"`)
        })
      }
    })
  }
}
console.log()

// 2. Services
console.log('🚚 Services (SAMEDAY_SERVICE_ID — alege serviciul de curierat standard):')
const svcRes = await fetch(`${BASE_URL}/api/client/services`, {
  headers: { 'X-AUTH-TOKEN': token },
})
if (!svcRes.ok) {
  console.error(`   ⚠️  Eroare la /api/client/services: ${svcRes.status}`)
} else {
  const svcData = await svcRes.json()
  const services = svcData.data || svcData || []
  if (services.length === 0) {
    console.log('   (niciun serviciu activ pe cont)')
  } else {
    services.forEach((s) => {
      const id = s.id ?? s.serviceId
      const name = s.name || s.serviceName || ''
      const code = s.code || s.serviceCode || ''
      console.log(`   id=${id}  code="${code}"  name="${name}"`)
    })
  }
}
console.log()

console.log('✏️  Pune valorile alese în .env.local:')
console.log('   SAMEDAY_PICKUP_POINT_ID=<id-pickup-point>')
console.log('   SAMEDAY_CONTACT_PERSON_ID=<id-contact-person-de-la-pickup>')
console.log('   SAMEDAY_SERVICE_ID=<id-service-curierat-standard>')
console.log('   SAMEDAY_MOCK=false')
