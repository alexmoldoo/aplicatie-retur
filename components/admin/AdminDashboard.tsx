'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import PageHeader from './PageHeader'
import { useAdminUser } from './AdminLayoutClient'
import { ArrowRightIcon, PackageIcon } from './Icon'
import s from './AdminDashboardView.module.css'
import { RETURN_STATUS_LABEL, normalizeStatus, type ReturnStatus } from '@/lib/return-status'

interface ReturnItem {
  idRetur: string
  numarComanda: string
  status: string
  totalRefund?: number
  createdAt?: string
  orderData?: { nume?: string }
}

export default function AdminDashboard() {
  const user = useAdminUser()
  const [returns, setReturns] = useState<ReturnItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/returns')
      .then(r => r.json())
      .then(data => {
        if (data.success) setReturns(data.returns || [])
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const normalized = returns.map(r => ({ ...r, status: normalizeStatus(r.status) }))
  const counts = {
    total: normalized.length,
    initiat: normalized.filter(r => r.status === 'INITIAT').length,
    inLucru: normalized.filter(r =>
      ['PRELUAT_CURIER', 'IN_TRANZIT', 'LIVRAT', 'PRIMIT'].includes(r.status)
    ).length,
    finalizat: normalized.filter(r => r.status === 'FINALIZAT').length,
  }

  const recent = [...normalized]
    .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
    .slice(0, 5)

  const stats = [
    { label: 'Retururi totale', value: counts.total },
    { label: 'Inițiate', value: counts.initiat },
    { label: 'În lucru', value: counts.inLucru },
    { label: 'Finalizate', value: counts.finalizat },
  ]

  return (
    <>
      <PageHeader title="Dashboard" subtitle={`Bine ai venit, ${user.prenume}.`} />

      <section className={s.statsGrid}>
        {stats.map(stat => (
          <div key={stat.label} className={s.statCard}>
            <div className={s.statLabel}>{stat.label}</div>
            <div className={s.statValue}>{loading ? '—' : stat.value}</div>
          </div>
        ))}
      </section>

      <section className={s.section}>
        <header className={s.sectionHeader}>
          <h2 className={s.sectionTitle}>Retururi recente</h2>
          <Link href="/admin/retururi" className={s.sectionLink}>
            Vezi toate
            <ArrowRightIcon size={14} />
          </Link>
        </header>

        <div className={s.card}>
          {loading ? (
            <div className={s.empty}>
              <div className={s.spinner} />
              <p>Se încarcă…</p>
            </div>
          ) : recent.length === 0 ? (
            <div className={s.empty}>
              <div className={s.emptyIcon}><PackageIcon size={28} /></div>
              <p className={s.emptyTitle}>Niciun retur încă</p>
              <p className={s.emptyText}>Cererile noi vor apărea aici.</p>
            </div>
          ) : (
            <ul className={s.list}>
              {recent.map(ret => (
                <li key={ret.idRetur} className={s.row}>
                  <Link href={`/admin/returns/${ret.idRetur}`} className={s.rowLink}>
                    <div className={s.rowMain}>
                      <div className={s.rowId}>{ret.idRetur}</div>
                      <div className={s.rowMeta}>
                        {ret.orderData?.nume || '—'} · #{ret.numarComanda}
                      </div>
                    </div>
                    <div className={s.rowSide}>
                      <span className={s.rowStatus}>{RETURN_STATUS_LABEL[ret.status]}</span>
                      <ArrowRightIcon size={14} />
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </>
  )
}
