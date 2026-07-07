'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase-browser'
import { localDateStr } from '@/lib/date'
import Link from 'next/link'

type InflowRow = {
  id: number
  transaction_items: { price_sold: number; profit: number }[]
}

type OutflowRow = {
  id: number
  amount: number
}

const fmt = (n: number) => n.toLocaleString('id-ID')

const firstOfMonth = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}

export default function ArusKeuanganPage() {
  const supabase = createClient()
  const [dateFrom, setDateFrom] = useState(firstOfMonth())
  const [dateTo, setDateTo] = useState(localDateStr())
  const [inflows, setInflows] = useState<InflowRow[]>([])
  const [outflows, setOutflows] = useState<OutflowRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchData() {
      setLoading(true)
      const [{ data: trx }, { data: out }] = await Promise.all([
        supabase
          .from('transactions')
          .select('id, transaction_items(price_sold, profit)')
          .gte('date', dateFrom)
          .lte('date', dateTo),
        supabase
          .from('outflow')
          .select('id, amount')
          .gte('date', dateFrom)
          .lte('date', dateTo),
      ])
      setInflows((trx as InflowRow[]) ?? [])
      setOutflows((out as OutflowRow[]) ?? [])
      setLoading(false)
    }
    fetchData()
  }, [dateFrom, dateTo])

  const totalIn = inflows.reduce((sum, r) => sum + r.transaction_items.reduce((s, i) => s + (i.price_sold ?? 0), 0), 0)
  const grossProfit = inflows.reduce((sum, r) => sum + r.transaction_items.reduce((s, i) => s + (i.profit ?? 0), 0), 0)
  const totalOut = outflows.reduce((sum, r) => sum + (r.amount ?? 0), 0)
  const net = totalIn - totalOut

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="px-4 pt-3 pb-10 max-w-2xl mx-auto space-y-4">

        <div>
          <h2 className="text-lg font-bold text-gray-800">Arus Keuangan</h2>
          <p className="text-xs text-gray-500 mt-0.5">Pemasukan & pengeluaran dalam periode tertentu.</p>
        </div>

        {/* Filter */}
        <div className="rounded-2xl shadow-sm px-4 py-3 space-y-3" style={{ backgroundColor: '#B5BAFF' }}>
          <p className="text-xs font-semibold text-[#121358] uppercase tracking-wide">Periode</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-semibold text-[#121358] mb-1">Dari</label>
              <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                className="w-auto bg-white border border-gray-200 rounded-lg px-2 py-1.5 text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#121358]" />
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-[#121358] mb-1">Sampai</label>
              <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
                className="w-auto bg-white border border-gray-200 rounded-lg px-2 py-1.5 text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#121358]" />
            </div>
          </div>
        </div>

        {/* Summary cards */}
        {loading ? (
          <div className="text-center text-sm text-gray-400 py-10">Memuat data...</div>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-3">
              <Link href={`/transaksi/riwayat?from=${dateFrom}&to=${dateTo}`}
                className="rounded-2xl shadow-sm px-3 py-3 text-center bg-white hover:bg-green-50 transition">
                <p className="text-[10px] text-gray-400 mb-1">Pemasukan</p>
                <p className="text-sm font-bold text-green-600">Rp {fmt(totalIn)}</p>
                <p className="text-[10px] text-gray-400 mt-1">Gross Profit</p>
                <p className="text-xs font-bold text-green-500">Rp {fmt(grossProfit)}</p>
              </Link>
              <Link href={`/laporan-pengeluaran?from=${dateFrom}&to=${dateTo}`}
                className="rounded-2xl shadow-sm px-3 py-3 text-center bg-white hover:bg-red-50 transition">
                <p className="text-[10px] text-gray-400 mb-1">Pengeluaran</p>
                <p className="text-sm font-bold text-red-500">Rp {fmt(totalOut)}</p>
              </Link>
              <div className="rounded-2xl shadow-sm px-3 py-3 text-center" style={{ backgroundColor: '#121358' }}>
                <p className="text-[10px] text-white/60 mb-1">Selisih</p>
                <p className={`text-sm font-bold ${net >= 0 ? 'text-[#ffc908]' : 'text-red-400'}`}>Rp {fmt(net)}</p>
              </div>
            </div>
          </>
        )}

      </div>
    </div>
  )
}
