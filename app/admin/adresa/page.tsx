'use client'

import { useState, useEffect, FormEvent } from 'react'
import PageHeader from '@/components/admin/PageHeader'
import s from '@/components/AdminDashboard.module.css'

interface AdresaRetur {
  companie: string
  strada: string
  oras: string
  judet: string
  codPostal: string
  tara: string
  telefon: string
}

const DEFAULT_ADRESA: AdresaRetur = {
  companie: 'Maxari',
  strada: '',
  oras: '',
  judet: '',
  codPostal: '',
  tara: 'România',
  telefon: '-',
}

export default function AdresaPage() {
  const [loadingCfg, setLoadingCfg] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const [adresaRetur, setAdresaRetur] = useState<AdresaRetur>(DEFAULT_ADRESA)
  const [costCurier, setCostCurier] = useState('19.99')

  useEffect(() => {
    loadAdresaRetur()
  }, [])

  const loadAdresaRetur = async () => {
    try {
      const res = await fetch('/api/config/return-info')
      const data = await res.json()
      if (data.success) {
        if (data.adresaRetur) setAdresaRetur(data.adresaRetur)
        if (data.transportCosts?.curier != null) {
          setCostCurier(String(data.transportCosts.curier))
        }
      }
    } catch {
      // ignore
    } finally {
      setLoadingCfg(false)
    }
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(null)
    setSaving(true)
    try {
      const cost = parseFloat(costCurier)
      const res = await fetch('/api/config/return-info', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          adresaRetur,
          transportCosts: Number.isFinite(cost) && cost >= 0 ? { curier: cost } : undefined,
        }),
      })
      const data = await res.json()
      if (data.success) {
        setSuccess('Adresa de retur salvată.')
        setTimeout(() => setSuccess(null), 3000)
      } else {
        setError(data.message || 'Eroare la salvare')
      }
    } catch {
      setError('Eroare la conectare.')
    } finally {
      setSaving(false)
    }
  }

  const updateField = (field: keyof AdresaRetur, value: string) => {
    setAdresaRetur(prev => ({ ...prev, [field]: value }))
  }

  if (loadingCfg) {
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
      <PageHeader title="Adresa de retur" subtitle="Adresa la care clienții trimit coletele cu retururi." />
      {error && <div className={`${s.alert} ${s.alertError}`}>{error}</div>}
      {success && <div className={`${s.alert} ${s.alertSuccess}`}>{success}</div>}

      <form onSubmit={handleSubmit}>
        <div className={s.card}>
          <div className={s.cardHeader}>
            <h2 className={s.cardTitle}>Adresa de expediere</h2>
          </div>

          <p className={s.cardSubtitle} style={{ marginBottom: 'var(--space-5)' }}>
            Apare clienților care aleg să trimită coletul prin curier propriu (manual).
          </p>

          <div className={`${s.fieldRow} ${s.fieldRow2}`}>
            <div className={s.field}>
              <label className={s.label}>Companie *</label>
              <input
                type="text"
                value={adresaRetur.companie}
                onChange={(e) => updateField('companie', e.target.value)}
                className={s.input}
                required
              />
            </div>
            <div className={s.field}>
              <label className={s.label}>Telefon</label>
              <input
                type="text"
                value={adresaRetur.telefon}
                onChange={(e) => updateField('telefon', e.target.value)}
                className={s.input}
                placeholder="-"
              />
            </div>
          </div>

          <div className={s.field}>
            <label className={s.label}>Stradă *</label>
            <input
              type="text"
              value={adresaRetur.strada}
              onChange={(e) => updateField('strada', e.target.value)}
              className={s.input}
              required
            />
          </div>

          <div className={`${s.fieldRow} ${s.fieldRow3}`}>
            <div className={s.field}>
              <label className={s.label}>Oraș *</label>
              <input
                type="text"
                value={adresaRetur.oras}
                onChange={(e) => updateField('oras', e.target.value)}
                className={s.input}
                required
              />
            </div>
            <div className={s.field}>
              <label className={s.label}>Județ *</label>
              <input
                type="text"
                value={adresaRetur.judet}
                onChange={(e) => updateField('judet', e.target.value)}
                className={s.input}
                required
              />
            </div>
            <div className={s.field}>
              <label className={s.label}>Cod poștal *</label>
              <input
                type="text"
                value={adresaRetur.codPostal}
                onChange={(e) => updateField('codPostal', e.target.value)}
                className={s.input}
                required
              />
            </div>
          </div>

          <div className={`${s.fieldRow} ${s.fieldRow2}`}>
            <div className={s.field}>
              <label className={s.label}>Țară</label>
              <input
                type="text"
                value={adresaRetur.tara}
                onChange={(e) => updateField('tara', e.target.value)}
                className={s.input}
              />
            </div>
            <div className={s.field}>
              <label className={s.label}>Cost curier (RON)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={costCurier}
                onChange={(e) => setCostCurier(e.target.value)}
                className={s.input}
                placeholder="19.99"
              />
              <p className={s.hint}>Cost reținut din rambursare dacă clientul alege curier propriu.</p>
            </div>
          </div>

          <button
            type="submit"
            disabled={saving}
            className={`${s.btn} ${s.btnPrimary} ${s.btnFull}`}
            style={{ marginTop: 'var(--space-5)' }}
          >
            {saving ? 'Se salvează…' : 'Salvează adresa de retur'}
          </button>
        </div>
      </form>
    </>
  )
}
