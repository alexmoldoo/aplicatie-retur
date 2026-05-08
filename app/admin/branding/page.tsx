'use client'

import { useState, useEffect } from 'react'
import PageHeader from '@/components/admin/PageHeader'
import s from '@/components/AdminDashboard.module.css'

export default function BrandingPage() {
  const [loadingCfg, setLoadingCfg] = useState(true)
  const [savingLogo, setSavingLogo] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [logo, setLogo] = useState<string | null>(null)

  useEffect(() => {
    loadCfg()
  }, [])

  const loadCfg = async () => {
    try {
      const res = await fetch('/api/config/return-info')
      const data = await res.json()
      if (data.success && data.logo) setLogo(data.logo)
    } catch {
      // ignore
    } finally {
      setLoadingCfg(false)
    }
  }

  const saveLogo = async (value: string | null) => {
    setSavingLogo(true)
    setError(null)
    setSuccess(null)
    try {
      const res = await fetch('/api/config/return-info', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ logo: value }),
      })
      const data = await res.json()
      if (data.success) {
        setSuccess(value ? 'Logo salvat.' : 'Logo eliminat.')
        setTimeout(() => setSuccess(null), 3000)
      } else {
        setError(data.message || 'Eroare la salvarea logo-ului')
      }
    } catch {
      setError('Eroare la conectare.')
    } finally {
      setSavingLogo(false)
    }
  }

  const handleLogoFile = async (file: File) => {
    if (!file) return
    if (!/^image\/(png|jpe?g|webp)$/.test(file.type)) {
      setError('Logo invalid. Acceptate: PNG, JPG, WEBP.')
      return
    }
    if (file.size > 1_000_000) {
      setError('Logo-ul depășește 1 MB. Folosește o imagine mai mică.')
      return
    }
    setError(null)
    const dataUrl: string = await new Promise((resolve, reject) => {
      const r = new FileReader()
      r.onload = () => resolve(String(r.result))
      r.onerror = reject
      r.readAsDataURL(file)
    })
    setLogo(dataUrl)
    await saveLogo(dataUrl)
  }

  const handleRemoveLogo = async () => {
    setLogo(null)
    await saveLogo(null)
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
      <PageHeader title="Branding" subtitle="Logo-ul magazinului folosit în PDF-ul de retur și UI-ul clientului." />
      {error && <div className={`${s.alert} ${s.alertError}`}>{error}</div>}
      {success && <div className={`${s.alert} ${s.alertSuccess}`}>{success}</div>}

      <div className={s.card}>
        <div className={s.cardHeader}>
          <h2 className={s.cardTitle}>Logo magazin</h2>
        </div>

        <p className={s.cardSubtitle} style={{ marginBottom: 'var(--space-5)' }}>
          Apare în antetul PDF-ului de retur trimis curierului. Format: PNG, JPG sau WEBP. Maxim 1 MB.
        </p>

        <div className={s.logoPreview}>
          <div style={{
            width: '120px',
            height: '80px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: '#fff',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-md)',
          }}>
            {logo ? (
              <img
                src={logo}
                alt="Logo"
                style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
              />
            ) : (
              <span style={{ color: 'var(--color-text-subtle)', fontSize: 'var(--font-size-xs)' }}>
                Niciun logo
              </span>
            )}
          </div>

          <div style={{ flex: 1, minWidth: '200px' }}>
            <div className={s.actionsRow}>
              <label
                className={`${s.btn} ${s.btnPrimary}`}
                style={{ cursor: savingLogo ? 'not-allowed' : 'pointer' }}
              >
                {savingLogo ? 'Se încarcă…' : (logo ? 'Înlocuiește logo' : 'Încarcă logo')}
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) handleLogoFile(file)
                  }}
                  style={{ display: 'none' }}
                />
              </label>
              {logo && (
                <button
                  type="button"
                  onClick={handleRemoveLogo}
                  disabled={savingLogo}
                  className={`${s.btn} ${s.btnSecondary}`}
                  style={{ color: 'var(--color-error)', borderColor: 'var(--color-error-border)' }}
                >
                  Elimină
                </button>
              )}
            </div>
            <p className={s.hint} style={{ marginTop: 'var(--space-3)' }}>
              Recomandăm un logo cu fundal transparent (PNG) și dimensiuni minime de 240×120px.
            </p>
          </div>
        </div>
      </div>
    </>
  )
}
