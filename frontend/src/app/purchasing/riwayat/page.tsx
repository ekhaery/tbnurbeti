'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase-browser'
import PurchasingTabs from '@/lib/PurchasingTabs'

type PurchasingItem = {
  id: number
  qty: number
  base_price: number
  products: { name: string } | null
}

type Purchasing = {
  id: number
  code: string
  date: string
  notes: string | null
  period: number
  total: number
  suppliers: { name: string } | null
  purchasing_items: PurchasingItem[]
}

const fmt = (n: number) => n.toLocaleString('id-ID')

export default function RiwayatPurchasingPage() {
  const supabase = createClient()
  const [list, setList] = useState<Purchasing[]>([])
  const [fetching, setFetching] = useState(true)
  const [expanded, setExpanded] = useState<number | null>(null)

  useEffect(() => {
    supabase
      .from('purchasing')
      .select('id, code, date, notes, period, total, suppliers(name), purchasing_items(id, qty, base_price, products(name))')
      .order('date', { ascending: false })
      .then(({ data }: { data: Purchasing[] | null }) => {
        setList(data ?? [])
        setFetching(false)
      })
  }, [])

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="px-4 pt-3 pb-10 max-w-xl mx-auto space-y-4">
        <PurchasingTabs />

        <div>
          <h2 className="text-lg font-bold text-gray-800">Riwayat Purchasing</h2>
          <p className="text-xs text-gray-400 mt-0.5">
            {fetching ? '...' : `${list.length} purchasing`}
          </p>
        </div>

        {fetching ? (
          <div className="text-center text-sm text-gray-400 py-10">Memuat...</div>
        ) : list.length === 0 ? (
          <div className="text-center text-sm text-gray-400 py-10">Belum ada purchasing.</div>
        ) : (
          <div className="space-y-2">
            {list.map(p => {
              const total = p.total
              const isOpen = expanded === p.id
              return (
                <div key={p.id} className="bg-white rounded-xl shadow-sm overflow-hidden">
                  <button
                    onClick={() => setExpanded(isOpen ? null : p.id)}
                    className="w-full px-4 py-3 flex items-center justify-between text-left"
                  >
                    <div>
                      <p className="text-sm font-semibold text-gray-800 font-mono">{p.code}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {p.suppliers?.name ?? '-'} · {new Date(p.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </p>
                      {p.period > 0 && (
                        <span className="inline-block mt-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-600">
                          Bayar {p.period} bln
                        </span>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-[#121358]">Rp {fmt(total)}</p>
                      <p className="text-xs text-gray-400">{p.purchasing_items.length} produk</p>
                    </div>
                  </button>

                  {isOpen && (
                    <div className="border-t border-gray-100">
                      {p.purchasing_items.map(item => (
                        <div key={item.id} className="flex items-center justify-between px-4 py-2.5 border-b border-gray-50 last:border-0">
                          <div>
                            <p className="text-sm text-gray-700">{item.products?.name ?? '-'}</p>
                            <p className="text-xs text-gray-400">Qty: {item.qty}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-xs text-gray-400">@ Rp {fmt(item.base_price)}</p>
                            <p className="text-sm font-semibold text-gray-700">Rp {fmt(item.qty * item.base_price)}</p>
                          </div>
                        </div>
                      ))}
                      {p.notes && (
                        <p className="px-4 py-2 text-xs text-gray-400 italic">Catatan: {p.notes}</p>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
