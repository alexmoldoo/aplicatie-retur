'use client'

import { useState, useEffect, FormEvent } from 'react'
import Link from 'next/link'
import PageHeader from '@/components/admin/PageHeader'
import s from '@/components/AdminDashboard.module.css'

interface Eligible {
  idRetur: string
  numarComanda: string
  numeTitular: string
  iban: string
  bic: string
  suma: number
}

interface Manual {
  idRetur: string
  numarComanda: string
  numeClient: string
  suma: number
  reason: string
}

interface Lot {
  lot: string
  generatLa: string | null
  count: number
  total: number
  hasFile: boolean
  returns: Array<{ idRetur: string; numarComanda: string; numeTitular: string; suma: number }>
}

const ron = (n: number) => `${n.toFixed(2)} RON`
const plati = (n: number) => (n === 1 ? '1 plată' : `${n} plăți`)
const retururi = (n: number) => (n === 1 ? '1 retur' : `${n} retururi`)

function roDateTime(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return isNaN(d.getTime()) ? '—' : d.toLocaleString('ro-RO', { dateStyle: 'short', timeStyle: 'short' })
}

function downloadCsv(filename: string, csv: string) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = window.URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  window.URL.revokeObjectURL(url)
}

export default function PlatiPage() {
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [skipped, setSkipped] = useState<Array<{ idRetur: string; reason: string }>>([])

  const [sourceIban, setSourceIban] = useState('')
  const [ibanInput, setIbanInput] = useState('')
  const [editIban, setEditIban] = useState(false)

  const [eligible, setEligible] = useState<Eligible[]>([])
  const [manual, setManual] = useState<Manual[]>([])
  const [lots, setLots] = useState<Lot[]>([])
  const [cardCount, setCardCount] = useState(0)
  const [selected, setSelected] = useState<Set<string>>(new Set())

  useEffect(() => {
    load()
  }, [])

  const load = async () => {
    try {
      const r = await fetch('/api/admin/payments', { cache: 'no-store' })
      const d = await r.json()
      if (!d.success) {
        setError(d.message || 'Eroare la încărcare.')
        return
      }
      setSourceIban(d.sourceIban || '')
      setEligible(d.eligible || [])
      setManual(d.manual || [])
      setLots(d.lots || [])
      setCardCount(d.cardCount || 0)
      const ids: string[] = (d.eligible || []).map((e: Eligible) => e.idRetur)
      // Nimic bifat din oficiu: ce intră în fișier se alege explicit.
      setSelected(prev => new Set(ids.filter(id => prev.has(id))))
    } catch {
      setError('Eroare de rețea.')
    } finally {
      setLoading(false)
    }
  }

  const post = async (payload: Record<string, unknown>) => {
    const r = await fetch('/api/admin/payments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    return r.json()
  }

  const saveIban = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(null)
    setBusy(true)
    try {
      const d = await post({ action: 'setSourceIban', iban: ibanInput })
      if (!d.success) {
        setError(d.message || 'IBAN invalid.')
        return
      }
      setSourceIban(d.sourceIban)
      setIbanInput('')
      setEditIban(false)
    } catch {
      setError('Eroare de rețea.')
    } finally {
      setBusy(false)
    }
  }

  const selectedRows = eligible.filter(e => selected.has(e.idRetur))
  const selectedTotal = selectedRows.reduce((sum, e) => sum + e.suma, 0)
  const allSelected = eligible.length > 0 && selectedRows.length === eligible.length
  const orderCounts = eligible.reduce<Record<string, number>>((acc, e) => {
    acc[e.numarComanda] = (acc[e.numarComanda] || 0) + 1
    return acc
  }, {})

  const toggle = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const generate = async () => {
    if (selectedRows.length === 0) return
    const ok = window.confirm(
      `Generezi fișierul pentru ${plati(selectedRows.length)}, total ${ron(selectedTotal)}?\n\nRetururile trec în „În plată".`
    )
    if (!ok) return
    setError(null)
    setSuccess(null)
    setSkipped([])
    setBusy(true)
    try {
      const d = await post({ action: 'generate', ids: selectedRows.map(e => e.idRetur) })
      setSkipped(d.skipped || [])
      if (!d.success) {
        setError(d.message || 'Fișierul nu a putut fi generat.')
        return
      }
      downloadCsv(d.filename, d.csv)
      setSuccess(`Fișier generat: ${plati(d.count)}, total ${ron(d.total)}.`)
      await load()
    } catch {
      setError('Eroare de rețea.')
    } finally {
      setBusy(false)
    }
  }

  const lotAction = async (lot: Lot, action: 'finalize' | 'cancel') => {
    const ok = window.confirm(
      action === 'finalize'
        ? `Marchezi ${retururi(lot.count)} ca plătite (Finalizat)?`
        : `Anulezi lotul? ${retururi(lot.count)} revin la „Primit".`
    )
    if (!ok) return
    setError(null)
    setSuccess(null)
    setBusy(true)
    try {
      const d = await post({ action, lot: lot.lot })
      if (!d.success) {
        setError(d.message || `Nu s-au putut actualiza: ${(d.failed || []).join(', ')}`)
      } else {
        setSuccess(action === 'finalize' ? `Finalizat: ${retururi(d.count)}.` : `Lot anulat (${retururi(d.count)}).`)
      }
      await load()
    } catch {
      setError('Eroare de rețea.')
    } finally {
      setBusy(false)
    }
  }

  if (loading) {
    return (
      <div className={s.loading}>
        <div className={s.loadingInner}>
          <div className={s.spinner} />
          <p>Se încarcă…</p>
        </div>
      </div>
    )
  }

  return (
    <>
      <PageHeader title="Plăți retururi" subtitle="Fișier de plăți pentru BT Go." />

      {error && <div className={`${s.alert} ${s.alertError}`}>{error}</div>}
      {success && <div className={`${s.alert} ${s.alertSuccess}`}>{success}</div>}
      {skipped.length > 0 && (
        <div className={`${s.alert} ${s.alertWarning}`}>
          Nu au intrat în fișier: {skipped.map(x => `${x.idRetur} (${x.reason})`).join('; ')}
        </div>
      )}

      <div className={s.card}>
        <div className={s.cardHeader}>
          <h2 className={s.cardTitle}>Cont plătitor</h2>
          {sourceIban && !editIban && (
            <button type="button" onClick={() => setEditIban(true)} className={`${s.btn} ${s.btnGhost} ${s.btnSm}`}>
              Schimbă
            </button>
          )}
        </div>
        {sourceIban && !editIban ? (
          <div style={{ fontFamily: 'monospace', fontWeight: 600 }}>{sourceIban}</div>
        ) : (
          <form onSubmit={saveIban} className={s.actionsRow}>
            <input
              type="text"
              value={ibanInput}
              onChange={e => setIbanInput(e.target.value.toUpperCase())}
              placeholder="IBAN cont BT"
              className={s.input}
              style={{ flex: 1, fontFamily: 'monospace' }}
              autoComplete="off"
            />
            <button type="submit" disabled={busy} className={`${s.btn} ${s.btnPrimary}`}>
              Salvează
            </button>
            {sourceIban && (
              <button type="button" onClick={() => { setEditIban(false); setIbanInput('') }} className={`${s.btn} ${s.btnSecondary}`}>
                Renunță
              </button>
            )}
          </form>
        )}
      </div>

      <div className={s.card}>
        <div className={s.cardHeader}>
          <h2 className={s.cardTitle}>De plătit ({eligible.length})</h2>
        </div>

        {eligible.length === 0 ? (
          <p className={s.hint} style={{ fontStyle: 'italic' }}>Niciun retur primit care așteaptă plata.</p>
        ) : (
          <>
            <div className={s.tableWrap}>
              <table className={s.table}>
                <thead>
                  <tr>
                    <th style={{ width: 36 }}>
                      <input
                        type="checkbox"
                        checked={allSelected}
                        onChange={() => setSelected(allSelected ? new Set() : new Set(eligible.map(e => e.idRetur)))}
                        aria-label="Selectează tot"
                      />
                    </th>
                    <th>Retur</th>
                    <th>Titular</th>
                    <th>IBAN</th>
                    <th style={{ textAlign: 'right' }}>Sumă</th>
                  </tr>
                </thead>
                <tbody>
                  {eligible.map(e => (
                    <tr key={e.idRetur} onClick={() => toggle(e.idRetur)}>
                      <td>
                        <input
                          type="checkbox"
                          checked={selected.has(e.idRetur)}
                          onChange={() => toggle(e.idRetur)}
                          onClick={ev => ev.stopPropagation()}
                          aria-label={`Selectează ${e.idRetur}`}
                        />
                      </td>
                      <td>
                        <Link
                          href={`/admin/returns/${e.idRetur}`}
                          onClick={ev => ev.stopPropagation()}
                          style={{ fontWeight: 'var(--font-weight-bold)', color: 'var(--color-primary)', whiteSpace: 'nowrap' }}
                        >
                          {e.idRetur}
                        </Link>
                        <div style={{ fontSize: '12px', color: 'var(--color-text-muted, #6b7280)' }}>{e.numarComanda}</div>
                        {orderCounts[e.numarComanda] > 1 && (
                          <div style={{ fontSize: '12px', color: 'var(--color-error, #b91c1c)' }}>
                            {orderCounts[e.numarComanda]} retururi pe aceeași comandă
                          </div>
                        )}
                      </td>
                      <td>{e.numeTitular}</td>
                      <td style={{ fontFamily: 'monospace', fontSize: '13px' }}>
                        {e.iban}
                        <div style={{ fontSize: '12px', color: 'var(--color-text-muted, #6b7280)' }}>{e.bic}</div>
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 'var(--font-weight-semibold)', whiteSpace: 'nowrap' }}>
                        {ron(e.suma)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className={s.actionsRow} style={{ marginTop: 'var(--space-4)', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
              <div>
                <strong>{selectedRows.length}</strong> selectate · total <strong>{ron(selectedTotal)}</strong>
              </div>
              <button
                type="button"
                onClick={generate}
                disabled={busy || selectedRows.length === 0 || !sourceIban}
                className={`${s.btn} ${s.btnPrimary}`}
              >
                {busy ? 'Se generează…' : 'Generează fișier BT'}
              </button>
            </div>
            {!sourceIban && (
              <p className={s.hint} style={{ marginTop: 'var(--space-2)' }}>Completează contul plătitor.</p>
            )}
          </>
        )}

        {cardCount > 0 && (
          <p className={s.hint} style={{ marginTop: 'var(--space-3)' }}>
            {cardCount === 1
              ? '1 retur primit are refund pe card și nu intră în fișier.'
              : `${cardCount} retururi primite au refund pe card și nu intră în fișier.`}
          </p>
        )}
      </div>

      {manual.length > 0 && (
        <div className={s.card}>
          <div className={s.cardHeader}>
            <h2 className={s.cardTitle}>De plătit manual ({manual.length})</h2>
          </div>
          <div className={s.tableWrap}>
            <table className={s.table}>
              <thead>
                <tr>
                  <th>Retur</th>
                  <th>Comandă</th>
                  <th>Client</th>
                  <th style={{ textAlign: 'right' }}>Sumă</th>
                  <th>Motiv</th>
                </tr>
              </thead>
              <tbody>
                {manual.map(m => (
                  <tr key={m.idRetur} onClick={() => (window.location.href = `/admin/returns/${m.idRetur}`)}>
                    <td style={{ fontWeight: 'var(--font-weight-bold)', color: 'var(--color-primary)', whiteSpace: 'nowrap' }}>{m.idRetur}</td>
                    <td>{m.numarComanda}</td>
                    <td>{m.numeClient || '—'}</td>
                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>{ron(m.suma)}</td>
                    <td style={{ color: 'var(--color-warning, #b45309)' }}>{m.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className={s.card}>
        <div className={s.cardHeader}>
          <h2 className={s.cardTitle}>În plată ({lots.reduce((n, l) => n + l.count, 0)})</h2>
        </div>

        {lots.length === 0 ? (
          <p className={s.hint} style={{ fontStyle: 'italic' }}>Niciun fișier în așteptare.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {lots.map(lot => (
              <div
                key={lot.lot || 'fara-fisier'}
                style={{
                  padding: '14px 16px',
                  border: '1px solid var(--color-border, #e5e7eb)',
                  borderRadius: '10px',
                  background: '#fff',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: 700 }}>
                      {lot.hasFile ? roDateTime(lot.generatLa) : 'Fără fișier'}
                    </div>
                    <div style={{ fontSize: '13px', color: 'var(--color-text-muted, #6b7280)' }}>
                      {plati(lot.count)} · {ron(lot.total)}
                    </div>
                  </div>
                  <div className={s.tableActions}>
                    {lot.hasFile && (
                      <a
                        href={`/api/admin/payments?lot=${encodeURIComponent(lot.lot)}&download=1`}
                        className={`${s.btn} ${s.btnSecondary} ${s.btnSm}`}
                      >
                        Descarcă
                      </a>
                    )}
                    <button type="button" onClick={() => lotAction(lot, 'finalize')} disabled={busy} className={`${s.btn} ${s.btnPrimary} ${s.btnSm}`}>
                      Marchează plătit
                    </button>
                    <button type="button" onClick={() => lotAction(lot, 'cancel')} disabled={busy} className={`${s.btn} ${s.btnDanger} ${s.btnSm}`}>
                      Anulează
                    </button>
                  </div>
                </div>
                <div style={{ marginTop: '10px', fontSize: '13px', color: 'var(--color-text-muted, #6b7280)' }}>
                  {lot.returns.map(r => `${r.idRetur} · ${r.numeTitular} · ${ron(r.suma)}`).join('  |  ')}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  )
}
