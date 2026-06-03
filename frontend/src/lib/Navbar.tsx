'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faEllipsisVertical, faRightFromBracket, faXmark, faGear, faUsers } from '@fortawesome/free-solid-svg-icons'
import { useAuth } from '@/context/AuthContext'
import { useRouter } from 'next/navigation'

const settingsLinks = [
  { label: 'Category', href: '/settings/categories', icon: faGear },
  { label: 'Users', href: '/settings/users', icon: faUsers },
]

export default function Navbar() {
  const pathname = usePathname()
  const router = useRouter()
  const { appUser, signOut } = useAuth()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const isAdmin = appUser?.role === 'admin'

  // Close drawer on route change
  useEffect(() => {
    setDrawerOpen(false)
  }, [pathname])

  // Prevent body scroll when drawer is open
  useEffect(() => {
    document.body.style.overflow = drawerOpen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [drawerOpen])

  const linkClass = (active: boolean) =>
    `px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
      active ? 'bg-white/20 text-white' : 'text-white/90 hover:bg-white/10 hover:text-white'
    }`

  const isSettingsActive = pathname.startsWith('/settings')
  const isProdukActive = pathname.startsWith('/products')

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
              <FontAwesomeIcon icon={faEllipsisVertical} className="w-4 h-4" />
            </button>
          )}

          {/* Brand */}
          <div className="shrink-0 flex flex-col leading-tight">
            <Link
              href="/products/list"
              className="font-bold text-white text-base tracking-wide hover:opacity-75 transition-opacity"
            >
              TB NURBETI
            </Link>
            {appUser && (
              <div className="flex items-center gap-1 mt-0.5">
                <span className="text-white/60 text-[10px]">{appUser.name}</span>
                <span className={`text-[9px] font-semibold px-1 py-0.5 rounded-full ${isAdmin ? 'bg-blue-400/30 text-[#a8aaee]' : 'bg-white/10 text-white/60'}`}>
                  {appUser.role}
                </span>
              </div>
            )}
          </div>

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

      {/* Drawer overlay */}
      {drawerOpen && (
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
            <p className="text-white font-bold text-base">Menu</p>
            {appUser && (
              <p className="text-white/60 text-xs mt-0.5">{appUser.name} · {appUser.role}</p>
            )}
          </div>
          <button
            onClick={() => setDrawerOpen(false)}
            className="w-8 h-8 flex items-center justify-center rounded-full text-white/70 hover:text-white hover:bg-white/10 transition"
          >
            <FontAwesomeIcon icon={faXmark} className="w-4 h-4" />
          </button>
        </div>

        {/* Settings section */}
        <div className="flex-1 overflow-y-auto py-4">
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
