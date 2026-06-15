'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'

const tabs = [
  { label: 'Daftar Produk', href: '/products/list' },
  { label: 'Buat Produk', href: '/products/bulk-input' },
]

export default function ProductTabs() {
  const pathname = usePathname()
  const { appUser } = useAuth()
  const isAdmin = appUser?.role === 'admin'

  const visibleTabs = isAdmin
    ? [...tabs, { label: 'Setting', href: '/products/settings' }]
    : tabs

  return (
    <div className="bg-white rounded-2xl shadow-sm p-1 flex gap-1">
      {visibleTabs.map((tab) => {
        const active = pathname === tab.href
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`flex-1 text-center text-sm font-medium py-2 rounded-xl transition-colors ${
              active
                ? 'bg-slate-800 text-white'
                : 'text-slate-500 hover:bg-slate-100'
            }`}
          >
            {tab.label}
          </Link>
        )
      })}
    </div>
  )
}
