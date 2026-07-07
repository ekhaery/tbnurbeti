'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase-browser'
import { localDateStr } from '@/lib/date'

type InflowRow = {
  id: number
  date: string
  code: string
  transaction_items: { price_sold: number }[]
}

type OutflowRow = {
  id: number
  date: string
  amount: number
  description: string | null
  category: string | null
  purchasing_id: number | null
  debt_loan_id: number | null
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
  const [inflowPage, setInflowPage] = useState(1)
  const [outflowPage, setOutflowPage] = useState(1)
  const PAGE_SIZE = 30

  useEffect(() => {
    setInflowPage(1)
    setOutflowPage(1)
    async function fetchData() {
      setLoading(true)
      const [{ data: trx }, { data: out }] = await Promise.all([
        supabase
          .from('transactions')
          .select('id, date, code, transaction_items(price_sold)')
          .gte('date', dateFrom)
          .lte('date', dateTo)
          .order('date', { ascending: false }),
        supabase
          .from('outflow')
          .select('id, date, amount, description, category, purchasing_id, debt_loan_id')
          .gte('date', dateFrom)
          .lte('date', dateTo)
          .order('date', { ascending: false }),
      ])
      setInflows((trx as InflowRow[]) ?? [])
      setOutflows((out as OutflowRow[]) ?? [])
      setLoading(false)
    }
    fetchData()
  }, [dateFrom, dateTo])

  const totalIn = inflows.reduce((sum, r) => sum + r.transaction_items.reduce((s, i) => s + (i.price_sold ?? 0), 0), 0)
  const totalOut = outflows.reduce((sum, r) => sum + (r.amount ?? 0), 0)
  const net = totalIn - totalOut

  function getOutflowLabel(r: OutflowRow) {
    if (r.purchasing_id !== null) return 'Purchasing'
    if (r.debt_loan_id !== null) return 'Hutang'
    return r.category ?? 'Operasional'
  }

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

        {/* Summary */}
        {!loading && (
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-white rounded-2xl shadow-sm px-3 py-3 text-center">
              <p className="text-[10px] text-gray-400 mb-1">Pemasukan</p>
              <p className="text-sm font-bold text-green-600">Rp {fmt(totalIn)}</p>
            </div>
            <div className="bg-white rounded-2xl shadow-sm px-3 py-3 text-center">
              <p className="text-[10px] text-gray-400 mb-1">Pengeluaran</p>
              <p className="text-sm font-bold text-red-500">Rp {fmt(totalOut)}</p>
            </div>
            <div className="rounded-2xl shadow-sm px-3 py-3 text-center" style={{ backgroundColor: '#121358' }}>
              <p className="text-[10px] text-white/60 mb-1">Selisih</p>
              <p className={`text-sm font-bold ${net >= 0 ? 'text-[#ffc908]' : 'text-red-400'}`}>Rp {fmt(net)}</p>
            </div>
          </div>
        )}

        {loading ? (
          <div className="text-center text-sm text-gray-400 py-10">Memuat data...</div>
        ) : (
          <>
            {/* Pemasukan */}
            {(() => {
              const totalPages = Math.ceil(inflows.length / PAGE_SIZE)
              const paged = inflows.slice((inflowPage - 1) * PAGE_SIZE, inflowPage * PAGE_SIZE)
              return (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide px-1">Pemasukan ({inflows.length})</p>
                  {inflows.length === 0 ? (
                    <div className="text-center text-sm text-gray-400 py-4">Tidak ada pemasukan.</div>
                  ) : paged.map(r => {
                    const amount = r.transaction_items.reduce((s, i) => s + (i.price_sold ?? 0), 0)
                    return (
                      <div key={r.id} className="bg-white rounded-2xl shadow-sm px-4 py-3 flex justify-between items-center">
                        <div>
                          <p className="text-sm font-semibold text-gray-800">{r.code}</p>
                          <p className="text-xs text-gray-400">{r.date}</p>
                        </div>
                        <p className="text-sm font-bold text-green-600">+ Rp {fmt(amount)}</p>
                      </div>
                    )
                  })}
                  {totalPages > 1 && (
                    <div className="flex items-center justify-center gap-3 pt-1">
                      <button onClick={() => setInflowPage(p => Math.max(1, p - 1))} disabled={inflowPage === 1}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-white shadow-sm text-gray-600 disabled:opacity-40">← Prev</button>
                      <span className="text-xs text-gray-500">{inflowPage} / {totalPages}</span>
                      <button onClick={() => setInflowPage(p => Math.min(totalPages, p + 1))} disabled={inflowPage === totalPages}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-white shadow-sm text-gray-600 disabled:opacity-40">Next →</button>
                    </div>
                  )}
                </div>
              )
            })()}

            {/* Pengeluaran */}
            {(() => {
              const totalPages = Math.ceil(outflows.length / PAGE_SIZE)
              const paged = outflows.slice((outflowPage - 1) * PAGE_SIZE, outflowPage * PAGE_SIZE)
              return (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide px-1">Pengeluaran ({outflows.length})</p>
                  {outflows.length === 0 ? (
                    <div className="text-center text-sm text-gray-400 py-4">Tidak ada pengeluaran.</div>
                  ) : paged.map(r => (
                    <div key={r.id} className="bg-white rounded-2xl shadow-sm px-4 py-3 flex justify-between items-start">
                      <div>
                        <p className="text-sm font-semibold text-gray-800">{r.description ?? getOutflowLabel(r)}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <p className="text-xs text-gray-400">{r.date}</p>
                          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-[#121358]/10 text-[#121358]">{getOutflowLabel(r)}</span>
                        </div>
                      </div>
                      <p className="text-sm font-bold text-red-500">- Rp {fmt(r.amount)}</p>
                    </div>
                  ))}
                  {totalPages > 1 && (
                    <div className="flex items-center justify-center gap-3 pt-1">
                      <button onClick={() => setOutflowPage(p => Math.max(1, p - 1))} disabled={outflowPage === 1}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-white shadow-sm text-gray-600 disabled:opacity-40">← Prev</button>
                      <span className="text-xs text-gray-500">{outflowPage} / {totalPages}</span>
                      <button onClick={() => setOutflowPage(p => Math.min(totalPages, p + 1))} disabled={outflowPage === totalPages}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-white shadow-sm text-gray-600 disabled:opacity-40">Next →</button>
                    </div>
                  )}
                </div>
              )
            })()}
          </>
        )}

      </div>
    </div>
  )
}
