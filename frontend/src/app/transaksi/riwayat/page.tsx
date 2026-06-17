'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase-browser'
import TransaksiTabs from '@/lib/TransaksiTabs'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faChevronDown, faChevronUp, faChevronLeft, faChevronRight } from '@fortawesome/free-solid-svg-icons'
import { useAuth } from '@/context/AuthContext'
import DateRangeFilter from '@/components/DateRangeFilter'

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
  is_initial_transformation: boolean
  users: { name: string } | null
  transaction_items: TransactionItem[]
}

const fmt = (n: number) => n.toLocaleString('id-ID')
const PAGE_SIZE = 10

const now = new Date()
const defaultFrom = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
const defaultTo = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`

export default function RiwayatTransaksiPage() {
  const supabase = createClient()
  const { appUser } = useAuth()
  const isAdmin = appUser?.role === 'admin'

  const [dateFrom, setDateFrom] = useState(defaultFrom)
  const [dateTo, setDateTo] = useState(defaultTo)
  const [page, setPage] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const [list, setList] = useState<Transaction[]>([])
  const [fetching, setFetching] = useState(true)
  const [expanded, setExpanded] = useState<number | null>(null)

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))

  const fetchData = async (p: number, from: string, to: string) => {
    setFetching(true)
    setExpanded(null)
    const rangeFrom = (p - 1) * PAGE_SIZE
    const rangeTo = rangeFrom + PAGE_SIZE - 1

    const [{ count }, { data }] = await Promise.all([
      supabase
        .from('transactions')
        .select('id', { count: 'exact', head: true })
        .gte('date', from)
        .lte('date', to),
      supabase
        .from('transactions')
        .select('id, code, date, notes, is_initial_transformation, users(name), transaction_items(id, qty, price_sold, cogs, profit, products(name))')
        .gte('date', from)
        .lte('date', to)
        .order('date', { ascending: false })
        .order('id', { ascending: false })
        .range(rangeFrom, rangeTo),
    ])

    setTotalCount(count ?? 0)
    setList((data as Transaction[]) ?? [])
    setFetching(false)
  }

  useEffect(() => { fetchData(page, dateFrom, dateTo) }, [page, dateFrom, dateTo])

  const handleDateChange = (from: string, to: string) => {
    setPage(1)
    setDateFrom(from)
    setDateTo(to)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="px-4 pt-3 pb-10 max-w-xl mx-auto space-y-4">
        <TransaksiTabs />

        <div>
          <h2 className="text-lg font-bold text-gray-800">Riwayat Transaksi</h2>
          <p className="text-xs text-gray-500 mt-0.5">Semua transaksi penjualan.</p>
        </div>

        <DateRangeFilter
          dateFrom={dateFrom} dateTo={dateTo}
          onFromChange={v => handleDateChange(v, dateTo)}
          onToChange={v => handleDateChange(dateFrom, v)}
        />

        {fetching ? (
          <div className="text-center text-sm text-gray-400 py-10">Memuat...</div>
        ) : list.length === 0 ? (
          <div className="text-center text-sm text-gray-400 py-10">Tidak ada transaksi dalam rentang ini.</div>
        ) : (
          <>
            <div className="space-y-3">
              {list.map(trx => {
                const totalRevenue = trx.transaction_items.reduce((s, i) => s + i.price_sold, 0)
                const totalProfit = trx.transaction_items.reduce((s, i) => s + i.profit, 0)
                const isOpen = expanded === trx.id

                return (
                  <div key={trx.id} className="bg-white rounded-xl shadow-sm overflow-hidden">
                    <button
                      onClick={() => setExpanded(isOpen ? null : trx.id)}
                      className="w-full px-4 py-3 flex items-start justify-between gap-3 text-left transition bg-gray-100 hover:bg-gray-200"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="text-xs font-mono font-semibold text-[#121358]">{trx.code}</p>
                          {trx.is_initial_transformation && (
                            <span className="text-[9px] font-bold bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full">INIT</span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {new Date(trx.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                          {trx.users?.name && <span> · {trx.users.name}</span>}
                        </p>
                        {trx.notes && <p className="text-xs text-gray-400 mt-0.5 italic">{trx.notes}</p>}
                      </div>
                      <div className="text-right shrink-0 flex items-start gap-2">
                        <div>
                          <p className="text-sm font-bold text-[#121358]">Rp {fmt(totalRevenue)}</p>
                          {isAdmin && !trx.is_initial_transformation && (
                            <p className={`text-xs font-semibold mt-0.5 ${totalProfit >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                              Profit: Rp {fmt(totalProfit)}
                            </p>
                          )}
                        </div>
                        <FontAwesomeIcon icon={isOpen ? faChevronUp : faChevronDown} className="w-3 h-3 text-gray-400 mt-1 shrink-0" />
                      </div>
                    </button>

                    {isOpen && (
                      <div className="border-t border-gray-100 divide-y divide-gray-50">
                        {trx.transaction_items.map(item => (
                          <div key={item.id} className="px-4 py-2.5 flex items-center justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm text-gray-700 truncate">{item.products?.name ?? '-'}</p>
                              <p className="text-xs text-gray-500 mt-0.5">
                                qty: {item.qty} · Rp {fmt(Math.round(item.price_sold / item.qty))}
                              </p>
                            </div>
                            <p className="text-sm font-semibold text-gray-800 shrink-0">Rp {fmt(item.price_sold)}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between px-1">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="flex items-center gap-1 text-xs font-semibold text-[#121358] disabled:opacity-30 hover:opacity-70 transition"
              >
                <FontAwesomeIcon icon={faChevronLeft} className="w-3 h-3" /> Sebelumnya
              </button>
              <p className="text-xs text-gray-500">
                Halaman <span className="font-semibold text-gray-700">{page}</span> dari <span className="font-semibold text-gray-700">{totalPages}</span>
                <span className="text-gray-400"> ({totalCount} transaksi)</span>
              </p>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="flex items-center gap-1 text-xs font-semibold text-[#121358] disabled:opacity-30 hover:opacity-70 transition"
              >
                Berikutnya <FontAwesomeIcon icon={faChevronRight} className="w-3 h-3" />
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
