'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const tabs = [
  { label: 'Buat Transaksi', href: '/transaksi/buat' },
  { label: 'Riwayat', href: '/transaksi/riwayat' },
]

export default function TransaksiTabs() {
  const pathname = usePathname()

  return (
    <div className="bg-white rounded-2xl shadow-sm p-1 flex gap-1">
      {tabs.map((tab) => {
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
