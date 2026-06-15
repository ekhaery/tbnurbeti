'use client'

import { useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { useRouter } from 'next/navigation'
import ProductTabs from '@/lib/ProductTabs'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faXmark } from '@fortawesome/free-solid-svg-icons'

export default function ProductSettingsPage() {
  const { appUser, loading } = useAuth()
  const router = useRouter()

  const [triggeringStock, setTriggeringStock] = useState(false)
  const [triggerResult, setTriggerResult] = useState<{ count: number; names: string[] } | null>(null)
  const [triggerError, setTriggerError] = useState<string | null>(null)

  const handleTriggerStock = async () => {
    setTriggeringStock(true)
    setTriggerResult(null)
    setTriggerError(null)
    const res = await fetch('/api/trigger-stock', { method: 'POST' })
    const json = await res.json()
    setTriggeringStock(false)
    if (res.ok) setTriggerResult({ count: json.count, names: json.names ?? [] })
    else setTriggerError(json.error ?? 'Gagal.')
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center text-sm text-gray-400">Memuat...</div>
  if (!appUser || appUser.role !== 'admin') { router.push('/products/list'); return null }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="px-4 pt-3 pb-10 max-w-xl mx-auto space-y-4">
        <ProductTabs />

        <div>
          <h2 className="text-lg font-bold text-gray-800">Setting Produk</h2>
          <p className="text-xs text-gray-500 mt-0.5">Pengaturan khusus admin.</p>
        </div>

        {/* Trigger Stock */}
        <div className="bg-white rounded-xl shadow-sm p-4 space-y-3">
          <div>
            <p className="text-sm font-semibold text-gray-800">Trigger Stock</p>
            <p className="text-xs text-gray-500 mt-0.5">Tambahkan opening stock untuk produk yang belum memiliki data stok.</p>
          </div>
          {triggerError && <p className="text-xs font-semibold text-red-500">⚠️ {triggerError}</p>}
          <button onClick={handleTriggerStock} disabled={triggeringStock}
            className="text-sm font-semibold px-5 py-2.5 rounded-full bg-red-600 hover:bg-red-700 disabled:bg-red-300 text-white transition shadow-sm">
            {triggeringStock ? 'Loading...' : 'Trigger Stock'}
          </button>
        </div>
      </div>

      {/* Trigger Stock result popup */}
      {triggerResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-xl overflow-hidden">
            <div className="px-5 py-4 bg-green-600 flex items-center justify-between">
              <p className="text-sm font-bold text-white">Berhasil menambahkan {triggerResult.count} produk</p>
              <button onClick={() => setTriggerResult(null)} className="w-7 h-7 flex items-center justify-center rounded-full bg-white/20 hover:bg-white/30 text-white transition">
                <FontAwesomeIcon icon={faXmark} className="w-3 h-3" />
              </button>
            </div>
            {triggerResult.names.length > 0 ? (
              <div className="max-h-64 overflow-y-auto divide-y divide-gray-100">
                {triggerResult.names.map((name, i) => (
                  <p key={i} className="px-5 py-2 text-sm text-gray-700">{name}</p>
                ))}
              </div>
            ) : (
              <p className="px-5 py-4 text-sm text-gray-400">Tidak ada produk baru yang ditambahkan.</p>
            )}
            <div className="px-5 py-3 border-t border-gray-100">
              <button onClick={() => setTriggerResult(null)} className="w-full py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-500 hover:bg-gray-50 transition">Tutup</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
