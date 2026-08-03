'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase-browser'
import { useAuth } from '@/context/AuthContext'
import WarehouseTabs from '@/lib/WarehouseTabs'

type Warehouse = { id: number; name: string; code: string }
type ProductWarehouse = { product_id: number; stock: number; products: { id: number; name: string } | null }

export default function TransferStokPage() {
  const supabase = createClient()
  const { appUser } = useAuth()

  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [fromId, setFromId] = useState<number | ''>('')
  const [toId, setToId] = useState<number | ''>('')
  const [sourceProducts, setSourceProducts] = useState<ProductWarehouse[]>([])
  const [productId, setProductId] = useState<number | ''>('')
  const [qty, setQty] = useState('')
  const [notes, setNotes] = useState('')
  const [loadingProducts, setLoadingProducts] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  useEffect(() => {
    supabase.from('warehouses').select('id, name, code').eq('is_active', true).order('name')
      .then(({ data }: { data: Warehouse[] | null }) => setWarehouses(data ?? []))
  }, [])

  useEffect(() => {
    if (!fromId) { setSourceProducts([]); setProductId(''); return }
    setLoadingProducts(true)
    setProductId('')
    supabase
      .from('product_warehouse')
      .select('product_id, stock, products(id, name)')
      .eq('warehouse_id', fromId)
      .gt('stock', 0)
      .order('product_id')
      .then(({ data }: { data: ProductWarehouse[] | null }) => {
        setSourceProducts(data ?? [])
        setLoadingProducts(false)
      })
  }, [fromId])

  const selectedProduct = sourceProducts.find(p => p.product_id === productId)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(null)

    if (!fromId || !toId) { setError('Pilih warehouse asal dan tujuan.'); return }
    if (fromId === toId) { setError('Warehouse asal dan tujuan tidak boleh sama.'); return }
    if (!productId) { setError('Pilih produk.'); return }
    const qtyNum = parseFloat(qty)
    if (!qtyNum || qtyNum <= 0) { setError('Masukkan qty yang valid.'); return }
    if (selectedProduct && qtyNum > selectedProduct.stock) {
      setError(`Stok di ${warehouses.find(w => w.id === fromId)?.name} hanya ${selectedProduct.stock}.`)
      return
    }

    setSaving(true)

    const [decErr, incErr, insErr] = await Promise.all([
      supabase.rpc('add_to_warehouse_stock', { p_product_id: productId, p_warehouse_id: fromId, p_qty: -qtyNum }),
      supabase.rpc('add_to_warehouse_stock', { p_product_id: productId, p_warehouse_id: toId, p_qty: qtyNum }),
      supabase.from('stock_transfers').insert({
        from_warehouse_id: fromId,
        to_warehouse_id: toId,
        product_id: productId,
        qty: qtyNum,
        notes: notes.trim() || null,
        created_by: appUser?.id ?? null,
      }),
    ]).then(results => results.map(r => r.error))

    setSaving(false)

    if (decErr || incErr || insErr) {
      setError((decErr || incErr || insErr)?.message ?? 'Gagal menyimpan transfer.')
      return
    }

    const fromName = warehouses.find(w => w.id === fromId)?.name
    const toName = warehouses.find(w => w.id === toId)?.name
    const prodName = selectedProduct?.products?.name
    setSuccess(`${qtyNum} ${prodName} dipindah: ${fromName} → ${toName}.`)
    setFromId('')
    setToId('')
    setProductId('')
    setQty('')
    setNotes('')
    setSourceProducts([])
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="px-4 pt-3 pb-10 max-w-xl mx-auto space-y-4">
        <WarehouseTabs />

        <div>
          <h2 className="text-lg font-bold text-gray-800">Transfer Stok</h2>
          <p className="text-xs text-gray-500 mt-0.5">Pindahkan stok antar warehouse.</p>
        </div>

        {success && (
          <div className="p-3 rounded-xl bg-green-50 border border-green-200 text-green-700 text-sm">✅ {success}</div>
        )}
        {error && (
          <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">⚠️ {error}</div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="bg-white rounded-xl shadow-sm p-4 space-y-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Dari Warehouse <span className="text-red-500">*</span></label>
              <select
                value={fromId}
                onChange={e => setFromId(e.target.value ? Number(e.target.value) : '')}
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#121358]"
              >
                <option value="">-- Pilih --</option>
                {warehouses.map(w => (
                  <option key={w.id} value={w.id}>{w.name} ({w.code})</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs text-gray-500 mb-1">Ke Warehouse <span className="text-red-500">*</span></label>
              <select
                value={toId}
                onChange={e => setToId(e.target.value ? Number(e.target.value) : '')}
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#121358]"
              >
                <option value="">-- Pilih --</option>
                {warehouses.filter(w => w.id !== fromId).map(w => (
                  <option key={w.id} value={w.id}>{w.name} ({w.code})</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs text-gray-500 mb-1">Produk <span className="text-red-500">*</span></label>
              {!fromId ? (
                <p className="text-xs text-gray-400 italic">Pilih warehouse asal terlebih dahulu.</p>
              ) : loadingProducts ? (
                <p className="text-xs text-gray-400">Memuat produk...</p>
              ) : sourceProducts.length === 0 ? (
                <p className="text-xs text-gray-400">Tidak ada stok di warehouse ini.</p>
              ) : (
                <select
                  value={productId}
                  onChange={e => setProductId(e.target.value ? Number(e.target.value) : '')}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#121358]"
                >
                  <option value="">-- Pilih Produk --</option>
                  {sourceProducts.map(p => (
                    <option key={p.product_id} value={p.product_id}>
                      {p.products?.name ?? '-'} (stok: {p.stock})
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div>
              <label className="block text-xs text-gray-500 mb-1">
                Qty <span className="text-red-500">*</span>
                {selectedProduct && (
                  <span className="ml-1 text-gray-400">(maks {selectedProduct.stock})</span>
                )}
              </label>
              <input
                type="number"
                value={qty}
                onChange={e => setQty(e.target.value)}
                placeholder="0"
                min="0.01"
                step="any"
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#121358]"
              />
            </div>

            <div>
              <label className="block text-xs text-gray-500 mb-1">Catatan</label>
              <input
                type="text"
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Opsional"
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#121358]"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full bg-[#121358] hover:bg-[#1a1c6e] disabled:bg-[#121358]/40 text-white font-semibold py-3 rounded-xl transition text-sm"
          >
            {saving ? 'Menyimpan...' : 'Transfer Stok'}
          </button>
        </form>
      </div>
    </div>
  )
}
