'use client'

import { useState, useEffect, FormEvent } from 'react'
import PageHeader from '@/components/admin/PageHeader'
import s from '@/components/AdminDashboard.module.css'

function normOrder(nr: string): string {
  return (nr || '').replace(/\s/g, '').replace(/^#/, '').toUpperCase()
}

function roDate(iso?: string): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return isNaN(d.getTime()) ? '—' : d.toLocaleDateString('ro-RO')
}

interface FoundOrder {
  numarComanda: string
  nume?: string
  dataComanda?: string
  eligibility: { status: 'eligible' | 'warning' | 'expired'; daysSinceOrder?: number; overridden?: boolean }
  isUnblocked?: boolean
}

export default function DeblocarePage() {
  const [query, setQuery] = useState('')
  const [searching, setSearching] = useState(false)
  const [results, setResults] = useState<FoundOrder[]>([])
  const [searchMsg, setSearchMsg] = useState<string | null>(null)
  const [overrides, setOverrides] = useState<string[]>([])
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  useEffect(() => {
    loadOverrides()
  }, [])

  const loadOverrides = async () => {
    try {
      const r = await fetch('/api/config')
      const d = await r.json()
      if (d.success) setOverrides(d.config.eligibilityOverrides || [])
    } catch {
      /* ignore */
    }
  }

  const isUnblocked = (nr: string) => overrides.includes(normOrder(nr))

  const doSearch = async (e?: FormEvent) => {
    e?.preventDefault()
    if (!query.trim()) return
    setSearching(true)
    setSearchMsg(null)
    setError(null)
    try {
      const r = await fetch('/api/admin/orders/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: query.trim() }),
      })
      const d = await r.json()
      if (d.success) {
        setResults(d.orders || [])
        if ((d.orders || []).length === 0) setSearchMsg(d.message || 'Nicio comandă găsită.')
      } else {
        setResults([])
        setError(d.message || 'Eroare la căutare.')
      }
    } catch {
      setError('Eroare de rețea.')
    } finally {
      setSearching(false)
    }
  }

  const saveOverrides = async (list: string[]): Promise<boolean> => {
    setError(null)
    try {
      const r = await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eligibilityOverrides: list }),
      })
      const d = await r.json()
      if (!d.success) {
        setError(d.message || 'Eroare la salvare.')
        return false
      }
      return true
    } catch {
      setError('Eroare de rețea la salvare.')
      return false
    }
  }

  const unblock = async (nr: string) => {
    setBusy(nr)
    const list = Array.from(new Set([...overrides, normOrder(nr)]))
    const ok = await saveOverrides(list)
    if (ok) {
      setOverrides(list)
      setSuccess(`Comanda ${nr} a fost deblocată.`)
      setResults(rs => rs.map(o => (o.numarComanda === nr ? { ...o, isUnblocked: true } : o)))
      setTimeout(() => setSuccess(null), 3000)
    }
    setBusy(null)
  }

  const reblock = async (nr: string) => {
    setBusy(nr)
    const list = overrides.filter(x => x !== normOrder(nr))
    const ok = await saveOverrides(list)
    if (ok) {
      setOverrides(list)
      setSuccess(`Deblocarea pentru ${nr} a fost anulată.`)
      setResults(rs => rs.map(o => (normOrder(o.numarComanda) === normOrder(nr) ? { ...o, isUnblocked: false } : o)))
      setTimeout(() => setSuccess(null), 3000)
    }
    setBusy(null)
  }

  const statusBadge = (o: FoundOrder) => {
    if (isUnblocked(o.numarComanda) || o.eligibility.overridden) {
      return <span className={`${s.badge} ${s.badgeSuccess}`}>Deblocat ✓</span>
    }
    if (o.eligibility.status === 'expired') return <span className={`${s.badge} ${s.badgeError}`}>Expirat</span>
    if (o.eligibility.status === 'warning') return <span className={`${s.badge} ${s.badgeWarning}`}>Aproape expirat</span>
    return <span className={`${s.badge} ${s.badgeSuccess}`}>Eligibil</span>
  }

  return (
    <>
      <PageHeader title="Deblocare retur" subtitle="Caută o comandă și deblochează retururile care au depășit termenul." />

      {error && <div className={`${s.alert} ${s.alertError}`}>{error}</div>}
      {success && <div className={`${s.alert} ${s.alertSuccess}`}>{success}</div>}

      <div className={s.card}>
        <form onSubmit={doSearch} className={s.filtersBar}>
          <input
            type="text"
            placeholder="Număr comandă (ex: MX22222), telefon sau email…"
            value={query}
            onChange={e => setQuery(e.target.value)}
            className={s.input}
            style={{ flex: 1 }}
          />
          <button type="submit" disabled={searching} className={`${s.btn} ${s.btnPrimary}`}>
            {searching ? 'Caut…' : 'Caută'}
          </button>
        </form>

        {searchMsg && (
          <p className={s.hint} style={{ marginTop: 'var(--space-3)' }}>{searchMsg}</p>
        )}

        {results.length > 0 && (
          <div style={{ marginTop: 'var(--space-4)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {results.map((o, i) => {
              const unblocked = isUnblocked(o.numarComanda) || o.eligibility.overridden
              return (
                <div
                  key={`${o.numarComanda}-${i}`}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '12px',
                    flexWrap: 'wrap',
                    padding: '14px 16px',
                    border: '1px solid var(--color-border, #e5e7eb)',
                    borderRadius: '10px',
                    background: '#fff',
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 700, color: 'var(--color-primary, #111)' }}>{o.numarComanda}</div>
                    <div style={{ fontSize: '13px', color: 'var(--color-text-muted, #6b7280)' }}>
                      {o.nume || '—'} · {roDate(o.dataComanda)}
                      {typeof o.eligibility.daysSinceOrder === 'number' ? ` · ${o.eligibility.daysSinceOrder} zile` : ''}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    {statusBadge(o)}
                    {unblocked ? (
                      <button
                        type="button"
                        onClick={() => reblock(o.numarComanda)}
                        disabled={busy === o.numarComanda}
                        className={`${s.btn} ${s.btnSecondary} ${s.btnSm}`}
                      >
                        {busy === o.numarComanda ? '…' : 'Anulează deblocarea'}
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => unblock(o.numarComanda)}
                        disabled={busy === o.numarComanda}
                        className={`${s.btn} ${s.btnPrimary} ${s.btnSm}`}
                      >
                        {busy === o.numarComanda ? '…' : 'Deblochează'}
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <div className={s.card}>
        <div className={s.cardHeader}>
          <h2 className={s.cardTitle}>Comenzi deblocate ({overrides.length})</h2>
        </div>
        {overrides.length === 0 ? (
          <p className={s.hint} style={{ fontStyle: 'italic' }}>Nicio comandă deblocată momentan.</p>
        ) : (
          <div className={s.tagList}>
            {overrides.map(nr => (
              <span key={nr} className={s.tag}>
                <strong>{nr}</strong>
                <button
                  type="button"
                  onClick={() => reblock(nr)}
                  disabled={busy === nr}
                  className={s.tagRemove}
                  aria-label={`Anulează deblocarea ${nr}`}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}
      </div>
    </>
  )
}
