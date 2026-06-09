#!/usr/bin/env node
// Verifică starea recentă a coduri retur și a auditului asociat. Strict citire — nu modifică nimic.

import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const env = Object.fromEntries(
  readFileSync('.env.local', 'utf-8')
    .split('\n')
    .filter(l => l && !l.startsWith('#') && l.includes('='))
    .map(l => {
      const i = l.indexOf('=')
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^"|"$/g, '')]
    })
)

const url = env.SUPABASE_URL
const key = env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')
  process.exit(1)
}
const sb = createClient(url, key)

console.log('\n=== 10 coduri cele mai recent atinse ===')
const { data: codes, error: codesErr } = await sb
  .from('return_codes')
  .select('code, kind, active, created_at, used_at, used_by_return_id, sent_at')
  .order('created_at', { ascending: false })
  .limit(10)
if (codesErr) {
  console.error('codes err:', codesErr)
} else {
  for (const c of codes) {
    console.log(
      `${c.code.padEnd(7)}  kind=${c.kind.padEnd(14)}  active=${String(c.active).padEnd(5)}  used=${c.used_at ? c.used_at.slice(0, 19) : '—'.padEnd(19)}  by=${c.used_by_return_id || '—'}  sent=${c.sent_at ? c.sent_at.slice(0, 19) : '—'}`
    )
  }
}

console.log('\n=== Ultimele 30 audit entries cu legatura la coduri ===')
const { data: audits, error: auditErr } = await sb
  .from('audit_log')
  .select('timestamp, action, ip, details')
  .or('action.eq.admin_code_generated,action.eq.admin_code_toggled,action.eq.admin_code_sent_toggled,action.eq.admin_code_deleted,action.eq.code_check,action.eq.code_check_rate_limited,action.eq.create_return_invalid_code,action.eq.create_return_code_race')
  .order('timestamp', { ascending: false })
  .limit(30)
if (auditErr) {
  console.error('audit err:', auditErr)
} else {
  for (const a of audits) {
    console.log(`${a.timestamp.slice(0, 19)}  ${a.action.padEnd(28)}  ${a.ip || '?'.padEnd(15)}  ${JSON.stringify(a.details)}`)
  }
}

console.log('\n=== Race events (create_return_code_race) ===')
const { data: races } = await sb
  .from('audit_log')
  .select('timestamp, action, ip, details')
  .eq('action', 'create_return_code_race')
  .order('timestamp', { ascending: false })
  .limit(10)
if (races && races.length) {
  for (const r of races) {
    console.log(`${r.timestamp.slice(0, 19)}  ${r.ip}  ${JSON.stringify(r.details)}`)
  }
} else {
  console.log('(niciun event)')
}

console.log('\n=== Returns recente (ultimele 10) ===')
const { data: rets } = await sb
  .from('returns')
  .select('id_retur, numar_comanda, status, created_at')
  .order('created_at', { ascending: false })
  .limit(10)
if (rets) {
  for (const r of rets) {
    console.log(`${r.created_at.slice(0, 19)}  ${r.id_retur}  ${r.numar_comanda}  status=${r.status}`)
  }
}
