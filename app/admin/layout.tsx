import AdminLayoutClient from '@/components/admin/AdminLayoutClient'
import s from './admin.module.css'

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className={s.shell} data-admin-shell>
      <AdminLayoutClient>{children}</AdminLayoutClient>
    </div>
  )
}
