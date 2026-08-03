'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const tabs = [
  { label: 'Add New Warehouse', href: '/settings/warehouses' },
  { label: 'Set Up Inventory', href: '/settings/warehouses/inventory' },
]

export default function WarehouseTabs() {
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
