'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'

const navItems = [
  {
    label: 'Input Produk',
    href: '/products/bulk-input',
    icon: (active: boolean) => (
      <svg xmlns="http://www.w3.org/2000/svg" className={`w-4 h-4 ${active ? 'text-[#121358]' : 'text-gray-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
      </svg>
    ),
  },
  {
    label: 'Daftar Produk',
    href: '/products/list',
    icon: (active: boolean) => (
      <svg xmlns="http://www.w3.org/2000/svg" className={`w-4 h-4 ${active ? 'text-[#121358]' : 'text-gray-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M20 7H4a2 2 0 00-2 2v10a2 2 0 002 2h16a2 2 0 002-2V9a2 2 0 00-2-2z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2" />
      </svg>
    ),
  },
]

const pageTitles: Record<string, string> = {
  '/products/bulk-input': 'Input Produk',
  '/products/list': 'Daftar Produk',
}

export default function TopNav() {
  const pathname = usePathname()
  const router = useRouter()
  const { appUser, signOut } = useAuth()

  if (pathname === '/login') return null

  const isAdmin = appUser?.role === 'admin'
  const pageTitle = pageTitles[pathname] ?? 'Produk'

  return (
    <nav className="fixed top-14 left-0 right-0 bg-white border-b border-gray-200 z-40 shadow-sm">
      {/* Top row: page title, user info, keluar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-100">
        <h1 className="text-sm font-bold text-gray-800">{pageTitle}</h1>
        <div className="flex items-center gap-2">
          {appUser && (
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-gray-500">{appUser.name}</span>
              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${isAdmin ? 'bg-[#121358]/10 text-[#121358]' : 'bg-gray-100 text-gray-500'}`}>
                {appUser.role}
              </span>
            </div>
          )}
          <button
            onClick={async () => { await signOut(); router.push('/login') }}
            className="text-xs text-gray-400 hover:text-red-500 transition ml-1"
          >
            Keluar
          </button>
        </div>
      </div>

      {/* Bottom row: nav links */}
      <div className="flex">
        {navItems.map((item) => {
          const active = pathname === item.href
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-[11px] font-medium transition ${active ? 'text-[#121358] border-b-2 border-[#121358]' : 'text-gray-400 hover:text-gray-600'}`}
            >
              {item.icon(active)}
              {item.label}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
