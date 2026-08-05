'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase-browser'
import WarehouseTabs from '@/lib/WarehouseTabs'

type Warehouse = { id: number; name: string; code: string }
type Product = { id: number; name: string; categories: { name: string } | null }

export default function WarehouseInventoryPage() {
  const supabase = createClient()

  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [selectedWarehouseId, setSelectedWarehouseId] = useState('')
  const [products, setProducts] = useState<Product[]>([])
  const [linkedProductIds, setLinkedProductIds] = useState<number[]>([])
  const [originalLinkedIds, setOriginalLinkedIds] = useState<number[]>([])
  const [search, setSearch] = useState('')
  const [loadingProducts, setLoadingProducts] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    supabase.from('warehouses').select('id, name, code').eq('is_active', true).order('name')
      .then(({ data }: { data: Warehouse[] | null }) => setWarehouses(data ?? []))

    const fetchAllProducts = async () => {
      const chunkSize = 1000
      let from = 0
      let all: Product[] = []
      while (true) {
        const { data, error } = await supabase
          .from('products')
          .select('id, name, categories(name)')
          .eq('is_deleted', false)
          .eq('is_discontinued', false)
          .order('name')
          .range(from, from + chunkSize - 1)
        if (error || !data || data.length === 0) break
        all = [...all, ...(data as Product[])]
        if (data.length < chunkSize) break
        from += chunkSize
      }
      setProducts(all)
    }
    fetchAllProducts()
  }, [])

  useEffect(() => {
    if (!selectedWarehouseId) {
      setLinkedProductIds([])
      setOriginalLinkedIds([])
      return
    }
    setLoadingProducts(true)
    supabase
      .from('product_warehouse')
      .select('product_id')
      .eq('warehouse_id', Number(selectedWarehouseId))
      .then(({ data }: { data: { product_id: number }[] | null }) => {
        const ids = (data ?? []).map(r => r.product_id)
        setLinkedProductIds(ids)
        setOriginalLinkedIds(ids)
        setLoadingProducts(false)
      })
  }, [selectedWarehouseId])

  const handleSave = async () => {
    if (!selectedWarehouseId) return
    setSaving(true)
    setError(null)
    setSaved(false)

    const toAdd = linkedProductIds.filter(id => !originalLinkedIds.includes(id))
    const toRemove = originalLinkedIds.filter(id => !linkedProductIds.includes(id))

    if (toRemove.length > 0) {
      await supabase.from('product_warehouse')
        .delete()
        .eq('warehouse_id', Number(selectedWarehouseId))
        .in('product_id', toRemove)
    }
    if (toAdd.length > 0) {
      await supabase.from('product_warehouse').insert(
        toAdd.map(pid => ({ warehouse_id: Number(selectedWarehouseId), product_id: pid, stock: 0 }))
      )
    }

    setOriginalLinkedIds([...linkedProductIds])
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const filtered = products.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase())
  )

  const isDirty = JSON.stringify([...linkedProductIds].sort()) !== JSON.stringify([...originalLinkedIds].sort())

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="px-4 pt-3 pb-10 max-w-xl mx-auto space-y-4">
        <WarehouseTabs />

        <div>
          <h2 className="text-lg font-bold text-gray-800">Set Up Inventory</h2>
          <p className="text-xs text-gray-500 mt-0.5">Pilih warehouse dan tentukan produk yang tersedia di dalamnya.</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-4">
          <label className="block text-xs text-gray-500 mb-1">Warehouse</label>
          <select
            value={selectedWarehouseId}
            onChange={e => { setSelectedWarehouseId(e.target.value); setSearch('') }}
            className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-[#121358]"
          >
            <option value="">-- Pilih Warehouse --</option>
            {warehouses.map(w => (
              <option key={w.id} value={w.id}>{w.name} ({w.code})</option>
            ))}
          </select>
        </div>

        {selectedWarehouseId && (
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
              <p className="text-xs font-semibold text-gray-700">{linkedProductIds.length} produk dipilih</p>
              <div className="flex gap-3">
                <button type="button" onClick={() => setLinkedProductIds(products.map(p => p.id))} className="text-[10px] text-[#121358] font-semibold">Pilih Semua</button>
                <button type="button" onClick={() => setLinkedProductIds([])} className="text-[10px] text-gray-400">Hapus Semua</button>
              </div>
            </div>

            <div className="px-4 py-2 border-b border-gray-100">
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Cari produk..."
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs bg-gray-50 focus:outline-none focus:ring-2 focus:ring-[#121358]"
              />
            </div>

            {loadingProducts ? (
              <p className="text-xs text-gray-400 text-center py-8">Memuat...</p>
            ) : (
              <div className="divide-y divide-gray-100 max-h-96 overflow-y-auto">
                {filtered.map(p => (
                  <label key={p.id} className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50">
                    <input
                      type="checkbox"
                      checked={linkedProductIds.includes(p.id)}
                      onChange={e => {
                        if (e.target.checked) setLinkedProductIds(prev => [...prev, p.id])
                        else setLinkedProductIds(prev => prev.filter(id => id !== p.id))
                      }}
                      className="w-4 h-4 accent-[#121358] flex-shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-700 truncate">{p.name}</p>
                      {p.categories?.name && <p className="text-[10px] text-gray-400">{p.categories.name}</p>}
                    </div>
                  </label>
                ))}
                {filtered.length === 0 && (
                  <p className="text-xs text-gray-400 text-center py-8">Tidak ada produk ditemukan.</p>
                )}
              </div>
            )}

            <div className="px-4 py-3 border-t border-gray-100 space-y-2">
              {error && <p className="text-xs text-red-500">{error}</p>}
              {saved && <p className="text-xs text-green-600">✓ Perubahan tersimpan.</p>}
              <button
                onClick={handleSave}
                disabled={saving || !isDirty}
                className="w-full bg-[#121358] text-white font-semibold py-3 rounded-xl text-sm disabled:opacity-40 transition"
              >
                {saving ? 'Menyimpan...' : 'Simpan'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
