'use client'

import { useState, useEffect, FormEvent } from 'react'
import Link from 'next/link'
import PageHeader from '@/components/admin/PageHeader'
import { TicketIcon, CopyIcon } from '@/components/admin/Icon'
import s from '@/components/AdminDashboard.module.css'

type CodeKind = 'free_shipping' | 'direct_refund'

interface ReturnCode {
  code: string
  kind: CodeKind
  note: string | null
  active: boolean
  createdAt: string
  createdBy: string | null
  createdByEmail?: string | null
  usedAt: string | null
  usedByReturnId: string | null
}

type StatusFilter = 'all' | 'active' | 'used' | 'inactive'

const STATUS_LABEL: Record<StatusFilter, string> = {
  all: 'Toate',
  active: 'Active (nefolosite)',
  used: 'Folosite',
  inactive: 'Dezactivate',
}

const KIND_LABEL: Record<CodeKind, string> = {
  free_shipping: 'Curier gratuit',
  direct_refund: 'Decont direct',
}

const KIND_HINT: Record<CodeKind, string> = {
  free_shipping: 'Clientul trimite coletul; SameDay e plătit de magazin (cost transport 0).',
  direct_refund: 'Fără AWB, fără colet. Banii se rambursează direct în cont. Clientul păstrează produsul.',
}

function rowStatusLabel(c: ReturnCode): { label: string; klass: string } {
  if (c.usedAt) return { label: 'Folosit', klass: s.badgeInfo }
  if (!c.active) return { label: 'Dezactivat', klass: s.badgeNeutral }
  return { label: 'Activ', klass: s.badgeSuccess }
}

export default function CoduriPage() {
  const [codes, setCodes] = useState<ReturnCode[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [search, setSearch] = useState('')

  const [showModal, setShowModal] = useState(false)
  const [count, setCount] = useState('1')
  const [note, setNote] = useState('')
  const [kind, setKind] = useState<CodeKind>('free_shipping')
  const [generating, setGenerating] = useState(false)
  const [generatedBatch, setGeneratedBatch] = useState<string[]>([])

  const [copiedCode, setCopiedCode] = useState<string | null>(null)

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter])

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (statusFilter !== 'all') params.set('status', statusFilter)
      if (search.trim()) params.set('search', search.trim())
      const r = await fetch(`/api/admin/codes${params.toString() ? `?${params.toString()}` : ''}`)
      const data = await r.json()
      if (!r.ok || !data.success) {
        setError(data?.message || 'Eroare la încărcarea codurilor.')
        setCodes([])
      } else {
        setCodes(data.codes || [])
      }
    } catch {
      setError('Eroare la conectare.')
      setCodes([])
    } finally {
      setLoading(false)
    }
  }

  const onGenerate = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setGenerating(true)
    setGeneratedBatch([])
    try {
      const n = Math.min(Math.max(parseInt(count, 10) || 1, 1), 50)
      const r = await fetch('/api/admin/codes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ count: n, kind, note: note.trim() || undefined }),
      })
      const data = await r.json()
      if (!r.ok || !data.success) {
        setError(data?.message || 'Eroare la generare.')
        return
      }
      setGeneratedBatch(data.codes || [])
      setSuccess(`${data.codes.length} cod${data.codes.length === 1 ? '' : 'uri'} generat${data.codes.length === 1 ? '' : 'e'}.`)
      setTimeout(() => setSuccess(null), 4000)
      await load()
    } catch {
      setError('Eroare la conectare.')
    } finally {
      setGenerating(false)
    }
  }

  const closeModal = () => {
    setShowModal(false)
    setCount('1')
    setNote('')
    setKind('free_shipping')
    setGeneratedBatch([])
  }

  const copyToClipboard = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code)
      setCopiedCode(code)
      setTimeout(() => setCopiedCode(c => (c === code ? null : c)), 1500)
    } catch {
      // ignore
    }
  }

  const toggleActive = async (c: ReturnCode) => {
    if (c.usedAt) return
    try {
      const r = await fetch(`/api/admin/codes/${encodeURIComponent(c.code)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: !c.active }),
      })
      const data = await r.json()
      if (!r.ok || !data.success) {
        setError(data?.message || 'Eroare la actualizarea codului.')
        return
      }
      await load()
    } catch {
      setError('Eroare la conectare.')
    }
  }

  const deleteCode = async (c: ReturnCode) => {
    if (c.usedAt) return
    if (!confirm(`Ștergi codul ${c.code}? Acțiunea e definitivă.`)) return
    try {
      const r = await fetch(`/api/admin/codes/${encodeURIComponent(c.code)}`, { method: 'DELETE' })
      const data = await r.json()
      if (!r.ok || !data.success) {
        setError(data?.message || 'Eroare la ștergere.')
        return
      }
      await load()
    } catch {
      setError('Eroare la conectare.')
    }
  }

  return (
    <>
      <PageHeader
        title="Coduri retur gratuit"
        subtitle={'Două tipuri: „Curier gratuit" (cost transport 0) sau „Decont direct" — cu prefix D, fără AWB, banii direct la client.'}
        actions={
          <button onClick={() => setShowModal(true)} className={`${s.btn} ${s.btnPrimary}`}>
            Generează cod
          </button>
        }
      />

      {error && <div className={`${s.alert} ${s.alertError}`}>{error}</div>}
      {success && <div className={`${s.alert} ${s.alertSuccess}`}>{success}</div>}

      <div className={s.filtersBar}>
        <input
          type="text"
          placeholder="Caută după cod…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') load() }}
          className={s.input}
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
          className={s.select}
        >
          {(Object.keys(STATUS_LABEL) as StatusFilter[]).map(k => (
            <option key={k} value={k}>{STATUS_LABEL[k]}</option>
          ))}
        </select>
        <button onClick={load} className={`${s.btn} ${s.btnSecondary}`}>
          Reîncarcă
        </button>
      </div>

      {loading ? (
        <div className={s.empty}>
          <div className={s.spinner} />
          <p className={s.emptyText}>Se încarcă codurile…</p>
        </div>
      ) : codes.length === 0 ? (
        <div className={s.empty}>
          <div className={s.emptyIcon}><TicketIcon size={32} /></div>
          <h3 className={s.emptyTitle}>Niciun cod</h3>
          <p className={s.emptyText}>
            {search || statusFilter !== 'all'
              ? 'Nu s-au găsit coduri care să corespundă criteriilor.'
              : 'Apasă „Generează cod" ca să creezi primul cod.'}
          </p>
        </div>
      ) : (
        <div className={s.tableWrap}>
          <table className={s.table}>
            <thead>
              <tr>
                <th>Cod</th>
                <th>Tip</th>
                <th>Notă</th>
                <th style={{ textAlign: 'center' }}>Status</th>
                <th>Creat</th>
                <th>De către</th>
                <th>Folosit</th>
                <th style={{ textAlign: 'center' }}>Acțiuni</th>
              </tr>
            </thead>
            <tbody>
              {codes.map(c => {
                const st = rowStatusLabel(c)
                return (
                  <tr key={c.code}>
                    <td style={{ fontFamily: 'monospace', fontWeight: 'var(--font-weight-bold)', letterSpacing: '0.05em' }}>
                      {c.code}
                    </td>
                    <td>
                      <span className={`${s.badge} ${c.kind === 'direct_refund' ? s.badgeWarning : s.badgeNeutral}`}>
                        {KIND_LABEL[c.kind] || c.kind}
                      </span>
                    </td>
                    <td style={{ color: c.note ? 'var(--color-text)' : 'var(--color-text-muted)' }}>
                      {c.note || '—'}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <span className={`${s.badge} ${st.klass}`}>{st.label}</span>
                    </td>
                    <td style={{ color: 'var(--color-text-muted)' }}>
                      {new Date(c.createdAt).toLocaleDateString('ro-RO')}
                    </td>
                    <td style={{ color: 'var(--color-text-muted)' }}>
                      {c.createdByEmail || '—'}
                    </td>
                    <td style={{ color: 'var(--color-text-muted)' }}>
                      {c.usedAt ? (
                        c.usedByReturnId ? (
                          <Link href={`/admin/returns/${c.usedByReturnId}`} style={{ color: 'var(--color-primary)' }}>
                            {c.usedByReturnId}
                          </Link>
                        ) : (
                          new Date(c.usedAt).toLocaleDateString('ro-RO')
                        )
                      ) : '—'}
                    </td>
                    <td>
                      <div className={s.tableActions}>
                        <button
                          onClick={() => copyToClipboard(c.code)}
                          className={`${s.btn} ${s.btnSecondary} ${s.btnSm}`}
                          title="Copiază cod"
                        >
                          <CopyIcon size={14} />
                          {copiedCode === c.code ? 'Copiat!' : 'Copiază'}
                        </button>
                        {!c.usedAt && (
                          <button
                            onClick={() => toggleActive(c)}
                            className={`${s.btn} ${s.btnGhost} ${s.btnSm}`}
                          >
                            {c.active ? 'Dezactivează' : 'Reactivează'}
                          </button>
                        )}
                        {!c.usedAt && (
                          <button
                            onClick={() => deleteCode(c)}
                            className={`${s.btn} ${s.btnDanger} ${s.btnSm}`}
                          >
                            Șterge
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <div
          onClick={closeModal}
          style={{
            position: 'fixed', inset: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 1000, padding: 'var(--space-4)',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'var(--color-bg)',
              borderRadius: 'var(--radius-md)',
              padding: 'var(--space-6)',
              maxWidth: '480px',
              width: '100%',
              boxShadow: 'var(--shadow-lg)',
            }}
          >
            <h2 style={{ margin: '0 0 var(--space-4)', fontSize: 'var(--font-size-xl)', fontWeight: 'var(--font-weight-bold)' }}>
              Generează coduri retur gratuit
            </h2>

            {generatedBatch.length === 0 ? (
              <form onSubmit={onGenerate}>
                <div className={s.field}>
                  <label className={s.label} htmlFor="kind">Tip cod</label>
                  <select
                    id="kind"
                    value={kind}
                    onChange={(e) => setKind(e.target.value as CodeKind)}
                    className={s.select}
                  >
                    <option value="free_shipping">{KIND_LABEL.free_shipping}</option>
                    <option value="direct_refund">{KIND_LABEL.direct_refund}</option>
                  </select>
                  <p className={s.hint}>{KIND_HINT[kind]}</p>
                </div>

                <div className={s.field}>
                  <label className={s.label} htmlFor="count">Câte coduri?</label>
                  <input
                    id="count"
                    type="number"
                    min={1}
                    max={50}
                    value={count}
                    onChange={(e) => setCount(e.target.value)}
                    className={s.input}
                  />
                  <p className={s.hint}>Între 1 și 50 coduri într-un singur batch.</p>
                </div>

                <div className={s.field}>
                  <label className={s.label} htmlFor="note">Notă (opțional)</label>
                  <textarea
                    id="note"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="ex: Produs defect — comanda #1234"
                    rows={3}
                    className={s.textarea}
                    maxLength={500}
                  />
                  <p className={s.hint}>Apare în listă și în detaliile returului unde a fost aplicat.</p>
                </div>

                <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'flex-end', marginTop: 'var(--space-4)' }}>
                  <button type="button" onClick={closeModal} className={`${s.btn} ${s.btnGhost}`}>
                    Anulează
                  </button>
                  <button type="submit" disabled={generating} className={`${s.btn} ${s.btnPrimary}`}>
                    {generating ? 'Generez…' : 'Generează'}
                  </button>
                </div>
              </form>
            ) : (
              <>
                <p style={{ margin: '0 0 var(--space-4)', color: 'var(--color-text-muted)' }}>
                  {generatedBatch.length === 1 ? 'Codul generat:' : 'Codurile generate:'}
                </p>
                <div style={{
                  display: 'flex', flexDirection: 'column', gap: 'var(--space-2)',
                  background: 'var(--color-bg-muted)',
                  padding: 'var(--space-4)',
                  borderRadius: 'var(--radius-sm)',
                  marginBottom: 'var(--space-4)',
                  maxHeight: '320px', overflowY: 'auto',
                }}>
                  {generatedBatch.map(c => (
                    <div key={c} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-3)' }}>
                      <code style={{
                        fontFamily: 'monospace', fontSize: 'var(--font-size-lg)',
                        fontWeight: 'var(--font-weight-bold)', letterSpacing: '0.1em',
                      }}>{c}</code>
                      <button
                        onClick={() => copyToClipboard(c)}
                        className={`${s.btn} ${s.btnSecondary} ${s.btnSm}`}
                      >
                        <CopyIcon size={14} />
                        {copiedCode === c ? 'Copiat!' : 'Copiază'}
                      </button>
                    </div>
                  ))}
                </div>
                {generatedBatch.length > 1 && (
                  <button
                    onClick={() => copyToClipboard(generatedBatch.join('\n'))}
                    className={`${s.btn} ${s.btnSecondary} ${s.btnSm}`}
                    style={{ marginBottom: 'var(--space-3)' }}
                  >
                    <CopyIcon size={14} />
                    {copiedCode === generatedBatch.join('\n') ? 'Toate copiate!' : 'Copiază toate'}
                  </button>
                )}
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <button onClick={closeModal} className={`${s.btn} ${s.btnPrimary}`}>
                    Închide
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}
