'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase-browser'
import TransaksiTabs from '@/lib/TransaksiTabs'

type TransactionItem = {
  id: number
  qty: number
  price_sold: number
  cogs: number
  profit: number
  products: { name: string } | null
}

type Transaction = {
  id: number
  code: string
  date: string
  notes: string | null
  users: { name: string } | null
  transaction_items: TransactionItem[]
}

const fmt = (n: number) => n.toLocaleString('id-ID')

export default function RiwayatTransaksiPage() {
  const supabase = createClient()
  const [list, setList] = useState<Transaction[]>([])
  const [fetching, setFetching] = useState(true)

  useEffect(() => {
    supabase
      .from('transactions')
      .select(`
        id, code, date, notes,
        users(name),
        transaction_items(id, qty, price_sold, cogs, profit, products(name))
      `)
      .order('date', { ascending: false })
      .order('id', { ascending: false })
      .then(({ data }: { data: Transaction[] | null }) => {
        setList(data ?? [])
        setFetching(false)
      })
  }, [])

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="px-4 pt-3 pb-10 max-w-xl mx-auto space-y-4">
        <TransaksiTabs />

        <div>
          <h2 className="text-lg font-bold text-gray-800">Riwayat Transaksi</h2>
          <p className="text-xs text-gray-400 mt-0.5">Semua transaksi penjualan.</p>
        </div>

        {fetching ? (
          <div className="text-center text-sm text-gray-400 py-10">Memuat...</div>
        ) : list.length === 0 ? (
          <div className="text-center text-sm text-gray-400 py-10">Belum ada transaksi.</div>
        ) : (
          <div className="space-y-3">
            {list.map(trx => {
              const totalRevenue = trx.transaction_items.reduce((s, i) => s + i.price_sold, 0)
              const totalProfit = trx.transaction_items.reduce((s, i) => s + i.profit, 0)

              return (
                <div key={trx.id} className="bg-white rounded-xl shadow-sm overflow-hidden">

                  {/* Card header */}
                  <div className="px-4 py-3 border-b border-gray-100 flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-mono font-semibold text-[#121358]">{trx.code}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {new Date(trx.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                        {trx.users?.name && <span> · {trx.users.name}</span>}
                      </p>
                      {trx.notes && <p className="text-xs text-gray-400 mt-0.5 italic">{trx.notes}</p>}
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-bold text-[#121358]">Rp {fmt(totalRevenue)}</p>
                      <p className={`text-xs font-semibold mt-0.5 ${totalProfit >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                        Profit: Rp {fmt(totalProfit)}
                      </p>
                    </div>
                  </div>

                  {/* Items */}
                  <div className="divide-y divide-gray-50">
                    {trx.transaction_items.map(item => (
                      <div key={item.id} className="px-4 py-2.5 flex items-center justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-gray-700 truncate">{item.products?.name ?? '-'}</p>
                          <p className="text-xs text-gray-400 mt-0.5">
                            qty: {item.qty}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-sm font-semibold text-gray-800">Rp {fmt(item.price_sold)}</p>
                          <p className="text-xs text-gray-400 mt-0.5">
                            COGS: Rp {fmt(item.cogs)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>

                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
