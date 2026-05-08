#!/usr/bin/env node
/**
 * Reset parolă pentru un user din data/users.json (fallback local fără Supabase).
 * Cere parola interactiv (nu apare pe ecran), o hash-uiește cu bcrypt și update-ază fișierul.
 *
 * Usage:
 *   node scripts/reset-local-password.mjs redmaxari@gmail.com
 */
import fs from 'node:fs'
import path from 'node:path'
import readline from 'node:readline'
import bcrypt from 'bcryptjs'

const email = process.argv[2]
if (!email) {
  console.error('Usage: node scripts/reset-local-password.mjs <email>')
  process.exit(1)
}

const file = path.join(process.cwd(), 'data', 'users.json')
if (!fs.existsSync(file)) {
  console.error(`Nu există ${file}`)
  process.exit(1)
}
const users = JSON.parse(fs.readFileSync(file, 'utf8'))
const u = users.find((x) => x.email?.toLowerCase() === email.toLowerCase())
if (!u) {
  console.error(`Nu există user cu email "${email}". Existenți: ${users.map((x) => x.email).join(', ')}`)
  process.exit(1)
}

function askHidden(prompt) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
    process.stdout.write(prompt)
    const stdin = process.stdin
    stdin.resume()
    let pw = ''
    const onData = (ch) => {
      ch = ch.toString('utf8')
      if (ch === '\n' || ch === '\r' || ch === '\u0004') {
        stdin.removeListener('data', onData)
        stdin.setRawMode(false)
        process.stdout.write('\n')
        rl.close()
        resolve(pw)
      } else if (ch === '\u0003') {
        process.exit(1)
      } else if (ch === '\u007f') {
        pw = pw.slice(0, -1)
      } else {
        pw += ch
      }
    }
    stdin.setRawMode(true)
    stdin.on('data', onData)
  })
}

const pw1 = await askHidden(`Parolă nouă pentru ${u.email}: `)
if (pw1.length < 6) {
  console.error('Parola e prea scurtă (min. 6).')
  process.exit(1)
}
const pw2 = await askHidden('Confirmă: ')
if (pw1 !== pw2) {
  console.error('Parolele nu coincid.')
  process.exit(1)
}

u.passwordHash = await bcrypt.hash(pw1, 12)
fs.writeFileSync(file, JSON.stringify(users, null, 2))
console.log(`✓ Parolă actualizată pentru ${u.email}.`)
