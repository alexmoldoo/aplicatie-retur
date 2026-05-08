'use client'

import { useState, useEffect } from 'react'
import PageHeader from '@/components/admin/PageHeader'
import { InboxIcon } from '@/components/admin/Icon'
import s from '@/components/AdminDashboard.module.css'
import { RETURN_STATUS_LABEL, RETURN_STATUS_LIST, normalizeStatus, type ReturnStatus } from '@/lib/return-status'

function badgeClassFor(status: ReturnStatus): string {
  switch (status) {
    case 'INITIAT': return s.badgeNeutral
    case 'PRELUAT_CURIER': return s.badgeInfo
    case 'IN_TRANZIT': return s.badgeWarning
    case 'LIVRAT': return s.badgeInfo
    case 'PRIMIT': return s.badgeInfo
    case 'FINALIZAT': return s.badgeSuccess
    case 'ANULAT': return s.badgeError
    default: return s.badgeNeutral
  }
}

export default function ReturnsPage() {
  const [returns, setReturns] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedStatus, setSelectedStatus] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [syncing, setSyncing] = useState(false)
  const [syncMsg, setSyncMsg] = useState<string | null>(null)

  useEffect(() => {
    loadReturns()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedStatus])

  const loadReturns = async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (selectedStatus) params.append('status', selectedStatus)
      const url = `/api/returns${params.toString() ? `?${params.toString()}` : ''}`
      const response = await fetch(url)
      const data = await response.json()
      if (data.success) {
        let filtered = data.returns || []
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase().trim()
          filtered = filtered.filter((ret: any) =>
            ret.idRetur.toLowerCase().includes(q) ||
            ret.numarComanda.toLowerCase().includes(q) ||
            (ret.orderData?.nume && ret.orderData.nume.toLowerCase().includes(q))
          )
        }
        setReturns(filtered)
      } else {
        setError(data.message || 'Eroare la încărcarea retururilor')
        setReturns([])
      }
    } catch {
      setError('Eroare la conectare. Vă rugăm să încercați din nou.')
      setReturns([])
    } finally {
      setLoading(false)
    }
  }

  const syncTracking = async () => {
    setSyncing(true)
    setSyncMsg(null)
    setError(null)
    try {
      const r = await fetch('/api/admin/returns/refresh-tracking', { method: 'POST' })
      const data = await r.json()
      if (!r.ok || !data.success) {
        setError(data?.message || 'Eroare la sincronizarea tracking-ului.')
        return
      }
      const { processed, updated, skipped, errors } = data
      const errPart = errors?.length ? ` · ${errors.length} erori` : ''
      let detail = `Verificate: ${processed} · Actualizate: ${updated} · Neschimbate: ${skipped}${errPart}`
      if (errors?.length) {
        const first = errors.slice(0, 3).map((e: any) => `${e.idRetur} (${e.awbNumber}): ${e.error}`).join(' | ')
        detail += ` — ${first}`
      }
      setSyncMsg(detail)
      if (updated > 0) {
        await loadReturns()
      }
    } catch {
      setError('Eroare la conectare.')
    } finally {
      setSyncing(false)
    }
  }

  return (
    <>
      <PageHeader title="Retururi" subtitle="Vezi și gestionează cererile de retur." />

      {error && <div className={`${s.alert} ${s.alertError}`}>{error}</div>}
      {syncMsg && <div className={`${s.alert} ${s.alertInfo || ''}`} style={{ background: 'var(--color-info-bg)', color: 'var(--color-info)', border: '1px solid var(--color-info-border)' }}>{syncMsg}</div>}

      <div className={s.filtersBar}>
        <input
          type="text"
          placeholder="Caută după ID retur, număr comandă sau nume client…"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') loadReturns() }}
          className={s.input}
        />
        <select
          value={selectedStatus}
          onChange={(e) => setSelectedStatus(e.target.value)}
          className={s.select}
        >
          <option value="">Toate statusurile</option>
          {RETURN_STATUS_LIST.map(k => (
            <option key={k} value={k}>{RETURN_STATUS_LABEL[k]}</option>
          ))}
        </select>
        <button onClick={loadReturns} className={`${s.btn} ${s.btnPrimary}`}>
          Reîncarcă
        </button>
        <button
          onClick={syncTracking}
          disabled={syncing}
          className={`${s.btn} ${s.btnSecondary}`}
          title="Verifică tracking SameDay și actualizează automat statusurile retururilor active"
        >
          {syncing ? 'Sincronizez…' : 'Sincronizează tracking'}
        </button>
      </div>

      {loading ? (
        <div className={s.empty}>
          <div className={s.spinner} />
          <p className={s.emptyText}>Se încarcă retururile…</p>
        </div>
      ) : returns.length === 0 ? (
        <div className={s.empty}>
          <div className={s.emptyIcon}><InboxIcon size={32} /></div>
          <h3 className={s.emptyTitle}>Niciun retur găsit</h3>
          <p className={s.emptyText}>
            {searchQuery || selectedStatus
              ? 'Nu s-au găsit retururi care să corespundă criteriilor.'
              : 'Nu există retururi încă.'}
          </p>
        </div>
      ) : (
        <div className={s.tableWrap}>
          <table className={s.table}>
            <thead>
              <tr>
                <th>ID Retur</th>
                <th>Număr Comandă</th>
                <th>Nume Client</th>
                <th style={{ textAlign: 'right' }}>Total Rambursare</th>
                <th style={{ textAlign: 'center' }}>Status</th>
                <th>Data Creării</th>
                <th style={{ textAlign: 'center' }}>Acțiuni</th>
              </tr>
            </thead>
            <tbody>
              {returns.map((ret: any) => (
                <tr
                  key={ret.idRetur}
                  onClick={() => window.location.href = `/admin/returns/${ret.idRetur}`}
                >
                  <td style={{ fontWeight: 'var(--font-weight-bold)', color: 'var(--color-primary)' }}>
                    {ret.idRetur}
                  </td>
                  <td>{ret.numarComanda}</td>
                  <td>{ret.orderData?.nume || 'N/A'}</td>
                  <td style={{ textAlign: 'right', fontWeight: 'var(--font-weight-semibold)' }}>
                    {ret.totalRefund?.toFixed(2) || '0.00'} RON
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    {(() => {
                      const st = normalizeStatus(ret.status)
                      return (
                        <span className={`${s.badge} ${badgeClassFor(st)}`}>
                          {RETURN_STATUS_LABEL[st]}
                        </span>
                      )
                    })()}
                  </td>
                  <td style={{ color: 'var(--color-text-muted)' }}>
                    {new Date(ret.createdAt).toLocaleDateString('ro-RO')}
                  </td>
                  <td>
                    <div className={s.tableActions}>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          window.location.href = `/admin/returns/${ret.idRetur}`
                        }}
                        className={`${s.btn} ${s.btnPrimary} ${s.btnSm}`}
                      >
                        Detalii
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          window.open(`/api/returns/${ret.idRetur}/pdf`, '_blank')
                        }}
                        className={`${s.btn} ${s.btnSecondary} ${s.btnSm}`}
                      >
                        PDF
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}
