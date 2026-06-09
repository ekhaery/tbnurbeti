'use client'

import { useState } from 'react'

type Tab = 'penjualan' | 'operasional'

export default function LaporanPage() {
  const [tab, setTab] = useState<Tab>('penjualan')

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="px-4 pt-3 pb-10 max-w-xl mx-auto space-y-4">

        <div>
          <h2 className="text-lg font-bold text-gray-800">Laporan</h2>
          <p className="text-xs text-gray-500 mt-0.5">Laporan penjualan dan operasional.</p>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-2xl shadow-sm p-1 flex gap-1">
          {([['penjualan', 'Laporan Penjualan'], ['operasional', 'Laporan Operasional']] as [Tab, string][]).map(([t, label]) => (
            <button key={t} onClick={() => setTab(t)}
              className={`flex-1 text-center text-sm font-medium py-2 rounded-xl transition-colors ${tab === t ? 'bg-slate-800 text-white' : 'bg-slate-200 sm:bg-transparent text-slate-500 sm:hover:bg-slate-200'}`}>
              {label}
            </button>
          ))}
        </div>

        {tab === 'penjualan' && (
          <div className="text-center text-sm text-gray-400 py-10">Laporan Penjualan sedang dalam pengembangan.</div>
        )}

        {tab === 'operasional' && (
          <div className="text-center text-sm text-gray-400 py-10">Laporan Operasional sedang dalam pengembangan.</div>
        )}

      </div>
    </div>
  )
}
