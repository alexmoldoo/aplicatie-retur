'use client'

import PageHeader from '@/components/admin/PageHeader'
import { PenIcon } from '@/components/admin/Icon'
import s from '@/components/AdminDashboard.module.css'

export default function TextePage() {
  return (
    <>
      <PageHeader title="Texte & motive retur" subtitle="Personalizează textele afișate clienților." />
      <div className={s.card}>
        <div className={s.empty}>
          <div className={s.emptyIcon}><PenIcon size={28} /></div>
          <h3 className={s.emptyTitle}>În curând</h3>
          <p className={s.emptyText}>
            Aici vei putea edita textele din interfața clientului (titluri, mesaje, motive de retur).<br/>
            Momentan textele sunt în <code>config/texts.ts</code>.
          </p>
        </div>
      </div>
    </>
  )
}
