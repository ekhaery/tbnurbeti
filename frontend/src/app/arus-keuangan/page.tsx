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
  purchasing_id: number | null
}

type CashOpening = {
  amount: number
} | null

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
  const [kasAwal, setKasAwal] = useState<CashOpening>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchData() {
      setLoading(true)
      const [{ data: trx }, { data: out }, { data: opening }] = await Promise.all([
        supabase
          .from('transactions')
          .select('id, transaction_items(price_sold, profit)')
          .gte('date', dateFrom)
          .lte('date', dateTo),
        supabase
          .from('outflow')
          .select('id, amount, purchasing_id')
          .gte('date', dateFrom)
          .lte('date', dateTo),
        supabase
          .from('cash_openings')
          .select('amount')
          .eq('date', dateFrom)
          .maybeSingle(),
      ])
      setInflows((trx as InflowRow[]) ?? [])
      setOutflows((out as OutflowRow[]) ?? [])
      setKasAwal((opening as CashOpening) ?? null)
      setLoading(false)
    }
    fetchData()
  }, [dateFrom, dateTo])

  const totalIn = inflows.reduce((sum, r) => sum + r.transaction_items.reduce((s, i) => s + (i.price_sold ?? 0), 0), 0)
  const grossProfit = inflows.reduce((sum, r) => sum + r.transaction_items.reduce((s, i) => s + (i.profit ?? 0), 0), 0)
  const totalOut = outflows.reduce((sum, r) => sum + (r.amount ?? 0), 0)
  const totalPurchasing = outflows.filter(r => r.purchasing_id !== null).reduce((sum, r) => sum + (r.amount ?? 0), 0)
  const totalOperasional = outflows.filter(r => r.purchasing_id === null).reduce((sum, r) => sum + (r.amount ?? 0), 0)
  const net = totalIn - totalOut
  const kasAkhir = (kasAwal?.amount ?? 0) + totalIn - totalOut

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

        {/* Kas Awal / Kas Akhir */}
        {!loading && (
          <div className="bg-white rounded-2xl shadow-sm px-4 py-3 flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wide text-gray-500">Kas Awal</p>
              {kasAwal ? (
                <p className="text-sm font-bold text-gray-800">Rp {fmt(kasAwal.amount)}</p>
              ) : (
                <Link href="/arus-kas" className="text-xs text-[#121358] font-semibold hover:underline">Belum diisi →</Link>
              )}
            </div>
            <div className="text-right">
              <p className="text-[10px] font-bold uppercase tracking-wide text-gray-500">Kas Akhir</p>
              <p className="text-sm font-bold text-gray-800">Rp {fmt(kasAkhir)}</p>
            </div>
          </div>
        )}

        {/* Summary cards */}
        {loading ? (
          <div className="text-center text-sm text-gray-400 py-10">Memuat data...</div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-stretch">
              <Link href={`/transaksi/riwayat?from=${dateFrom}&to=${dateTo}`}
                className="rounded-2xl shadow-sm px-3 py-3 text-center bg-white hover:bg-green-50 transition flex flex-col justify-center">
                <p className="text-[10px] font-bold uppercase tracking-wide text-gray-500 mb-1">Pemasukan</p>
                <p className="text-sm font-bold text-green-600">Rp {fmt(totalIn)}</p>
                <div className="border-t border-gray-100 my-2" />
                <p className="text-[10px] font-bold uppercase tracking-wide text-gray-500 mt-1">Gross Profit</p>
                <p className="text-xs font-bold text-green-500">
                  Rp {fmt(grossProfit)}
                  <span className="ml-1 text-[10px] font-normal text-gray-400">
                    ({totalIn > 0 ? ((grossProfit / totalIn) * 100).toFixed(1) : '0'}%)
                  </span>
                </p>
              </Link>
              <Link href={`/laporan-pengeluaran?from=${dateFrom}&to=${dateTo}`}
                className="rounded-2xl shadow-sm px-3 py-3 text-center bg-white hover:bg-red-50 transition col-span-1 flex flex-col justify-center">
                <p className="text-[10px] font-bold uppercase tracking-wide text-gray-500 mb-1">Pengeluaran</p>
                <p className="text-sm font-bold text-red-500">Rp {fmt(totalOut)}</p>
                <div className="mt-2 space-y-0.5">
                  <div className="flex justify-between text-[10px]">
                    <span className="text-gray-400">Purchasing</span>
                    <span className="font-semibold text-gray-600">
                      {totalOut > 0 ? ((totalPurchasing / totalOut) * 100).toFixed(0) : '0'}%
                    </span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-1">
                    <div className="bg-red-400 h-1 rounded-full" style={{ width: totalOut > 0 ? `${(totalPurchasing / totalOut) * 100}%` : '0%' }} />
                  </div>
                  <div className="flex justify-between text-[10px]">
                    <span className="text-gray-400">Operasional</span>
                    <span className="font-semibold text-gray-600">
                      {totalOut > 0 ? ((totalOperasional / totalOut) * 100).toFixed(0) : '0'}%
                    </span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-1">
                    <div className="bg-orange-400 h-1 rounded-full" style={{ width: totalOut > 0 ? `${(totalOperasional / totalOut) * 100}%` : '0%' }} />
                  </div>
                </div>
              </Link>
              <div className="rounded-2xl shadow-sm px-3 py-3 text-center space-y-2" style={{ backgroundColor: '#121358' }}>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wide text-white mb-1">Selisih (net cashflow)</p>
                  <p className={`text-sm font-bold ${net >= 0 ? 'text-[#ffc908]' : 'text-red-400'}`}>Rp {fmt(net)}</p>
                </div>
                <div className="border-t border-white/10 pt-2">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-white mb-1">Net Profit</p>
                  <p className={`text-xs font-bold ${(grossProfit - totalOperasional) >= 0 ? 'text-[#ffc908]' : 'text-red-400'}`}>
                    Rp {fmt(grossProfit - totalOperasional)}
                  </p>
                  <p className="text-[9px] text-white/70 mt-0.5">Gross Profit − Operasional</p>
                </div>
              </div>
            </div>
          </>
        )}

      </div>
    </div>
  )
}
