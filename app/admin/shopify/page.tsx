'use client'

import { useState, useEffect, FormEvent } from 'react'
import PageHeader from '@/components/admin/PageHeader'
import s from '@/components/AdminDashboard.module.css'

export default function ShopifyPage() {
  const [loadingCfg, setLoadingCfg] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const [shopifyDomain, setShopifyDomain] = useState('')
  const [shopifyClientId, setShopifyClientId] = useState('')
  const [shopifyClientSecret, setShopifyClientSecret] = useState('')
  const [shopifyAccessToken, setShopifyAccessToken] = useState('')
  const [shopTitle, setShopTitle] = useState('')
  const [isShopifyConnected, setIsShopifyConnected] = useState(false)
  const [showShopifyEdit, setShowShopifyEdit] = useState(false)
  const [clientIdConfigured, setClientIdConfigured] = useState(false)
  const [clientSecretConfigured, setClientSecretConfigured] = useState(false)
  const [accessTokenConfigured, setAccessTokenConfigured] = useState(false)

  const [excludedSKUs, setExcludedSKUs] = useState<string[]>([])
  const [newSKU, setNewSKU] = useState('')

  useEffect(() => {
    loadConfig()
  }, [])

  const loadConfig = async () => {
    try {
      const response = await fetch('/api/config')
      const data = await response.json()
      if (data.success) {
        setShopifyDomain(data.config.shopify.domain || '')
        setShopTitle(data.config.shopify.shopTitle || '')
        setExcludedSKUs(data.config.excludedSKUs || [])

        const cidOk = !!data.config.shopify.clientIdConfigured
        const csOk = !!data.config.shopify.clientSecretConfigured
        const tokOk = !!data.config.shopify.accessTokenConfigured
        setClientIdConfigured(cidOk)
        setClientSecretConfigured(csOk)
        setAccessTokenConfigured(tokOk)

        const hasCreds = (cidOk && csOk) || tokOk
        const connected = hasCreds && data.config.shopify.domain && data.config.shopify.shopTitle
        setIsShopifyConnected(connected)
      }
    } catch {
      setError('Eroare la încărcarea configurației')
    } finally {
      setLoadingCfg(false)
    }
  }

  const handleSaveShopify = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(null)
    setSaving(true)

    if (!shopTitle || !shopifyDomain) {
      setError('Domain Shopify și Titlu magazin sunt obligatorii')
      setSaving(false)
      return
    }

    const hasNewCreds = shopifyClientId && shopifyClientSecret
    const hasLegacy = shopifyAccessToken
    const alreadyConfigured = (clientIdConfigured && clientSecretConfigured) || accessTokenConfigured

    if (!hasNewCreds && !hasLegacy && !alreadyConfigured) {
      setError('Completează Client ID + Client Secret (sau Access Token legacy)')
      setSaving(false)
      return
    }

    try {
      const response = await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shopify: {
            domain: shopifyDomain,
            clientId: shopifyClientId,
            clientSecret: shopifyClientSecret,
            accessToken: shopifyAccessToken,
            shopTitle,
          },
        }),
      })
      const data = await response.json()
      if (data.success) {
        setSuccess('Configurație Shopify salvată cu succes!')
        setIsShopifyConnected(true)
        setShowShopifyEdit(false)
        setShopifyClientId('')
        setShopifyClientSecret('')
        setShopifyAccessToken('')
        loadConfig()
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

  const handleSaveSKUs = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(null)
    setSaving(true)

    try {
      const response = await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ excludedSKUs }),
      })
      const data = await response.json()
      if (data.success) {
        setSuccess('SKU-uri excluse salvate cu succes!')
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

  const handleAddSKU = () => {
    const cleaned = newSKU.trim().toUpperCase()
    if (cleaned && !excludedSKUs.includes(cleaned)) {
      setExcludedSKUs([...excludedSKUs, cleaned])
      setNewSKU('')
    }
  }

  const handleRemoveSKU = (sku: string) => {
    setExcludedSKUs(excludedSKUs.filter(x => x !== sku))
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
      <PageHeader title="Shopify" subtitle="Conectează magazinul și configurează SKU-urile excluse de la retur." />
      {error && <div className={`${s.alert} ${s.alertError}`}>{error}</div>}
      {success && <div className={`${s.alert} ${s.alertSuccess}`}>{success}</div>}

      <div className={s.card}>
        <div className={s.cardHeader}>
          <h2 className={s.cardTitle}>Configurare Shopify</h2>
          {isShopifyConnected && !showShopifyEdit && (
            <button
              type="button"
              onClick={() => setShowShopifyEdit(true)}
              className={`${s.btn} ${s.btnPrimary} ${s.btnSm}`}
            >
              Editează
            </button>
          )}
        </div>

        {isShopifyConnected && !showShopifyEdit ? (
          <div className={`${s.statusBox} ${s.statusBoxSuccess}`}>
            <div className={s.statusRow}>
              <div className={s.statusIcon}>✓</div>
              <div className={s.statusText}>
                <div><span className={s.statusLabel}>Magazin conectat:</span> {shopTitle}</div>
                <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)' }}>
                  {shopifyDomain}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSaveShopify}>
            <div className={s.intro}>
              <strong>Cum obții cheile?</strong> Du-te în Shopify → Settings → Apps and sales channels →
              Develop apps → creează o aplicație custom și generează Client ID + Client Secret cu permisiunile
              de citire comenzi și produse.
            </div>

            <div className={`${s.fieldRow} ${s.fieldRow2}`}>
              <div className={s.field}>
                <label className={s.label}>Domain Shopify *</label>
                <input
                  type="text"
                  value={shopifyDomain}
                  onChange={(e) => setShopifyDomain(e.target.value)}
                  placeholder="magazin.myshopify.com"
                  className={s.input}
                />
              </div>

              <div className={s.field}>
                <label className={s.label}>Titlu magazin *</label>
                <input
                  type="text"
                  value={shopTitle}
                  onChange={(e) => setShopTitle(e.target.value)}
                  placeholder="MAXARI"
                  className={s.input}
                />
              </div>
            </div>

            <div className={s.field}>
              <label className={s.label}>
                Client ID Shopify {clientIdConfigured && <span style={{ color: 'var(--color-success)', fontWeight: 'var(--font-weight-normal)' }}>· configurat ✓</span>}
              </label>
              <input
                type="text"
                value={shopifyClientId}
                onChange={(e) => setShopifyClientId(e.target.value)}
                placeholder={clientIdConfigured ? '••••••••••' : 'din Dev Dashboard'}
                className={s.input}
                style={{ fontFamily: 'monospace' }}
              />
            </div>

            <div className={s.field}>
              <label className={s.label}>
                Client Secret Shopify {clientSecretConfigured && <span style={{ color: 'var(--color-success)', fontWeight: 'var(--font-weight-normal)' }}>· configurat ✓</span>}
              </label>
              <input
                type="password"
                value={shopifyClientSecret}
                onChange={(e) => setShopifyClientSecret(e.target.value)}
                placeholder={clientSecretConfigured ? '••••••••••' : 'din Dev Dashboard'}
                className={s.input}
                style={{ fontFamily: 'monospace' }}
              />
            </div>

            <details className={s.details}>
              <summary className={s.detailsSummary}>Folosesc Access Token legacy (shpat_)</summary>
              <div className={s.field} style={{ marginTop: 'var(--space-3)' }}>
                <label className={s.label}>
                  Access Token (legacy) {accessTokenConfigured && <span style={{ color: 'var(--color-success)', fontWeight: 'var(--font-weight-normal)' }}>· configurat ✓</span>}
                </label>
                <input
                  type="password"
                  value={shopifyAccessToken}
                  onChange={(e) => setShopifyAccessToken(e.target.value)}
                  placeholder={accessTokenConfigured ? '••••••••••' : 'shpat_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'}
                  className={s.input}
                  style={{ fontFamily: 'monospace' }}
                />
              </div>
            </details>

            <div className={s.actionsRow} style={{ marginTop: 'var(--space-5)' }}>
              <button
                type="submit"
                disabled={saving}
                className={`${s.btn} ${s.btnPrimary}`}
                style={{ flex: 1 }}
              >
                {saving ? 'Se salvează…' : 'Salvează configurație Shopify'}
              </button>
              {isShopifyConnected && (
                <button
                  type="button"
                  onClick={() => setShowShopifyEdit(false)}
                  className={`${s.btn} ${s.btnSecondary}`}
                >
                  Anulează
                </button>
              )}
            </div>
          </form>
        )}
      </div>

      <form onSubmit={handleSaveSKUs}>
        <div className={s.card}>
          <div className={s.cardHeader}>
            <h2 className={s.cardTitle}>SKU-uri excluse de la retur</h2>
          </div>

          <p className={s.cardSubtitle} style={{ marginBottom: 'var(--space-4)' }}>
            Produsele cu aceste SKU-uri nu pot fi returnate. Util pentru produse personalizate, lichidări, etc.
          </p>

          <div className={s.actionsRow}>
            <input
              type="text"
              value={newSKU}
              onChange={(e) => setNewSKU(e.target.value.toUpperCase())}
              placeholder="Ex: RMA-009"
              onKeyPress={(e) => {
                if (e.key === 'Enter') { e.preventDefault(); handleAddSKU() }
              }}
              className={s.input}
              style={{ flex: 1 }}
            />
            <button type="button" onClick={handleAddSKU} className={`${s.btn} ${s.btnPrimary}`}>
              Adaugă
            </button>
          </div>

          {excludedSKUs.length > 0 ? (
            <div className={s.tagList}>
              {excludedSKUs.map(sku => (
                <span key={sku} className={s.tag}>
                  <strong>{sku}</strong>
                  <button
                    type="button"
                    onClick={() => handleRemoveSKU(sku)}
                    className={s.tagRemove}
                    aria-label={`Elimină ${sku}`}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          ) : (
            <p className={s.hint} style={{ marginTop: 'var(--space-3)', fontStyle: 'italic' }}>
              Nu există SKU-uri excluse. Toate produsele pot fi returnate.
            </p>
          )}

          <button
            type="submit"
            disabled={saving}
            className={`${s.btn} ${s.btnPrimary} ${s.btnFull}`}
            style={{ marginTop: 'var(--space-5)' }}
          >
            {saving ? 'Se salvează…' : 'Salvează SKU-uri excluse'}
          </button>
        </div>
      </form>
    </>
  )
}
