'use client'

import PageHeader from '@/components/admin/PageHeader'
import { useAdminUser } from '@/components/admin/AdminLayoutClient'
import { UsersIcon } from '@/components/admin/Icon'
import s from '@/components/AdminDashboard.module.css'

export default function UtilizatoriPage() {
  const user = useAdminUser()

  return (
    <>
      <PageHeader title="Utilizatori & accese" subtitle="Adaugă colegi cu acces limitat sau full." />
      <div className={s.card}>
        <div className={s.empty}>
          <div className={s.emptyIcon}><UsersIcon size={28} /></div>
          <h3 className={s.emptyTitle}>În curând</h3>
          <p className={s.emptyText}>
            Aici vei putea invita colegi cu unul din rolurile:<br/>
            <strong>Owner</strong> (acces complet) sau <strong>Operator retururi</strong> (doar gestionează cereri de retur).
          </p>
          <p className={s.emptyText} style={{ marginTop: 'var(--space-4)' }}>
            <em>Contul tău actual: {user.email}</em>
          </p>
        </div>
      </div>
    </>
  )
}
