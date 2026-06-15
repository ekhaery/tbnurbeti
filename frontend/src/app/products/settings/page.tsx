'use client'

import { useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { useRouter } from 'next/navigation'
import ProductTabs from '@/lib/ProductTabs'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faXmark } from '@fortawesome/free-solid-svg-icons'

type NoStockProduct = { name: string; base_price: number; price: number }
const fmt = (n: number) => n.toLocaleString('id-ID')

export default function ProductSettingsPage() {
  const { appUser, loading } = useAuth()
  const router = useRouter()

  const [noStockProducts, setNoStockProducts] = useState<NoStockProduct[] | null>(null)
  const [loadingNoStock, setLoadingNoStock] = useState(false)
  const [noStockError, setNoStockError] = useState<string | null>(null)

  const handleFetchNoStock = async () => {
    setLoadingNoStock(true)
    setNoStockError(null)
    const res = await fetch('/api/products-no-stock')
    const json = await res.json()
    setLoadingNoStock(false)
    if (res.ok) setNoStockProducts(json.products)
    else setNoStockError(json.error ?? 'Gagal.')
  }

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

        {/* Lihat Daftar Produk Tanpa Stock Batches */}
        <div className="bg-white rounded-xl shadow-sm p-4 space-y-3">
          <div>
            <p className="text-sm font-semibold text-gray-800">Lihat Daftar Produk Tanpa Stock Batches</p>
            <p className="text-xs text-gray-500 mt-0.5">Produk dengan harga beli = 0 dan belum memiliki data stok. Update base_price dan klik Setting &gt; Trigger Stok untuk membuat data produk bisa dibeli.</p>
          </div>
          {noStockError && <p className="text-xs font-semibold text-red-500">⚠️ {noStockError}</p>}
          <button onClick={handleFetchNoStock} disabled={loadingNoStock}
            className="text-sm font-semibold px-5 py-2.5 rounded-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white transition shadow-sm">
            {loadingNoStock ? 'Memuat...' : 'Lihat Produk'}
          </button>
          {noStockProducts !== null && (
            <div className="mt-2">
              <p className="text-xs text-gray-500 mb-2">{noStockProducts.length} produk ditemukan</p>
              {noStockProducts.length > 0 && (
                <div className="max-h-72 overflow-y-auto border border-gray-100 rounded-xl divide-y divide-gray-100">
                  {noStockProducts.map((p, i) => (
                    <div key={i} className="flex items-center justify-between px-4 py-2.5 gap-3">
                      <p className="text-sm text-gray-700 flex-1 min-w-0 truncate">{p.name}</p>
                      <p className="text-xs text-gray-400 shrink-0">Rp {fmt(p.price)}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
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
