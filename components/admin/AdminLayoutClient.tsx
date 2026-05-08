'use client'

import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import AdminLogin from '@/components/AdminLogin'
import shellCss from './AdminShell.module.css'
import shellLayout from '../../app/admin/admin.module.css'
import {
  HomeIcon,
  PackageIcon,
  StoreIcon,
  MapPinIcon,
  PaletteIcon,
  PenIcon,
  UsersIcon,
  LogoutIcon,
  MenuIcon,
  CloseIcon,
} from './Icon'
import type { ComponentType, SVGProps } from 'react'

interface AdminUser {
  id: string
  nume: string
  prenume: string
  email: string
}

interface NavItem {
  href: string
  Icon: ComponentType<SVGProps<SVGSVGElement> & { size?: number }>
  label: string
  comingSoon?: boolean
}

const NAV: NavItem[] = [
  { href: '/admin', Icon: HomeIcon, label: 'Dashboard' },
  { href: '/admin/retururi', Icon: PackageIcon, label: 'Retururi' },
  { href: '/admin/shopify', Icon: StoreIcon, label: 'Shopify' },
  { href: '/admin/adresa', Icon: MapPinIcon, label: 'Adresa de retur' },
  { href: '/admin/branding', Icon: PaletteIcon, label: 'Branding' },
  { href: '/admin/texte', Icon: PenIcon, label: 'Texte', comingSoon: true },
  { href: '/admin/utilizatori', Icon: UsersIcon, label: 'Utilizatori', comingSoon: true },
]

const AdminUserContext = createContext<AdminUser | null>(null)

/** Hook pentru paginile interioare să acceseze user-ul curent. */
export function useAdminUser(): AdminUser {
  const u = useContext(AdminUserContext)
  if (!u) throw new Error('useAdminUser trebuie folosit într-o pagină admin (sub layout)')
  return u
}

export default function AdminLayoutClient({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<AdminUser | null>(null)
  const [mobileOpen, setMobileOpen] = useState(false)

  const checkAuth = useCallback(async () => {
    try {
      const r = await fetch('/api/auth/check')
      const data = await r.json()
      setUser(data.authenticated && data.user ? data.user : null)
    } catch {
      setUser(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    checkAuth()
  }, [checkAuth])

  useEffect(() => {
    setMobileOpen(false)
  }, [pathname])

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
      setUser(null)
      router.replace('/admin')
    } catch (e) {
      console.error('Logout failed:', e)
    }
  }

  if (loading) {
    return (
      <div className={shellLayout.loadingShell}>
        <div className={shellLayout.loadingInner}>
          <div className={shellLayout.spinner} />
          <p>Se încarcă…</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return <AdminLogin onLoginSuccess={checkAuth} />
  }

  const isActive = (href: string) => {
    if (href === '/admin') return pathname === '/admin'
    return pathname === href || pathname?.startsWith(`${href}/`)
  }

  const initials = `${user.prenume?.[0] || ''}${user.nume?.[0] || ''}`.toUpperCase() || 'XP'

  return (
    <AdminUserContext.Provider value={user}>
      <div className={shellCss.layout} data-admin-shell>
        <aside className={`${shellCss.sidebar} ${mobileOpen ? shellCss.sidebarOpen : ''}`} aria-label="Navigare admin">
          <div className={shellCss.sidebarHeader}>
            <div className={shellCss.brand}>
              <img src="/logo-xpy.png" alt="" className={shellCss.brandLogo} />
              <span className={shellCss.brandText}>XPY</span>
            </div>
            <button
              type="button"
              className={shellCss.closeBtn}
              onClick={() => setMobileOpen(false)}
              aria-label="Închide meniul"
            >
              <CloseIcon size={20} />
            </button>
          </div>

          <nav className={shellCss.nav}>
            {NAV.map(item => {
              const active = isActive(item.href)
              const className = `${shellCss.navItem} ${active ? shellCss.navItemActive : ''} ${item.comingSoon ? shellCss.navItemDisabled : ''}`
              const inner = (
                <>
                  <span className={shellCss.navIcon}><item.Icon size={18} /></span>
                  <span className={shellCss.navLabel}>{item.label}</span>
                  {item.comingSoon && <span className={shellCss.navBadge}>Soon</span>}
                </>
              )
              return item.comingSoon ? (
                <span key={item.href} className={className} aria-disabled="true">
                  {inner}
                </span>
              ) : (
                <Link key={item.href} href={item.href} className={className} aria-current={active ? 'page' : undefined}>
                  {inner}
                </Link>
              )
            })}
          </nav>
        </aside>

        {mobileOpen && <div className={shellCss.overlay} onClick={() => setMobileOpen(false)} aria-hidden="true" />}

        <div className={shellCss.content}>
          <header className={shellCss.topBar}>
            <button
              type="button"
              className={shellCss.menuBtn}
              onClick={() => setMobileOpen(true)}
              aria-label="Deschide meniul"
            >
              <MenuIcon size={22} />
            </button>
            <div className={shellCss.topBarSpacer} />
            <div className={shellCss.profile}>
              <div className={shellCss.profileMeta}>
                <div className={shellCss.profileName}>{user.prenume} {user.nume}</div>
                <div className={shellCss.profileEmail}>{user.email}</div>
              </div>
              <div className={shellCss.avatar}>{initials}</div>
              <button onClick={handleLogout} className={shellCss.logoutBtn} aria-label="Deconectare" title="Deconectare">
                <LogoutIcon size={16} />
              </button>
            </div>
          </header>

          <main className={shellCss.main}>
            {children}
          </main>
        </div>
      </div>
    </AdminUserContext.Provider>
  )
}
