'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase-browser'
import { localDateStr } from '@/lib/date'
import { useSearchParams } from 'next/navigation'

type Tab = 'purchasing' | 'operasional'

type OutflowRow = {
  id: number
  date: string
  category: string
  purchasing_id: number | null
  debt_loan_id: number | null
  description: string | null
  amount: number
  paid_by: number | null
  purchasing: { supplier_id: number | null; suppliers: { name: string } | null } | null
  debt_loan: { debt_type: string; supplier_id: number | null; suppliers: { name: string } | null } | null
  users: { name: string } | null
}

const fmt = (n: number) => n.toLocaleString('id-ID')

export default function LaporanPengeluaranPage() {
  const supabase = createClient()
  const searchParams = useSearchParams()
  const [tab, setTab] = useState<Tab>('purchasing')
  const [rows, setRows] = useState<OutflowRow[]>([])
  const [loading, setLoading] = useState(true)
  const [dateFrom, setDateFrom] = useState(searchParams.get('from') ?? localDateStr())
  const [dateTo, setDateTo] = useState(searchParams.get('to') ?? localDateStr())
  const [supplierFilter, setSupplierFilter] = useState('')

  useEffect(() => {
    async function fetchData() {
      setLoading(true)
      const { data } = await supabase
        .from('outflow')
        .select(`
          id, date, category, purchasing_id, debt_loan_id, description, amount, paid_by,
          purchasing:purchasing_id ( supplier_id, suppliers:supplier_id ( name ) ),
          debt_loan:debt_loan_id ( debt_type, supplier_id, suppliers:supplier_id ( name ) ),
          users:paid_by ( name )
        `)
        .gte('date', dateFrom)
        .lte('date', dateTo)
        .order('date', { ascending: false })
      setRows((data as OutflowRow[]) ?? [])
      setLoading(false)
    }
    fetchData()
  }, [dateFrom, dateTo])

  function getSupplierName(r: OutflowRow) {
    if (r.purchasing?.suppliers?.name) return r.purchasing.suppliers.name
    if (r.debt_loan?.suppliers?.name) return r.debt_loan.suppliers.name
    return '—'
  }

  function getType(r: OutflowRow) {
    if (r.purchasing_id !== null) return 'Purchasing'
    if (r.debt_loan_id !== null) return r.debt_loan?.debt_type ?? '—'
    return r.category ?? '—'
  }

  const filtered = rows
    .filter(r => tab === 'purchasing' ? r.purchasing_id !== null : r.purchasing_id === null)
    .filter(r => !supplierFilter || getSupplierName(r).toLowerCase().includes(supplierFilter.toLowerCase()))

  const total = filtered.reduce((sum, r) => sum + (r.amount ?? 0), 0)

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="px-4 pt-3 pb-10 max-w-2xl mx-auto space-y-4">

        <div>
          <h2 className="text-lg font-bold text-gray-800">Laporan Pengeluaran</h2>
          <p className="text-xs text-gray-500 mt-0.5">Catatan pengeluaran operasional.</p>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-2xl shadow-sm p-1 flex gap-1">
          {([['purchasing', 'Purchasing'], ['operasional', 'Operasional']] as [Tab, string][]).map(([t, label]) => (
            <button key={t} onClick={() => setTab(t)}
              className={`flex-1 text-center text-sm font-medium py-2 rounded-xl transition-colors ${tab === t ? 'bg-[#121358] text-white' : 'text-gray-500 hover:bg-gray-100'}`}>
              {label}
            </button>
          ))}
        </div>

        {/* Filter card */}
        <div className="rounded-2xl shadow-sm px-4 py-3 space-y-3" style={{ backgroundColor: '#B5BAFF' }}>
          <p className="text-xs font-semibold text-[#121358] uppercase tracking-wide">Filter</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-semibold text-[#121358] mb-1">Dari</label>
              <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                className="w-auto border border-gray-200 bg-white rounded-lg px-2 py-1.5 text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#121358]" />
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-[#121358] mb-1">Sampai</label>
              <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
                className="w-auto border border-gray-200 bg-white rounded-lg px-2 py-1.5 text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#121358]" />
            </div>
          </div>
          {tab === 'purchasing' && (
            <div>
              <label className="block text-[10px] font-semibold text-[#121358] mb-1">Supplier</label>
              <input type="text" value={supplierFilter} onChange={e => setSupplierFilter(e.target.value)}
                placeholder="Cari supplier..."
                className="w-full border border-gray-200 bg-white rounded-lg px-3 py-1.5 text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#121358]" />
            </div>
          )}
        </div>

        {/* Total */}
        <div className="bg-white rounded-2xl shadow-sm px-4 py-3 flex justify-between items-center">
          <span className="text-xs text-gray-500">Total {tab === 'purchasing' ? 'Purchasing' : 'Operasional'}</span>
          <span className="text-sm font-bold text-[#121358]">Rp {fmt(total)}</span>
        </div>

        {/* List */}
        {loading ? (
          <div className="text-center text-sm text-gray-400 py-10">Memuat data...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center text-sm text-gray-400 py-10">Tidak ada data.</div>
        ) : (
          <div className="space-y-2">
            {filtered.map(r => (
              <div key={r.id} className="bg-white rounded-2xl shadow-sm px-4 py-3 space-y-1.5">
                <div className="flex justify-between items-start">
                  <div className="space-y-0.5">
                    <p className="text-sm font-semibold text-gray-800">{getSupplierName(r)}</p>
                    <p className="text-xs text-gray-400">{r.date}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-[#121358]">Rp {fmt(r.amount)}</p>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#121358]/10 text-[#121358]">
                      {getType(r)}
                    </span>
                  </div>
                </div>
                {r.description && (
                  <p className="text-xs text-gray-500">{r.description}</p>
                )}
                {r.users?.name && (
                  <p className="text-[10px] text-gray-400">Oleh: {r.users.name}</p>
                )}
              </div>
            ))}
          </div>
        )}

      </div>
    </div>
  )
}
