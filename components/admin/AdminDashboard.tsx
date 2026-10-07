'use client'

import Link from 'next/link'
import PageHeader from './PageHeader'
import { useAdminUser } from './AdminLayoutClient'
import { useReturnsList } from './useReturnsList'
import { ArrowRightIcon, PackageIcon } from './Icon'
import s from './AdminDashboardView.module.css'
import { RETURN_STATUS_LABEL, normalizeStatus, type ReturnStatus } from '@/lib/return-status'
import { monthKeyRO, currentAndPreviousMonthRO } from '@/lib/dates'

interface ReturnItem {
  idRetur: string
  numarComanda: string
  status: string
  totalRefund?: number
  createdAt?: string
  orderData?: { nume?: string }
  refundData?: { finalizatLa?: string; plata?: { suma?: number; platitLa?: string } }
}

export default function AdminDashboard() {
  const user = useAdminUser()
  // Lista din memorie: apare instant la revenirea pe dashboard, se aduce la zi în fundal
  const { returns, loading } = useReturnsList()

  const normalized = (returns as unknown as ReturnItem[]).map(r => ({ ...r, status: normalizeStatus(r.status) }))
  const counts = {
    total: normalized.length,
    initiat: normalized.filter(r => r.status === 'INITIAT').length,
    inLucru: normalized.filter(r =>
      ['PRELUAT_CURIER', 'IN_TRANZIT', 'LIVRAT', 'PRIMIT', 'IN_PLATA'].includes(r.status)
    ).length,
    finalizat: normalized.filter(r => r.status === 'FINALIZAT').length,
  }

  // Bani dați înapoi luna aceasta: retururi finalizate, la data plății
  const { current } = currentAndPreviousMonthRO()
  const rambursatLunaAceasta = normalized
    .filter(r => r.status === 'FINALIZAT')
    .filter(r => monthKeyRO(r.refundData?.finalizatLa || r.refundData?.plata?.platitLa || r.createdAt || '') === current)
    .reduce((sum, r) => sum + Number(r.refundData?.plata?.suma ?? r.totalRefund ?? 0), 0)

  const recent = [...normalized]
    .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
    .slice(0, 5)

  const stats = [
    { label: 'Retururi totale', value: counts.total },
    { label: 'Inițiate', value: counts.initiat },
    { label: 'În lucru', value: counts.inLucru },
    { label: 'Finalizate', value: counts.finalizat },
    { label: 'Rambursat luna aceasta', value: `${rambursatLunaAceasta.toFixed(2)} RON` },
  ]

  return (
    <>
      <PageHeader title="Dashboard" subtitle={`Bine ai venit, ${user.prenume}.`} />

      <section className={s.statsGrid}>
        {stats.map(stat => (
          <div key={stat.label} className={s.statCard}>
            <div className={s.statLabel}>{stat.label}</div>
            <div className={s.statValue}>{loading && returns.length === 0 ? '—' : stat.value}</div>
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
          {loading && returns.length === 0 ? (
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
                        {ret.orderData?.nume || '—'} · #{(ret.numarComanda || '').replace(/^#/, '')}
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
