'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faBars, faRightFromBracket, faXmark, faGear, faUsers, faCartShopping, faTruck, faFileInvoiceDollar, faHandHoldingDollar, faMoneyCheckDollar, faReceipt, faUserGroup, faArrowTrendUp, faMoneyBillWave, faChartBar, faIdCard } from '@fortawesome/free-solid-svg-icons'
import { useAuth } from '@/context/AuthContext'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-browser'
import { faBell } from '@fortawesome/free-solid-svg-icons'

const settingsLinks = [
  { label: 'Category', href: '/settings/categories', icon: faGear },
  { label: 'Users', href: '/settings/users', icon: faUsers },
]

export default function Navbar() {
  const pathname = usePathname()
  const router = useRouter()
  const { appUser, signOut } = useAuth()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [isDesktop, setIsDesktop] = useState(false)
  const [activityCount, setActivityCount] = useState(0)
  const isAdmin = appUser?.role === 'admin'
  const supabase = createClient()

  useEffect(() => {
    if (!appUser) return
    const today = new Date().toISOString().slice(0, 10)
    supabase
      .from('user_activities')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', today)
      .then(({ count }) => setActivityCount(count ?? 0))
  }, [appUser])

  // Detect desktop
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)')
    setIsDesktop(mq.matches)
    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  // Close drawer on route change — mobile only
  useEffect(() => {
    if (!isDesktop) setDrawerOpen(false)
  }, [pathname, isDesktop])

  // Prevent body scroll when drawer is open — mobile only
  useEffect(() => {
    document.body.style.overflow = (drawerOpen && !isDesktop) ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [drawerOpen, isDesktop])

  // Shift main content on desktop
  useEffect(() => {
    const main = document.getElementById('main-content')
    if (!main) return
    if (drawerOpen && isDesktop) {
      main.style.marginLeft = '18rem' // w-72 = 288px
      main.style.transition = 'margin-left 0.3s ease-in-out'
    } else {
      main.style.marginLeft = '0'
      main.style.transition = 'margin-left 0.3s ease-in-out'
    }
  }, [drawerOpen, isDesktop])

  const linkClass = (active: boolean) =>
    `px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
      active ? 'bg-white/20 text-white' : 'text-white/90 hover:bg-white/10 hover:text-white'
    }`

  const isSettingsActive = pathname.startsWith('/settings')
  const isProdukActive = pathname.startsWith('/products')

  if (!appUser) return null

  return (
    <>
      <nav className="bg-[#121358] fixed top-0 left-0 right-0 z-50 h-14">
        <div className="max-w-4xl mx-auto px-4 h-full flex items-center">
          {/* Kebab — admin only, leftmost */}
          {isAdmin && (
            <button
              onClick={() => setDrawerOpen(true)}
              className={`mr-2 ${linkClass(isSettingsActive && !drawerOpen)} px-2`}
              title="Menu"
            >
              <FontAwesomeIcon icon={faBars} className="w-4 h-4" />
            </button>
          )}


          {/* Nav links — right aligned */}
          <div className="flex flex-1 items-center justify-end gap-1">
            {/* Produk link */}
            <Link href="/products/list" className={linkClass(isProdukActive)}>
              Produk
            </Link>

            {/* Transaksi link */}
            <Link href="/transaksi" className={linkClass(pathname.startsWith('/transaksi'))}>
              Transaksi
            </Link>

            {/* Activity link */}
            <Link href="/activity" className={`${linkClass(pathname.startsWith('/activity'))} relative`}>
              <FontAwesomeIcon icon={faBell} className="w-4 h-4" />
              {activityCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                  {activityCount > 99 ? '99+' : activityCount}
                </span>
              )}
            </Link>

            {/* Logout — non-admin only */}
            {!isAdmin && (
              <button
                onClick={async () => { await signOut(); router.push('/login') }}
                className="px-3 py-1.5 rounded-md text-white/90 hover:bg-white/10 hover:text-white transition-colors"
                title="Keluar"
              >
                <FontAwesomeIcon icon={faRightFromBracket} className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </nav>

      {/* Drawer overlay — mobile only */}
      {drawerOpen && !isDesktop && (
        <div
          className="fixed inset-0 z-40 bg-black/40"
          onClick={() => setDrawerOpen(false)}
        />
      )}

      {/* Drawer panel — slides in from left */}
      <div
        className={`fixed top-0 left-0 h-full w-72 bg-white z-50 shadow-2xl flex flex-col transition-transform duration-300 ease-in-out ${
          drawerOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Drawer header */}
        <div className="flex items-center justify-between px-5 py-4 bg-[#121358]">
          <div>
            <p className="text-white font-bold text-base tracking-wide">TB NURBETI</p>
            {appUser && (
              <div className="flex items-center gap-1.5 mt-1">
                <span className="text-white/70 text-xs">{appUser.name}</span>
                <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full ${isAdmin ? 'bg-blue-400/30 text-[#a8aaee]' : 'bg-white/10 text-white/60'}`}>
                  {appUser.role}
                </span>
              </div>
            )}
          </div>
          <button
            onClick={() => setDrawerOpen(false)}
            className="w-8 h-8 flex items-center justify-center rounded-full text-white/70 hover:text-white hover:bg-white/10 transition"
          >
            <FontAwesomeIcon icon={faXmark} className="w-4 h-4" />
          </button>
        </div>

        {/* Drawer body */}
        <div className="flex-1 overflow-y-auto py-4 space-y-4">

          {/* Laporan */}
          <div>
            <p className="px-5 pb-2 text-[10px] font-semibold text-gray-400 uppercase tracking-widest">Laporan</p>
            <Link
              href="/laporan-penjualan"
              className={`flex items-center gap-3 px-5 py-3 text-sm transition ${
                pathname.startsWith('/laporan-penjualan')
                  ? 'text-[#121358] bg-[#121358]/8 font-semibold'
                  : 'text-gray-700 hover:bg-gray-50'
              }`}
            >
              <FontAwesomeIcon icon={faChartBar} className="w-4 h-4 text-gray-400" />
              Laporan
            </Link>
          </div>

          {/* Purchasing */}
          <div>
            <p className="px-5 pb-2 text-[10px] font-semibold text-gray-400 uppercase tracking-widest">Purchasing</p>
            <Link
              href="/purchasing"
              className={`flex items-center gap-3 px-5 py-3 text-sm transition ${
                pathname.startsWith('/purchasing')
                  ? 'text-[#121358] bg-[#121358]/8 font-semibold'
                  : 'text-gray-700 hover:bg-gray-50'
              }`}
            >
              <FontAwesomeIcon icon={faCartShopping} className="w-4 h-4 text-gray-400" />
              Purchasing
            </Link>
            <Link
              href="/bills"
              className={`flex items-center gap-3 px-5 py-3 text-sm transition ${
                pathname.startsWith('/bills')
                  ? 'text-[#121358] bg-[#121358]/8 font-semibold'
                  : 'text-gray-700 hover:bg-gray-50'
              }`}
            >
              <FontAwesomeIcon icon={faFileInvoiceDollar} className="w-4 h-4 text-gray-400" />
              Tagihan Dagang
            </Link>
          </div>

          {/* Finance */}
          <div>
            <p className="px-5 pb-2 text-[10px] font-semibold text-gray-400 uppercase tracking-widest">Finance</p>
            <Link
              href="/debt-loan"
              className={`flex items-center gap-3 px-5 py-3 text-sm transition ${
                pathname.startsWith('/debt-loan')
                  ? 'text-[#121358] bg-[#121358]/8 font-semibold'
                  : 'text-gray-700 hover:bg-gray-50'
              }`}
            >
              <FontAwesomeIcon icon={faHandHoldingDollar} className="w-4 h-4 text-gray-400" />
              Debt & Loan
            </Link>
            <Link
              href="/tagihan-giro"
              className={`flex items-center gap-3 px-5 py-3 text-sm transition ${
                pathname.startsWith('/tagihan-giro')
                  ? 'text-[#121358] bg-[#121358]/8 font-semibold'
                  : 'text-gray-700 hover:bg-gray-50'
              }`}
            >
              <FontAwesomeIcon icon={faMoneyCheckDollar} className="w-4 h-4 text-gray-400" />
              Giro
            </Link>
            <Link
              href="/tagihan-debt-loan"
              className={`flex items-center gap-3 px-5 py-3 text-sm transition ${
                pathname.startsWith('/tagihan-debt-loan')
                  ? 'text-[#121358] bg-[#121358]/8 font-semibold'
                  : 'text-gray-700 hover:bg-gray-50'
              }`}
            >
              <FontAwesomeIcon icon={faReceipt} className="w-4 h-4 text-gray-400" />
              Tagihan Debt & Loan
            </Link>
            <Link
              href="/piutang"
              className={`flex items-center gap-3 px-5 py-3 text-sm transition ${
                pathname.startsWith('/piutang')
                  ? 'text-[#121358] bg-[#121358]/8 font-semibold'
                  : 'text-gray-700 hover:bg-gray-50'
              }`}
            >
              <FontAwesomeIcon icon={faArrowTrendUp} className="w-4 h-4 text-gray-400" />
              Piutang
            </Link>
          </div>

          {/* Operational */}
          <div>
            <p className="px-5 pb-2 text-[10px] font-semibold text-gray-400 uppercase tracking-widest">Operational</p>
            <Link
              href="/gaji-karyawan"
              className={`flex items-center gap-3 px-5 py-3 text-sm transition ${
                pathname.startsWith('/gaji-karyawan')
                  ? 'text-[#121358] bg-[#121358]/8 font-semibold'
                  : 'text-gray-700 hover:bg-gray-50'
              }`}
            >
                <FontAwesomeIcon icon={faMoneyBillWave} className="w-4 h-4 text-gray-400" />
              Gaji Karyawan
            </Link>
          </div>

          {/* Masterdata */}
          <div>
            <p className="px-5 pb-2 text-[10px] font-semibold text-gray-400 uppercase tracking-widest">Masterdata</p>
            <Link
              href="/customers"
              className={`flex items-center gap-3 px-5 py-3 text-sm transition ${
                pathname.startsWith('/customers')
                  ? 'text-[#121358] bg-[#121358]/8 font-semibold'
                  : 'text-gray-700 hover:bg-gray-50'
              }`}
            >
                <FontAwesomeIcon icon={faUserGroup} className="w-4 h-4 text-gray-400" />
              Customer
            </Link>
            <Link
              href="/karyawan"
              className={`flex items-center gap-3 px-5 py-3 text-sm transition ${
                pathname.startsWith('/karyawan')
                  ? 'text-[#121358] bg-[#121358]/8 font-semibold'
                  : 'text-gray-700 hover:bg-gray-50'
              }`}
            >
              <FontAwesomeIcon icon={faIdCard} className="w-4 h-4 text-gray-400" />
              Karyawan
            </Link>
            <Link
              href="/settings/suppliers"
              className={`flex items-center gap-3 px-5 py-3 text-sm transition ${
                pathname.startsWith('/settings/suppliers')
                  ? 'text-[#121358] bg-[#121358]/8 font-semibold'
                  : 'text-gray-700 hover:bg-gray-50'
              }`}
            >
              <FontAwesomeIcon icon={faTruck} className="w-4 h-4 text-gray-400" />
              Supplier
            </Link>
          </div>

          {/* Settings */}
          <div>
            <p className="px-5 pb-2 text-[10px] font-semibold text-gray-400 uppercase tracking-widest">Settings</p>
              {settingsLinks.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-5 py-3 text-sm transition ${
                  pathname === item.href
                    ? 'text-[#121358] bg-[#121358]/8 font-semibold'
                    : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                <FontAwesomeIcon icon={item.icon} className="w-4 h-4 text-gray-400" />
                {item.label}
              </Link>
            ))}
          </div>
        </div>

        {/* Logout */}
        <div className="border-t border-gray-100 px-5 py-4">
          <button
            onClick={async () => { setDrawerOpen(false); await signOut(); router.push('/login') }}
            className="flex items-center gap-3 w-full text-sm text-red-500 hover:text-red-600 transition"
          >
            <FontAwesomeIcon icon={faRightFromBracket} className="w-4 h-4" />
            Keluar
          </button>
        </div>
      </div>
    </>
  )
}
